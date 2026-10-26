// Build the fix plan: ordered chunks of [top-ups..., asset transfers...]. Pure; no api objects.
import { topupAmount } from './checks';
import type { ChainSnapshot, CheckedRow } from './types';

export type PlannedCall =
  | { kind: 'topup'; line: number; dest: string; amount: bigint }
  | { kind: 'asset'; line: number; dest: string; assetId: string; amount: bigint };

export interface PlanChunk {
  calls: PlannedCall[];
  recipients: number;
}

export interface Plan {
  chunks: PlanChunk[];
  topups: number;
  transfers: number;
  totalTopup: bigint;
  totalAsset: bigint;
}

/** Default recipients per signed batch (measured limit recorded in docs/SPIKE.md). */
export const DEFAULT_CHUNK = 50;

export function buildPlan(
  rows: CheckedRow[],
  snap: Pick<ChainSnapshot, 'ed' | 'topupBufferBps' | 'asset'>,
  chunkSize = DEFAULT_CHUNK,
): Plan {
  const included = rows.filter((r) => r.action === 'send' || r.action === 'topup+send');
  const top = topupAmount(snap);
  const chunks: PlanChunk[] = [];
  for (let i = 0; i < included.length; i += chunkSize) {
    const slice = included.slice(i, i + chunkSize);
    const topups: PlannedCall[] = slice
      .filter((r) => r.action === 'topup+send')
      .map((r) => ({ kind: 'topup', line: r.line, dest: r.account!, amount: top }));
    const transfers: PlannedCall[] = slice.map((r) => ({
      kind: 'asset', line: r.line, dest: r.account!, assetId: snap.asset.id, amount: r.amount!,
    }));
    chunks.push({ calls: [...topups, ...transfers], recipients: slice.length });
  }
  const topups = included.filter((r) => r.action === 'topup+send').length;
  return {
    chunks,
    topups,
    transfers: included.length,
    totalTopup: top * BigInt(topups),
    totalAsset: included.reduce((s, r) => s + r.amount!, 0n),
  };
}
