// Screenshot a URL: node scripts/shot.mjs <url> <out.png> [width] [height] [waitText]
import puppeteer from 'puppeteer-core';
const [url, out, w = '1440', h = '900', wait] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
if (wait) await p.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 120000 }, wait);
await new Promise((r) => setTimeout(r, 2500));
await p.screenshot({ path: out });
console.log('ok', out, errs.length ? 'ERRORS ' + JSON.stringify(errs) : '');
await b.close();
