// Same flow as the UI, from the CLI: parse -> resolve -> check -> plan -> fee -> (optionally) sign & send.
// Read-only unless --send. Usage:
//   tsx --env-file=.env scripts/run-demo-headless.ts --asset 7777 --list public/demo-list.csv [--sender <ss58>] [--send]
import { readFileSync } from 'node:fs';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import { CHAIN } from '../src/config/chain.ts';
import { connect, readIdentity, checkIdentity, readAsset, readAccounts, resolveEvm } from '../src/core/chain.ts';
import { parseInput } from '../src/core/input.ts';
import { parseAddress, h160FallbackAccount } from '../src/core/address.ts';
import { checkRows } from '../src/core/checks.ts';
import { buildPlan } from '../src/core/planner.ts';
import { buildBatch, estimateFee, signAndSend } from '../src/core/submit.ts';
import { formatUnits } from '../src/core/units.ts';
import type { ChainSnapshot } from '../src/core/types.ts';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (k: string) => process.argv.includes(k);

export async function runHeadless(opts: { assetId: string; csv: string; senderAddress?: string; send?: boolean; log?: (s: string) => void }) {
  const log = opts.log ?? console.log;
  await cryptoWaitReady();
  const api = await connect(CHAIN.wss);
  try {
    const id = await readIdentity(api);
    const chk = checkIdentity(id, { genesis: CHAIN.expectedGenesis, specName: CHAIN.expectedSpecName });
    log(`network ${id.specName}/${id.specVersion} genesis ${id.genesis.slice(0, 12)}… identity ${chk.ok ? 'OK' : 'MISMATCH ' + chk.problems.join(' ')}`);
    if (!chk.ok) throw new Error('chain identity mismatch');

    let pair;
    let senderAddr = opts.senderAddress;
    if (opts.send) {
      const file = process.env.DEMO_SEED_FILE;
      if (!file) throw new Error('DEMO_SEED_FILE not set');
      pair = new Keyring({ type: 'sr25519', ss58Format: id.ss58 }).addFromUri(readFileSync(file, 'utf8').trim());
      senderAddr = pair.address;
    }

    const asset = await readAsset(api, opts.assetId);
    log(`asset ${asset.id} ${asset.name} (${asset.symbol}) decimals ${asset.decimals} min ${asset.minBalance} sufficient ${asset.isSufficient} ${asset.status}`);
    const { rows: raw, errors } = parseInput(opts.csv, CHAIN);
    errors.forEach((e) => log('parse: ' + e));

    const h160s: string[] = [];
    const direct: string[] = [];
    for (const r of raw) {
      const a = parseAddress(r.addressInput);
      if (a.kind === 'h160') h160s.push(a.h160!);
      if (a.kind === 'ss58') direct.push(a.accountHex!);
    }
    const evmMap = await resolveEvm(api, h160s);
    const accts = [...direct, ...h160s.map((h) => evmMap[h] ?? u8aToHex(h160FallbackAccount(h)))];
    const senderHex = senderAddr ? u8aToHex(decodeAddress(senderAddr)) : undefined;
    const states = await readAccounts(api, asset.id, senderHex ? [...accts, senderHex] : accts);

    const snap: ChainSnapshot = {
      ss58: id.ss58, nativeDecimals: id.decimals, nativeSymbol: id.symbol, ed: id.ed, asset,
      accounts: states, evmMap, topupBufferBps: CHAIN.topupBufferBps,
      sender: senderHex ? { account: senderHex, state: states[senderHex] } : undefined,
    };
    let res = checkRows(raw, snap, { mergeDuplicates: true });
    let plan = buildPlan(res.rows, snap);
    if (senderAddr && plan.transfers) {
      let fee = 0n;
      for (const ch of plan.chunks) fee += await estimateFee(buildBatch(api, ch), senderAddr);
      snap.feeEstimate = fee;
      res = checkRows(raw, snap, { mergeDuplicates: true });
      plan = buildPlan(res.rows, snap);
    }

    for (const r of res.rows) {
      const codes = r.issues.map((i) => i.code).join('+');
      log(`${String(r.line).padStart(3)} ${r.severity.padEnd(5)} ${r.action.padEnd(10)} ${codes.padEnd(28)} ${(r.resolved ?? r.addressInput).slice(0, 14).padEnd(14)} ${r.amount !== undefined ? formatUnits(r.amount, asset.decimals) : r.amountInput}`);
    }
    const s = res.summary;
    log(`summary: ${s.recipients} recipients · ${s.ok} ok · ${s.autoFixable} auto-fixable · ${s.blocked} blocked · ${formatUnits(s.totalAsset, asset.decimals)} ${asset.symbol} · top-ups ${s.topups} = ${formatUnits(s.totalTopup, id.decimals)} ${id.symbol} · fee ${snap.feeEstimate !== undefined ? formatUnits(snap.feeEstimate, id.decimals) : 'n/a'}`);
    res.runIssues.forEach((i) => log(`run: ${i.blocking ? 'BLOCKING ' : ''}${i.code} ${i.message}`));
    log(`plan: ${plan.chunks.length} chunk(s), ${plan.chunks.map((c) => c.calls.length).join('/')} calls`);

    if (!opts.send) return { res, plan, results: [] };
    if (res.runIssues.some((i) => i.blocking)) throw new Error('run is blocked; not sending');

    const results = [];
    for (const [i, ch] of plan.chunks.entries()) {
      const r = await signAndSend(api, buildBatch(api, ch), { pair: pair! }, (m) => log(`chunk ${i + 1}: ${m}`));
      log(`chunk ${i + 1}: ${r.ok ? 'OK' : 'FAILED ' + r.error} tx ${r.txHash} block #${r.blockNumber} ${r.blockHash} dryRun ${JSON.stringify(r.dryRun)}`);
      log(`chunk ${i + 1}: events ${[...new Set(r.events)].join(', ')}; asset transfers ${r.transfers.filter((t) => t.kind === 'asset').length}, native ${r.transfers.filter((t) => t.kind === 'native').length}`);
      results.push(r);
      if (!r.ok) break;
    }
    const included = res.rows.filter((r) => r.action === 'send' || r.action === 'topup+send');
    const after = await readAccounts(api, asset.id, [...included.map((r) => r.account!), senderHex!]);
    for (const r of included) {
      log(`after L${r.line} ${r.resolved!.slice(0, 10)} ${formatUnits(states[r.account!]?.assetBalance ?? 0n, asset.decimals)} -> ${formatUnits(after[r.account!].assetBalance ?? 0n, asset.decimals)} ${asset.symbol}`);
    }
    log(`sender native after ${formatUnits(after[senderHex!].nativeFree, id.decimals)} ${id.symbol} (ED ${formatUnits(id.ed, id.decimals)})`);
    return { res, plan, results, after, senderHex, ed: id.ed };
  } finally {
    await api.disconnect();
  }
}

if (process.argv[1]?.includes('run-demo-headless')) {
  const assetId = arg('--asset') ?? JSON.parse(readFileSync('public/demo.json', 'utf8')).assetId;
  const csv = readFileSync(arg('--list') ?? 'public/demo-list.csv', 'utf8');
  runHeadless({ assetId, csv, senderAddress: arg('--sender'), send: flag('--send') })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
