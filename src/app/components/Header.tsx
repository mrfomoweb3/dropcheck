'use client';
import type { Dropcheck } from '../useDropcheck';
import { CopyAddr } from './ui';
import { formatUnits } from '@/core/units';
import { Logo } from './Logo';

export function Header({ dc }: { dc: Dropcheck }) {
  const { conn, accounts, sender, setSender, connectWallet, senderState, identity, asset } = dc;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-white">
        <Logo light />
        <p className="mt-0.5 text-sm font-medium text-white/90 text-shadow">See which token transfers would fail, then fix and send them all with one signature.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NetworkBadge conn={conn} />
        {accounts ? (
          <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-3 py-1.5 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80">
            <select
              aria-label="Sender account"
              className="max-w-[11rem] bg-transparent text-sm outline-none"
              value={sender?.address}
              onChange={(e) => setSender(accounts.find((a) => a.address === e.target.value) ?? null)}
            >
              {accounts.map((a) => <option key={a.address} value={a.address}>{a.name ?? a.address.slice(0, 8)}</option>)}
            </select>
            {sender && <CopyAddr value={sender.address} n={4} />}
            {senderState && identity && (
              <span className="text-xs text-zinc-500">
                {formatUnits(senderState.nativeFree, identity.decimals, 4)} {identity.symbol}
                {asset?.exists && <> · {formatUnits(senderState.assetBalance ?? 0n, asset.decimals, 4)} {asset.symbol}</>}
              </span>
            )}
          </div>
        ) : (
          <button className="btn-primary" onClick={connectWallet} disabled={conn.status !== 'ready'}>Connect wallet</button>
        )}
      </div>
    </header>
  );
}

function NetworkBadge({ conn }: { conn: Dropcheck['conn'] }) {
  if (conn.status === 'connecting') return <span className="chip bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">● {conn.note ? 'downloading new chain data…' : 'connecting…'}</span>;
  if (conn.status === 'error') return <span className="chip bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">● offline</span>;
  const { identity, identityOk } = conn;
  return (
    <span
      title={`genesis ${identity.genesis}`}
      className={`chip ${identityOk ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${identityOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {identity.specName}/{identity.specVersion} {identityOk ? 'verified' : 'UNKNOWN NETWORK'}
    </span>
  );
}
