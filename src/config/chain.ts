// All chain endpoints and identity expectations. Override via NEXT_PUBLIC_* env vars (build time).
// Each process.env.NEXT_PUBLIC_* must be written out literally: Next.js only inlines literal references
// into the browser bundle, so a dynamic process.env[key] lookup silently ignores the override.

export const CHAIN = {
  wss: process.env.NEXT_PUBLIC_DROPCHECK_WSS || 'wss://test-node-v3.portaldot.dev',
  evmRpc: process.env.NEXT_PUBLIC_DROPCHECK_EVM_RPC || 'https://test-evm-rpc-v3.portaldot.dev',
  evmChainId: 420420777,
  explorer: process.env.NEXT_PUBLIC_DROPCHECK_EXPLORER || 'https://node-console.portaldot.dev',
  // Verified on V3 2026-10-26 (see docs/EVIDENCE.md).
  expectedGenesis:
    process.env.NEXT_PUBLIC_DROPCHECK_GENESIS ||
    '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd',
  expectedSpecName: process.env.NEXT_PUBLIC_DROPCHECK_SPEC || 'portaldot-v3',
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

/**
 * Endpoint for this page load: `?rpc=wss://...` overrides the default node (useful if the public node is down).
 * Safe: the genesis + spec check still runs, so any other chain is refused for sending.
 * Only wss:// (or ws:// on localhost, for fork rehearsals) is accepted.
 */
export function endpointFromSearch(search: string, fallback: string = CHAIN.wss): string {
  const rpc = new URLSearchParams(search).get('rpc')?.trim();
  if (!rpc) return fallback;
  try {
    const u = new URL(rpc);
    if (u.protocol === 'wss:') return rpc;
    if (u.protocol === 'ws:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return rpc;
  } catch { /* not a URL */ }
  return fallback;
}
