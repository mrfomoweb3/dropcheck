// Build a read-only preview list for an existing asset: real holders + fresh + EVM + bad rows.
import { ApiPromise, WsProvider } from '@polkadot/api';
import { encodeAddress, mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
const assetId = process.argv[2] ?? '7777';
await cryptoWaitReady();
const api = await ApiPromise.create({ provider: new WsProvider('wss://test-node-v3.portaldot.dev'), noInitWarn: true });
const holders = (await api.query.assets.account.entries(assetId)).map(([k]: any) => k.args[1].toString()).slice(0, 6);
const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
const fresh = [0, 1, 2].map(() => kr.addFromUri(mnemonicGenerate()).address);
const lines = ['address,amount',
  ...holders.map((h, i) => `${h},${10 + i}`),
  ...fresh.map((f) => `${f},5`),
  '0xf7eC65d11e35375A250e474059a917B537804142,7.5',
  `${encodeAddress(kr.addFromUri(mnemonicGenerate()).publicKey, 0)},3`,
  `${holders[0]},2`,
  `${fresh[0].slice(0, -3)}abc,1`,
  `${kr.addFromUri(mnemonicGenerate()).address},0.001`,
  `${holders[1]},50000`,
];
console.log(lines.join('\n'));
await api.disconnect();
