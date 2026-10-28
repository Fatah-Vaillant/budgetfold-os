// Projets : mise du mois couverte par un versement, alerte reste à vivre, doublons, début de la mise.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D, flat } = require('./util');

const { check, done } = suite('projets');

const fillDeposit = (p, { amount, project = 'p1', covers } = {}) => p.evaluate((o) => {
  const $ = (id) => document.getElementById(id);
  window.BudgetFold.actions.openAdd({ mode: 'deposit', projectId: o.project });
  $('tx-amount').value = o.amount;
  $('tx-amount').dispatchEvent(new Event('input'));
  if (o.covers !== undefined && $('tx-covers').checked !== o.covers) $('tx-covers').click();
}, { amount, project, covers });
const submit = async (p) => { await p.evaluate(() => document.getElementById('tx-form').requestSubmit()); await wait(400); };
const confirmOpen = (p) => p.evaluate(() => document.getElementById('dlg-confirm').open && document.getElementById('confirm-title').textContent);
const answer = async (p, yes) => { await p.evaluate((y) => document.querySelector(`#dlg-confirm [value="${y ? 'confirm' : 'cancel'}"]`).click(), yes); await wait(400); };

// Scénario « Moto » du BACKLOG : 2 000 € de revenus, loyer 300, enveloppes 500, projet Actif à 1 000 €/mois.
const moto = {
  v: 3, salary: 200000, salaryDay: 1, openingBalance: null, lastRollover: '2026-10', prefs: { onboarded: true },
  envelopes: [
    { id: 'e1', kind: 'spend', name: 'Courses', max: 50000, period: 'month' },
    { id: 'm', kind: 'project', name: 'Moto', target: 600000, saved: 0, monthly: 100000, mode: 'active' }
  ],
  recurring: [{ id: 'r1', type: 'expense', label: 'Loyer', amount: 30000, freq: 'month', start: '2026-10-01' }],
  transactions: []
};

