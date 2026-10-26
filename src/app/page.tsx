import Link from 'next/link';
import { Logo } from './components/Logo';

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#checks', label: 'Checks' },
  { href: '#why', label: 'Why Portaldot' },
  { href: '/app', label: 'Launch app' },
];

export default function Landing() {
  return (
    <main>
      <Hero />
      <How />
      <Checks />
      <Why />
      <Closing />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <picture className="absolute inset-0 -z-20">
        <source media="(max-width: 640px)" srcSet="/landscape-sm.jpg" />
        <img src="/landscape.jpg" alt="" className="h-full w-full object-cover object-[50%_60%]" />
      </picture>
      {/* Darken the sky slightly so white type reads, and fade the bottom toward the page. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#1d3a5c]/50 via-[#1d3a5c]/25 to-transparent" />

      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-10">
        <Logo light />
        <ul className="hidden items-center gap-8 text-[15px] font-medium text-white/95 md:flex">
          {NAV.map((n) => (
            <li key={n.href}><Link href={n.href} className="text-shadow transition hover:text-white hover:opacity-80">{n.label}</Link></li>
          ))}
        </ul>
        <Link href="/app" className="btn bg-white/90 text-zinc-900 backdrop-blur hover:bg-white md:hidden">Launch app</Link>
      </nav>

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-5 pt-[6vh] text-center text-white">
        <p className="animate-rise font-script text-2xl text-white/95 text-shadow sm:text-3xl">usability over complexity</p>
        <h1 className="mt-3 animate-rise text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-shadow [animation-delay:.08s] sm:text-6xl lg:text-[5.25rem]">
          Pre-flight Checks for<br className="hidden sm:block" /> Every Token Airdrop
        </h1>
        <p className="mt-6 max-w-2xl animate-rise text-[15px] font-medium leading-relaxed text-white/95 text-shadow [animation-delay:.16s] sm:text-[17px]">
          Dropcheck shows which transfers in your Portaldot distribution would fail or strand tokens (empty wallets,
          MetaMask addresses, dust amounts, decimal slips) and fixes them all in one signed batch.
        </p>
        <div className="mt-8 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:.24s]">
          <Link href="/app" className="btn bg-white px-6 py-3 text-[15px] text-zinc-900 shadow-lg hover:bg-zinc-100">Try the live demo</Link>
          <Link href="#how" className="btn border border-white/60 bg-white/10 px-6 py-3 text-[15px] text-white backdrop-blur hover:bg-white/20">How it works</Link>
        </div>
      </div>

      <HeroCards />
    </section>
  );
}

/** The stacked "check result" cards, echoing a real Dropcheck row. */
function HeroCards() {
  return (
    <div className="relative mx-auto mt-auto w-full max-w-md px-5 pb-0 pt-24 animate-rise [animation-delay:.35s]">
      <div className="absolute inset-x-16 top-6 h-28 rotate-[4deg] rounded-2xl border border-white/60 bg-white/50 backdrop-blur-md" aria-hidden />
      <div className="absolute inset-x-10 top-12 flex h-28 rotate-[3deg] items-start rounded-2xl border border-white/70 bg-white/80 px-5 pt-3.5 shadow-lg backdrop-blur-md" aria-hidden>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 10a6 6 0 0 1 10.4-4M16 10a6 6 0 0 1-10.4 4M14 3v3h-3M6 17v-3h3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          MetaMask address resolved
        </span>
      </div>

      <div className="relative animate-float rounded-t-3xl border border-white/80 bg-white/95 p-6 pb-7 text-left text-zinc-900 shadow-[0_30px_80px_-20px_rgba(20,40,15,.55)] backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-meadow-50 px-2.5 py-1 text-sm font-medium text-meadow-700">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
              <line key={d} x1="10" y1="2.5" x2="10" y2="5.5" strokeLinecap="round" transform={`rotate(${d} 10 10)`} />
            ))}
          </svg>
          Pre-flight check
        </span>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight">Fresh wallet found</h3>
        <p className="mt-0.5 text-[15px] text-zinc-500">No tPOT yet, so a 0.11 tPOT top-up was added</p>

        <div className="mt-6 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <span>Ready to send</span><span className="text-base normal-case tracking-normal text-zinc-900">17 / 19</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-[89%] animate-fill rounded-full bg-gradient-to-r from-[#e6e35a] via-meadow-400 to-meadow-500" />
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-meadow-400 to-meadow-700 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 3c3 3.6 6 6.9 6 10a6 6 0 1 1-12 0c0-3.1 3-6.4 6-10Z" strokeLinejoin="round" /></svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold">Awaiting signature</div>
            <div className="text-sm text-zinc-500">1 batch · 5 top-ups · 17 transfers</div>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full border border-zinc-300">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m4 20 4-1 10-10-3-3L5 16l-1 4ZM13 7l3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      {/* Decorative cursor, as in the reference. */}
      <svg viewBox="0 0 32 32" className="absolute -right-4 bottom-24 hidden h-9 w-9 drop-shadow-lg sm:block lg:-right-40" aria-hidden>
        <path d="M5 3 28 14l-10 3.2L13.6 28Z" fill="#4f9be8" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const STEPS = [
  { n: '01', title: 'Paste your list', body: 'Address and amount per line, or drop a CSV. Portaldot, other Substrate, and MetaMask addresses all work.' },
  { n: '02', title: 'See every problem', body: 'Each row is checked against live chain state and turns green, amber or red, with a plain-English reason.' },
  { n: '03', title: 'Fix & send once', body: 'Top-ups, address fixes and merges go into one atomic batch. Sign once, then get a block link for every transfer.' },
];

function How() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-24 sm:px-10">
      <p className="font-script text-2xl text-meadow-700">three steps, one signature</p>
      <h2 className="mt-1 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">From a messy list to verified transfers in under a minute.</h2>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-3xl border border-zinc-200/80 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="font-mono text-sm text-meadow-600">{s.n}</div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const CHECKS: { tone: 'red' | 'amber' | 'sky' | 'green'; label: string; body: string }[] = [
  { tone: 'amber', label: 'Empty wallet', body: 'No native tPOT means it can’t hold the token. We add an ED + 10% top-up first.' },
  { tone: 'sky', label: 'MetaMask address', body: 'H160 resolved to its native account with ReviveApi. No manual runtime-call lookup.' },
  { tone: 'amber', label: 'Wrong network prefix', body: 'A Polkadot-encoded address is re-encoded for Portaldot. Same key, right format.' },
  { tone: 'amber', label: 'Duplicate wallet', body: 'Same account listed twice, even in different formats. Amounts are merged.' },
  { tone: 'red', label: 'Below minimum', body: 'New holders below the asset’s min_balance would fail. Flagged with the minimum.' },
  { tone: 'amber', label: 'Decimal slip', body: 'An amount 1,000× the typical one, or dust among whole numbers. Confirm before you send.' },
  { tone: 'red', label: 'Frozen or invalid', body: 'Typos, frozen holders and frozen assets are caught before they cost a fee.' },
  { tone: 'green', label: 'Sender protected', body: 'transfer_keep_alive + a balance check, so your account is never reaped.' },
];
const TONE = {
  red: 'bg-red-500', amber: 'bg-amber-500', sky: 'bg-sky-500', green: 'bg-meadow-500',
};

function Checks() {
  return (
    <section id="checks" className="relative isolate scroll-mt-8 overflow-hidden py-24">
      <img src="/landscape-sm.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-bottom opacity-90" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#f5f4ee] via-[#f5f4ee]/40 to-[#f5f4ee] dark:from-zinc-950 dark:via-zinc-950/60 dark:to-zinc-950" />
      <div className="mx-auto max-w-7xl px-5 sm:px-10">
        <p className="font-script text-2xl text-meadow-700">what we catch</p>
        <h2 className="mt-1 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">The mistakes that silently strand tokens.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKS.map((c) => (
            <div key={c.label} className="card p-5">
              <div className="flex items-center gap-2 font-semibold">
                <span className={`h-2 w-2 rounded-full ${TONE[c.tone]}`} />{c.label}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why() {
  const items = [
    ['Native Assets pallet', 'Tokens without an ERC-20 contract, with Substrate’s existential-deposit and min-balance rules that Dropcheck checks for you.'],
    ['Atomic batch_all', 'Top-ups and transfers land together or not at all. The signed batch is dry-run on the node before broadcast.'],
    ['Revive address mapping', 'MetaMask users get their tokens at the native account the runtime itself uses.'],
  ];
  return (
    <section id="why" className="mx-auto grid max-w-7xl scroll-mt-8 gap-12 px-5 py-24 sm:px-10 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="font-script text-2xl text-meadow-700">built on portaldot</p>
        <h2 className="mt-1 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">No backend. No keys. Just the chain.</h2>
        <p className="mt-5 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Dropcheck runs in your browser against the public Portaldot V3 node. You sign in your own wallet extension:
          Talisman, SubWallet or polkadot{'{'}.js{'}'}. Testnet only, and it refuses any other network.
        </p>
      </div>
      <dl className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {items.map(([t, b]) => (
          <div key={t} className="grid gap-2 py-6 sm:grid-cols-[14rem_1fr]">
            <dt className="text-lg font-semibold">{t}</dt>
            <dd className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{b}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative isolate overflow-hidden rounded-[2rem] px-6 py-24 text-center text-white">
        <img src="/landscape.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-top" />
        <div className="absolute inset-0 -z-10 bg-[#1d3a5c]/35" />
        <p className="font-script text-2xl text-shadow">ready when your list is</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-shadow sm:text-6xl">Check your airdrop before it ships.</h2>
        <Link href="/app" className="btn mt-9 bg-white px-7 py-3 text-[15px] text-zinc-900 shadow-lg hover:bg-zinc-100">Open Dropcheck</Link>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/90 text-shadow">
          <Logo light className="!text-lg" />
          <span>Portaldot Hacker House 2026 · Track 4</span>
          <span>Testnet only</span>
        </div>
      </div>
    </section>
  );
}
