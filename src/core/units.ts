// Decimal-aware conversion between human units and planck. BigInt only, never floats.

export const U128_MAX = (1n << 128n) - 1n;

export class UnitsError extends Error {}

const NUMERIC = /^(\d+)(?:\.(\d*))?$|^\.(\d+)$/;

/** Parse a human-unit string ("1,234.5", "1e6", "0.00000000000001") into planck. */
export function parseUnits(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) throw new UnitsError('bad decimals');
  let s = input.trim().replace(/[_\s]/g, '');
  // Accept thousands separators only in the integer part, e.g. "1,000.5".
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');

  let exp = 0;
  const e = s.match(/^([^eE]+)[eE]([+-]?\d+)$/);
  if (e) {
    s = e[1];
    exp = Number(e[2]);
    if (!Number.isSafeInteger(exp) || Math.abs(exp) > 100) throw new UnitsError('exponent out of range');
  }

  const m = s.match(NUMERIC);
  if (!m) throw new UnitsError(`not a number: "${input}"`);
  const intPart = m[1] ?? '0';
  const frac = m[2] ?? m[3] ?? '';

  // Shift the decimal point by `exp`, then by `decimals`.
  let digits = intPart + frac;
  let pointPos = intPart.length + exp + decimals;
  if (pointPos < 0) {
    if (/[1-9]/.test(digits)) throw new UnitsError(`more than ${decimals} decimal places`);
    return 0n;
  }
  if (pointPos >= digits.length) {
    digits = digits + '0'.repeat(pointPos - digits.length);
    pointPos = digits.length;
  }
  const whole = digits.slice(0, pointPos);
  const rest = digits.slice(pointPos);
  if (/[1-9]/.test(rest)) throw new UnitsError(`more than ${decimals} decimal places`);
  const value = BigInt(whole || '0');
  if (value > U128_MAX) throw new UnitsError('amount exceeds u128');
  return value;
}

/** Format planck as a human-unit string, trimming trailing zeros. */
export function formatUnits(value: bigint, decimals: number, maxFraction?: number): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = decimals > 0 ? (v % base).toString().padStart(decimals, '0') : '';
  if (maxFraction !== undefined && frac.length > maxFraction) frac = frac.slice(0, maxFraction);
  frac = frac.replace(/0+$/, '');
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + w + (frac ? '.' + frac : '');
}
