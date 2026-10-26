'use client';
import { useRef } from 'react';
import type { Dropcheck } from '../useDropcheck';
import { formatUnits } from '@/core/units';
import { CHAIN } from '@/config/chain';
import { Banner } from './ui';

export function InputPanel({ dc }: { dc: Dropcheck }) {
  const { assetId, setAssetId, asset, assetError, text, setText, demo, loadDemo, merge, setMerge, parseErrors, parsed, run } = dc;
  const fileRef = useRef<HTMLInputElement>(null);
  const locked = run.phase === 'signing';

  return (
    <section className="space-y-4">
      <div className="card space-y-3 p-4">
        <label className="block text-sm font-medium" htmlFor="asset">Token (Assets pallet ID)</label>
        <input
          id="asset" className="input font-mono" inputMode="numeric" placeholder="e.g. 4242"
          value={assetId} disabled={locked}
          onChange={(e) => setAssetId(e.target.value.replace(/[^\d]/g, '').slice(0, 20))}
        />
        {assetError && <Banner tone="red">{assetError}</Banner>}
        {asset && !asset.exists && <Banner tone="red">No asset with ID {asset.id} exists on this network.</Banner>}
        {asset?.exists && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-zinc-500">Name</dt><dd className="font-medium">{asset.name || '—'} ({asset.symbol || '?'})</dd>
            <dt className="text-zinc-500">Decimals</dt><dd>{asset.decimals}</dd>
            <dt className="text-zinc-500">Min. balance</dt><dd>{formatUnits(asset.minBalance, asset.decimals)} {asset.symbol}</dd>
            <dt className="text-zinc-500" title="Sufficient assets can be held by wallets with no native token">Needs native token</dt>
            <dd>{asset.isSufficient ? 'No (sufficient asset)' : 'Yes: recipients need tPOT'}</dd>
            <dt className="text-zinc-500">Status</dt><dd className={asset.status === 'Live' ? 'text-emerald-600' : 'font-semibold text-red-600'}>{asset.status}</dd>
          </dl>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium" htmlFor="list">
            Recipients <span className="font-normal text-zinc-500">(address, amount per line)</span>
          </label>
          <span
            className="cursor-help text-xs text-zinc-500 underline decoration-dotted"
            title={`Amounts are in whole tokens, not base units. ${asset?.exists ? `${asset.symbol} has ${asset.decimals} decimals: 1 = ${10n ** BigInt(asset.decimals)} base units.` : 'tPOT has 14 decimals: 1 tPOT = 100,000,000,000,000 base units.'}`}
          >
            amounts in whole tokens ⓘ
          </span>
        </div>
        <textarea
          id="list" className="input h-64 resize-y font-mono text-xs leading-5" spellCheck={false} disabled={locked}
          placeholder={'5Grw…utQY, 100\n0xf7eC65d1…4142, 25.5'}
          value={text} onChange={(e) => setText(e.target.value.slice(0, CHAIN.maxRows * CHAIN.maxLineLength))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" disabled={!demo || locked} onClick={loadDemo} title={demo?.note}>Load demo list</button>
          <button className="btn-ghost" disabled={locked} onClick={() => fileRef.current?.click()}>Upload CSV</button>
          <input
            ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 200_000) { alert('CSV is too large (max 200 KB).'); return; }
              f.text().then(setText);
              e.target.value = '';
            }}
          />
          {text && <button className="btn-ghost" disabled={locked} onClick={() => setText('')}>Clear</button>}
          <label className="ml-auto flex items-center gap-2 text-xs">
            <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} disabled={locked} />
            Merge duplicate wallets
          </label>
        </div>
        <p className="text-xs text-zinc-500">{parsed.rows.length} rows · max {CHAIN.maxRows}. Accepts Portaldot (5…), other Substrate networks, and MetaMask (0x…) addresses.</p>
        {parseErrors.map((e) => <Banner key={e} tone="amber">{e}</Banner>)}
      </div>
    </section>
  );
}
