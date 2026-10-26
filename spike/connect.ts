// Spike steps 1-4: identity, constants, call presence, address mapping. Read-only, no keys.
import { ApiPromise, WsProvider } from '@polkadot/api';
import { u8aConcat, u8aToHex, hexToU8a } from '@polkadot/util';
import { encodeAddress } from '@polkadot/util-crypto';

const WSS = process.env.DROPCHECK_WSS ?? 'wss://test-node-v3.portaldot.dev';
const H160 = '0xf7eC65d11e35375A250e474059a917B537804142';
const EXPECTED = '5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y';

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(WSS), noInitWarn: true });
  const rv = api.runtimeVersion;
  const props = await api.rpc.system.properties();
  console.log('## 1. identity');
  console.log('genesis', api.genesisHash.toHex());
  console.log('spec', rv.specName.toString(), rv.specVersion.toNumber());
  console.log('chain', (await api.rpc.system.chain()).toString());
  console.log('properties', JSON.stringify(props.toHuman()));
  console.log('pallets', api.runtimeMetadata.asLatest.pallets.length);
  console.log('header', (await api.rpc.chain.getHeader()).number.toNumber());

  console.log('## 2. constants');
  console.log('ED', api.consts.balances.existentialDeposit.toString());
  console.log('blockWeights.maxBlock', JSON.stringify((api.consts.system.blockWeights as any).maxBlock.toHuman()));
  console.log('utility.batchedCallsLimit', api.consts.utility?.batchedCallsLimit?.toString());
  for (const k of ['assetDeposit', 'assetAccountDeposit', 'metadataDepositBase', 'metadataDepositPerByte', 'stringLimit']) {
    console.log('assets.' + k, (api.consts.assets as any)?.[k]?.toString());
  }

  console.log('## 3. calls');
  const calls: [string, string][] = [
    ['balances', 'transfer'], ['balances', 'transferKeepAlive'], ['balances', 'transferAllowDeath'],
    ['assets', 'create'], ['assets', 'setMetadata'], ['assets', 'mint'], ['assets', 'transferKeepAlive'],
    ['assets', 'transfer'], ['assets', 'touch'], ['assets', 'touchOther'], ['utility', 'batchAll'], ['utility', 'forceBatch'],
  ];
  for (const [p, c] of calls) console.log(`${p}.${c}`, typeof (api.tx as any)[p]?.[c] === 'function');
  console.log('runtime apis', Object.keys(api.call).join(','));
  console.log('reviveApi methods', Object.keys((api.call as any).reviveApi ?? {}).join(','));
  const rpcs = await api.rpc.rpc.methods();
  const methods = rpcs.methods.map((m) => m.toString());
  console.log('system_dryRun', methods.includes('system_dryRun'));
  console.log('rpc count', methods.length);
  console.log('revive storage', Object.keys((api.query as any).revive ?? {}).join(','));
  console.log('assets storage', Object.keys((api.query as any).assets ?? {}).join(','));
  console.log('assets errors', Object.keys((api.errors as any).assets ?? {}).join(','));

  console.log('## 4. address mapping');
  const fallback = u8aConcat(hexToU8a(H160), new Uint8Array(12).fill(0xee));
  const fb = encodeAddress(fallback, 42);
  console.log('fallback', fb, fb === EXPECTED);
  try {
    const r = await (api.call as any).reviveApi.address?.(EXPECTED);
    console.log('reviveApi.address(ss58)', r?.toHex?.() ?? r?.toString());
  } catch (e) { console.log('reviveApi.address err', (e as Error).message); }
  try {
    const orig = await (api.query as any).revive.originalAccount?.(H160);
    console.log('Revive.OriginalAccount', orig?.toHuman());
  } catch (e) { console.log('originalAccount err', (e as Error).message); }
  try {
    const acc = await (api.call as any).reviveApi.accountId?.(H160);
    console.log('reviveApi.accountId', acc ? encodeAddress(acc.toU8a(), 42) : 'n/a', acc ? encodeAddress(acc.toU8a(), 42) === EXPECTED : '');
  } catch (e) { console.log('reviveApi.accountId err', (e as Error).message); }
  console.log('fallbackHex', u8aToHex(fallback));
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
