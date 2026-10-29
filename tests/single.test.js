// Version en un seul fichier (BudgetFold.html) : générée à partir des modules, elle doit marcher comme l'app.
const path = require('path');
const { execFileSync } = require('child_process');
const { start } = require('./harness');
const demo = require('./demo');
const { clone, suite, D } = require('./util');

const { check, done } = suite('version un seul fichier');

(async () => {
  const file = path.join(__dirname, 'fixtures', 'BudgetFold.html');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-single.js'), file]);
  const H = await start();
  const p = await H.open({ storage: clone(demo), page: '/tests/fixtures/BudgetFold.html' });
  const info = await p.evaluate(() => ({
    modules: document.querySelectorAll('script[type="module"]').length,
    external: [...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((n) => n.src || n.href).filter((u) => !/fonts\.googleapis/.test(u)),
    icons: document.querySelectorAll('svg.lucide').length
  }));
  check('un seul fichier : aucun module ni script ou style externe (hors police)', info.modules === 0 && !info.external.length, info);
  check('icônes intégrées', info.icons > 10, info.icons);
  check('mêmes calculs que l\'app (reste à vivre 599,94 €)', (await D(p)).free === 59994);
  await p.evaluate(() => window.BudgetFold.setTab('report'));
  check('Bilan rendu, score de santé affiché', await p.evaluate(() => /Santé du budget/.test(document.getElementById('r-health').textContent)));
  await p.evaluate(() => window.BudgetFold.actions.openAdd());
  check('saisie ouverte', await p.evaluate(() => document.getElementById('dlg-tx').open));
  await p.close();
  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
