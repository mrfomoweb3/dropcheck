// Simulates "Portaldot upgraded the runtime": the shipped metadata snapshot no longer matches (fake key),
// browser cache is empty. Expect: the upgrade note is shown, then the app connects by downloading metadata.
// Usage: node scripts/ui-upgrade-sim.mjs <appUrl> <screenshot>
import puppeteer from 'puppeteer-core';
const [url, shot] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 400000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setRequestInterception(true);
page.on('request', (r) => r.url().endsWith('/metadata.json')
  ? r.respond({ contentType: 'application/json', body: JSON.stringify({ key: '0xdead-1', hex: '0x00' }) })
  : r.continue());
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.body.innerText.includes('Portaldot updated the chain'), { timeout: 60000 });
console.log('upgrade note shown after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.screenshot({ path: shot });
const ok = await page.waitForFunction(() => document.body.innerText.includes('verified') || document.body.innerText.includes("Can't reach"), { timeout: 330000 }).then(() => true, () => false);
const state = await page.evaluate(() => document.body.innerText.includes('verified') ? 'connected' : document.body.innerText.includes("Can't reach") ? 'error banner' : 'still connecting');
console.log('result:', ok ? state : 'timed out', 'after', ((Date.now() - t0) / 1000).toFixed(1), 's; cached metadata:', await page.evaluate(() => (localStorage.getItem('dropcheck.metadata') ?? '').length), 'chars');
console.log('page errors:', JSON.stringify(errors));
console.log('banners:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[role=alert],[role=status]')].map((e) => e.innerText))));
await browser.close();
