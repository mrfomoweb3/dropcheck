'use client';
import { useDropcheck } from './useDropcheck';
import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { ResultsTable } from './components/ResultsTable';
import { SummaryBar, RunPanel } from './components/SendFlow';
import { Banner } from './components/ui';

export default function Page() {
  const dc = useDropcheck();
  const { conn, retry, walletError, sender } = dc;
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 pt-4">
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
        <InputPanel dc={dc} />
        <ResultsTable dc={dc} />
      </div>
      <SummaryBar dc={dc} />
      <footer className="pb-24 pt-2 text-center text-xs text-zinc-500">
        Testnet only · keys never leave your wallet extension · <a className="underline" href="https://github.com/">source</a>
      </footer>
    </main>
  );
}
