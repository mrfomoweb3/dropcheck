import puppeteer from 'puppeteer-core';
const [url, out, w, wait] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 240000 });
const p = await b.newPage();
await p.setViewport({ width: +w, height: 900 });
await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
if (wait) await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 120000 }, wait);
await new Promise((r) => setTimeout(r, 2500));
if (!wait) { await p.evaluate(() => window.scrollTo(0, 900)); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: out + '-2.png' }); await p.evaluate(() => window.scrollTo(0, 1700)); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: out + '-3.png' }); await p.evaluate(() => window.scrollTo(0, 99999)); await new Promise((r) => setTimeout(r, 500)); }
await p.screenshot({ path: out + '.png' });
await b.close();
