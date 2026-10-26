// Pure classifier: (rows, chain snapshot) -> issues per row + run-level issues. No network.
import { parseAddress, h160FallbackAccount, isEthDerived, toSs58 } from './address';
import { parseUnits, formatUnits } from './units';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import type {
  AccountState, ChainSnapshot, CheckResult, CheckedRow, Issue, RawRow, RunIssue, Severity,
} from './types';

export interface CheckOptions {
  mergeDuplicates: boolean;
}

const RANK: Record<Severity, number> = { green: 0, info: 1, amber: 2, red: 3 };
const EMPTY: AccountState = {
  nativeFree: 0n, providers: 0, consumers: 0, sufficients: 0, assetBalance: null, assetStatus: null,
};

export function topupAmount(snap: Pick<ChainSnapshot, 'ed' | 'topupBufferBps'>): bigint {
  return snap.ed + (snap.ed * snap.topupBufferBps) / 10_000n;
}

function worst(issues: Issue[]): Severity {
  return issues.reduce<Severity>((w, i) => (RANK[i.severity] > RANK[w] ? i.severity : w), 'green');
}

/** Rows that cannot be sent (they get excluded from the batch). */
const ROW_BLOCKERS = new Set(['ADDR_INVALID', 'AMOUNT_INVALID', 'BELOW_MIN_BALANCE', 'RECIPIENT_FROZEN']);

/** Step 1: per-row address + amount parsing, no chain state beyond ss58/evmMap/decimals. */
function resolveRow(raw: RawRow, snap: ChainSnapshot): CheckedRow {
  const issues: Issue[] = [];
  const row: CheckedRow = {
    line: raw.line, addressInput: raw.addressInput, amountInput: raw.amountInput,
    issues, severity: 'green', action: 'send',
  };
  const sym = snap.asset.symbol || 'tokens';

  const a = parseAddress(raw.addressInput);
  if (a.kind === 'invalid') {
    issues.push({
      code: 'ADDR_INVALID', severity: 'red',
      message: raw.addressInput ? 'This is not a valid Portaldot or EVM address.' : 'Address is missing.',
      fix: 'Edit this row. It will be skipped.',
      why: a.error,
    });
  } else if (a.kind === 'ss58') {
    row.account = a.accountHex;
    if (a.prefix !== snap.ss58) {
      issues.push({
        code: 'ADDR_WRONG_PREFIX', severity: 'amber',
        message: `This address is written for another network (prefix ${a.prefix}). It's the same account on Portaldot.`,
        fix: `Will send to ${toSs58(a.accountHex!, snap.ss58)}.`,
        why: `SS58 prefix ${a.prefix} re-encoded to prefix ${snap.ss58}. The underlying 32-byte public key is unchanged.`,
      });
    }
  } else {
    const mapped = snap.evmMap[a.h160!];
    row.account = mapped ?? u8aToHex(h160FallbackAccount(a.h160!));
    const resolved = toSs58(row.account, snap.ss58);
    issues.push({
      code: 'ADDR_EVM', severity: 'info',
      message: 'MetaMask (EVM) address. We found its Portaldot account for you.',
      fix: `Will send to ${resolved}.`,
      why: mapped
        ? `Resolved with ReviveApi.account_id(${a.h160}).`
        : `Resolved with the pallet-revive fallback mapping h160 ++ 0xEE×12 (runtime call unavailable).`,
    });
  }
  if (row.account) row.resolved = toSs58(row.account, snap.ss58);
  if (row.account && isEthDerived(hexToU8a(row.account))) {
    issues.push({
      code: 'EVM_VISIBILITY', severity: 'info',
      message: `${sym} will arrive, but MetaMask may not display it. The holder can see it in a Polkadot wallet.`,
      why: 'Assets-pallet balances live in native storage; no ERC-20 view of this asset was found on the EVM side.',
    });
  }

  if (!raw.amountInput) {
    issues.push({ code: 'AMOUNT_INVALID', severity: 'red', message: 'Amount is missing.', fix: 'Edit this row. It will be skipped.' });
  } else {
    try {
      const v = parseUnits(raw.amountInput, snap.asset.decimals);
      if (v === 0n) {
        issues.push({ code: 'AMOUNT_INVALID', severity: 'red', message: 'Amount is zero.', fix: 'Edit this row. It will be skipped.' });
      } else {
        row.amount = v;
      }
    } catch (e) {
      issues.push({
        code: 'AMOUNT_INVALID', severity: 'red',
        message: `"${raw.amountInput}" is not a valid amount for a ${snap.asset.decimals}-decimal token.`,
        fix: 'Edit this row. It will be skipped.', why: (e as Error).message,
      });
    }
  }
  return row;
}

