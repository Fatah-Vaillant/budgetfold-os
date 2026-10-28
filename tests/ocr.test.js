// Scan de ticket de bout en bout (vrai moteur Tesseract, dans le navigateur) :
// tickets générés (tests/tickets/synthetic/*.html) puis vraies photos (tests/tickets/*.jpg|png) avec leur .json attendu.
const path = require('path');
const fs = require('fs');
const { start } = require('./harness');
const demo = require('./demo');
const { clone, suite } = require('./util');

const { check, done } = suite('scan OCR');
const TICKETS = path.join(__dirname, 'tickets');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const paper = (pre) => `<html><body style="margin:0;background:#e8e4da;display:flex;justify-content:center;padding:40px">
<div style="background:#fbfaf6;padding:36px 30px;font:22px/1.5 'DejaVu Sans Mono',Consolas,monospace;color:#222;transform:rotate(-1.2deg);box-shadow:0 4px 18px rgba(0,0,0,.25)">${pre}</div></body></html>`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function compare(name, got, want) {
  if ('merchant' in want) check(`${name} : enseigne ${want.merchant}`, got.label === want.merchant, got.label);
  if ('total' in want) check(`${name} : total ${want.total / 100} €`, got.scan.total === want.total, got.scan.total);
  if ('date' in want) check(`${name} : date ${want.date}`, got.date === want.date, got.date);
  if ('dateOld' in want) check(`${name} : ticket ancien ${want.dateOld ? 'signalé' : 'non signalé'}`, Boolean(got.scan.dateOld) === want.dateOld && (!want.dateOld || /Ticket daté du/.test(got.hint)), got.hint);
  if (typeof want.items === 'number') check(`${name} : ${want.items} articles`, got.scan.items.length === want.items, got.scan.items);
  if (Array.isArray(want.items)) {
    const ok = got.scan.items.length === want.items.length
      && want.items.every((w, i) => got.scan.items[i] && norm(got.scan.items[i].label).includes(norm(w.label)) && got.scan.items[i].amount === w.amount);
    check(`${name} : articles ${want.items.map((w) => w.label).join(', ')}`, ok, got.scan.items);
  }
  if ('envelope' in want) check(`${name} : enveloppe ${want.envelope} proposée`, (got.env || '').includes(want.envelope), got.env);
}

async function scan(H, file) {
  const p = await H.open({ storage: clone(demo) });
  await p.evaluate(() => window.BudgetFold.actions.openAdd());
  const t0 = Date.now();
  await (await p.$('#scan-file')).uploadFile(file);
  await p.waitForFunction(() => document.getElementById('scan-status').hidden && (window.BudgetFold.ui.lastScan || !document.getElementById('tx-error').hidden), { timeout: 120000 });
  const got = await p.evaluate(() => ({
    scan: window.BudgetFold.ui.lastScan || { items: [] },
    amount: document.getElementById('tx-amount').value,
    label: document.getElementById('tx-label').value,
    date: document.getElementById('tx-date').value,
    env: (document.querySelector('#tx-chips [aria-checked="true"]') || {}).textContent,
    hint: document.getElementById('tx-hint').textContent,
    error: document.getElementById('tx-error').textContent
  }));
  console.log(`  ${path.basename(file)} lu en ${Date.now() - t0} ms`);
  await p.close();
  return got;
}

(async () => {
  const H = await start();

  const synth = fs.readdirSync(path.join(TICKETS, 'synthetic')).filter((f) => f.endsWith('.html')).sort();
  const g = await H.browser.newPage();
  await g.setViewport({ width: 640, height: 900 });
  for (const f of synth) {
    const name = f.replace(/\.html$/, '');
    await g.setContent(paper(fs.readFileSync(path.join(TICKETS, 'synthetic', f), 'utf8')));
    const img = path.join(OUT, `${name}.jpg`);
    await g.screenshot({ path: img, type: 'jpeg', quality: 80, fullPage: true });
    const want = JSON.parse(fs.readFileSync(path.join(TICKETS, 'synthetic', `${name}.json`), 'utf8'));
    const got = await scan(H, img);
    const shown = want.total % 100 === 0 ? String(want.total / 100) : (want.total / 100).toFixed(2).replace('.', ',');
    check(`${name} : montant reporté dans la saisie`, !want.total || got.amount === shown, got.amount);
    compare(name, got, want);
  }
  await g.close();

  const photos = fs.readdirSync(TICKETS).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  for (const f of photos) {
    const name = f.replace(/\.[^.]+$/, '');
    const json = path.join(TICKETS, `${name}.json`);
    if (!fs.existsSync(json)) { check(`${f} : fichier ${name}.json attendu à côté de la photo`, false, 'json manquant'); continue; }
    compare(name, await scan(H, path.join(TICKETS, f)), JSON.parse(fs.readFileSync(json, 'utf8')));
  }
  console.log(`${synth.length} ticket(s) généré(s), ${photos.length} vraie(s) photo(s).`);

  done(H);
  await H.close();
})().catch((e) => { console.error(e); process.exit(1); });
