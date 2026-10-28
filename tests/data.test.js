// Données : migrations de chaque ancienne version vers v4, persistance, rappel de sauvegarde.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D } = require('./util');

const { check, done } = suite('données');

(async () => {
  const H = await start();

  // 1. v3 → v4 : même reste à vivre, nouvelle clé écrite, ancienne clé conservée.
  {
    const p = await H.open({ storage: clone(demo) });
    const s = await S(p);
    check('v3 → v4 : champ v = 4', s.v === 4, s.v);
    check('v3 → v4 : date de début d\'usage posée', s.prefs.since === '2026-10-15' && s.prefs.lastExport === null, s.prefs);
    check('v3 → v4 : reste à vivre identique (599,94 €)', (await D(p)).free === 59994);
    const keys = await p.evaluate(() => ({ v4: !!localStorage.getItem('budgetfold-os:v4'), v3: !!localStorage.getItem('budgetfold-os:v3') }));
    check('v3 → v4 : clé v4 écrite, clé v3 jamais effacée', keys.v4 && keys.v3, keys);
    const round = await p.evaluate(() => {
      const B = window.BudgetFold;
      B.actions.addTransaction({ type: 'deposit', envId: 'p1', amount: 1000, date: '2026-10-15', covers: true });
      B.getState().envelopes.find((e) => e.id === 'p1').startMonth = '2026-10';
      B.getState().prefs.lastExport = '2026-10-01';
      const raw = JSON.parse(JSON.stringify(B.getState()));
      B.setState(raw);
      const st = B.getState();
      return { covers: st.transactions.find((t) => t.type === 'deposit').covers, start: st.envelopes.find((e) => e.id === 'p1').startMonth, exp: st.prefs.lastExport, v: st.v };
    });
    check('v4 relu tel quel : covers, startMonth, lastExport gardés', round.covers === '2026-10' && round.start === '2026-10' && round.exp === '2026-10-01' && round.v === 4, round);
    const junk = await p.evaluate(() => {
      const B = window.BudgetFold;
      const raw = JSON.parse(JSON.stringify(B.getState()));
      raw.transactions.push({ id: 'x', type: 'expense', envId: 'e1', amount: 100, date: '2026-10-15', covers: '2026-10' });
      raw.envelopes[0].startMonth = 'n\'importe quoi';
      B.setState(raw);
      const st = B.getState();
      return { covers: st.transactions.find((t) => t.id === 'x').covers, start: st.envelopes.find((e) => e.id === 'p1').startMonth };
    });
    check('v4 : covers ignoré hors versement, startMonth invalide écarté', junk.covers === undefined && junk.start === '2026-10', junk);
    await p.close();
  }

  // 2. v1 → v4 (clé budgetfold-os:v1).
  {
    const v1 = { salary: 150000, envelopes: [
      { id: 'a', name: 'Courses', max: 30000, spent: 5000 },
      { id: 'g', name: 'Vacances', max: 10000, spent: 2000, kind: 'goal' }
    ] };
    const p = await H.open({ storage: v1, key: 'budgetfold-os:v1' });
    const s = await S(p);
    const courses = s.envelopes.find((e) => e.id === 'a');
    const vac = s.envelopes.find((e) => e.id === 'g');
    check('v1 → v4 : version et enveloppe de dépenses', s.v === 4 && courses && courses.kind === 'spend' && courses.max === 30000, courses);
    check('v1 → v4 : dépenses reprises au journal', s.transactions.some((t) => t.envId === 'a' && t.amount === 5000));
    check('v1 → v4 : objectif devenu projet Actif', vac && vac.kind === 'project' && vac.saved === 2000 && vac.monthly === 10000 && vac.mode === 'active', vac);
    check('v1 → v4 : clé v1 conservée', await p.evaluate(() => !!localStorage.getItem('budgetfold-os:v1')));
    await p.close();
  }

  // 3. Rappel de sauvegarde après 30 jours sans export.
  {
    const old = clone(demo);
    old.prefs.since = '2026-09-01';
    const p = await H.open({ storage: old });
    const titles = () => p.evaluate(() => [...document.querySelectorAll('#insights .insight strong')].map((n) => n.textContent));
    check('44 jours sans export : rappel affiché', (await titles()).includes('Pense à sauvegarder'), await titles());
    await p.evaluate(() => document.querySelector('#insights [data-action="export"]').click());
    await wait(300);
    const s = await S(p);
    check('export : date mémorisée et rappel retiré', s.prefs.lastExport === '2026-10-15' && !(await titles()).includes('Pense à sauvegarder'), s.prefs);
    await p.close();

    const q = await H.open({ storage: clone(demo) });
    check('premier jour : pas de rappel', !(await q.evaluate(() => /Pense à sauvegarder/.test(document.getElementById('insights').textContent))));
    await q.close();
  }

  // 4. Persistance : demande au navigateur, et alerte si le stockage est presque plein.
  {
    const init = () => {
      window.__persistCalls = 0;
      const fake = {
        persisted: async () => false,
        persist: async () => { window.__persistCalls++; return true; },
        estimate: async () => ({ usage: 90, quota: 100 })
      };
      Object.defineProperty(navigator, 'storage', { value: fake, configurable: true });
    };
    const p = await H.open({ storage: clone(demo), init });
    await wait(300);
    check('navigator.storage.persist() demandé au démarrage', (await p.evaluate(() => window.__persistCalls)) === 1);
    check('stockage à 90 % : alerte affichée', await p.evaluate(() => /Stockage presque plein/.test(document.getElementById('toasts').textContent)));
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
