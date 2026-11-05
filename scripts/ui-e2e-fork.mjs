// End-to-end UI test against a LOCAL CHOPSTICKS FORK of V3 (not live V3).
// Injects a test wallet extension that signs as the public dev key //Alice, then drives the real UI:
// load demo -> connect wallet -> Fix & Send -> confirm -> wait for on-chain confirmation.
// Usage: node scripts/ui-e2e-fork.mjs <appUrl> <fork-demo.json> <screenshot-prefix>
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const [url, demoPath, shots] = process.argv.slice(2);
const FORK = 'ws://localhost:8000';
await cryptoWaitReady();
const api = await ApiPromise.create({ provider: new WsProvider(FORK), noInitWarn: true });
const alice = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri('//Alice');
let signed = 0;

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Serve the fork demo list instead of the shipped one.
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
await page.evaluateOnNewDocument((address) => {
  window.injectedWeb3 = {
    'test-wallet': {
      version: '0.0.1',
      enable: async () => ({
        accounts: { get: async () => [{ address, name: 'Alice (fork test)', type: 'sr25519' }], subscribe: (cb) => { cb([{ address, name: 'Alice (fork test)', type: 'sr25519' }]); return () => {}; } },
        signer: { signPayload: async (p) => ({ id: 1, signature: await window.__signPayload(p) }) },
      }),
    },
  };
}, alice.address);

const waitText = (t, timeout = 180000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const clickText = (t) => page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().startsWith(x) && !e.disabled); if (!b) throw new Error('no enabled button: ' + x); b.click(); }, t);

const t0 = Date.now();
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await waitText('Checked against live chain state');
console.log('checked rows in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await clickText('Connect wallet');
await waitText('Alice (fork test)');
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
