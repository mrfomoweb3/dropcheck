'use client';
import type { Dropcheck } from '../useDropcheck';
import { formatUnits } from '@/core/units';
import { Banner } from './ui';

/**
 * Shown when a connected wallet doesn't hold the demo token. The visitor creates their own copy
 * (one signature, their own wallet, a refundable deposit), and the demo list switches to it.
 */
export function DemoTokenOffer({ dc }: { dc: Dropcheck }) {
  const { offerDemoToken, demoToken, createDemoToken, identity, senderState, run, fee } = dc;
  if (!identity) return null;
  if (demoToken.phase === 'done') return <Banner tone="green">{demoToken.message}</Banner>;
  if (!offerDemoToken || run.phase === 'signing') return null;

  const n = (v: bigint) => formatUnits(v, identity.decimals, 4);
  const cost = demoToken.cost;
  // Create (deposit + fee) and then the demo send itself: 5 top-ups of ED+10% plus its fee. The send fee is
  // the app's live estimate for this list (0.105 tPOT on V3); 0.15 is only a fallback before it arrives.
  const sendBudget = (identity.ed * 11n / 10n) * 5n + (fee ?? identity.ed * 3n / 2n);
  const need = cost ? cost.deposit + cost.fee + sendBudget + identity.ed : undefined;
  const have = senderState?.nativeFree;
  const short = need !== undefined && have !== undefined && have < need;
  const working = demoToken.phase === 'working';

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex-1 text-sm">
        <div className="font-semibold">Your wallet doesn&apos;t hold the demo token, so it can&apos;t send this list.</div>
        <div className="mt-0.5 text-zinc-600">
          Create your own copy of <b>DROP</b> (same settings as ours) with one signature, then press Fix &amp; Send.
          {cost && <> It reserves <b>{n(cost.deposit)} {identity.symbol}</b> as the token deposit (held, not spent), plus about {n(cost.fee)} {identity.symbol} fee.</>}
          {' '}The demo send then needs about {n(sendBudget)} {identity.symbol} more.
        </div>
        {short && (
          <div className="mt-1 text-red-700">
            You have {n(have!)} {identity.symbol}; this needs about {n(need!)} {identity.symbol}. You can still preview every check without sending.
          </div>
        )}
        {demoToken.phase === 'error' && <div className="mt-1 text-red-700">{demoToken.message}</div>}
        {working && <div className="mt-1 text-zinc-600" aria-live="polite">{demoToken.message}</div>}
      </div>
      <button className="btn-primary shrink-0" disabled={working || short || !cost} onClick={createDemoToken}>
        {working ? 'Creating…' : !cost ? 'Checking cost…' : 'Create my demo token'}
      </button>
    </div>
  );
}
