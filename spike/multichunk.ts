// Live check of the >50-recipient path: 55 never-used accounts -> plan splits into 2 ordered batches,
// one signature each; every recipient must end up holding the asset. Usage: tsx --env-file=.env spike/multichunk.ts <assetId>
import { readFileSync } from 'node:fs';
import { runHeadless } from '../scripts/run-demo-headless.ts';
import { randomFreshAddress } from '../src/core/demo.ts';
import { cryptoWaitReady } from '@polkadot/util-crypto';

await cryptoWaitReady();
const assetId = process.argv[2] ?? JSON.parse(readFileSync('public/demo.json', 'utf8')).assetId;
const N = 55;
const rows = Array.from({ length: N }, (_, i) => `${randomFreshAddress(42)},${5 + i}`);
const out: any = await runHeadless({ assetId, csv: ['address,amount', ...rows].join('\n'), send: true, log: (s) => { if (!/^\s*\d+ /.test(s)) console.log(s); } });
const { plan, results, after, res } = out;
const included = res.rows.filter((r: any) => r.action === 'send' || r.action === 'topup+send');
const holding = included.filter((r: any) => (after[r.account]?.assetBalance ?? 0n) === r.amount).length;
console.log(`RESULT chunks=${plan.chunks.length} sizes=${plan.chunks.map((c: any) => c.calls.length).join('/')} signatures=${results.length} ok=${results.every((r: any) => r.ok)} recipients=${included.length} holdingExactAmount=${holding}`);
for (const r of results) console.log(`TX ${r.txHash} block #${r.blockNumber}`);
process.exit(results.length === plan.chunks.length && results.every((r: any) => r.ok) && holding === N ? 0 : 1);
