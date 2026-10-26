'use client';
import { useState } from 'react';
import type { Severity } from '@/core/types';
import { shortAddr } from '@/core/address';

const CHIP: Record<Severity, string> = {
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};
const LABEL: Record<Severity, string> = { red: 'Blocked', amber: 'Auto-fix', info: 'Resolved', green: 'OK' };
const DOT: Record<Severity, string> = { red: 'bg-red-500', amber: 'bg-amber-500', info: 'bg-sky-500', green: 'bg-emerald-500' };

export function StatusChip({ severity, label }: { severity: Severity; label?: string }) {
  return (
    <span className={`chip ${CHIP[severity]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[severity]}`} />
      {label ?? LABEL[severity]}
    </span>
  );
}

export function CopyAddr({ value, n = 6 }: { value: string; n?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
      }}
      className="font-mono text-xs text-zinc-700 hover:text-indigo-600 dark:text-zinc-300"
    >
      {copied ? 'copied ✓' : shortAddr(value, n)}
    </button>
  );
}

export function Banner({ tone, children }: { tone: 'red' | 'amber' | 'info' | 'green'; children: React.ReactNode }) {
  const c = {
    red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
    info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  }[tone];
  return <div role={tone === 'red' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>;
}
