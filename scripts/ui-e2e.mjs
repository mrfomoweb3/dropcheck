// End-to-end UI test. Injects a test wallet extension into the real UI and drives:
// load demo -> connect wallet -> Fix & Send -> confirm -> wait for on-chain confirmation.
// Default: a LOCAL CHOPSTICKS FORK (ws://localhost:8000) signing as the public dev key //Alice.
// Live V3: E2E_WSS=wss://test-node-v3.portaldot.dev E2E_SEED_FILE=<demo seed file, mode 600, outside repo>.
// The seed is read here in Node only; the page receives signatures, never the key.
// Usage: node scripts/ui-e2e.mjs <appUrl> <demo.json> <screenshot-prefix>
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const [url, demoPath, shots] = process.argv.slice(2);
const WSS = process.env.E2E_WSS ?? 'ws://localhost:8000';
const SEED_FILE = process.env.E2E_SEED_FILE;
const LABEL = SEED_FILE ? 'Demo key (e2e)' : 'Alice (fork test)';
await cryptoWaitReady();
// Reuse the shipped metadata snapshot (a fresh 1 MB metadata download often times out on the live node).
const snap = JSON.parse(readFileSync(new URL('../public/metadata.json', import.meta.url), 'utf8'));
const api = await ApiPromise.create({ provider: new WsProvider(WSS), noInitWarn: true, metadata: { [snap.key]: snap.hex } });
const alice = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(SEED_FILE ? readFileSync(SEED_FILE, 'utf8').trim() : '//Alice');
console.log('signer', alice.address, 'on', WSS);
let signed = 0;

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Serve the given demo list instead of the shipped one.
await page.setRequestInterception(true);
page.on('request', (r) => r.url().endsWith('/demo.json')
  ? r.respond({ contentType: 'application/json', body: readFileSync(demoPath, 'utf8') })
  : r.continue());

const CANCEL = process.env.E2E_CANCEL === '1';
await page.exposeFunction('__signPayload', async (payload) => {
  signed++;
  if (CANCEL) throw new Error('Cancelled');
  const ext = api.registry.createType('ExtrinsicPayload', payload, { version: payload.version });
  return ext.sign(alice).signature;
});
await page.evaluateOnNewDocument((address, name) => {
  window.injectedWeb3 = {
    'test-wallet': {
      version: '0.0.1',
      enable: async () => ({
        accounts: { get: async () => [{ address, name, type: 'sr25519' }], subscribe: (cb) => { cb([{ address, name, type: 'sr25519' }]); return () => {}; } },
        signer: { signPayload: async (p) => ({ id: 1, signature: await window.__signPayload(p) }) },
      }),
    },
  };
}, alice.address, LABEL);

const waitText = (t, timeout = 180000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const clickText = (t) => page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().startsWith(x) && !e.disabled); if (!b) throw new Error('no enabled button: ' + x); b.click(); }, t);

const t0 = Date.now();
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await waitText('Checked against live chain state');
console.log('checked rows in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await clickText('Connect wallet');
await waitText(LABEL);
await page.waitForFunction(() => /fee ≈/.test(document.body.innerText) && document.body.innerText.includes('Checked against live chain state'), { timeout: 120000 });
const summary = await page.evaluate(() => document.querySelector('.sticky')?.innerText.replace(/\s+/g, ' '));
console.log('summary:', summary);
// The §8 demo list must plan exactly 5 top-ups (5 × 0.11 tPOT) and 17 transfers; anything else is a bug.
const expectTopup = process.env.EXPECT_TOPUP ?? '0.55';
if (!summary.includes(`+ ${expectTopup} tPOT top-ups`)) throw new Error(`expected ${expectTopup} tPOT of top-ups, got: ${summary}`);
await page.screenshot({ path: `${shots}-before.png` });
await clickText('Fix & Send');
await waitText('Review before signing');
await page.screenshot({ path: `${shots}-confirm.png` });
await clickText('Sign once');
if (CANCEL) {
  await waitText('You cancelled the signature. Nothing was sent.', 60000);
  console.log('cancel path: PASS (banner shown, signatures requested:', signed + ')');
  await page.screenshot({ path: `${shots}-cancel.png` });
  await browser.close(); await api.disconnect(); process.exit(0);
}
await waitText('transfers confirmed on-chain', 180000);
await new Promise((r) => setTimeout(r, 1500));
const banner = await page.evaluate(() => document.querySelector('[role=status]')?.innerText ?? '');
const rows = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ')).filter((t) => /^\d/.test(t)));
console.log('banner:', banner.replace(/\s+/g, ' '));
console.log('sent rows:', rows.filter((r) => r.includes('Sent')).length, 'skipped:', rows.filter((r) => r.includes('Skipped')).length, 'merged:', rows.filter((r) => r.includes('Merged')).length, 'failed:', rows.filter((r) => r.includes('Failed')).length);
console.log('signatures requested:', signed, 'total seconds:', ((Date.now() - t0) / 1000).toFixed(1));
await page.screenshot({ path: `${shots}-after.png` });
console.log('page errors:', JSON.stringify(errors));
await browser.close();
await api.disconnect();
