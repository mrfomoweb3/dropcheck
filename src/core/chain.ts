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

export interface ConnectProbe {
  /** `${genesis}-${specVersion}` of the node we reached. */
  key: string;
  specVersion: number;
  /** true when shipped/cached metadata matches, so no ~1 MB download is needed. */
  metadataKnown: boolean;
}

/**
 * Connect and wait until the API is ready. `metadata` is a known `${genesis}-${specVersion}` -> hex map;
 * polkadot.js uses it only on an exact match, which skips the ~1 MB metadata download.
 * Before starting the API, two tiny RPC calls on the same socket tell whether the runtime was upgraded
 * (no matching metadata). Then `onProbe` fires and the slower `slowTimeoutMs` applies, so the UI can say
 * "downloading new chain data" instead of looking dead.
 */
export async function connect(
  wss: string,
  timeoutMs = 90_000,
  metadata?: Record<string, `0x${string}`>,
  opts: { slowTimeoutMs?: number; onProbe?: (p: ConnectProbe) => void } = {},
): Promise<ApiPromise> {
  // Long per-request timeout: the metadata download below can take 20+ s on the public V3 node.
  const provider = new WsProvider(wss, 2_500, {}, Math.max(opts.slowTimeoutMs ?? 0, 120_000));
  let api: ApiPromise | undefined;
  let known = metadata;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let budget = timeoutMs;
  const deadline = (ms: number) => new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`Node unreachable: ${wss}`)), ms); });
  try {
    const t0 = Date.now();
    await Promise.race([provider.isReady, deadline(timeoutMs)]);
    clearTimeout(timer);
    try {
      const [genesis, rv] = await Promise.race([
        Promise.all([provider.send('chain_getBlockHash', [0]), provider.send('state_getRuntimeVersion', [])]),
        deadline(20_000),
      ]);
      clearTimeout(timer);
      const key = `${genesis}-${rv.specVersion}`;
      const metadataKnown = !!metadata?.[key];
      if (!metadataKnown && opts.slowTimeoutMs) budget = opts.slowTimeoutMs;
      opts.onProbe?.({ key, specVersion: Number(rv.specVersion), metadataKnown });
      if (!metadataKnown) {
        // Download it ourselves with plain state_getMetadata. polkadot.js would first try
        // state_call Metadata_metadata_at_version, which makes the V3 node drop the socket (verified 2026-11-05).
        known = { ...metadata, [key]: await downloadMetadata(wss, t0 + budget) };
      }
    } catch (e) {
      clearTimeout(timer);
      // Probe is best-effort, but a failed download after an upgrade is a real connection failure.
      if ((e as Error).message.startsWith('Node unreachable')) throw e;
    }
    api = new ApiPromise({ provider, noInitWarn: true, throwOnConnect: true, metadata: known });
    await Promise.race([api.isReadyOrError, deadline(Math.max(budget - (Date.now() - t0), 15_000))]);
  } catch (e) {
    if (api) await api.disconnect().catch(() => undefined);
    else await provider.disconnect().catch(() => undefined);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return api;
}

/**
 * state_getMetadata with retries: the public node sometimes stalls or drops the socket mid-download (1006),
 * and a request on a stalled socket never settles. So each attempt uses its own fresh connection and gets
 * 45 s (a normal download takes ~20 s). Gives up at `deadlineAt`.
 */
async function downloadMetadata(wss: string, deadlineAt: number): Promise<`0x${string}`> {
  let last: unknown;
  for (let attempt = 1; attempt <= 6 && Date.now() < deadlineAt; attempt++) {
    const ms = Math.min(45_000, deadlineAt - Date.now());
    const p = new WsProvider(wss, false, {}, ms + 5_000);
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('metadata download timed out')), ms); });
      await Promise.race([p.connect(), timeout]);
      await Promise.race([p.isReady, timeout]);
      return await Promise.race([p.send('state_getMetadata', []) as Promise<`0x${string}`>, timeout]);
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(t);
      p.disconnect().catch(() => undefined);
    }
  }
  throw new Error(`Node unreachable: chain metadata download failed (${(last as Error)?.message ?? 'timeout'})`);
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
  // Raw state_call, not api.call.reviveApi: the shipped metadata snapshot is v14 (no runtime-API section),
  // so api.call.reviveApi is undefined there and every H160 would silently get the fallback mapping.
  // Input is the SCALE of [u8; 20] (the raw bytes); output is AccountId32 (32 raw bytes).
  await Promise.all(
    [...new Set(h160s)].map(async (h) => {
      try {
        const res = (await api.rpc.state.call('ReviveApi_account_id', h)).toU8a(true);
        if (res.length === 32) out[h] = u8aToHex(res);
      } catch {
        /* fallback applied by classifier */
      }
    }),
  );
  return out;
}

export { h160FallbackAccount };
