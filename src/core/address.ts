// Address parsing: SS58 validate/re-encode, H160 detect, H160 -> AccountId32 (pallet-revive mapping).
import { decodeAddress, encodeAddress, checkAddress } from '@polkadot/util-crypto';
import { hexToU8a, isHex, u8aConcat, u8aToHex, u8aEq } from '@polkadot/util';
import { base58Decode } from '@polkadot/util-crypto';

export type AddressKind = 'ss58' | 'h160' | 'invalid';

export interface ParsedAddress {
  kind: AddressKind;
  input: string;
  /** Raw 32-byte account id hex (ss58 only; h160 is resolved separately). */
  accountHex?: string;
  /** Prefix the input was encoded with (ss58 only). */
  prefix?: number;
  /** Normalised H160 (lowercase 0x...). */
  h160?: string;
  error?: string;
}

const EE_SUFFIX = new Uint8Array(12).fill(0xee);

/** Read the SS58 network prefix from an encoded address. */
export function ss58Prefix(address: string): number {
  const d = base58Decode(address);
  if (d[0] < 64) return d[0];
  // Two-byte prefix encoding.
  return ((d[0] & 0b0011_1111) << 2) | (d[1] >> 6) | ((d[1] & 0b0011_1111) << 8);
}

export function parseAddress(raw: string): ParsedAddress {
  const input = raw.trim();
  if (!input) return { kind: 'invalid', input, error: 'empty address' };
  if (/^0x[0-9a-fA-F]{40}$/.test(input)) return { kind: 'h160', input, h160: input.toLowerCase() };
  if (isHex(input)) {
    return { kind: 'invalid', input, error: 'hex value is not a 20-byte EVM address' };
  }
  try {
    const pk = decodeAddress(input);
    if (pk.length !== 32) return { kind: 'invalid', input, error: 'not a 32-byte account' };
    const prefix = ss58Prefix(input);
    const [ok, err] = checkAddress(input, prefix);
    if (!ok) return { kind: 'invalid', input, error: err ?? 'bad checksum' };
    return { kind: 'ss58', input, accountHex: u8aToHex(pk), prefix };
  } catch (e) {
    return { kind: 'invalid', input, error: (e as Error).message.replace(/^Decoding .*?: /, '') };
  }
}

/** pallet-revive fallback: an unmapped H160 maps to h160 ++ [0xEE; 12]. */
export function h160FallbackAccount(h160: string): Uint8Array {
  return u8aConcat(hexToU8a(h160), EE_SUFFIX);
}

/** True if a 32-byte account id is an EVM-derived (0xEE-suffixed) account. */
export function isEthDerived(account: Uint8Array): boolean {
  return account.length === 32 && u8aEq(account.subarray(20), EE_SUFFIX);
}

export function toSs58(accountHexOrU8a: string | Uint8Array, prefix: number): string {
  return encodeAddress(accountHexOrU8a, prefix);
}

export function shortAddr(a: string, n = 6): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}
