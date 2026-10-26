import { u8aToHex } from '@polkadot/util';
import { encodeAddress } from '@polkadot/util-crypto';
import type { AccountState, ChainSnapshot } from '@/core/types';

export const UNIT = 10n ** 6n; // fixture asset: 6 decimals
export const ED = 10n ** 13n; // 0.1 tPOT, as measured on V3

/** Deterministic account n -> hex + ss58. */
export function acct(n: number) {
  const u8 = new Uint8Array(32).fill(n);
  return { hex: u8aToHex(u8), ss58: encodeAddress(u8, 42), dot: encodeAddress(u8, 0) };
}

export const funded = (asset: bigint | null = null, status: string | null = asset === null ? null : 'Liquid'): AccountState => ({
  nativeFree: 10n ** 15n, providers: 1, consumers: 0, sufficients: 0, assetBalance: asset, assetStatus: status,
});
export const empty = (): AccountState => ({
  nativeFree: 0n, providers: 0, consumers: 0, sufficients: 0, assetBalance: null, assetStatus: null,
});

export function snapshot(over: Partial<ChainSnapshot> = {}): ChainSnapshot {
  return {
    ss58: 42,
    nativeDecimals: 14,
    nativeSymbol: 'tPOT',
    ed: ED,
    topupBufferBps: 1000n,
    asset: {
      id: '7', exists: true, name: 'Demo', symbol: 'DROP', decimals: 6,
      minBalance: 5n * UNIT, isSufficient: false, status: 'Live',
    },
    accounts: {},
    evmMap: {},
    sender: { account: acct(99).hex, state: { ...funded(1_000_000n * UNIT), nativeFree: 100n * 10n ** 14n } },
    ...over,
  };
}
