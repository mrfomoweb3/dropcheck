'use client';
import { useState } from 'react';
import type { Dropcheck } from '../useDropcheck';
import { formatUnits } from '@/core/units';
import { blockLink, CHAIN } from '@/config/chain';
import { Banner } from './ui';

export function SummaryBar({ dc }: { dc: Dropcheck }) {
  const { result, asset, identity, fee, feeError, sender, conn, run, connectWallet } = dc;
  const [confirm, setConfirm] = useState(false);
  if (!result || !asset?.exists || !identity) return null;
  const s = result.summary;
  const blocking = result.runIssues.filter((i) => i.blocking);
  const identityOk = conn.status === 'ready' && conn.identityOk;
  // Locked while chain state is loading or the fee is for an older plan (fee is undefined then).
  const canSend = identityOk && !!sender && !dc.checking && blocking.length === 0 && fee !== undefined && run.phase !== 'signing' && run.phase !== 'done';
  const n = (v: bigint) => formatUnits(v, identity.decimals, 6);

  return (
    <>
      <div className="sticky bottom-3 z-10 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_10px_40px_-10px_rgba(20,40,15,.45)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span><b>{s.recipients}</b> recipients</span>
          <span className="text-emerald-600">{s.ok} ok</span>
          <span className="text-amber-600">{s.autoFixable} auto-fixable</span>
          <span className="text-red-600">{s.blocked} skipped</span>
          <span className="hidden sm:inline text-zinc-400">|</span>
          <span>{formatUnits(s.totalAsset, asset.decimals)} {asset.symbol}</span>
          <span>+ {n(s.totalTopup)} {identity.symbol} top-ups</span>
          <span className="text-zinc-500">fee {fee !== undefined ? `≈ ${n(fee)} ${identity.symbol}` : sender ? (feeError ? 'unavailable' : 'estimating…') : 'shown after wallet connects'}</span>
          <div className="ml-auto">
            {!sender ? (
              <button className="btn-primary" onClick={connectWallet}>Connect wallet to send</button>
            ) : (
              <button className="btn-primary" disabled={!canSend} onClick={() => setConfirm(true)}>Fix &amp; Send</button>
            )}
          </div>
        </div>
        {(blocking.length > 0 || !identityOk) && (
          <div className="mx-auto mt-2 max-w-7xl space-y-1">
            {!identityOk && <Banner tone="red">Sending is disabled: this is not the Portaldot V3 testnet.</Banner>}
            {blocking.filter((b) => b.code !== 'OK' || s.transfers === 0).map((b, i) => (
              <Banner key={i} tone={b.severity === 'red' ? 'red' : 'info'}>{b.message}</Banner>
            ))}
          </div>
        )}
      </div>
      {confirm && <ConfirmModal dc={dc} onClose={() => setConfirm(false)} />}
    </>
  );
}

