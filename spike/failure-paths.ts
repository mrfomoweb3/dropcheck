// Proves the safety net: a batch that would fail is caught by system_dryRun on the SIGNED bytes,
// and nothing is broadcast (sender nonce unchanged). Runs on the fork (as //Alice) or on live V3
// (as DEMO_SEED_FILE's key; with no tPOT the dry-run must report a payment failure).
// Usage: NEXT_PUBLIC_DROPCHECK_WSS=... DEMO_SEED_FILE=... tsx spike/failure-paths.ts <assetId>
import { readFileSync } from 'node:fs';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';
import { CHAIN } from '../src/config/chain';
import { connect } from '../src/core/chain';
import { signAndSend } from '../src/core/submit';

await cryptoWaitReady();
const assetId = process.argv[2] ?? '7777';
const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
const me = kr.addFromUri(readFileSync(process.env.DEMO_SEED_FILE!, 'utf8').trim());
const api = await connect(CHAIN.wss, 120_000);
console.log('endpoint', CHAIN.wss, 'sender', me.address);
const fresh = kr.addFromUri(mnemonicGenerate()).address;
const nonceBefore = (await api.rpc.system.accountNextIndex(me.address)).toNumber();
// Asset transfer to a wallet with no tPOT and no top-up: must fail (TokenError.CannotCreate on V3 runtime).
const bad = api.tx.utility.batchAll([api.tx.assets.transferKeepAlive(assetId, { Id: fresh }, 10_000_000n)]);
const r = await signAndSend(api, bad, { pair: me });
const nonceAfter = (await api.rpc.system.accountNextIndex(me.address)).toNumber();
console.log('ok', r.ok, '| dryRun', JSON.stringify(r.dryRun), '| error', r.error);
console.log('broadcast?', r.blockNumber ? `YES block ${r.blockNumber}` : 'no', '| nonce', nonceBefore, '->', nonceAfter);
if (r.ok || r.blockNumber || nonceAfter !== nonceBefore) { console.log('FAIL: unsafe'); process.exitCode = 1; } else console.log('PASS: caught by dry-run, nothing broadcast');
await api.disconnect();
