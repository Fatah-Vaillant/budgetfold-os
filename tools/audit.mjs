// Audit Lighthouse (performance, accessibilité, bonnes pratiques, SEO) sur mobile : chaque note doit être ≥ 90.
// Usage : npm run audit (a besoin d'internet pour la police et les icônes, comme l'app en ligne).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import lighthouse from 'lighthouse';

const require = createRequire(import.meta.url);
const { launchBrowser } = require('../tests/harness.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, p === '/' ? 'index.html' : p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  // Comme GitHub Pages : fichiers texte compressés en gzip.
  const body = fs.readFileSync(file);
  const text = /\.(html|css|m?js|json|svg)$/.test(file) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ...(text ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(text ? zlib.gzipSync(body) : body);
});
await new Promise((r) => server.listen(0, r));
const browser = await launchBrowser();
const port = Number(new URL(browser.wsEndpoint()).port);
const url = `http://localhost:${server.address().port}/`;
const { lhr } = await lighthouse(url, { port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
const scores = Object.fromEntries(Object.values(lhr.categories).map((c) => [c.title, Math.round(c.score * 100)]));
for (const [k, v] of Object.entries(scores)) console.log(`${v >= 90 ? 'PASS' : 'FAIL'} ${k} : ${v}`);
const failing = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable').map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
if (failing.length) console.log(`Points à améliorer :\n${failing.slice(0, 15).join('\n')}`);
if (process.env.AUDIT_DETAIL) {
  for (const id of ['mainthread-work-breakdown', 'bootup-time', 'largest-contentful-paint-element', 'render-blocking-resources']) {
    const items = (lhr.audits[id].details && lhr.audits[id].details.items) || [];
    console.log(id, JSON.stringify(items.slice(0, 6).map((x) => x.groupLabel || x.url || (x.items && JSON.stringify(x.items[0]).slice(0, 160)) || x.node && x.node.snippet ? [x.groupLabel || x.url || '', Math.round(x.duration || x.total || x.wastedMs || 0)] : x)).slice(0, 700));
  }
}
fs.mkdirSync(path.join(root, 'tests', 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests', 'fixtures', 'lighthouse.json'), JSON.stringify(scores, null, 2));
await browser.close();
server.close();
process.exitCode = Object.values(scores).every((v) => v >= 90) ? 0 : 1;
