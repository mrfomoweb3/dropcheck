// Snapshot chain metadata into public/metadata.json so the browser skips the ~1 MB RPC download.
// polkadot.js only uses it when `${genesis}-${specVersion}` matches the live runtime. Re-run after a runtime upgrade.
import { writeFileSync } from 'node:fs';
import { CHAIN } from '../src/config/chain.ts';
import { connect } from '../src/core/chain.ts';

const api = await connect(CHAIN.wss, 120_000);
const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toNumber()}`;
const hex = (await api.rpc.state.getMetadata()).toHex();
writeFileSync('public/metadata.json', JSON.stringify({ key, hex }));
console.log('wrote public/metadata.json', key, hex.length, 'chars');
await api.disconnect();
