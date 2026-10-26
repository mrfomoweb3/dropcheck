// Creates a demo-only sr25519 seed file (mode 600) outside the repo. Prints only the address.
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';

const path = process.argv[2];
if (!path) throw new Error('usage: gen-demo-key <seed-file-path>');
await cryptoWaitReady();
if (!existsSync(path)) writeFileSync(path, mnemonicGenerate(12) + '\n', { mode: 0o600 });
const pair = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(readFileSync(path, 'utf8').trim());
console.log('demo sender address:', pair.address);
