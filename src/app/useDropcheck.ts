'use client';
// Single-screen state: chain connection, wallet, asset, live checks, fee, send, results.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiPromise } from '@polkadot/api';
import type { Signer } from '@polkadot/api/types';
import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import { CHAIN, endpointFromSearch } from '@/config/chain';
import { connect, readIdentity, checkIdentity, readAsset, readAccounts, resolveEvm, type ChainIdentity } from '@/core/chain';
import { parseInput } from '@/core/input';
import { parseAddress, h160FallbackAccount } from '@/core/address';
import { checkRows } from '@/core/checks';
import { buildPlan, type Plan } from '@/core/planner';
import { buildBatch, estimateFee, signAndSend, type SubmitResult } from '@/core/submit';
import type { AccountState, AssetInfo, ChainSnapshot, CheckResult } from '@/core/types';
import { DEMO_TOKEN, freshenDemoCsv, randomAssetId, demoTokenDeposit } from '@/core/demo';

export type ConnState =
  | { status: 'connecting'; note?: string }
  | { status: 'ready'; identity: ChainIdentity; identityOk: boolean; problems: string[] }
  | { status: 'error'; error: string };

export interface WalletAccount { address: string; name?: string; source: string }

export interface RowOutcome {
  status: 'sent' | 'failed';
  block?: number;
  txHash?: string;
  before?: bigint | null;
  after?: bigint | null;
}

export interface RunState {
  phase: 'idle' | 'signing' | 'done' | 'error';
  message?: string;
  chunkIndex?: number;
  results: SubmitResult[];
  outcomes: Record<number, RowOutcome>;
  senderAfter?: bigint;
}

export interface DemoConfig { assetId: string; csv: string; note?: string; fresh?: string[]; sender?: string }

export interface DemoTokenState {
  phase: 'idle' | 'working' | 'error' | 'done';
  message?: string;
  /** Reserved deposit + fee for creating the visitor's own demo token, once estimated. */
  cost?: { deposit: bigint; fee: bigint };
}

const MY_TOKEN_KEY = (address: string) => `dropcheck.demoToken.${address}`;
const readMyToken = (address: string) => { try { return localStorage.getItem(MY_TOKEN_KEY(address)); } catch { return null; } };

const toHex = (ss58: string) => u8aToHex(decodeAddress(ss58));
const CHAIN_SS58 = 42;

const META_KEY = 'dropcheck.metadata';

async function loadKnownMetadata(): Promise<Record<string, `0x${string}`>> {
  const known: Record<string, `0x${string}`> = {};
  try {
    const cached = JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
    if (cached?.key && cached?.hex) known[cached.key] = cached.hex;
  } catch { /* storage unavailable */ }
  try {
    const r = await fetch('/metadata.json');
    if (r.ok) {
      const { key, hex } = await r.json();
      if (key && hex) known[key] = hex;
    }
  } catch { /* snapshot missing: the API downloads metadata from the node */ }
  return known;
}

