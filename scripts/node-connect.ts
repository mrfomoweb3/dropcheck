// Node-side connect that reuses the shipped metadata snapshot (public/metadata.json), like the browser does.
// Without it, scripts download ~1 MB of metadata per connect, which regularly times out on the V3 node.
// polkadot.js only uses the snapshot when its genesis-specVersion key matches the chain; otherwise it fetches.
import { readFileSync, existsSync } from 'node:fs';
import { connect } from '../src/core/chain.ts';

export function snapshotMetadata(): Record<string, `0x${string}`> | undefined {
  const f = new URL('../public/metadata.json', import.meta.url);
  if (!existsSync(f)) return undefined;
  const m = JSON.parse(readFileSync(f, 'utf8'));
  return { [m.key]: m.hex };
}

export function connectNode(wss: string, timeoutMs = 120_000) {
  return connect(wss, timeoutMs, snapshotMetadata());
}
