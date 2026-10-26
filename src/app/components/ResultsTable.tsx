'use client';
import { Fragment, useState } from 'react';
import type { Dropcheck } from '../useDropcheck';
import { formatUnits } from '@/core/units';
import { blockLink } from '@/config/chain';
import { CopyAddr, StatusChip } from './ui';
import type { CheckedRow, IssueCode } from '@/core/types';

export function ResultsTable({ dc }: { dc: Dropcheck }) {
  const { result, asset, checking, run, conn } = dc;
  const [open, setOpen] = useState<number | null>(null);

  if (conn.status === 'connecting') return <Empty>Connecting to Portaldot V3…</Empty>;
  if (!asset?.exists) return <Empty>Enter a token ID to start checking.</Empty>;
  if (!result) return <Empty>Paste recipients on the left, or click <b>Load demo list</b>.</Empty>;

  const dec = asset.decimals;
  const sent = Object.keys(run.outcomes).length > 0;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        <span>{result.rows.length} rows</span>
        <span aria-live="polite">{checking ? 'Checking chain state…' : 'Checked against live chain state'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="block w-full text-left text-sm sm:table">
          <thead className="hidden sm:table-header-group bg-zinc-50/70 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">What we found</th>
              {sent && <th className="px-3 py-2">On-chain</th>}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {result.rows.map((r) => {
              const o = run.outcomes[r.line];
              const sev = o?.status === 'sent' ? 'green' : o?.status === 'failed' ? 'red' : r.severity;
              const ranked = [...r.issues].sort((a, b) => PRIORITY.indexOf(a.code) - PRIORITY.indexOf(b.code));
              const top = ranked[0];
              const expanded = open === r.line;
              return (
                <Fragment key={r.line}>
                  <tr className={`grid grid-cols-[2rem_1fr_auto] border-t border-zinc-100 py-1 align-top sm:table-row sm:py-0 dark:border-zinc-800 ${r.action === 'merged' || r.action === 'excluded' ? 'opacity-70' : ''}`}>
                    <td className="py-2 pl-3 text-xs text-zinc-500 sm:px-3">{r.line}</td>
                    <td className="min-w-0 px-3 py-2">
                      <div className="truncate sm:max-w-[14rem] font-mono text-xs" title={r.addressInput}>{r.addressInput || <i>empty</i>}</div>
                      {r.resolved && r.resolved !== r.addressInput && (
                        <div className="text-xs text-zinc-500">→ <CopyAddr value={r.resolved} /></div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs" title={r.amount !== undefined ? `${r.amount} base units` : undefined}>
                      {r.amount !== undefined ? formatUnits(r.amount, dec) : r.amountInput || '—'}
                      {r.mergedFrom && <div className="text-[10px] text-zinc-500">combined</div>}
                    </td>
                    <td className="col-span-3 px-3 pb-1 pl-11 sm:p-3 sm:px-3 sm:py-2"><StatusChip severity={sev} label={chipLabel(r, o?.status)} /></td>
                    <td className="col-span-3 px-3 pb-2 pl-11 text-xs sm:px-3 sm:py-2">
                      <div>{top.message}</div>
                      {top.fix && <div className="mt-0.5 text-zinc-500">{top.fix}</div>}
                      {(r.issues.length > 1 || r.issues.some((i) => i.why)) && (
                        <button className="mt-1 text-meadow-700 hover:underline dark:text-meadow-400" onClick={() => setOpen(expanded ? null : r.line)}>
                          {expanded ? 'Hide' : r.issues.length > 1 ? `Why? (+${r.issues.length - 1} more)` : 'Why?'}
                        </button>
                      )}
                    </td>
                    {sent && (
                      <td className="col-span-3 px-3 pb-2 pl-11 text-xs sm:px-3 sm:py-2">
                        {o?.block ? <a className="text-meadow-700 hover:underline dark:text-meadow-400" href={blockLink(o.block)} target="_blank" rel="noreferrer">#{o.block}</a> : '—'}
                        {o?.after !== undefined && (
                          <div className="font-mono text-zinc-500">
                            {formatUnits(o.before ?? 0n, dec, 4)} → {formatUnits(o.after ?? 0n, dec, 4)}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="block bg-meadow-50/60 sm:table-row dark:bg-zinc-950/60">
                      <td className="hidden sm:table-cell" />
                      <td colSpan={sent ? 5 : 4} className="block space-y-1 px-3 pb-3 pl-11 text-xs sm:table-cell sm:pl-3">
                        {ranked.map((i, k) => (
                          <div key={k}>
                            <span className="font-mono text-[10px] text-zinc-500">{i.code}</span> {i.message}
                            {i.why && <div className="text-zinc-500">{i.why}</div>}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Which issue to headline when a row has several (most actionable first). */
const PRIORITY: IssueCode[] = [
  'ADDR_INVALID', 'AMOUNT_INVALID', 'RECIPIENT_FROZEN', 'BELOW_MIN_BALANCE', 'NO_PROVIDER', 'DECIMAL_SUSPECT',
  'DUPLICATE', 'ADDR_WRONG_PREFIX', 'ADDR_EVM', 'EVM_VISIBILITY', 'OK',
];

function chipLabel(r: CheckedRow, outcome?: 'sent' | 'failed'): string {
  if (outcome === 'sent') return 'Sent';
  if (outcome === 'failed') return 'Failed';
  if (r.action === 'merged') return 'Merged';
  if (r.action === 'excluded') return 'Skipped';
  if (r.action === 'topup+send') return 'Top-up + send';
  if (r.severity === 'amber') return 'Fixed';
  if (r.issues.some((i) => i.code === 'ADDR_EVM')) return 'Resolved';
  return 'OK';
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card flex h-64 items-center justify-center p-6 text-center text-sm text-zinc-500">{children}</div>;
}
