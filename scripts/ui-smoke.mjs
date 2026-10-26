// UI smoke test in real Chrome (no extension): page connects, loads demo config, classifies rows.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] ?? 'http://localhost:8765/';
const shot = process.argv[3];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setViewport({ width: Number(process.env.W ?? 1400), height: 1300 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.includes('Checked against live chain state') || document.body.innerText.includes('offline'), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 4000));
if (shot) await page.screenshot({ path: shot });
console.log('\nERRORS:', JSON.stringify(errors));
await browser.close();
