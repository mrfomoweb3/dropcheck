// Spike steps 5-9 (needs a funded DEMO_SEED_FILE). Prints every error string, tx hash and block.
// Usage: node --env-file=.env spike/funded.ts [assetId]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';
import { decodeDispatchError } from '../src/core/submit.ts';

const WSS = process.env.NEXT_PUBLIC_DROPCHECK_WSS ?? 'wss://test-node-v3.portaldot.dev';
// Fork runs keep separate state so they are never mistaken for live-V3 results.
const STATE = new URL(WSS.includes('localhost') || WSS.includes('127.0.0.1') ? './state.fork.json' : './state.json', import.meta.url);
const state: Record<string, unknown> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

async function send(api: ApiPromise, tx: any, signer: any, label: string) {
  return new Promise<{ ok: boolean; err?: string; block: number; hash: string; tx: string; events: string[] }>((resolve, reject) => {
    tx.signAndSend(signer, { nonce: -1 }, async (r: any) => {
      if (r.status.isInvalid || r.status.isDropped) reject(new Error(label + ' ' + r.status.type));
      if (!r.status.isInBlock) return;
      const h = r.status.asInBlock.toHex();
      const n = (await api.rpc.chain.getHeader(h)).number.toNumber();
      const events = r.events.map((e: any) => `${e.event.section}.${e.event.method}${e.event.section === 'utility' && e.event.method === 'BatchInterrupted' ? ' ' + decodeDispatchError(api, e.event.data[1]) : ''}`);
      const err = r.dispatchError ? decodeDispatchError(api, r.dispatchError) : undefined;
      console.log(`[${label}] block #${n} ${h} tx ${tx.hash.toHex()} ${err ? 'FAILED ' + err : 'OK'}`);
      console.log(`[${label}] events: ${events.join(', ')}`);
      resolve({ ok: !err, err, block: n, hash: h, tx: tx.hash.toHex(), events });
    }).catch(reject);
  });
}

async function main() {
  await cryptoWaitReady();
  const seedFile = process.env.DEMO_SEED_FILE;
  if (!seedFile) throw new Error('DEMO_SEED_FILE not set');
  const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const me = kr.addFromUri(readFileSync(seedFile, 'utf8').trim());
  const api = await ApiPromise.create({ provider: new WsProvider(WSS), noInitWarn: true });
  const ed = BigInt(api.consts.balances.existentialDeposit.toString());
  const UNIT = 10n ** 14n;
  const acct: any = await api.query.system.account(me.address);
  console.log('sender', me.address, 'free', acct.data.free.toString());

  // 5. create asset (non-sufficient), min_balance = 5 units of 6-decimal token, metadata, mint.
  let assetId = process.argv[2] ?? (state.assetId as string | undefined);
  if (!assetId) {
    const next: any = await (api.query.assets as any).nextAssetId?.();
    let candidate = next && next.isSome ? next.unwrap().toString() : String(4200 + Math.floor(Math.random() * 100000));
    if ((await api.query.assets.asset(candidate) as any).isSome) candidate = String(Number(candidate) + 1 + Math.floor(Math.random() * 1000));
    const minBalance = 5_000_000n; // 5.0 at 6 decimals
    const r = await send(api, api.tx.utility.batchAll([
      api.tx.assets.create(candidate, { Id: me.address }, minBalance),
      api.tx.assets.setMetadata(candidate, 'Dropcheck Demo', 'DROP', 6),
      api.tx.assets.mint(candidate, { Id: me.address }, 1_000_000n * 1_000_000n),
    ]), me, 'step5 create+metadata+mint');
    if (!r.ok) throw new Error('asset create failed');
    assetId = candidate;
    state.assetId = assetId;
    state.step5 = r;
    save();
  }
  const details: any = (await api.query.assets.asset(assetId)).toHuman();
  console.log('asset', assetId, JSON.stringify(details));

  const fresh = () => kr.addFromUri(mnemonicGenerate()).address; // throwaway, seed discarded

  // 6a. asset transfer to fresh account with no native balance
  state.step6a = await send(api, api.tx.assets.transferKeepAlive(assetId, { Id: fresh() }, 10_000_000n), me, 'step6a asset->fresh no native');
  // 6b. below min_balance to new holder that HAS native (isolate BelowMinimum)
  const b = fresh();
  state.step6b = await send(api, api.tx.utility.batchAll([
    api.tx.balances.transferKeepAlive({ Id: b }, ed + ed / 10n),
  ]), me, 'step6b prep: fund recipient');
  state.step6b2 = await send(api, api.tx.assets.transferKeepAlive(assetId, { Id: b }, 1_000_000n), me, 'step6b asset below min_balance');
  // 6c. native transfer below ED to a fresh account
  state.step6c = await send(api, api.tx.balances.transferKeepAlive({ Id: fresh() }, ed / 2n), me, 'step6c native below ED');
  save();

  // 7. fix: batch_all(top-up ED+10%, asset transfer) to fresh account
  const f = fresh();
  state.step7 = await send(api, api.tx.utility.batchAll([
    api.tx.balances.transferKeepAlive({ Id: f }, ed + ed / 10n),
    api.tx.assets.transferKeepAlive(assetId, { Id: f }, 10_000_000n),
  ]), me, 'step7 top-up + asset');
  const after: any = await api.query.assets.account(assetId, f);
  console.log('step7 recipient', f, 'asset account', JSON.stringify(after.toHuman()));
  state.step7recipient = f;
  save();

  // 8. EVM visibility: probe ERC20 totalSupply() at assets precompile-style addresses
  for (const prefix of ['ffffffff', '0000000000000000000000000000000000000000'.slice(0, 8)]) {
    const addr = '0x' + prefix + BigInt(assetId).toString(16).padStart(32, '0');
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: addr, data: '0x18160ddd' }, 'latest'] };
    const res = await fetch('https://test-evm-rpc-v3.portaldot.dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
    console.log('step8 eth_call totalSupply', addr, JSON.stringify(res));
    const code = await fetch('https://test-evm-rpc-v3.portaldot.dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [addr, 'latest'] }) }).then((x) => x.json());
    console.log('step8 eth_getCode', addr, JSON.stringify(code));
  }

  // 9. batch size: 50 top-ups + 50 asset transfers — fee/weight only (paymentInfo), then send 50-recipient batch
  const many = Array.from({ length: 50 }, fresh);
  const big = api.tx.utility.batchAll([
    ...many.map((d) => api.tx.balances.transferKeepAlive({ Id: d }, ed + ed / 10n)),
    ...many.map((d) => api.tx.assets.transferKeepAlive(assetId!, { Id: d }, 5_000_000n)),
  ]);
  const info = await big.paymentInfo(me.address);
  console.log('step9 50 recipients (100 calls): weight', JSON.stringify(info.weight.toHuman()), 'fee', info.partialFee.toString(), 'len', big.encodedLength);
  if (process.env.SPIKE_SEND_50 === '1') {
    state.step9 = await send(api, big, me, 'step9 50-recipient batch');
    save();
  }
  const end: any = await api.query.system.account(me.address);
  console.log('sender free after', end.data.free.toString(), '(ED', ed.toString() + ')', 'units', Number(BigInt(end.data.free.toString()) / (UNIT / 1000n)) / 1000);
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
