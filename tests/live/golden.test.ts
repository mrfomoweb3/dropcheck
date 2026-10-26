// Opt-in live test: pnpm seed-demo && pnpm test:live  (needs funded DEMO_SEED_FILE in .env)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import 'dotenv/config';
import { runHeadless } from '../../scripts/run-demo-headless';
import { blockLink } from '@/config/chain';
import { connect, resolveEvm } from '@/core/chain';
import { CHAIN } from '@/config/chain';
import { encodeAddress } from '@polkadot/util-crypto';

const ready = !!process.env.DEMO_SEED_FILE && existsSync('public/demo.json');

describe.skipIf(!ready)('live golden path on V3', () => {
  it('A2 live: ReviveApi.account_id resolves the guide example', async () => {
    const api = await connect(CHAIN.wss);
    const m = await resolveEvm(api, ['0xf7ec65d11e35375a250e474059a917b537804142']);
    await api.disconnect();
    expect(encodeAddress(m['0xf7ec65d11e35375a250e474059a917b537804142'], 42)).toBe('5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y');
  });

  it('A5–A7: demo list -> 1 signature -> 17 sent, 2 excluded, dup merged, fresh accounts hold asset, sender alive', async () => {
    const demo = JSON.parse(readFileSync('public/demo.json', 'utf8'));
    const out = await runHeadless({ assetId: demo.assetId, csv: demo.csv, send: true, log: () => undefined });
    const { res, plan, results, after, senderHex, ed } = out as any;
    expect(plan.chunks).toHaveLength(1);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.ok).toBe(true);
    expect(r.batchCompleted).toBe(true);
    // A5
    expect(r.transfers.filter((t: any) => t.kind === 'asset')).toHaveLength(17);
    expect(res.rows.filter((x: any) => x.action === 'excluded')).toHaveLength(2);
    expect(res.rows.filter((x: any) => x.action === 'merged')).toHaveLength(1);
    // A6: every NO_PROVIDER row now holds the asset
    const fresh = res.rows.filter((x: any) => x.action === 'topup+send');
    expect(fresh).toHaveLength(5);
    for (const f of fresh) expect(after[f.account].assetBalance).toBe(f.amount);
    // A7
    expect(after[senderHex].nativeFree >= ed).toBe(true);
    appendFileSync('docs/PROOF.md', `\n| ${new Date().toISOString()} | live test A5–A7 | \`${r.txHash}\` | [#${r.blockNumber}](${blockLink(r.blockNumber)}) | 5 top-ups + 17 asset transfers, asset ${demo.assetId} |\n`);
  });
});
