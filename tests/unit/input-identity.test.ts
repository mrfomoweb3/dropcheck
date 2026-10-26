import { describe, it, expect } from 'vitest';
import { parseInput } from '@/core/input';
import { checkIdentity } from '@/core/chain';
import { CHAIN } from '@/config/chain';

const EXP = { genesis: CHAIN.expectedGenesis, specName: CHAIN.expectedSpecName };
const L = { maxRows: 500, maxLineLength: 300 };

describe('input parser', () => {
  it('accepts comma, semicolon, tab, space; skips header, blanks and comments', () => {
    const r = parseInput('address,amount\nA,1\n\n# note\nB;2\nC\t3\nD 4\n"E","1,000"', L);
    expect(r.rows.map((x) => [x.addressInput, x.amountInput])).toEqual([['A', '1'], ['B', '2'], ['C', '3'], ['D', '4'], ['E', '1,000']]);
    expect(r.rows[0].line).toBe(2);
  });
  it('caps rows and line length, strips control/markup chars', () => {
    const many = Array.from({ length: 600 }, (_, i) => `A${i},1`).join('\n');
    const r = parseInput(many, L);
    expect(r.rows).toHaveLength(500);
    expect(r.errors[0]).toMatch(/first 500/);
    expect(parseInput('x'.repeat(400), L).rows).toHaveLength(0);
    expect(parseInput('<b>A</b>\u0000,1', L).rows[0].addressInput).toBe('<b>A</b>');
  });
});

describe('chain identity (A8)', () => {
  it('matches the V3 testnet', () => {
    expect(checkIdentity({ genesis: CHAIN.expectedGenesis, specName: 'portaldot-v3' }, EXP).ok).toBe(true);
  });
  it('blocks a mismatched genesis or spec', () => {
    const bad = checkIdentity({ genesis: '0x' + '00'.repeat(32), specName: 'polkadot' }, EXP);
    expect(bad.ok).toBe(false);
    expect(bad.problems).toHaveLength(2);
  });
});
