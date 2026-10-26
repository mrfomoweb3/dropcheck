import Link from 'next/link';

/** Wordmark: a drop with a check cut into it. */
export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight ${light ? 'text-white' : 'text-zinc-900 dark:text-white'} ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M12 2.5c3.6 4.3 7 8.2 7 12a7 7 0 1 1-14 0c0-3.8 3.4-7.7 7-12Z" fill="currentColor" />
        <path d="m8.6 14.6 2.3 2.3 4.6-4.8" fill="none" stroke={light ? '#517121' : '#a3c95a'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Dropcheck
    </Link>
  );
}
