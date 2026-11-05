import { describe, it, expect } from 'vitest';
import { checkRows, topupAmount } from '@/core/checks';
import { acct, empty, funded, snapshot, UNIT, ED } from './fixtures';
import type { RawRow } from '@/core/types';

let n = 0;
const row = (addressInput: string, amountInput: string): RawRow => ({ line: ++n, addressInput, amountInput });
const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);
const opts = { mergeDuplicates: true };

describe('check engine (A3)', () => {
  it('OK: funded existing account', () => {
    const a = acct(1);
    const res = checkRows([row(a.ss58, '10')], snapshot({ accounts: { [a.hex]: funded() } }), opts);
    expect(codes(res.rows[0])).toEqual(['OK']);
    expect(res.rows[0].severity).toBe('green');
    expect(res.rows[0].amount).toBe(10n * UNIT);
    expect(res.runIssues.filter((i) => i.blocking)).toEqual([]);
  });

  it('ADDR_INVALID: typo is red and excluded', () => {
    const r = checkRows([row(acct(1).ss58.slice(0, -2) + 'xx', '10')], snapshot(), opts).rows[0];
    expect(codes(r)).toContain('ADDR_INVALID');
    expect(r.action).toBe('excluded');
    expect(r.severity).toBe('red');
  });

  it('ADDR_WRONG_PREFIX: re-encoded to 42', () => {
    const a = acct(2);
    const r = checkRows([row(a.dot, '10')], snapshot({ accounts: { [a.hex]: funded() } }), opts).rows[0];
    expect(codes(r)).toEqual(['ADDR_WRONG_PREFIX']);
    expect(r.resolved).toBe(a.ss58);
    expect(r.severity).toBe('amber');
    expect(r.action).toBe('send');
  });

  it('ADDR_EVM + EVM_VISIBILITY: resolves via evmMap, else fallback', () => {
    const h = '0xf7ec65d11e35375a250e474059a917b537804142';
    const viaFallback = checkRows([row(h, '10')], snapshot(), opts).rows[0];
    expect(viaFallback.resolved).toBe('5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y');
    expect(codes(viaFallback)).toEqual(expect.arrayContaining(['ADDR_EVM', 'EVM_VISIBILITY']));
    const mapped = acct(3);
    const viaMap = checkRows([row(h, '10')], snapshot({ evmMap: { [h]: mapped.hex }, accounts: { [mapped.hex]: funded() } }), opts).rows[0];
    expect(viaMap.resolved).toBe(mapped.ss58);
    expect(codes(viaMap)).toEqual(['ADDR_EVM']);
  });

  it('DUPLICATE: merged (sum) or excluded', () => {
    const a = acct(4);
    const snap = snapshot({ accounts: { [a.hex]: funded() } });
    const merged = checkRows([row(a.ss58, '10'), row(a.dot, '5')], snap, opts);
    expect(merged.rows[0].amount).toBe(15n * UNIT);
    expect(merged.rows[1].action).toBe('merged');
    expect(merged.summary.transfers).toBe(1);
    expect(merged.summary.recipients).toBe(1);
    const excl = checkRows([row(a.ss58, '10'), row(a.ss58, '5')], snap, { mergeDuplicates: false });
    expect(excl.rows[0].amount).toBe(10n * UNIT);
    expect(excl.rows[1].action).toBe('excluded');
    expect(codes(excl.rows[1])).toContain('DUPLICATE');
  });

  it('NO_PROVIDER: fresh account gets a top-up of ED + 10%', () => {
    const a = acct(5);
    const res = checkRows([row(a.ss58, '10')], snapshot({ accounts: { [a.hex]: empty() } }), opts);
    expect(codes(res.rows[0])).toEqual(['NO_PROVIDER']);
    expect(res.rows[0].action).toBe('topup+send');
    expect(res.summary.totalTopup).toBe(ED + ED / 10n);
    expect(topupAmount(snapshot())).toBe(11n * 10n ** 12n);
  });

  it('NO_PROVIDER does not fire for sufficient assets or existing holders', () => {
    const a = acct(5);
    const s1 = snapshot({ accounts: { [a.hex]: empty() } });
    s1.asset.isSufficient = true;
    expect(codes(checkRows([row(a.ss58, '10')], s1, opts).rows[0])).toEqual(['OK']);
    const s2 = snapshot({ accounts: { [a.hex]: { ...empty(), assetBalance: 1n, assetStatus: 'Liquid' } } });
    expect(codes(checkRows([row(a.ss58, '10')], s2, opts).rows[0])).toEqual(['OK']);
  });

  it('BELOW_MIN_BALANCE: new holder under min, but fine for an existing holder', () => {
    const a = acct(6);
    const r = checkRows([row(a.ss58, '1')], snapshot({ accounts: { [a.hex]: funded() } }), opts).rows[0];
    expect(codes(r)).toEqual(['BELOW_MIN_BALANCE']);
    expect(r.action).toBe('excluded');
    const holder = checkRows([row(a.ss58, '1')], snapshot({ accounts: { [a.hex]: funded(10n * UNIT) } }), opts).rows[0];
    expect(codes(holder)).toEqual(['OK']);
  });

  it('RECIPIENT_FROZEN: frozen or blocked holder is excluded', () => {
    const a = acct(7);
    for (const st of ['Frozen', 'Blocked']) {
      const r = checkRows([row(a.ss58, '10')], snapshot({ accounts: { [a.hex]: funded(1n, st) } }), opts).rows[0];
      expect(codes(r)).toEqual(['RECIPIENT_FROZEN']);
      expect(r.action).toBe('excluded');
    }
  });

  it('ASSET_FROZEN / missing asset blocks the run', () => {
    const a = acct(1);
    const s = snapshot({ accounts: { [a.hex]: funded() } });
    s.asset.status = 'Frozen';
    const res = checkRows([row(a.ss58, '10')], s, opts);
    expect(res.runIssues.find((i) => i.code === 'ASSET_FROZEN')?.blocking).toBe(true);
    const s2 = snapshot({ accounts: { [a.hex]: funded() } });
    s2.asset.exists = false;
    expect(checkRows([row(a.ss58, '10')], s2, opts).runIssues.some((i) => i.code === 'ASSET_FROZEN')).toBe(true);
  });

  it('DECIMAL_SUSPECT: 1000x median and sub-unit among whole amounts', () => {
    const accs = [1, 2, 3, 4].map(acct);
    const snap = snapshot({ accounts: Object.fromEntries(accs.map((a) => [a.hex, funded()])) });
    const big = checkRows([row(accs[0].ss58, '10'), row(accs[1].ss58, '10'), row(accs[2].ss58, '10'), row(accs[3].ss58, '10000000')], snap, opts);
    expect(codes(big.rows[3])).toEqual(['DECIMAL_SUSPECT']);
    expect(codes(big.rows[0])).toEqual(['OK']);
    const small = checkRows([row(accs[0].ss58, '10'), row(accs[1].ss58, '20'), row(accs[2].ss58, '10'), row(accs[3].ss58, '0.00001')], snap, opts);
    expect(codes(small.rows[3])).toContain('DECIMAL_SUSPECT');
  });

  it('AMOUNT_INVALID: too many decimals / zero / missing', () => {
    const a = acct(1);
    const snap = snapshot({ accounts: { [a.hex]: funded() } });
    for (const amt of ['1.0000001', '0', '', 'ten']) {
      const r = checkRows([row(a.ss58, amt)], snap, opts).rows[0];
      expect(codes(r), amt).toContain('AMOUNT_INVALID');
      expect(r.action).toBe('excluded');
    }
  });

  it('SENDER_SHORT_ASSET blocks the run', () => {
    const a = acct(1);
    const s = snapshot({ accounts: { [a.hex]: funded() } });
    s.sender!.state.assetBalance = 5n * UNIT;
    const res = checkRows([row(a.ss58, '10')], s, opts);
    expect(res.runIssues.find((i) => i.code === 'SENDER_SHORT_ASSET')?.blocking).toBe(true);
  });

  it('SENDER_SHORT_NATIVE: fee + top-ups would take sender below ED', () => {
    const a = acct(5);
    const s = snapshot({ accounts: { [a.hex]: empty() }, feeEstimate: 10n ** 12n });
    s.sender!.state.nativeFree = ED + ED / 10n; // enough for ED but not top-up + fee + ED
    const res = checkRows([row(a.ss58, '10')], s, opts);
    expect(res.runIssues.find((i) => i.code === 'SENDER_SHORT_NATIVE')?.blocking).toBe(true);
    s.sender!.state.nativeFree = 2n * ED + ED / 10n + 10n ** 12n; // exactly enough
    expect(checkRows([row(a.ss58, '10')], s, opts).runIssues.some((i) => i.code === 'SENDER_SHORT_NATIVE')).toBe(false);
  });

  it('unread wallets are unknown, not empty: no invented top-ups, run blocked until read', () => {
    const a = acct(5);
    const res = checkRows([row(a.ss58, '10')], snapshot({ accounts: {} }), opts);
    expect(codes(res.rows[0])).toEqual(['OK']);
    expect(res.rows[0].action).toBe('send');
    expect(res.summary.topups).toBe(0);
    expect(res.runIssues.find((i) => /Still reading chain state/.test(i.message))?.blocking).toBe(true);
    const loaded = checkRows([row(a.ss58, '10')], snapshot({ accounts: { [a.hex]: empty() } }), opts);
    expect(loaded.summary.topups).toBe(1);
    expect(loaded.runIssues.some((i) => /Still reading/.test(i.message))).toBe(false);
  });

  it('summary counts', () => {
    const [ok, fresh] = [acct(1), acct(5)];
    const res = checkRows(
      [row(ok.ss58, '10'), row(fresh.ss58, '10'), row('nope', '10')],
      snapshot({ accounts: { [ok.hex]: funded(), [fresh.hex]: empty() } }),
      opts,
    );
    expect(res.summary).toMatchObject({ recipients: 3, ok: 1, autoFixable: 1, blocked: 1, transfers: 2, topups: 1, totalAsset: 20n * UNIT });
  });
});
