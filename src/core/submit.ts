// Turn a plan chunk into a batch_all extrinsic, estimate its fee, sign once, dry-run, submit, parse events.
import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { Signer } from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import { u8aToHex } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';
import type { PlanChunk } from './planner';

export type Batch = SubmittableExtrinsic<'promise'>;

export function buildBatch(api: ApiPromise, chunk: PlanChunk): Batch {
  const calls = chunk.calls.map((c) =>
    c.kind === 'topup'
      ? api.tx.balances.transferKeepAlive({ Id: c.dest }, c.amount)
      : api.tx.assets.transferKeepAlive(c.assetId, { Id: c.dest }, c.amount),
  );
  return api.tx.utility.batchAll(calls);
}

export async function estimateFee(batch: Batch, sender: string): Promise<bigint> {
  const info = await batch.paymentInfo(sender);
  return BigInt(info.partialFee.toString());
}

export type SignWith = { pair: KeyringPair } | { address: string; signer: Signer };

export interface DryRunResult {
  available: boolean;
  ok?: boolean;
  error?: string;
}

export interface TransferEvent {
  kind: 'asset' | 'native';
  to: string;
  amount: bigint;
}

export interface SubmitResult {
  ok: boolean;
  txHash: string;
  blockHash: string;
  blockNumber: number;
  extrinsicIndex: number;
  transfers: TransferEvent[];
  batchCompleted: boolean;
  error?: string;
  dryRun: DryRunResult;
  events: string[];
}

export function decodeDispatchError(api: ApiPromise, err: any): string {
  if (err?.isModule) {
    const m = api.registry.findMetaError(err.asModule);
    return `${m.section}.${m.name}: ${m.docs.join(' ').trim()}`;
  }
  // TokenError / ArithmeticError etc. carry their variant as `type` (e.g. Token -> CannotCreate).
  if (err?.isToken) return `TokenError.${err.asToken.type}`;
  if (err?.isArithmetic) return `ArithmeticError.${err.asArithmetic.type}`;
  return err?.toString?.() ?? String(err);
}

const toHexAccount = (a: { toString(): string }) => u8aToHex(decodeAddress(a.toString()));

/**
 * One signature per chunk: sign -> dry-run the signed bytes (system_dryRun) -> broadcast the same bytes.
 * Resolves once the extrinsic is in a block.
 */
export async function signAndSend(
  api: ApiPromise,
  batch: Batch,
  who: SignWith,
  onStatus?: (s: string) => void,
): Promise<SubmitResult> {
  if ('pair' in who) await batch.signAsync(who.pair, { nonce: -1 });
  else await batch.signAsync(who.address, { signer: who.signer, nonce: -1 });
  const txHash = batch.hash.toHex();

  const dryRun: DryRunResult = { available: false };
  if ((api.rpc as any).system?.dryRun) {
    try {
      onStatus?.('Dry-running signed batch…');
      const r = await api.rpc.system.dryRun(batch.toHex());
      dryRun.available = true;
      if (r.isErr) {
        dryRun.ok = false;
        const inv: any = r.asErr;
        dryRun.error = inv.isInvalid && inv.asInvalid.isPayment
          ? "Your account can't pay the network fee (not enough tPOT)."
          : `Invalid transaction: ${inv.toString()}`;
      } else if (r.asOk.isErr) {
        dryRun.ok = false;
        dryRun.error = decodeDispatchError(api, r.asOk.asErr);
      } else {
        dryRun.ok = true;
      }
    } catch (e) {
      dryRun.available = false;
      dryRun.error = (e as Error).message;
    }
  }
  if (dryRun.available && dryRun.ok === false) {
    return { ok: false, txHash, blockHash: '', blockNumber: 0, extrinsicIndex: -1, transfers: [], batchCompleted: false, error: `Dry-run failed, nothing was sent. ${dryRun.error}`, dryRun, events: [] };
  }

  onStatus?.('Broadcasting…');
  const startBlock = (await api.rpc.chain.getHeader()).number.toNumber();
  return new Promise<SubmitResult>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let settled = false;
    const finish = (r: SubmitResult | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      unsub?.();
      if (r instanceof Error) reject(r); else resolve(r);
    };
    // If the node's socket drops, the status subscription goes quiet forever. After a while, look for the
    // tx in the chain itself, so a lost confirmation is never shown as "nothing happened" (and resent).
    const watchdog = setTimeout(async () => {
      onStatus?.('No confirmation yet, checking the chain directly…');
      try {
        const found = await findIncluded(api, txHash, startBlock, INCLUSION_SCAN_MS);
        if (found) finish({ ...found, dryRun });
        else finish(new Error(`No confirmation from the node within ${Math.round((CONFIRM_TIMEOUT_MS + INCLUSION_SCAN_MS) / 1000)} s and the batch is not in any block since #${startBlock}. It was probably not sent. Reload the page to re-check balances before trying again.`));
      } catch (e) {
        finish(new Error(`Lost contact with the node (${(e as Error).message}). Your batch may still have been included: reload the page and check balances before sending again.`));
      }
    }, CONFIRM_TIMEOUT_MS);
    batch
      .send(async (res) => {
        const { status } = res;
        if (status.isReady || status.isBroadcast) onStatus?.('Waiting for block…');
        if (status.isInvalid || status.isDropped || status.isUsurped) {
          finish(new Error(`Transaction ${status.type}`));
          return;
        }
        if (!status.isInBlock) return;
        const blockHash = status.asInBlock.toHex();
        const header = await api.rpc.chain.getHeader(blockHash);
        finish({ ...parseOutcome(api, res.events as any, res.dispatchError, txHash, blockHash, header.number.toNumber()), dryRun });
      })
      .then((u) => { unsub = u; if (settled) u(); })
      .catch((e) => finish(e as Error));
  });
}