function cacheMetadata(api: ApiPromise) {
  try {
    const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toNumber()}`;
    const cached = JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
    if (cached?.key !== key) localStorage.setItem(META_KEY, JSON.stringify({ key, hex: api.runtimeMetadata.toHex() }));
  } catch { /* quota or private mode: fine */ }
}

export function useDropcheck() {
  const apiRef = useRef<ApiPromise | null>(null);
  const [conn, setConn] = useState<ConnState>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  const [accounts, setAccounts] = useState<WalletAccount[] | null>(null);
  const [walletError, setWalletError] = useState<string>();
  const [sender, setSender] = useState<WalletAccount | null>(null);
  const signerRef = useRef<Signer | null>(null);

  const [assetId, setAssetId] = useState('');
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const [assetError, setAssetError] = useState<string>();

  const [text, setText] = useState('');
  const [merge, setMerge] = useState(true);
  const [demo, setDemo] = useState<DemoConfig | null>(null);

  const [chainState, setChainState] = useState<{ accounts: Record<string, AccountState>; evmMap: Record<string, string> }>({ accounts: {}, evmMap: {} });
  const [senderState, setSenderState] = useState<AccountState | null>(null);
  const [checking, setChecking] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  // A fee is only valid for the exact plan + sender it was estimated for.
  const [feeState, setFeeState] = useState<{ key: string; value: bigint } | null>(null);
  const [feeError, setFeeError] = useState<string>();
  const [run, setRun] = useState<RunState>({ phase: 'idle', results: [], outcomes: {} });

  // Connect (and retry). Metadata comes from the shipped snapshot or a localStorage cache when they match.
  useEffect(() => {
    let cancelled = false;
    setConn({ status: 'connecting' });
    const wss = endpointFromSearch(window.location.search);
    loadKnownMetadata()
      .then((metadata) => connect(wss, 90_000, metadata, {
        slowTimeoutMs: 300_000,
        onProbe: (p) => {
          if (!cancelled && !p.metadataKnown) {
            setConn({ status: 'connecting', note: `Portaldot updated the chain (runtime ${p.specVersion}). Downloading the new chain description, about 1 MB, one time only. This can take a minute or two.` });
          }
        },
      }))
      .then(async (api) => {
        if (cancelled) { await api.disconnect(); return; }
        apiRef.current = api;
        cacheMetadata(api);
        const identity = await readIdentity(api);
        const chk = checkIdentity(identity, { genesis: CHAIN.expectedGenesis, specName: CHAIN.expectedSpecName });
        setConn({ status: 'ready', identity, identityOk: chk.ok, problems: chk.problems });
      })
      .catch((e) => !cancelled && setConn({ status: 'error', error: (e as Error).message }));
    return () => {
      cancelled = true;
      apiRef.current?.disconnect().catch(() => undefined);
      apiRef.current = null;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Demo config (asset id + list) shipped with the site.
  useEffect(() => {
    fetch('/demo.json').then((r) => (r.ok ? r.json() : null)).then((d: DemoConfig | null) => {
      if (!d) return;
      setDemo(d);
      setAssetId((cur) => cur || d.assetId);
      // New never-used accounts on every load, so the top-up case is always shown, however often the demo is sent.
      setText((cur) => cur || freshenDemoCsv(d.csv, d.fresh ?? [], CHAIN_SS58));
    }).catch(() => undefined);
  }, []);
  const [myToken, setMyToken] = useState<string | null>(null);
  const loadDemo = useCallback(() => {
    if (!demo) return;
    setAssetId(myToken ?? demo.assetId);
    setText(freshenDemoCsv(demo.csv, demo.fresh ?? [], CHAIN_SS58));
    setRun({ phase: 'idle', results: [], outcomes: {} });
  }, [demo, myToken]);

  const ready = conn.status === 'ready';
  const identity = ready ? conn.identity : null;

  // Asset info.
  useEffect(() => {
    const api = apiRef.current;
    setAsset(null);
    setAssetError(undefined);
    if (!ready || !api || !assetId.trim()) return;
    const t = setTimeout(() => {
      readAsset(api, assetId.trim()).then(setAsset).catch((e) => setAssetError((e as Error).message));
    }, 300);
    return () => clearTimeout(t);
  }, [ready, assetId]);

  // Wallet.
  const connectWallet = useCallback(async () => {
    setWalletError(undefined);
    try {
      const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
      const exts = await web3Enable('Dropcheck');
      if (!exts.length) {
        setWalletError('No Polkadot wallet extension found. Install Talisman, SubWallet or polkadot{.js}, then reload.');
        return;
      }
      const accs = await web3Accounts({ ss58Format: identity?.ss58 ?? 42 });
      const list = accs
        .filter((a) => a.type !== 'ethereum')
        .map((a) => ({ address: a.address, name: a.meta.name, source: a.meta.source }));
      if (!list.length) { setWalletError('Your wallet has no Substrate accounts shared with this site.'); return; }
      setAccounts(list);
      setSender((cur) => cur ?? list[0]);
    } catch (e) {
      setWalletError((e as Error).message);
    }
  }, [identity?.ss58]);

  useEffect(() => {
    signerRef.current = null;
    if (!sender) return;
    import('@polkadot/extension-dapp').then(({ web3FromSource }) => web3FromSource(sender.source))
      .then((inj) => { signerRef.current = inj.signer as Signer; })
      .catch((e) => setWalletError((e as Error).message));
  }, [sender]);

  // Parse + fetch chain state for the list (debounced, batched with queryMulti, cached by account).
  const parsed = useMemo(() => parseInput(text, CHAIN), [text]);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    setParseErrors(parsed.errors);
    const api = apiRef.current;
    if (!ready || !api || !asset?.exists) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const h160s: string[] = [];
        const direct: string[] = [];
        for (const r of parsed.rows) {
          const a = parseAddress(r.addressInput);
          if (a.kind === 'h160') h160s.push(a.h160!);
          if (a.kind === 'ss58') direct.push(a.accountHex!);
        }
        const evmMap = await resolveEvm(api, h160s);
        const evmAccts = h160s.map((h) => evmMap[h] ?? u8aToHex(h160FallbackAccount(h)));
        const accs = await readAccounts(api, asset.id, [...direct, ...evmAccts]);
        if (sender) {
          const s = await readAccounts(api, asset.id, [toHex(sender.address)]);
          if (!cancelled) setSenderState(Object.values(s)[0]);
        } else if (!cancelled) setSenderState(null);
        if (!cancelled) setChainState({ accounts: accs, evmMap });
      } catch (e) {
        if (!cancelled) setParseErrors((p) => [...p, `Couldn't read chain state: ${(e as Error).message}`]);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [ready, asset, parsed, sender, refreshTick]);

  const baseSnapshot: ChainSnapshot | null = useMemo(() => {
    if (!identity || !asset) return null;
    return {
      ss58: identity.ss58,
      nativeDecimals: identity.decimals,
      nativeSymbol: identity.symbol,
      ed: identity.ed,
      asset,
      accounts: chainState.accounts,
      evmMap: chainState.evmMap,
      sender: sender && senderState ? { account: toHex(sender.address), state: senderState } : undefined,
      topupBufferBps: CHAIN.topupBufferBps,
    };
  }, [identity, asset, chainState, sender, senderState]);

  // Rows and plan never depend on the fee; the fee only feeds the sender-balance run check.
  const planResult: CheckResult | null = useMemo(
    () => (baseSnapshot && parsed.rows.length ? checkRows(parsed.rows, baseSnapshot, { mergeDuplicates: merge }) : null),
    [baseSnapshot, parsed, merge],
  );
  const plan: Plan | null = useMemo(() => (planResult && baseSnapshot ? buildPlan(planResult.rows, baseSnapshot) : null), [planResult, baseSnapshot]);
  const planKey = plan ? plan.chunks.map((c) => c.calls.map((x) => `${x.kind}${x.dest}${x.amount}`).join()).join('|') : '';
  const feeKey = `${planKey}#${sender?.address ?? ''}`;
  const fee = feeState?.key === feeKey ? feeState.value : undefined;

  const result: CheckResult | null = useMemo(
    () => (baseSnapshot && planResult && fee !== undefined
      ? checkRows(parsed.rows, { ...baseSnapshot, feeEstimate: fee }, { mergeDuplicates: merge })
      : planResult),
    [baseSnapshot, planResult, fee, parsed, merge],
  );

  // Fee estimate for the current plan.
  useEffect(() => {
    const api = apiRef.current;
    setFeeError(undefined);
    if (!api || !plan || !sender || !plan.transfers) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        let total = 0n;
        for (const ch of plan.chunks) total += await estimateFee(buildBatch(api, ch), sender.address);
        if (!cancelled) setFeeState({ key: feeKey, value: total });
      } catch (e) {
        if (!cancelled) setFeeError((e as Error).message);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeKey]);

  // Send.
  const send = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !plan || !sender || !result || !asset) return;
    if (conn.status !== 'ready' || !conn.identityOk) return;
    const signer = signerRef.current;
    if (!signer) { setRun({ phase: 'error', message: 'Wallet signer not ready. Reconnect your wallet.', results: [], outcomes: {} }); return; }

    const before = chainState.accounts;
    const outcomes: Record<number, RowOutcome> = {};
    const results: SubmitResult[] = [];
    const rowsByLine = new Map(result.rows.map((r) => [r.line, r]));
    try {
      for (let i = 0; i < plan.chunks.length; i++) {
        const chunk = plan.chunks[i];
        setRun({ phase: 'signing', chunkIndex: i, message: `Sign batch ${i + 1} of ${plan.chunks.length} in your wallet…`, results, outcomes });
        const res = await signAndSend(api, buildBatch(api, chunk), { address: sender.address, signer }, (m) =>
          setRun((s) => ({ ...s, message: `Batch ${i + 1}/${plan.chunks.length}: ${m}` })));
        results.push(res);
        const lines = chunk.calls.filter((c) => c.kind === 'asset');
        for (const c of lines) {
          const hit = res.ok && res.transfers.some((t) => t.kind === 'asset' && t.to === c.dest && t.amount === c.amount);
          outcomes[c.line] = { status: hit ? 'sent' : 'failed', block: res.blockNumber || undefined, txHash: res.txHash, before: before[c.dest]?.assetBalance ?? null };
        }
        if (!res.ok) {
          setRun({ phase: 'error', message: res.error ?? 'Batch failed. Nothing in it was applied.', results, outcomes });
          return;
        }
      }
      // Re-read balances: before -> after.
      const dests = Object.keys(outcomes).map((l) => rowsByLine.get(Number(l))!.account!);
      const after = await readAccounts(api, asset.id, [...dests, toHex(sender.address)]);
      for (const [l, o] of Object.entries(outcomes)) o.after = after[rowsByLine.get(Number(l))!.account!]?.assetBalance ?? null;
      if (after[toHex(sender.address)]) setSenderState(after[toHex(sender.address)]);
      setRun({ phase: 'done', results, outcomes, senderAfter: after[toHex(sender.address)]?.nativeFree, message: 'All batches included on-chain.' });
    } catch (e) {
      const msg = (e as Error).message;
      setRun({ phase: 'error', message: /cancel|reject/i.test(msg) ? 'You cancelled the signature. Nothing was sent.' : msg, results, outcomes });
    }
  }, [plan, sender, result, asset, conn, chainState]);

  const resetRun = useCallback(() => { setRun({ phase: 'idle', results: [], outcomes: {} }); refresh(); }, [refresh]);

  // ---- Visitor's own demo token -------------------------------------------------------------
  // The shipped demo token is held by our demo key only. Any visitor with a little tPOT can create
  // their own copy (same name, decimals, min balance) in one signature, then run the same demo list.
  const [demoToken, setDemoToken] = useState<DemoTokenState>({ phase: 'idle' });

  // Remembered token for this wallet (only if it still exists and this wallet owns it).
  useEffect(() => {
    setMyToken(null);
    const api = apiRef.current;
    if (!ready || !api || !sender) return;
    const id = readMyToken(sender.address);
    if (!id) return;
    let cancelled = false;
    (api.query.assets.asset(id) as Promise<any>).then((a) => {
      if (cancelled || a.isNone || a.unwrap().owner.toString() !== sender.address) return;
      setMyToken(id);
      setAssetId((cur) => (demo && cur === demo.assetId ? id : cur));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready, sender, demo]);

  const isDemoAsset = !!demo && (assetId.trim() === demo.assetId || (!!myToken && assetId.trim() === myToken));
  const senderLacksAsset = !!senderState && !!result && (senderState.assetBalance ?? 0n) < result.summary.totalAsset;
  const offerDemoToken = isDemoAsset && !!sender && senderLacksAsset && !myToken;

  // Cost estimate, only when the offer is shown.
  useEffect(() => {
    const api = apiRef.current;
    if (!offerDemoToken || !api || !sender) return;
    let cancelled = false;
    (async () => {
      const c = api.consts.assets as any;
      const deposit = demoTokenDeposit({
        assetDeposit: BigInt(c.assetDeposit.toString()),
        metadataDepositBase: BigInt(c.metadataDepositBase.toString()),
        metadataDepositPerByte: BigInt(c.metadataDepositPerByte.toString()),
      });
      const fee = await estimateFee(demoTokenBatch(api, 1_000_000, sender.address), sender.address);
      if (!cancelled) setDemoToken((s) => ({ ...s, cost: { deposit, fee } }));
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [offerDemoToken, sender]);

  const createDemoToken = useCallback(async () => {
    const api = apiRef.current;
    const signer = signerRef.current;
    if (!api || !sender || !demo || conn.status !== 'ready' || !conn.identityOk) return;
    if (!signer) { setDemoToken((s) => ({ ...s, phase: 'error', message: 'Wallet signer not ready. Reconnect your wallet.' })); return; }
    setDemoToken((s) => ({ ...s, phase: 'working', message: 'Finding a free token ID…' }));
    try {
      let id = 0;
      for (let i = 0; i < 10 && !id; i++) {
        const c = randomAssetId();
        if (((await api.query.assets.asset(c)) as any).isNone) id = c;
      }
      if (!id) throw new Error('Could not find a free token ID. Try again.');
      setDemoToken((s) => ({ ...s, message: 'Sign in your wallet to create your demo token…' }));
      const res = await signAndSend(api, demoTokenBatch(api, id, sender.address), { address: sender.address, signer },
        (m) => setDemoToken((s) => ({ ...s, message: m })));
      if (!res.ok) throw new Error(res.error ?? 'Creating the token failed. Nothing was changed.');
      try { localStorage.setItem(MY_TOKEN_KEY(sender.address), String(id)); } catch { /* fine */ }
      setMyToken(String(id));
      setAssetId(String(id));
      setText(freshenDemoCsv(demo.csv, demo.fresh ?? [], CHAIN_SS58));
      setRun({ phase: 'idle', results: [], outcomes: {} });
      setDemoToken({ phase: 'done', message: `Your demo token ${id} (DROP) was created in block #${res.blockNumber}. The demo list now uses it: press Fix & Send.` });
    } catch (e) {
      const msg = (e as Error).message;
      setDemoToken((s) => ({ ...s, phase: 'error', message: /cancel|reject/i.test(msg) ? 'You cancelled the signature. Nothing was created.' : msg }));
    }
  }, [sender, demo, conn]);

  return {
    conn, retry, identity,
    accounts, sender, setSender, connectWallet, walletError, senderState,
    assetId, setAssetId, asset, assetError,
    text, setText, merge, setMerge, demo, loadDemo,
    myToken, offerDemoToken, demoToken, createDemoToken,
    parsed, parseErrors, checking, result, plan, fee, feeError,
    run, send, resetRun,
  };
}

export type Dropcheck = ReturnType<typeof useDropcheck>;

/** create + setMetadata + mint to the creator, atomically. Same parameters as the shipped demo token. */
function demoTokenBatch(api: ApiPromise, id: number, owner: string) {
  return api.tx.utility.batchAll([
    api.tx.assets.create(id, { Id: owner }, DEMO_TOKEN.minBalance),
    api.tx.assets.setMetadata(id, DEMO_TOKEN.name, DEMO_TOKEN.symbol, DEMO_TOKEN.decimals),
    api.tx.assets.mint(id, { Id: owner }, DEMO_TOKEN.mint),
  ]);
}