(async () => {
  const H = await start();

  // 1. « C'est la mise de ce mois » : le versement remplace la mise au lieu de s'y ajouter.
  {
    const p = await H.open({ storage: clone(moto), today: '2026-10-16' });
    check('moto: reste à vivre avant versement 200 €', (await D(p)).free === 20000, (await D(p)).free);
    await fillDeposit(p, { amount: '1000', project: 'm' });
    const ui = await p.evaluate(() => ({ shown: !document.getElementById('tx-covers-field').hidden, checked: document.getElementById('tx-covers').checked, hint: document.getElementById('tx-hint').textContent }));
    check('versement projet Actif : case « mise de ce mois » proposée et cochée', ui.shown && ui.checked, ui);
    check('versement : le conseil annonce la mise du mois', /Comptécommelamised'octobre/.test(flat(ui.hint)) && /Resteàvivreaprès:200€/.test(flat(ui.hint)), ui.hint);
    await submit(p);
    const s = await S(p);
    const dep = s.transactions.find((t) => t.type === 'deposit');
    check('versement enregistré avec covers = 2026-10', dep && dep.covers === '2026-10', dep);
    const d = await D(p);
    check('moto : la mise n\'est plus comptée deux fois (reste 200 €, pas −800 €)', d.free === 20000 && d.projectsMonthly === 0 && d.deposits === 100000, { free: d.free, pm: d.projectsMonthly, dep: d.deposits });
    await p.evaluate(() => { window.__dateOffset += 17 * 86400000; });
    const credits = await p.evaluate(() => [...window.BudgetFold.tick().credits]);
    const after = await S(p);
    check('clôture d\'octobre : aucun versement automatique en plus', credits.length === 0 && after.envelopes.find((e) => e.id === 'm').saved === 100000, { credits, saved: after.envelopes.find((e) => e.id === 'm').saved });
    check('novembre : la mise est de nouveau réservée', (await D(p)).projectsMonthly === 100000);
    await p.close();
  }

  // 2. Versement partiel marqué « mise du mois » et versement exceptionnel.
  {
    const p = await H.open({ storage: clone(demo) });
    const free0 = (await D(p)).free;
    await p.evaluate(() => window.BudgetFold.actions.addTransaction({ type: 'deposit', envId: 'p1', amount: 5000, date: '2026-10-15', covers: true }));
    let d = await D(p);
    check('versement partiel : mise réduite à 150 €, reste à vivre inchangé', d.projectsMonthly === 15000 && d.free === free0, { pm: d.projectsMonthly, free: d.free, free0 });
    await p.evaluate(() => window.BudgetFold.actions.addTransaction({ type: 'deposit', envId: 'p1', amount: 3000, date: '2026-10-15' }));
    d = await D(p);
    check('versement exceptionnel : pris en plus sur le reste à vivre', d.free === free0 - 3000, { free: d.free, free0 });
    await p.evaluate(() => { window.__dateOffset += 17 * 86400000; });
    const cr = await p.evaluate(() => Object.fromEntries(window.BudgetFold.tick().credits));
    check('clôture d\'octobre : seul le reste de la mise (150 €) est versé', cr.p1 === 15000, cr);
    await p.close();
  }

  // 3. Alerte quand le versement fait passer le reste à vivre sous 0.
  {
    const p = await H.open({ storage: clone(demo) });
    const n0 = (await S(p)).transactions.length;
    await fillDeposit(p, { amount: '700', covers: false });
    const hint = await p.evaluate(() => document.getElementById('tx-hint').textContent);
    check('versement trop gros : le conseil prévient', /passerait à/.test(hint), hint);
    await submit(p);
    check('versement trop gros : confirmation demandée', (await confirmOpen(p)) === 'Reste à vivre négatif');
    await answer(p, false);
    check('confirmation refusée : rien n\'est versé', (await S(p)).transactions.length === n0);
    await submit(p);
    await answer(p, true);
    check('confirmation acceptée : versement ajouté', (await S(p)).transactions.length === n0 + 1);
    await p.close();
  }

  // 4. Doublon probable : même montant, même cible, moins de 2 minutes.
  {
    const p = await H.open({ storage: clone(demo) });
    const add = () => p.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' });
      $('tx-amount').value = '12,50';
      $('tx-amount').dispatchEvent(new Event('input'));
    });
    const count = async () => (await S(p)).transactions.filter((t) => t.amount === 1250).length;
    await add();
    await submit(p);
    check('première saisie : ajoutée sans question', (await count()) === 1 && !(await confirmOpen(p)));
    await add();
    await submit(p);
    check('même saisie juste après : doublon probable signalé', (await confirmOpen(p)) === 'Doublon probable');
    await answer(p, false);
    check('doublon refusé : une seule opération', (await count()) === 1);
    await add();
    await submit(p);
    await answer(p, true);
    check('doublon confirmé : deux opérations', (await count()) === 2);
    await p.evaluate(() => { window.__dateOffset += 3 * 60 * 1000; });
    await add();
    await submit(p);
    check('3 minutes plus tard : plus de question', !(await confirmOpen(p)) && (await count()) === 3);
    await p.close();
  }

  // 5. Projet créé en cours de mois : première mise à la prochaine paie ou dès ce mois-ci.
  {
    const p = await H.open({ storage: clone(demo) }); // 15 octobre, paie le 3 : déjà passée
    const free0 = (await D(p)).free;
    await p.evaluate(() => window.BudgetFold.actions.openEnv({ kind: 'project' }));
    const field = await p.evaluate(() => ({ shown: !document.getElementById('env-start-field').hidden, text: document.getElementById('env-start-pay-text').textContent, pay: document.getElementById('env-start-pay').checked }));
    check('nouveau projet : choix de la première mise proposé', field.shown && /novembre 2026/.test(field.text) && field.pay, field);
    await p.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      for (const [id, v] of [['env-name', 'Moto'], ['env-target', '3000'], ['env-monthly', '100']]) { $(id).value = v; $(id).dispatchEvent(new Event('input')); }
    });
    const hint = await p.evaluate(() => document.getElementById('env-hint').textContent);
    check('conseil : rien réservé ce mois-ci', /rien n'est réservé ce mois-ci/.test(hint) && /novembre/.test(hint), hint);
    await p.evaluate(() => document.getElementById('env-form').requestSubmit());
    await wait(400);
    const env = (await S(p)).envelopes.find((e) => e.name === 'Moto');
    check('projet créé avec startMonth = 2026-11', env && env.startMonth === '2026-11', env);
    check('octobre : reste à vivre inchangé', (await D(p)).free === free0, (await D(p)).free);
    check('novembre : la mise de 100 € est réservée', (await D(p, '2026-11')).projectsMonthly === 20000 + 10000);
    await p.evaluate(() => { window.__dateOffset += 17 * 86400000; });
    const cr = await p.evaluate(() => Object.fromEntries(window.BudgetFold.tick().credits));
    check('clôture d\'octobre : rien versé sur le projet qui démarre en novembre', !cr[env.id] && cr.p1 === 20000, cr);
    await p.evaluate(() => { window.__dateOffset -= 17 * 86400000; });

    await p.evaluate(() => window.BudgetFold.actions.openEnv({ kind: 'project' }));
    await p.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      for (const [id, v] of [['env-name', 'Vélo'], ['env-target', '500'], ['env-monthly', '50']]) { $(id).value = v; $(id).dispatchEvent(new Event('input')); }
      $('env-start-now').click();
      document.getElementById('env-form').requestSubmit();
    });
    await wait(400);
    const velo = (await S(p)).envelopes.find((e) => e.name === 'Vélo');
    check('« Dès ce mois-ci » : mise réservée en octobre', velo && velo.startMonth === '2026-10' && (await D(p)).free === free0 - 5000, velo);
    await p.close();

    const q = await H.open({ storage: clone(demo), today: '2026-10-02' }); // paie le 3 : pas encore passée
    await q.evaluate(() => window.BudgetFold.actions.openEnv({ kind: 'project' }));
    check('avant le jour de paie : pas de choix à faire', await q.evaluate(() => document.getElementById('env-start-field').hidden));
    await q.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
