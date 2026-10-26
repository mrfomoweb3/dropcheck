import { ApiPromise, WsProvider } from '@polkadot/api';
const api = await ApiPromise.create({ provider: new WsProvider('wss://test-node-v3.portaldot.dev'), noInitWarn: true });
const entries = await api.query.assets.asset.entries();
const metas = await api.query.assets.metadata.entries();
const m = new Map(metas.map(([k, v]: any) => [k.args[0].toString(), v.toHuman()]));
console.log('asset count', entries.length, 'nextAssetId', (await (api.query.assets as any).nextAssetId()).toHuman());
for (const [k, v] of entries.slice(0, 40) as any) {
  const d = v.unwrap();
  const id = k.args[0].toString();
  console.log(id, d.status.type, 'suff', d.isSufficient.isTrue, 'min', d.minBalance.toString(), 'holders', d.accounts.toString(), JSON.stringify(m.get(id)));
}
await api.disconnect();
