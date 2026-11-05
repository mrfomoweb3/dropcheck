import { describe, it, expect } from 'vitest';
import { decodeAddress } from '@polkadot/util-crypto';
import { endpointFromSearch } from '@/config/chain';
import { freshenDemoCsv, randomFreshAddress, randomAssetId, demoTokenDeposit } from '@/core/demo';

const A = '5ChzoupHs3UwZtpjJkAXbPYR1iZX2fQzrZQMrQBrJSdGhNT8';
const F1 = '5GEjLh1uHQ1Sp44keJYB1NqywoQ3VYu5qgpS4KPhokv51Jav';
const F2 = '5CtDFA6BfFH8fStpiH761Ktk9jamqdURhiifV8PTouRPkXYH';

describe('demo helpers', () => {
  it('random fresh addresses are valid ss58-42 and distinct', () => {
    const a = randomFreshAddress(42);
    const b = randomFreshAddress(42);
    expect(a).not.toBe(b);
    expect(a.startsWith('5')).toBe(true);
    expect(decodeAddress(a)).toHaveLength(32);
  });

  it('freshenDemoCsv replaces only the fresh rows and keeps amounts, order and other rows', () => {
    const csv = `address,amount\n${A},100\n${F1},50\n${F2},60\n${A},25\n`;
    const out = freshenDemoCsv(csv, [F1, F2], 42);
    const lines = out.split('\n');
    expect(lines[0]).toBe('address,amount');
    expect(lines[1]).toBe(`${A},100`);
    expect(lines[4]).toBe(`${A},25`);
    expect(lines[2].endsWith(',50')).toBe(true);
    expect(lines[3].endsWith(',60')).toBe(true);
    expect(out).not.toContain(F1);
    expect(out).not.toContain(F2);
    expect(lines[2].split(',')[0]).not.toBe(lines[3].split(',')[0]);
    expect(lines).toHaveLength(6);
  });

  it('freshenDemoCsv is a no-op without fresh rows', () => {
    const csv = `address,amount\n${A},1\n`;
    expect(freshenDemoCsv(csv, [], 42)).toBe(csv);
  });

  it('randomAssetId stays in the visitor range', () => {
    expect(randomAssetId(() => 0)).toBe(1_000_000);
    expect(randomAssetId(() => 0.999999999)).toBeLessThan(10_000_000);
  });

  it('demoTokenDeposit = asset deposit + metadata base + per byte * (name + symbol)', () => {
    expect(demoTokenDeposit({ assetDeposit: 100n, metadataDepositBase: 10n, metadataDepositPerByte: 1n })).toBe(100n + 10n + 18n);
  });
});

describe('endpointFromSearch', () => {
  const D = 'wss://default.example';
  it('uses ?rpc= for wss and local ws', () => {
    expect(endpointFromSearch('?rpc=wss://other.example/ws', D)).toBe('wss://other.example/ws');
    expect(endpointFromSearch('?rpc=ws://localhost:8000', D)).toBe('ws://localhost:8000');
  });
  it('ignores missing, insecure remote, or junk values', () => {
    expect(endpointFromSearch('', D)).toBe(D);
    expect(endpointFromSearch('?rpc=ws://evil.example', D)).toBe(D);
    expect(endpointFromSearch('?rpc=javascript:alert(1)', D)).toBe(D);
    expect(endpointFromSearch('?rpc=notaurl', D)).toBe(D);
  });
});
