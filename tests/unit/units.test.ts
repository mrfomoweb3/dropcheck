import { describe, it, expect } from 'vitest';
import { parseUnits, formatUnits, U128_MAX, UnitsError } from '@/core/units';

describe('units (A1)', () => {
  it('round-trips the smallest 14-decimal value', () => {
    expect(parseUnits('0.00000000000001', 14)).toBe(1n);
    expect(formatUnits(1n, 14)).toBe('0.00000000000001');
  });
  it('handles exponents and separators', () => {
    expect(parseUnits('1e6', 14)).toBe(10n ** 20n);
    expect(parseUnits('1.5e-13', 14)).toBe(15n);
    expect(parseUnits('1,000.25', 2)).toBe(100025n);
    expect(parseUnits('.5', 14)).toBe(5n * 10n ** 13n);
    expect(parseUnits('  10  ', 14)).toBe(10n * 10n ** 14n);
  });
  it('rejects more precision than decimals', () => {
    expect(() => parseUnits('0.000000000000001', 14)).toThrow(UnitsError);
    expect(() => parseUnits('1.0000001', 6)).toThrow(/decimal places/);
    expect(() => parseUnits('1e-15', 14)).toThrow(UnitsError);
  });
  it('rejects junk and negatives', () => {
    for (const bad of ['', 'abc', '-1', '1.2.3', '0x10', '1,00', 'NaN', 'Infinity']) {
      expect(() => parseUnits(bad, 14), bad).toThrow(UnitsError);
    }
  });
  it('accepts max u128 and rejects beyond', () => {
    expect(parseUnits(U128_MAX.toString(), 0)).toBe(U128_MAX);
    expect(() => parseUnits((U128_MAX + 1n).toString(), 0)).toThrow(/u128/);
    const human = formatUnits(U128_MAX, 14).replace(/,/g, '');
    expect(parseUnits(human, 14)).toBe(U128_MAX);
  });
  it('round-trips many values exactly', () => {
    const vals = [0n, 1n, 10n ** 14n, 123456789012345678901234567890n, 99999999999999n];
    for (const v of vals) expect(parseUnits(formatUnits(v, 14).replace(/,/g, ''), 14)).toBe(v);
  });
  it('trailing-zero-safe: 1.000 == 1', () => {
    expect(parseUnits('1.000', 2)).toBe(100n);
    expect(parseUnits('1.0000000000000000', 14)).toBe(10n ** 14n);
  });
});
