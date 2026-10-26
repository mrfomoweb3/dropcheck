import { describe, it, expect } from 'vitest';
import { parseAddress, h160FallbackAccount, isEthDerived, toSs58, ss58Prefix } from '@/core/address';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';

const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

describe('address (A2)', () => {
  it('guide example: H160 -> 5Hfmuhj1…to8Y via fallback mapping', () => {
    const acc = h160FallbackAccount('0xf7eC65d11e35375A250e474059a917B537804142');
    expect(toSs58(acc, 42)).toBe('5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y');
    expect(isEthDerived(acc)).toBe(true);
    expect(isEthDerived(decodeAddress(ALICE))).toBe(false);
  });
  it('detects H160', () => {
    const p = parseAddress('0xf7eC65d11e35375A250e474059a917B537804142');
    expect(p.kind).toBe('h160');
    expect(p.h160).toBe('0xf7ec65d11e35375a250e474059a917b537804142');
  });
  it('parses SS58 and reports prefix', () => {
    const p = parseAddress(ALICE);
    expect(p.kind).toBe('ss58');
    expect(p.prefix).toBe(42);
    const dot = encodeAddress(ALICE, 0);
    expect(parseAddress(dot).prefix).toBe(0);
    expect(parseAddress(dot).accountHex).toBe(p.accountHex);
    expect(ss58Prefix(encodeAddress(ALICE, 2))).toBe(2);
    expect(ss58Prefix(encodeAddress(ALICE, 1284))).toBe(1284);
  });
  it('rejects typos, short hex and garbage', () => {
    expect(parseAddress(ALICE.slice(0, -1) + 'Z').kind).toBe('invalid');
    expect(parseAddress('0x1234').kind).toBe('invalid');
    expect(parseAddress('hello').kind).toBe('invalid');
    expect(parseAddress('').kind).toBe('invalid');
  });
});
