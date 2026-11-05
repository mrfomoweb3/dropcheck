// End-to-end "judge / first-time visitor" test on LIVE V3, in the real production UI:
// a wallet with a little tPOT but no demo token connects -> sees "Create my demo token" -> creates it
// (signature 1) -> Fix & Send on the freshly generated demo list (signature 2) -> 17 rows sent.
// The visitor key is generated in memory for this run only (never printed or saved) and funded with
// a few tPOT from the demo key (DEMO_SEED_FILE, read in Node only).
// Usage: node --env-file=.env scripts/ui-e2e-visitor.mjs <appUrl> <screenshot-prefix>
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

const [url, shots] = process.argv.slice(2);
const WSS = process.env.E2E_WSS ?? 'wss://test-node-v3.portaldot.dev';
await cryptoWaitReady();
const snap = JSON.parse(readFileSync(new URL('../public/metadata.json', import.meta.url), 'utf8'));
const api = await ApiPromise.create({ provider: new WsProvider(WSS), noInitWarn: true, metadata: { [snap.key]: snap.hex } });
const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
const funder = kr.addFromUri(readFileSync(process.env.DEMO_SEED_FILE, 'utf8').trim());
const visitor = kr.addFromUri(mnemonicGenerate());
const FUND = BigInt(process.env.VISITOR_FUND_TPOT ?? '3') * 10n ** 14n;
console.log('visitor', visitor.address, 'funding', Number(FUND) / 1e14, 'tPOT');
await new Promise((resolve, reject) => api.tx.balances.transferKeepAlive(visitor.address, FUND).signAndSend(funder, ({ status, dispatchError }) => {
  if (dispatchError) reject(new Error('funding failed: ' + dispatchError.toString()));
  if (status.isInBlock) resolve();
}).catch(reject));

let signed = 0;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.exposeFunction('__signPayload', async (payload) => {
  signed++;
  return api.registry.createType('ExtrinsicPayload', payload, { version: payload.version }).sign(visitor).signature;
});
await page.evaluateOnNewDocument((address) => {
  const acc = [{ address, name: 'Visitor (e2e)', type: 'sr25519' }];
  window.injectedWeb3 = { 'test-wallet': { version: '0.0.1', enable: async () => ({
    accounts: { get: async () => acc, subscribe: (cb) => { cb(acc); return () => {}; } },
    signer: { signPayload: async (p) => ({ id: 1, signature: await window.__signPayload(p) }) },
  }) } };
}, visitor.address);

const dump = async (why) => {
  const msgs = await page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert],.card')].map((e) => e.innerText.replace(/\s+/g, ' ')));
  console.log('FAILED waiting for:', why); console.log('on-screen messages:', JSON.stringify(msgs, null, 1));
  console.log('signatures so far:', signed, 'page errors:', JSON.stringify(errors));
  await page.screenshot({ path: `${shots}-fail.png`, fullPage: true });
  await browser.close(); await api.disconnect(); process.exit(1);
};
const waitText = (t, timeout = 180000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t).catch(() => dump(t));
const clickText = (t) => page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find((e) => e.innerText.trim().startsWith(x) && !e.disabled); if (!b) throw new Error('no enabled button: ' + x); b.click(); }, t);

const t0 = Date.now();
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await waitText('Checked against live chain state');
const freshShown = await page.evaluate(() => document.body.innerText.split('Top-up + send').length - 1);
console.log('preview: top-up rows shown', freshShown);
await clickText('Connect wallet');
await waitText('Visitor (e2e)');
await waitText("Your wallet doesn't hold the demo token", 120000);
await waitText('as the token deposit', 120000);
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.startsWith('Create my demo token') && !b.disabled), { timeout: 120000 }).catch(() => dump('enabled Create button'));
const offer = await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.innerText.includes('demo token'))?.innerText.replace(/\s+/g, ' '));
console.log('offer:', offer);
await page.screenshot({ path: `${shots}-offer.png` });
await clickText('Create my demo token');
await waitText('was created in block', 180000);
const created = await page.evaluate(() => [...document.querySelectorAll('[role=status]')].map((e) => e.innerText).find((t) => t.includes('was created')));
console.log('created:', created);
await page.waitForFunction(() => /fee ≈/.test(document.body.innerText) && document.body.innerText.includes('Checked against live chain state'), { timeout: 120000 });
const summary = await page.evaluate(() => document.querySelector('.sticky')?.innerText.replace(/\s+/g, ' '));
console.log('summary:', summary);
if (!summary.includes('+ 0.55 tPOT top-ups')) throw new Error('expected 5 top-ups on a freshly generated list');
await clickText('Fix & Send');
await waitText('Review before signing');
await clickText('Sign once');
await waitText('transfers confirmed on-chain', 180000);
await new Promise((r) => setTimeout(r, 1500));
const rows = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ')).filter((t) => /^\d/.test(t)));
const banner = await page.evaluate(() => [...document.querySelectorAll('[role=status]')].map((e) => e.innerText).find((t) => t.includes('confirmed on-chain')) ?? '');
console.log('banner:', banner.replace(/\s+/g, ' '));
console.log('sent rows:', rows.filter((r) => r.includes('Sent')).length, 'skipped:', rows.filter((r) => r.includes('Skipped')).length, 'failed:', rows.filter((r) => r.includes('Failed')).length);
console.log('signatures requested:', signed, 'total seconds:', ((Date.now() - t0) / 1000).toFixed(1));
await page.screenshot({ path: `${shots}-after.png` });
console.log('page errors:', JSON.stringify(errors));
await browser.close();
await api.disconnect();