function median(xs: bigint[]): bigint {
  const s = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return s[Math.floor(s.length / 2)];
}

export function checkRows(raws: RawRow[], snap: ChainSnapshot, opts: CheckOptions): CheckResult {
  const rows = raws.map((r) => resolveRow(r, snap));
  const { asset } = snap;
  const sym = asset.symbol || 'tokens';
  const nsym = snap.nativeSymbol;
  const fmt = (v: bigint) => formatUnits(v, asset.decimals);
  const nfmt = (v: bigint) => formatUnits(v, snap.nativeDecimals);

  // Duplicates (by resolved account). The first occurrence is the keeper.
  const firstByAccount = new Map<string, CheckedRow>();
  for (const row of rows) {
    if (!row.account) continue;
    const keeper = firstByAccount.get(row.account);
    if (!keeper) { firstByAccount.set(row.account, row); continue; }
    if (opts.mergeDuplicates && keeper.amount !== undefined && row.amount !== undefined) {
      keeper.amount += row.amount;
      keeper.mergedFrom = [...(keeper.mergedFrom ?? []), row.line];
      row.action = 'merged';
      row.mergedInto = keeper.line;
      row.issues.push({
        code: 'DUPLICATE', severity: 'amber',
        message: `Same wallet as row ${keeper.line}. Amounts are combined into one transfer.`,
        fix: `Merged into row ${keeper.line}.`,
      });
    } else {
      row.action = 'excluded';
      row.issues.push({
        code: 'DUPLICATE', severity: 'amber',
        message: `Same wallet as row ${keeper.line}. This row is skipped.`,
        fix: 'Skipped (turn on "merge duplicates" to combine).',
      });
    }
  }
  for (const k of firstByAccount.values()) {
    if (k.mergedFrom?.length) {
      k.issues.push({
        code: 'DUPLICATE', severity: 'amber',
        message: `Also listed on row ${k.mergedFrom.join(', ')}. Sending the combined ${fmt(k.amount!)} ${sym}.`,
        fix: 'Duplicates merged.',
      });
    }
  }

  // Decimal sanity across valid amounts.
  const amounts = rows.filter((r) => r.amount !== undefined && r.action !== 'merged').map((r) => r.amount!);
  if (amounts.length >= 3) {
    const med = median(amounts);
    const unit = 10n ** BigInt(asset.decimals);
    for (const r of rows) {
      if (r.amount === undefined || r.action === 'merged') continue;
      const others = amounts.filter((x) => x !== r.amount);
      const tooBig = r.amount >= med * 1000n && med > 0n;
      const tooSmall = r.amount < unit && others.length > 0 && others.every((x) => x % unit === 0n);
      if (tooBig || tooSmall) {
        r.issues.push({
          code: 'DECIMAL_SUSPECT', severity: 'amber',
          message: tooBig
            ? `${fmt(r.amount)} ${sym} is over 1,000× the typical amount (${fmt(med)}). Was this meant in whole tokens?`
            : `${fmt(r.amount)} ${sym} is less than one token while every other row is whole. Check the decimals.`,
          fix: 'Will send as written. Edit if this is a mistake.',
          why: `Token has ${asset.decimals} decimals: 1 ${sym} = ${unit} base units.`,
        });
      }
    }
  }

  // Chain-state checks per included row.
  const topup = topupAmount(snap);
  for (const r of rows) {
    if (!r.account || r.amount === undefined || r.action === 'merged' || r.action === 'excluded') continue;
    const st = snap.accounts[r.account] ?? EMPTY;
    const holds = st.assetBalance !== null;
    if (st.assetStatus === 'Frozen' || st.assetStatus === 'Blocked') {
      r.issues.push({
        code: 'RECIPIENT_FROZEN', severity: 'red',
        message: `The issuer has ${st.assetStatus.toLowerCase()} this wallet for ${sym}, so it can't receive it.`,
        fix: 'Skipped.', why: `Assets.Account(${asset.id}, who).status = ${st.assetStatus}`,
      });
      continue;
    }
    if (!holds && r.amount < asset.minBalance) {
      r.issues.push({
        code: 'BELOW_MIN_BALANCE', severity: 'red',
        message: `New holders must receive at least ${fmt(asset.minBalance)} ${sym}. This row sends ${fmt(r.amount)}.`,
        fix: `Raise the amount to ${fmt(asset.minBalance)} or more. Skipped for now.`,
        why: `Asset min_balance = ${asset.minBalance} base units; a transfer creating a new holder below it fails (BelowMinimum).`,
      });
      continue;
    }
    if (!asset.isSufficient && !holds && st.providers === 0) {
      r.issues.push({
        code: 'NO_PROVIDER', severity: 'amber',
        message: `This wallet has no ${nsym}, so it can't hold ${sym} yet. We'll send ${nfmt(topup)} ${nsym} first.`,
        fix: `Top up ${nfmt(topup)} ${nsym}, then send.`,
        why: `${sym} is not a "sufficient" asset, so the recipient needs a native balance (a provider reference) to hold it. Without one the transfer fails with UnavailableConsumer. Top-up = existential deposit ${nfmt(snap.ed)} + buffer.`,
      });
      r.action = 'topup+send';
    }
  }

  for (const r of rows) {
    if (r.action !== 'merged' && r.issues.some((i) => ROW_BLOCKERS.has(i.code))) r.action = 'excluded';
    if (!r.issues.length) r.issues.push({ code: 'OK', severity: 'green', message: 'Ready to send.' });
    r.severity = worst(r.issues);
  }

  // Run-level checks.
  const runIssues: RunIssue[] = [];
  const included = rows.filter((r) => r.action === 'send' || r.action === 'topup+send');
  const totalAsset = included.reduce((s, r) => s + r.amount!, 0n);
  const topups = included.filter((r) => r.action === 'topup+send').length;
  const totalTopup = topup * BigInt(topups);

  if (!asset.exists) {
    runIssues.push({ code: 'ASSET_FROZEN', severity: 'red', blocking: true, message: `Asset ${asset.id} does not exist on this network.` });
  } else if (asset.status !== 'Live') {
    runIssues.push({
      code: 'ASSET_FROZEN', severity: 'red', blocking: true,
      message: `${sym} is ${asset.status.toLowerCase()} by its issuer. No transfers can go through.`,
      why: `Assets.Asset(${asset.id}).status = ${asset.status}`,
    });
  }
  if (snap.sender) {
    const s = snap.sender.state;
    if (s.assetStatus === 'Frozen' || s.assetStatus === 'Blocked') {
      runIssues.push({ code: 'ASSET_FROZEN', severity: 'red', blocking: true, message: `Your ${sym} balance is ${s.assetStatus.toLowerCase()}.` });
    }
    const have = s.assetBalance ?? 0n;
    if (totalAsset > have) {
      runIssues.push({
        code: 'SENDER_SHORT_ASSET', severity: 'red', blocking: true,
        message: `You need ${fmt(totalAsset)} ${sym} but hold ${fmt(have)}. Short by ${fmt(totalAsset - have)}.`,
      });
    }
    const fee = snap.feeEstimate ?? 0n;
    const needNative = totalTopup + fee + snap.ed;
    if (s.nativeFree < needNative) {
      runIssues.push({
        code: 'SENDER_SHORT_NATIVE', severity: 'red', blocking: true,
        message: `You need ${nfmt(totalTopup + fee)} ${nsym} for top-ups and fees and must keep ${nfmt(snap.ed)} to stay alive. You have ${nfmt(s.nativeFree)}. Short by ${nfmt(needNative - s.nativeFree)}.`,
        why: 'transfer_keep_alive refuses to take the sender below the existential deposit, so the whole batch would fail.',
      });
    }
  }
  if (included.length === 0) {
    runIssues.push({ code: 'OK', severity: 'info', blocking: true, message: 'No sendable rows yet.' });
  }

  const real = rows.filter((r) => r.action !== 'merged');
  return {
    rows,
    runIssues,
    summary: {
      recipients: real.length,
      ok: real.filter((r) => r.action === 'send' && r.severity !== 'amber').length,
      autoFixable: real.filter((r) => r.action !== 'excluded' && (r.severity === 'amber' || r.action === 'topup+send')).length,
      blocked: real.filter((r) => r.action === 'excluded').length,
      totalAsset, totalTopup, topups, transfers: included.length, fee: snap.feeEstimate,
    },
  };
}
