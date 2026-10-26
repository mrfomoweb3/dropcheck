'use client';
import { useDropcheck } from '../useDropcheck';
import { Header } from '../components/Header';
import { InputPanel } from '../components/InputPanel';
import { ResultsTable } from '../components/ResultsTable';
import { SummaryBar, RunPanel } from '../components/SendFlow';
import Link from 'next/link';
import { Banner } from '../components/ui';

export default function Page() {
  const dc = useDropcheck();
  const { conn, retry, walletError, sender } = dc;
  return (
    <div className="app-backdrop min-h-screen">
    <div className="min-h-screen bg-gradient-to-b from-[#1d3a5c]/35 via-white/30 to-white/60 dark:from-zinc-950/70 dark:via-zinc-950/80 dark:to-zinc-950/90">
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-6">
      <Header dc={dc} />
      {conn.status === 'error' && (
        <Banner tone="red">
          Can&apos;t reach the Portaldot V3 node ({conn.error}). <button className="underline" onClick={retry}>Retry</button>
        </Banner>
      )}
      {conn.status === 'ready' && !conn.identityOk && (
        <Banner tone="red"><b>Wrong network.</b> {conn.problems.join(' ')} Dropcheck will not send transactions here.</Banner>
      )}
      {walletError && <Banner tone="amber">{walletError}</Banner>}
      {!sender && conn.status === 'ready' && (
        <Banner tone="info">Preview mode: rows are checked against live chain state. Connect a wallet to check your own balance and send.</Banner>
      )}
      <RunPanel dc={dc} />
      <div className="grid flex-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="order-2 lg:order-1"><InputPanel dc={dc} /></div>
        <div className="order-1 min-w-0 lg:order-2"><ResultsTable dc={dc} /></div>
      </div>
      <SummaryBar dc={dc} />
      <footer className="pb-24 pt-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-400">
        Testnet only · keys never leave your wallet extension · <Link className="underline" href="/">about Dropcheck</Link>
      </footer>
    </main>
    </div>
    </div>
  );
}
