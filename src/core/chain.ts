// Chain access: connect + identity check, constants, asset info, batched account reads, H160 resolution.
import { ApiPromise, WsProvider } from '@polkadot/api';
import { hexToString, isHex, u8aToHex } from '@polkadot/util';
import { h160FallbackAccount } from './address';
import type { AccountState, AssetInfo } from './types';

export interface ChainIdentity {
  genesis: string;
  specName: string;
  specVersion: number;
  ss58: number;
  decimals: number;
  symbol: string;
  ed: bigint;
}

export interface IdentityCheck {
  ok: boolean;
  problems: string[];
}

export function checkIdentity(
  id: Pick<ChainIdentity, 'genesis' | 'specName'>,
  expected: { genesis: string; specName: string },
): IdentityCheck {
  const problems: string[] = [];
  if (id.genesis.toLowerCase() !== expected.genesis.toLowerCase()) {
    problems.push(`Genesis hash ${id.genesis} is not Portaldot V3 testnet (${expected.genesis}).`);
  }
  if (id.specName !== expected.specName) {
    problems.push(`Runtime "${id.specName}" is not "${expected.specName}".`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Connect and wait until the API is ready. `metadata` is a known `${genesis}-${specVersion}` -> hex map;
 * polkadot.js uses it only on an exact match, which skips the ~1 MB metadata download.
 */
export async function connect(
  wss: string,
  timeoutMs = 90_000,
  metadata?: Record<string, `0x${string}`>,
): Promise<ApiPromise> {
  const provider = new WsProvider(wss, 2_500);
  const api = new ApiPromise({ provider, noInitWarn: true, throwOnConnect: true, metadata });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      api.isReadyOrError,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`Node unreachable: ${wss}`)), timeoutMs); }),
    ]);
  } catch (e) {
    await api.disconnect().catch(() => undefined);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return api;
}

export async function readIdentity(api: ApiPromise): Promise<ChainIdentity> {
  const props = await api.rpc.system.properties();
  return {
    genesis: api.genesisHash.toHex(),
    specName: api.runtimeVersion.specName.toString(),
    specVersion: api.runtimeVersion.specVersion.toNumber(),
    ss58: props.ss58Format.isSome ? props.ss58Format.unwrap().toNumber() : 42,
    decimals: props.tokenDecimals.isSome ? props.tokenDecimals.unwrap()[0].toNumber() : 14,
    symbol: props.tokenSymbol.isSome ? props.tokenSymbol.unwrap()[0].toString() : 'UNIT',
    ed: BigInt(api.consts.balances.existentialDeposit.toString()),
  };
}

const bytesToText = (v: { toHex(): string }) => {
  const h = v.toHex();
  return isHex(h) ? hexToString(h) : '';
};

export async function readAsset(api: ApiPromise, assetId: string): Promise<AssetInfo> {
  if (!/^\d+$/.test(assetId)) throw new Error('Asset ID must be a whole number.');
  const [details, meta] = await api.queryMulti([
    [api.query.assets.asset, assetId],
    [api.query.assets.metadata, assetId],
  ]) as unknown as [any, any];
  if (details.isNone) {
    return { id: assetId, exists: false, name: '', symbol: '', decimals: 0, minBalance: 0n, isSufficient: false, status: 'Unknown' };
  }
  const d = details.unwrap();
  return {
    id: assetId,
    exists: true,
    name: bytesToText(meta.name),
    symbol: bytesToText(meta.symbol),
    decimals: meta.decimals.toNumber(),
    minBalance: BigInt(d.minBalance.toString()),
    isSufficient: d.isSufficient.isTrue,
    status: d.status.type,
    owner: d.owner.toString(),
    supply: BigInt(d.supply.toString()),
  };
}

/** Read native + asset state for many accounts with batched queryMulti calls. */
export async function readAccounts(
  api: ApiPromise,
  assetId: string,
  accounts: string[],
  batch = 100,
): Promise<Record<string, AccountState>> {
  const out: Record<string, AccountState> = {};
  const uniq = [...new Set(accounts)];
  for (let i = 0; i < uniq.length; i += batch) {
    const slice = uniq.slice(i, i + batch);
    const queries = slice.flatMap((a) => [
      [api.query.system.account, a],
      [api.query.assets.account, [assetId, a]],
    ]);
    const res = (await api.queryMulti(queries as any)) as any[];
    slice.forEach((a, j) => {
      const sys = res[j * 2];
      const acc = res[j * 2 + 1];
      const has = acc.isSome;
      out[a] = {
        nativeFree: BigInt(sys.data.free.toString()),
        providers: sys.providers.toNumber(),
        consumers: sys.consumers.toNumber(),
        sufficients: sys.sufficients.toNumber(),
        assetBalance: has ? BigInt(acc.unwrap().balance.toString()) : null,
        assetStatus: has ? acc.unwrap().status.type : null,
      };
    });
  }
  return out;
}

/**
 * H160 -> account hex via ReviveApi.account_id. H160s the runtime call can't resolve are left
 * out; the classifier then applies the h160 ++ 0xEE×12 fallback (see h160FallbackAccount).
 */
export async function resolveEvm(api: ApiPromise, h160s: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const call = (api.call as any).reviveApi?.accountId;
  if (!call) return out;
  await Promise.all(
    [...new Set(h160s)].map(async (h) => {
      try {
        out[h] = u8aToHex((await call(h)).toU8a());
      } catch {
        /* fallback applied by classifier */
      }
    }),
  );
  return out;
}

export { h160FallbackAccount };
