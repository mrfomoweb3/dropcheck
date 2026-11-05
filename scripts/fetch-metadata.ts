// Snapshot chain metadata into public/metadata.json so the browser skips the ~1 MB RPC download.
// polkadot.js only uses it when `${genesis}-${specVersion}` matches the live runtime.
// Runs before every build (`prebuild`) so a redeploy after a runtime upgrade ships fresh metadata.
// --soft: never fail the build; on any error or timeout keep the existing snapshot (the app then
// downloads metadata itself and says so).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { CHAIN } from '../src/config/chain.ts';
import { connectNode } from './node-connect.ts';

const soft = process.argv.includes('--soft');
const FILE = 'public/metadata.json';
const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')).key : undefined;

async function main() {
  const api = await connectNode(CHAIN.wss, 240_000);
  try {
    const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toNumber()}`;
    if (key === old) { console.log('metadata snapshot up to date:', key); return; }
    if (api.genesisHash.toHex() !== CHAIN.expectedGenesis) throw new Error(`unexpected genesis ${api.genesisHash.toHex()}`);
    const hex = api.runtimeMetadata.toHex();
    writeFileSync(FILE, JSON.stringify({ key, hex }));
    console.log('wrote', FILE, key, hex.length, 'chars (was', old, ')');
  } finally {
    await api.disconnect();
  }
}

const guard = setTimeout(() => { console.warn('metadata refresh timed out; keeping', old); process.exit(soft ? 0 : 1); }, 300_000);
main().then(() => { clearTimeout(guard); process.exit(0); }).catch((e) => {
  console.warn('metadata refresh failed:', (e as Error).message, soft ? '- keeping ' + old : '');
  process.exit(soft ? 0 : 1);
});
