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
        dryRun.error = `Invalid transaction: ${r.asErr.toString()}`;
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
  return new Promise<SubmitResult>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    batch
      .send(async (res) => {
        const { status, events, dispatchError } = res;
        if (status.isReady || status.isBroadcast) onStatus?.('Waiting for block…');
        if (status.isInvalid || status.isDropped || status.isUsurped) {
          unsub?.();
          reject(new Error(`Transaction ${status.type}`));
          return;
        }
        if (!status.isInBlock) return;
        unsub?.();
        const blockHash = status.asInBlock.toHex();
        const header = await api.rpc.chain.getHeader(blockHash);
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
        resolve({
          ok: !dispatchError && batchCompleted,
          txHash,
          blockHash,
          blockNumber: header.number.toNumber(),
          extrinsicIndex,
          transfers,
          batchCompleted,
          error: dispatchError ? decodeDispatchError(api, dispatchError) : undefined,
          dryRun,
          events: names,
        });
      })
      .then((u) => { unsub = u; })
      .catch(reject);
  });
}
