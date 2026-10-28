const path = require('path');
const { start } = require('./harness');
const demo = require('./demo');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
const receipt = `<html><body style="margin:0;background:#e8e4da;display:flex;justify-content:center;padding:40px">
<pre style="background:#fbfaf6;padding:36px 30px;font:22px/1.5 'DejaVu Sans Mono',monospace;color:#222;transform:rotate(-1.2deg);box-shadow:0 4px 18px rgba(0,0,0,.25)">
     CARREFOUR MARKET
 12 RUE DE LA PAIX 75002 PARIS
    TEL 01 23 45 67 89
14/10/2026 18:42     CAISSE 3
--------------------------------
LAIT DEMI ECREME 1L      1,05 €
PAIN DE MIE              1,89 €
2 x 1,20
YAOURT NATURE            2,40 €
POMMES GOLDEN 1KG        2,99 €
CAFE MOULU 250G          3,49 €
--------------------------------
SOUS-TOTAL              11,82 €
TOTAL TTC               11,82 €
CB                      11,82 €
TVA 5,5%                 0,62 €
   MERCI DE VOTRE VISITE
</pre></body></html>`;
(async () => {
  const H = await start();
  const g = await H.browser.newPage();
  await g.setViewport({ width: 620, height: 820 });
  await g.setContent(receipt);
  await g.screenshot({ path: path.join(__dirname, 'fixtures/receipt.jpg'), type: 'jpeg', quality: 80 });
  await g.close();

  const p = await H.open({ storage: demo });
  const unit = await p.evaluate(() => {
    const B = window.BudgetFold;
    const noisy = 'LIDL\n13 AV FOCH\n15/10/26 12:01\nBANANES 1,49 A\nEMMENTAL RAPE 2,1O B\nCHIPS NATURE 0,99 A\nREMISE FIDELITE -0,50\nTOTAL 4,08\nCARTE BANCAIRE 4,08 EUR\nRENDU 0,00';
    const r = B.parseReceipt(noisy);
    return { merchant: r.merchant, total: r.total, date: r.date, items: r.items.map((i) => [i.label, i.amount]) };
  });
  const checks = [];
  const check = (n, c, i = '') => { checks.push(c); console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ` -> ${i}`}`); };
  check('parseReceipt: Lidl, total 4,08, remise', unit.merchant === 'Lidl' && unit.total === 408 && unit.items.length === 4, JSON.stringify(unit));
  await p.evaluate(() => window.BudgetFold.actions.openAdd());
  const input = await p.$('#scan-file');
  const t0 = Date.now();
  await input.uploadFile(path.join(__dirname, 'fixtures/receipt.jpg'));
  await p.waitForFunction(() => document.getElementById('scan-status').hidden && document.getElementById('tx-amount').value !== '' || !document.getElementById('tx-error').hidden, { timeout: 120000 });
  const res = await p.evaluate(() => ({
    amount: document.getElementById('tx-amount').value, label: document.getElementById('tx-label').value, date: document.getElementById('tx-date').value,
    env: (document.querySelector('#tx-chips [aria-checked="true"]') || {}).textContent, detail: document.getElementById('tx-detail').value,
    hint: document.getElementById('tx-hint').textContent, error: document.getElementById('tx-error').textContent
  }));
  console.log('OCR en', Date.now() - t0, 'ms');
  check('OCR: montant 11,82', res.amount === '11,82', JSON.stringify(res));
  check('OCR: enseigne Carrefour Market', res.label === 'Carrefour Market', res.label);
  check('OCR: date du ticket', res.date === '2026-10-14', res.date);
  check('OCR: 5 articles dans le détail', /5 articles/.test(res.detail), res.detail);
  check('OCR: enveloppe Courses proposée', /Courses/.test(res.env || ''), res.env);
    check('aucune erreur console', !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
  await H.close();
  const failed = checks.filter((c) => !c).length;
  console.log(`\nOCR : ${checks.length - failed}/${checks.length} réussis`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
