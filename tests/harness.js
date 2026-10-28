const http = require('http');
const fs = require('fs');
const path = require('path');

// Navigateur des tests, dans cet ordre :
// 1. CHROME_PATH s'il est défini ; 2. le Chrome téléchargé par Puppeteer ;
// 3. un Chrome ou un Edge déjà installé sur l'ordinateur.
const INSTALLED = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

async function launchBrowser() {
  const core = require('puppeteer-core');
  const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
  if (process.env.CHROME_PATH) return core.launch({ executablePath: process.env.CHROME_PATH, args, headless: true });
  try {
    return await require('puppeteer').launch({ args, headless: true });
  } catch (err) {
    const exe = INSTALLED.find((p) => fs.existsSync(p));
    if (!exe) throw err;
    console.log(`(Chrome de Puppeteer introuvable, les tests utilisent : ${exe})`);
    return core.launch({ executablePath: exe, args, headless: true });
  }
}

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const lucideJs = fs.readFileSync(path.join(NM, 'lucide/dist/umd/lucide.min.js'), 'utf8');
const OCR_NM = NM;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.gz': 'application/gzip' };

function localFor(u) {
  let m;
  if ((m = /tesseract\.js@[^/]+\/dist\/(.+)$/.exec(u))) return `${OCR_NM}/tesseract.js/dist/${m[1]}`;
  if ((m = /tesseract\.js-core@[^/]+\/(.+)$/.exec(u))) return `${OCR_NM}/tesseract.js-core/${m[1]}`;
  if ((m = /@tesseract\.js-data\/fra@[^/]+\/(.+)$/.exec(u))) return `${OCR_NM}/@tesseract.js-data/fra/${m[1]}`;
  return null;
}

async function start() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await launchBrowser();
  const logs = [];
  const requests = [];
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*cdn.jsdelivr.net*' }] });
  cdp.on('Fetch.requestPaused', async (ev) => {
    const local = localFor(ev.request.url);
    requests.push('CDP ' + ev.request.url);
    try {
      if (local && fs.existsSync(local)) {
        await cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: mime[path.extname(local)] || 'application/octet-stream' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: fs.readFileSync(local).toString('base64') });
      } else {
        logs.push('CDP MISSING ' + ev.request.url);
        await cdp.send('Fetch.failRequest', { requestId: ev.requestId, errorReason: 'Failed' });
      }
    } catch (e) { logs.push('CDP ERR ' + e.message); }
  });

  async function open({ width = 1280, height = 900, mobile = false, today = '2026-10-15', storage = null, key = 'budgetfold-os:v3', page: file = '/' } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    page.on('console', async (m) => { if (m.type() === 'warn') { const a = await Promise.all(m.args().map((x) => x.evaluate((v) => (v instanceof Error ? v.stack : String(v))).catch(() => '?'))); logs.push('WARN ' + a.join(' ')); return; } if (['error', 'warning', 'warn'].includes(m.type()) && !/Failed to load resource/.test(m.text())) logs.push(`[${width}] ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[${width}] pageerror: ${e.message}`));
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      requests.push(u);
      if (u.includes('unpkg.com/lucide')) return req.respond({ status: 200, contentType: 'text/javascript', body: lucideJs });
      if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return req.abort();
      const local = localFor(u);
      if (local) {
        if (!fs.existsSync(local)) { logs.push(`MISSING LOCAL ${u}`); return req.respond({ status: 404, body: '' }); }
        return req.respond({ status: 200, contentType: mime[path.extname(local)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(local) });
      }
      if (!u.startsWith(`http://localhost:${port}`) && !u.startsWith('data:') && !u.startsWith('blob:')) { logs.push(`EXTERNAL ${u}`); return req.abort(); }
      req.continue();
    });
    await page.evaluateOnNewDocument((today, storage, key) => {
      const R = Date;
      window.__dateOffset = new R(`${today}T10:00:00`).getTime() - R.now();
      class D extends R {
        constructor(...a) { if (!a.length) super(R.now() + window.__dateOffset); else super(...a); }
        static now() { return R.now() + window.__dateOffset; }
      }
      window.Date = D;
      if (storage && !sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify(storage));
        sessionStorage.setItem('__seeded', '1');
      }
    }, today, storage, key);
    await page.goto(`http://localhost:${port}${file}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    return page;
  }

  async function close() {
    await browser.close();
    server.close();
  }
  return { open, close, logs, requests, port, browser };
}

module.exports = { start };
