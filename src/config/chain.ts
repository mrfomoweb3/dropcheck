// All chain endpoints and identity expectations. Override via NEXT_PUBLIC_* env vars.

const env = (k: string): string | undefined =>
  typeof process !== 'undefined' ? process.env?.[k] : undefined;

export const CHAIN = {
  wss: env('NEXT_PUBLIC_DROPCHECK_WSS') ?? 'wss://test-node-v3.portaldot.dev',
  evmRpc: env('NEXT_PUBLIC_DROPCHECK_EVM_RPC') ?? 'https://test-evm-rpc-v3.portaldot.dev',
  evmChainId: 420420777,
  explorer: env('NEXT_PUBLIC_DROPCHECK_EXPLORER') ?? 'https://node-console.portaldot.dev',
  // Verified on V3 2026-10-26 (see docs/EVIDENCE.md).
  expectedGenesis:
    env('NEXT_PUBLIC_DROPCHECK_GENESIS') ??
    '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd',
  expectedSpecName: env('NEXT_PUBLIC_DROPCHECK_SPEC') ?? 'portaldot-v3',
  /** Top-up = ED + ED * TOPUP_BUFFER_BPS / 10_000 */
  topupBufferBps: 1000n,
  maxRows: 500,
  maxLineLength: 300,
} as const;

/** Link to a block in the node console (no tx-hash search there). */
export function blockLink(block: number | string): string {
  const rpc = encodeURIComponent(CHAIN.wss);
  return `${CHAIN.explorer}/?rpc=${rpc}#/explorer/query/${block}`;
}
