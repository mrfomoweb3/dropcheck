// Creates (or reuses) the demo asset and writes public/demo-list.csv + public/demo.json (§8).
// Idempotent: persistent demo accounts are funded once; the 5 "fresh" rows are new every run.
// Usage: tsx --env-file=.env scripts/seed-demo.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Keyring } from '@polkadot/keyring';
import { blake2AsU8a, cryptoWaitReady, encodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import type { ApiPromise } from '@polkadot/api';
import { CHAIN } from '../src/config/chain.ts';
import { connectNode } from './node-connect.ts';
import { readIdentity, checkIdentity, resolveEvm, readAccounts } from '../src/core/chain.ts';
import { h160FallbackAccount } from '../src/core/address.ts';
import { signAndSend } from '../src/core/submit.ts';

// DEMO_OUT lets fork rehearsals write elsewhere instead of overwriting the shipped demo.
const OUT = process.env.DEMO_OUT ?? 'public';
const DEMO_JSON = `${OUT}/demo.json`;
const DEMO_CSV = `${OUT}/demo-list.csv`;
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
const MIN_BALANCE = 5n * UNIT;

async function sendBatch(api: ApiPromise, pair: any, calls: any[], label: string) {
  const r = await signAndSend(api, api.tx.utility.batchAll(calls), { pair });
  console.log(`${label}: ${r.ok ? 'OK' : 'FAILED ' + r.error} tx ${r.txHash} block #${r.blockNumber}`);
  if (!r.ok) throw new Error(label + ' failed');
  return r;
}

async function main() {
  await cryptoWaitReady();
  const file = process.env.DEMO_SEED_FILE;
  if (!file) throw new Error('DEMO_SEED_FILE not set (see .env.example)');
  const seed = readFileSync(file, 'utf8').trim();
  const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const me = kr.addFromUri(seed);
  const derive = (path: string) => kr.addFromUri(`${seed}//dropcheck//${path}`).address;

  const api = await connectNode(CHAIN.wss);
  const id = await readIdentity(api);
  if (!checkIdentity(id, { genesis: CHAIN.expectedGenesis, specName: CHAIN.expectedSpecName }).ok) throw new Error('wrong chain');
  const ed = id.ed;
  console.log('sender', me.address);

  // 1. Asset (non-sufficient, min_balance 5 DROP, 6 decimals).
  const prev = existsSync(DEMO_JSON) ? JSON.parse(readFileSync(DEMO_JSON, 'utf8')) : {};
  let assetId: string | undefined = prev.assetId;
  // Reuse only an asset this demo key owns (the shipped preview demo.json points at pUSD 7777, which we can't send).
  if (assetId) {
    const a = (await api.query.assets.asset(assetId)) as any;
    if (a.isNone || a.unwrap().owner.toString() !== me.address) assetId = undefined;
  }
  if (!assetId) {
    let candidate = 0;
    for (let i = 0; i < 20; i++) {
      candidate = 420_000 + Math.floor(Math.random() * 500_000);
      if (((await api.query.assets.asset(candidate)) as any).isNone) break;
    }
    await sendBatch(api, me, [
      api.tx.assets.create(candidate, { Id: me.address }, MIN_BALANCE),
      api.tx.assets.setMetadata(candidate, 'Dropcheck Demo', 'DROP', DECIMALS),
      api.tx.assets.mint(candidate, { Id: me.address }, 10_000_000n * UNIT),
    ], `create asset ${candidate}`);
    assetId = String(candidate);
  }
  console.log('asset', assetId);

  // 2. Persistent accounts: 9 OK, 1 wrong-prefix, 1 below-min, 2 EVM (mapped accounts funded).
  const ok = Array.from({ length: 9 }, (_, i) => derive(`ok//${i}`));
  const prefixAcct = derive('prefix');
  const belowAcct = derive('below');
  const evm = [0, 1].map((i) => u8aToHex(blake2AsU8a(`${me.address}//dropcheck//evm//${i}`, 256).subarray(0, 20)));
  const evmMap = await resolveEvm(api, evm);
  const evmAccts = evm.map((h) => encodeAddress(evmMap[h] ?? h160FallbackAccount(h), 42));
  const persistent = [...ok, prefixAcct, belowAcct, ...evmAccts];
  const hexOf = (a: string) => u8aToHex(kr.decodeAddress(a));
  const states = await readAccounts(api, assetId, persistent.map(hexOf));
  const needFunding = persistent.filter((a) => states[hexOf(a)].providers === 0);
  if (needFunding.length) {
    await sendBatch(api, me, needFunding.map((a) => api.tx.balances.transferKeepAlive({ Id: a }, ed * 2n)), `fund ${needFunding.length} persistent demo accounts`);
  }

  // 3. Fresh accounts for this run.
  const runId = Date.now().toString(36);
  const fresh = Array.from({ length: 5 }, (_, i) => derive(`${runId}//${i}`));

  // 4. The list: 20 rows in §8 order.
  const typo = ok[0].slice(0, 20) + (ok[0][20] === 'x' ? 'y' : 'x') + ok[0].slice(21);
  const rows = [
    ...ok.map((a, i) => `${a},${100 + i * 25}`),
    ...fresh.map((a, i) => `${a},${50 + i * 10}`),
    `${evm[0]},75`,
    `${evm[1]},80`,
    `${encodeAddress(kr.decodeAddress(prefixAcct), 0)},120`,
    `${ok[0]},25`,
    `${belowAcct},1`,
    `${typo},60`,
  ];
  const csv = ['address,amount', ...rows].join('\n') + '\n';
  writeFileSync(DEMO_CSV, csv);
  writeFileSync(DEMO_JSON, JSON.stringify({
    assetId, csv, runId,
    note: `Demo asset ${assetId} (DROP). Fresh rows generated ${new Date().toISOString()}.`,
    sender: me.address,
  }, null, 2) + '\n');
  console.log(`wrote ${DEMO_CSV} (20 rows) and ${DEMO_JSON}; runId ${runId}`);
  console.log('fresh:', fresh.join(' '));
  console.log('evm:', evm.join(' '), '->', evmAccts.join(' '));
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