const CONFIRM_TIMEOUT_MS = 60_000;
const INCLUSION_SCAN_MS = 60_000;

type Outcome = Omit<SubmitResult, 'dryRun'>;

function parseOutcome(api: ApiPromise, events: { event: any; phase: any }[], dispatchError: any, txHash: string, blockHash: string, blockNumber: number): Outcome {
  const transfers: TransferEvent[] = [];
  let batchCompleted = false;
  const names: string[] = [];
  let extrinsicIndex = -1;
  for (const { event, phase } of events) {
    if (phase.isApplyExtrinsic) extrinsicIndex = phase.asApplyExtrinsic.toNumber();
    names.push(`${event.section}.${event.method}`);
    if (event.section === 'assets' && event.method === 'Transferred') {
      const [, , to, amount] = event.data as any;
      transfers.push({ kind: 'asset', to: toHexAccount(to), amount: BigInt(amount.toString()) });
    } else if (event.section === 'balances' && event.method === 'Transfer') {
      const [, to, amount] = event.data as any;
      transfers.push({ kind: 'native', to: toHexAccount(to), amount: BigInt(amount.toString()) });
    } else if (event.section === 'utility' && event.method === 'BatchCompleted') {
      batchCompleted = true;
    }
  }
  return {
    ok: !dispatchError && batchCompleted,
    txHash, blockHash, blockNumber, extrinsicIndex, transfers, batchCompleted,
    error: dispatchError ? decodeDispatchError(api, dispatchError) : undefined,
    events: names,
  };
}

/**
 * Scan blocks from `fromBlock` for an extrinsic with this hash, polling until `waitMs` elapses.
 * Returns its outcome (from that block's events) or null if it never appeared.
 */
export async function findIncluded(api: ApiPromise, txHash: string, fromBlock: number, waitMs: number): Promise<Outcome | null> {
  const until = Date.now() + waitMs;
  let next = fromBlock;
  for (;;) {
    const head = (await api.rpc.chain.getHeader()).number.toNumber();
    // Fetch blocks in parallel (this node takes ~3 s per block request when read one at a time).
    while (next <= head) {
      const nums = Array.from({ length: Math.min(10, head - next + 1) }, (_, i) => next + i);
      const blocks = await Promise.all(nums.map(async (n) => {
        const hash = await api.rpc.chain.getBlockHash(n);
        return { n, hash, block: await api.rpc.chain.getBlock(hash) };
      }));
      for (const { n, hash, block } of blocks) {
        const idx = block.block.extrinsics.findIndex((x) => x.hash.toHex() === txHash);
        if (idx < 0) continue;
        const all: any = await (await api.at(hash)).query.system.events();
        const mine = all.filter((e: any) => e.phase.isApplyExtrinsic && e.phase.asApplyExtrinsic.toNumber() === idx);
        const failed = mine.find((e: any) => e.event.section === 'system' && e.event.method === 'ExtrinsicFailed');
        return parseOutcome(api, mine, failed ? failed.event.data[0] : undefined, txHash, hash.toHex(), n);
      }
      next += nums.length;
    }
    if (Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, 3_000));
  }
}
