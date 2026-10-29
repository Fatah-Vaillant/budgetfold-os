// Appareils (émulation) : iPhone, iPad, Android, en portrait et en paysage, et un ordinateur.
// Ne remplace pas un essai sur de vrais appareils (voir docs/checklist.md), mais attrape les débordements et erreurs.
const { KnownDevices } = require('puppeteer-core');
const { start } = require('./harness');
const demo = require('./demo');
const { clone, suite, wait } = require('./util');

const { check, done } = suite('appareils');
const DEVICES = ['iPhone SE', 'iPhone 15 Pro', 'iPhone 15 Pro Max landscape', 'iPad Mini', 'iPad Pro 11 landscape', 'Galaxy S9+'];

(async () => {
  const H = await start();
  const run = async (label, opts) => {
    const p = await H.open({ storage: clone(demo), ...opts });
    const r = await p.evaluate(async () => {
      const over = [];
      for (const tab of ['home', 'journal', 'projects', 'agenda', 'report']) {
        window.BudgetFold.setTab(tab);
        await new Promise((res) => setTimeout(res, 80));
        const o = document.documentElement.scrollWidth - window.innerWidth;
        if (o > 0) over.push(`${tab}:${o}`);
      }
      window.BudgetFold.setTab('home');
      const add = [...document.querySelectorAll('#nav-add, #top-add')].find((b) => b.getClientRects().length && getComputedStyle(b).display !== 'none');
      add.click();
      const sheet = document.getElementById('dlg-tx').getBoundingClientRect();
      return { over, sheetFits: sheet.width <= window.innerWidth + 1, free: window.BudgetFold.derive().free, w: window.innerWidth };
    });
    await wait(100);
    check(`${label} (${r.w} px) : aucun débordement, saisie à l'écran, calculs justes`, !r.over.length && r.sheetFits && r.free === 59994, r);
    await p.close();
  };
  for (const name of DEVICES) await run(name, { device: KnownDevices[name] });
  await run('Ordinateur', { width: 1440, height: 900 });
  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
