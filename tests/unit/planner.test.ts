import { describe, it, expect } from 'vitest';
import { checkRows } from '@/core/checks';
import { buildPlan } from '@/core/planner';
import { parseInput } from '@/core/input';
import { acct, empty, funded, snapshot } from './fixtures';
import { toSs58 } from '@/core/address';

/** The §8 demo shape: 9 OK, 5 fresh, 2 EVM, 1 wrong prefix, 1 duplicate, 1 below-min, 1 invalid. */
export function demoFixture() {
  const ok = Array.from({ length: 9 }, (_, i) => acct(10 + i));
  const fresh = Array.from({ length: 5 }, (_, i) => acct(30 + i));
  const evm = ['0x' + '11'.repeat(20), '0x' + '22'.repeat(20)];
  const evmAcc = [acct(40), acct(41)];
  const wrong = acct(50);
  const below = acct(60);
  const lines = [
    'address,amount',
    ...ok.map((a, i) => `${a.ss58},${100 + i * 10}`),
    ...fresh.map((a) => `${a.ss58},50`),
    ...evm.map((h) => `${h},75`),
    `${wrong.dot},100`,
    `${ok[0].ss58},25`,
    `${below.ss58},1`,
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQX,10',
  ];
  const accounts = {
    ...Object.fromEntries([...ok, wrong, below, ...evmAcc].map((a) => [a.hex, funded()])),
    ...Object.fromEntries(fresh.map((a) => [a.hex, empty()])),
  };
  const snap = snapshot({ accounts, evmMap: { [evm[0]]: evmAcc[0].hex, [evm[1]]: evmAcc[1].hex } });
  return { text: lines.join('\n'), snap };
}

describe('planner (A4)', () => {
  it('demo list -> expected call list', () => {
    const { text, snap } = demoFixture();
    const { rows: raw, errors } = parseInput(text, { maxRows: 500, maxLineLength: 300 });
    expect(errors).toEqual([]);
    expect(raw).toHaveLength(20);
    const res = checkRows(raw, snap, { mergeDuplicates: true });
    expect(res.summary).toMatchObject({ recipients: 19, blocked: 2, transfers: 17, topups: 5 });
    const plan = buildPlan(res.rows, snap);
    expect(plan.chunks).toHaveLength(1);
    const pretty = plan.chunks[0].calls.map((c) =>
      `${c.kind} L${c.line} ${toSs58(c.dest, 42).slice(0, 8)} ${c.amount}`);
    expect(pretty).toMatchSnapshot();
    expect(plan.chunks[0].calls.slice(0, 5).every((c) => c.kind === 'topup')).toBe(true);
    expect(plan.totalTopup).toBe(5n * 11n * 10n ** 12n);
  });

  it('chunks keep top-ups with their transfers', () => {
    const fresh = Array.from({ length: 7 }, (_, i) => acct(100 + i));
    const snap = snapshot({ accounts: Object.fromEntries(fresh.map((a) => [a.hex, empty()])) });
    const res = checkRows(fresh.map((a, i) => ({ line: i + 1, addressInput: a.ss58, amountInput: '10' })), snap, { mergeDuplicates: true });
    const plan = buildPlan(res.rows, snap, 3);
    expect(plan.chunks.map((c) => c.recipients)).toEqual([3, 3, 1]);
    for (const ch of plan.chunks) {
      const tops = ch.calls.filter((c) => c.kind === 'topup').map((c) => c.dest);
      const sends = ch.calls.filter((c) => c.kind === 'asset').map((c) => c.dest);
      expect(tops).toEqual(sends);
    }
  });
});
