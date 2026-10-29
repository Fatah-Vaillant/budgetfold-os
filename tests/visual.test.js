// Captures de référence (390 et 1280 px) : chaque écran est comparé, pixel par pixel, à tests/reference/*.png.
// Première exécution, ou UPDATE_REFS=1 (npm run test:refs) : les références sont (re)créées.
// Les captures dépendent des polices installées : régénère-les si tu changes d'ordinateur.
const path = require('path');
const fs = require('fs');
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite } = require('./util');

const { check, done } = suite('captures de référence');
const REF = path.join(__dirname, 'reference');
const OUT = path.join(__dirname, 'fixtures', 'visual');
fs.mkdirSync(REF, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const UPDATE = process.env.UPDATE_REFS === '1';
const MAX_DIFF = 0.015;
const SCREENS = ['home', 'journal', 'projects', 'agenda', 'report'];

// Part des pixels nettement différents entre deux PNG (comparaison faite dans le navigateur).
async function diffRatio(page, a, b) {
  return page.evaluate(async (x, y) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const da = px(ia);
    const db = px(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 40 || Math.abs(da[i + 1] - db[i + 1]) > 40 || Math.abs(da[i + 2] - db[i + 2]) > 40) n++;
    return n / (da.length / 4);
  }, `data:image/png;base64,${Buffer.from(a).toString('base64')}`, `data:image/png;base64,${Buffer.from(b).toString('base64')}`);
}

(async () => {
  const H = await start();
  const cmp = await H.browser.newPage(); // onglet sans interception de requêtes, pour décoder les PNG
  for (const [w, h, mobile] of [[390, 844, true], [1280, 900, false]]) {
    const p = await H.open({ storage: clone(demo), width: w, height: h, mobile });
    await p.addStyleTag({ content: '.toasts{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    for (const screen of SCREENS) {
      await p.evaluate((s) => { window.BudgetFold.setTab(s); window.scrollTo(0, 0); }, screen);
      await wait(700);
      const shot = await p.screenshot({ type: 'png' });
      const name = `${screen}-${w}.png`;
      fs.writeFileSync(path.join(OUT, name), shot);
      const ref = path.join(REF, name);
      if (UPDATE || !fs.existsSync(ref)) {
        fs.writeFileSync(ref, shot);
        check(`${name} : référence enregistrée`, true);
        continue;
      }
      const ratio = await diffRatio(cmp, shot, fs.readFileSync(ref));
      check(`${name} : identique à la référence (${(ratio * 100).toFixed(2)} % de pixels différents)`, ratio <= MAX_DIFF, `voir tests/fixtures/visual/${name}`);
    }
    await p.close();
  }
  const other = await diffRatio(cmp, fs.readFileSync(path.join(REF, 'home-390.png')), fs.readFileSync(path.join(REF, 'journal-390.png')));
  check('la comparaison repère bien un écran différent', other > MAX_DIFF, other);
  await cmp.close();
  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
