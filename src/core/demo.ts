// Demo helpers that keep the shipped demo usable by anyone, forever, with no backend and no keys:
// - fresh rows are regenerated on every load (random accounts that have never existed on-chain),
// - a visitor can create their own copy of the demo token from their own wallet.
import { encodeAddress } from '@polkadot/util-crypto';

/** Demo token parameters. Same as scripts/seed-demo.ts, so a visitor's copy behaves exactly like ours. */
export const DEMO_TOKEN = {
  name: 'Dropcheck Demo',
  symbol: 'DROP',
  decimals: 6,
  minBalance: 5n * 10n ** 6n,
  mint: 10_000_000n * 10n ** 6n,
} as const;

/** A random AccountId32 that (with overwhelming probability) has never been used on-chain. No key exists for it. */
export function randomFreshAddress(ss58: number, rand: (n: number) => Uint8Array = cryptoRandom): string {
  return encodeAddress(rand(32), ss58);
}

function cryptoRandom(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/**
 * Replace each "fresh" address in the demo CSV with a new random one, so the demo always shows
 * the "no native token -> top-up + send" case, even after earlier demo runs funded the old ones.
 */
export function freshenDemoCsv(csv: string, fresh: readonly string[], ss58: number, rand?: (n: number) => Uint8Array): string {
  if (!fresh.length) return csv;
  const swap = new Map(fresh.map((a) => [a, randomFreshAddress(ss58, rand)]));
  return csv
    .split('\n')
    .map((line) => {
      const [addr, ...rest] = line.split(',');
      const next = swap.get(addr.trim());
      return next ? [next, ...rest].join(',') : line;
    })
    .join('\n');
}

/** Candidate asset IDs for a visitor's demo token (V3 has no NextAssetId, so IDs are chosen by the creator). */
export function randomAssetId(rand: () => number = Math.random): number {
  return 1_000_000 + Math.floor(rand() * 8_999_999);
}

/** Native tPOT a visitor needs to create the demo token (reserved deposits) before fees. */
export function demoTokenDeposit(consts: { assetDeposit: bigint; metadataDepositBase: bigint; metadataDepositPerByte: bigint }): bigint {
  const bytes = BigInt(DEMO_TOKEN.name.length + DEMO_TOKEN.symbol.length);
  return consts.assetDeposit + consts.metadataDepositBase + consts.metadataDepositPerByte * bytes;
}