function ConfirmModal({ dc, onClose }: { dc: Dropcheck; onClose: () => void }) {
  const { plan, asset, identity, fee, send } = dc;
  if (!plan || !asset || !identity) return null;
  const n = (v: bigint) => formatUnits(v, identity.decimals);
  const a = (v: bigint) => formatUnits(v, asset.decimals);
  const nativeTotal = plan.totalTopup + (fee ?? 0n);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="card w-full max-w-lg space-y-4 p-5 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold">Review before signing</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {plan.chunks.length === 1 ? 'One atomic batch: if any call fails, nothing is applied.' : `${plan.chunks.length} atomic batches, one signature each, sent in order.`}
        </p>
        <table className="w-full text-sm">
          <tbody className="[&_td]:py-1">
            <tr><td>Top-ups (new wallets)</td><td className="text-right"><b>{plan.topups}</b> × {n(plan.totalTopup / BigInt(plan.topups || 1))} {identity.symbol}</td></tr>
            <tr><td>Token transfers</td><td className="text-right"><b>{plan.transfers}</b></td></tr>
            <tr className="border-t border-zinc-200 dark:border-zinc-800"><td>Total {asset.symbol}</td><td className="text-right font-mono">{a(plan.totalAsset)}<div className="text-[10px] text-zinc-500">{plan.totalAsset.toString()} base units</div></td></tr>
            <tr><td>Total top-ups</td><td className="text-right font-mono">{n(plan.totalTopup)} {identity.symbol}<div className="text-[10px] text-zinc-500">{plan.totalTopup.toString()} planck</div></td></tr>
            <tr><td>Network fee (est.)</td><td className="text-right font-mono">{fee !== undefined ? `${n(fee)} ${identity.symbol}` : '—'}<div className="text-[10px] text-zinc-500">{fee?.toString()} planck</div></td></tr>
            <tr className="border-t border-zinc-200 font-semibold dark:border-zinc-800"><td>Total {identity.symbol} spent</td><td className="text-right font-mono">{n(nativeTotal)}</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-zinc-500">
          Calls use <code>transfer_keep_alive</code>, so your account can never be reaped. Your wallet will show the batch before you sign.
          The signed batch is dry-run on the node first; if the dry-run fails, nothing is broadcast.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onClose(); send(); }}>Sign {plan.chunks.length > 1 ? `${plan.chunks.length} batches` : 'once'} &amp; send</button>
        </div>
      </div>
    </div>
  );
}

export function RunPanel({ dc }: { dc: Dropcheck }) {
  const { run, result, asset, identity, resetRun, sender } = dc;
  if (run.phase === 'idle' || !result || !asset || !identity) return null;
  const sent = Object.values(run.outcomes).filter((o) => o.status === 'sent').length;

  const proof = () => [
    `## Dropcheck run, ${new Date().toISOString()}`,
    `Network: Portaldot V3 testnet (${CHAIN.expectedGenesis.slice(0, 10)}…) · Asset ${asset.id} (${asset.symbol})`,
    `Sender: ${sender?.address}`,
    ...run.results.map((r, i) => `- Batch ${i + 1}: tx \`${r.txHash}\` · block [#${r.blockNumber}](${blockLink(r.blockNumber)}) \`${r.blockHash}\` · ${r.ok ? 'BatchCompleted' : `FAILED: ${r.error}`} · ${r.transfers.filter((t) => t.kind === 'asset').length} asset + ${r.transfers.filter((t) => t.kind === 'native').length} native transfers`),
  ].join('\n');

  const exportCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = ['line,address,resolved_address,amount,status,block,tx_hash'];
    for (const r of result.rows) {
      const o = run.outcomes[r.line];
      lines.push([String(r.line), r.addressInput, r.resolved ?? '', r.amount !== undefined ? formatUnits(r.amount, asset.decimals).replace(/,/g, '') : r.amountInput,
        o?.status ?? r.action, String(o?.block ?? ''), o?.txHash ?? ''].map(esc).join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const el = document.createElement('a');
    el.href = url; el.download = `dropcheck-${asset.id}-${Date.now()}.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      {run.phase === 'signing' && <Banner tone="info">{run.message}</Banner>}
      {run.phase === 'error' && <Banner tone="red">{run.message}</Banner>}
      {run.phase === 'done' && (
        <Banner tone="green">
          <b>{sent} transfers confirmed on-chain.</b>{' '}
          {run.results.map((r) => (
            <a key={r.txHash} className="underline" href={blockLink(r.blockNumber)} target="_blank" rel="noreferrer">block #{r.blockNumber}</a>
          ))}
          {run.senderAfter !== undefined && <> · your balance now {formatUnits(run.senderAfter, identity.decimals, 4)} {identity.symbol}</>}
          {run.results.some((r) => !r.dryRun.available) && <> · dry-run unavailable on this node</>}
        </Banner>
      )}
      {(run.phase === 'done' || run.phase === 'error') && (
        <div className="flex flex-wrap gap-2">
          {run.results.length > 0 && <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(proof())}>Copy proof</button>}
          <button className="btn-ghost" onClick={exportCsv}>Export CSV</button>
          <button className="btn-ghost" onClick={resetRun}>Re-check list</button>
        </div>
      )}
    </div>
  );
}
