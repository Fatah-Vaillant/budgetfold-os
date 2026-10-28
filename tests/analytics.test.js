// Analyses : score de santé, suggestions (historique), abonnements, série sans dépense, 50/30/20,
// rapports, prévisions découpées par type, heures de dépense.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S } = require('./util');

const { check, done } = suite('analyses');
const act = (p, fn, ...args) => p.evaluate(fn, ...args);
const sp = (s) => String(s).replace(/[  ]/g, ' ');

const snap = (key, courses, transport) => ({
  key, at: 1, lines: [], free: 5000, freeAction: 'budget',
  snapshot: {
    key, start: `${key}-01`, end: `${key}-28`, income: 208000, spent: 150000, free: 5000, projects: 20000, charges: 69849, health: 60,
    envs: [{ id: 'e1', name: 'Courses', period: 'month', budget: 30000, spent: courses, left: 30000 - courses }, { id: 'e2', name: 'Transport', period: 'month', budget: 8000, spent: transport, left: 8000 - transport }]
  }
});

(async () => {
  const H = await start();

  // 1. Score de santé : six facteurs expliqués.
  {
    const p = await H.open({ storage: clone(demo) });
    const hs = await act(p, () => window.BudgetFold.healthScore());
    const f = Object.fromEntries(hs.factors.map((x) => [x.id, x.points]));
    check('score = somme des 6 facteurs, sur 100', hs.factors.length === 6 && hs.score === hs.factors.reduce((s, x) => s + x.points, 0) && hs.factors.reduce((s, x) => s + x.max, 0) === 100, hs);
    check('marge de 29 % → 25/25 ; enveloppes tenues → 20/20', f.free === 25 && f.envelopes === 20, f);
    check('épargne 9,6 % des revenus → 10/20 ; matelas vide → 0/15', f.savings === 10 && f.cushion === 0, f);
    check('décembre dans le rouge → 6/10 ; dépenses rangées et sauvegarde récente → 10/10', f.forecast === 6 && f.hygiene === 10, f);
    check('score 71 « Solide »', hs.score === 71 && hs.label === 'Solide', hs.score);
    await act(p, () => window.BudgetFold.setTab('report'));
    const card = await act(p, () => ({ score: document.querySelector('.health-score strong').textContent, n: document.querySelectorAll('.health-factors li').length, txt: document.getElementById('r-health').textContent }));
    check('Bilan : carte « Santé du budget » avec le score et les 6 facteurs', card.score === '71' && card.n === 6 && /Santé du budget : solide/.test(card.txt), card);
    check('conseil par facteur (matelas : objectif 3 mois)', /couvre 0,0 mois de dépenses ; l'objectif courant est 3 mois/.test(card.txt));
    await p.close();
  }

  // 2. Suggestions : budgets ajustés après 3 mois clôturés, abonnements, série, 50/30/20.
  {
    const s = clone(demo);
    s.v = 4;
    s.prefs.cycle = 'calendar';
    s.prefs.since = '2026-06-01';
    s.lastClosed = '2026-09';
    s.closings = [snap('2026-07', 18000, 9000), snap('2026-08', 19000, 9500), snap('2026-09', 17000, 8500)];
    s.recurring.push({ id: 'spot', type: 'expense', label: 'Spotify', amount: 1099, freq: 'month', start: '2026-01-05' });
    const p = await H.open({ storage: s, key: 'budgetfold-os:v4' });
    const sug = await act(p, () => window.BudgetFold.envelopeSuggestions().map((x) => [x.env.id, x.kind, x.to]));
    check('Courses sous-utilisée 3 mois → 190 €', sug.some((x) => x[0] === 'e1' && x[1] === 'under' && x[2] === 19000), sug);
    check('Transport dépassée 3 mois → 90 €', sug.some((x) => x[0] === 'e2' && x[1] === 'over' && x[2] === 9000), sug);
    await act(p, () => window.BudgetFold.setTab('report'));
    const txt = sp(await act(p, () => document.getElementById('r-suggest').textContent));
    check('suggestions affichées avec leur bouton', /« Courses » reste sous-utilisée 3 mois de suite/.test(txt) && /Passer à 190 €/.test(txt) && /« Transport » est dépassée 3 mois de suite/.test(txt), txt.slice(0, 200));
    check('coût annuel des abonnements (Spotify, Netflix)', /Tes abonnements coûtent 294 € par an/.test(txt) && /Spotify 132 €/.test(txt), txt);
    check('abonnement de plus de 6 mois : « tu t\'en sers toujours ? »', /« Spotify » depuis plus de 6 mois/.test(txt), txt);
    check('série sans dépense et record sur 60 jours', /1 jour sans dépense d'affilée/.test(txt) && /record sur 60 jours : \d+/.test(txt), txt);
    const split = await act(p, () => window.BudgetFold.splitNeeds(window.BudgetFold.derive()));
    check('repère 50/30/20 : besoins, envies, épargne (indicatif)', new RegExp(`Besoins ${split.pNeeds} % · envies ${split.pWants} % · épargne et marge ${split.pSavings} %`).test(txt) && /Repère indicatif : 50\/30\/20/.test(txt) && Math.abs(split.pNeeds + split.pWants + split.pSavings - 100) <= 2, split);
    await act(p, () => document.querySelector('#r-suggest [data-run^="budget:e1"]').click());
    await wait(300);
    check('« Passer à 190 € » : budget de Courses modifié (avec « Annuler »)', (await S(p)).envelopes.find((e) => e.id === 'e1').max === 19000);
    await act(p, () => document.querySelector('.toast:last-child .toast-action').click());
    await wait(200);
    check('« Annuler » remet 300 €', (await S(p)).envelopes.find((e) => e.id === 'e1').max === 30000);
    await act(p, () => document.querySelector('#r-suggest [data-run="stop:spot"]').click());
    await wait(200);
    await act(p, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(300);
    check('« Arrêter » l\'abonnement : retiré de l\'échéancier', !(await S(p)).recurring.some((r) => r.id === 'spot'));
    const trend = await act(p, () => document.querySelectorAll('.health-trend .ht-col').length);
    check('évolution du score sur les mois (juin → octobre)', trend === 5, trend);
    await p.close();

    const q = await H.open({ storage: { ...clone(s), closings: s.closings.slice(0, 2), lastClosed: '2026-08' }, key: 'budgetfold-os:v4' });
    await act(q, () => window.BudgetFold.setTab('report'));
    check('moins de 3 mois clôturés : on explique quand viendront les suggestions', /Encore 1 mois clôturé et/.test(await act(q, () => document.getElementById('r-suggest').textContent)));
    await q.close();
  }

  // 3. Rapports.
  {
    const s = clone(demo);
    s.prefs.since = '2026-08-01';
    s.transactions.push({ id: 'aug', type: 'expense', envId: 'e1', amount: 25000, date: '2026-08-12', note: 'Courses août', ts: 1 });
    const p = await H.open({ storage: s });
    const rep = await act(p, () => window.BudgetFold.monthlyReport(6).map((m) => [m.key, m.spent, m.cumul]));
    check('rapport mensuel : août → octobre', rep.length === 3 && rep[0][0] === '2026-08' && rep[0][1] === 25000, rep);
    check('épargne cumulée croissante', rep[2][2] >= rep[1][2] && rep[1][2] >= rep[0][2], rep);
    await act(p, () => window.BudgetFold.setTab('report'));
    const table = await act(p, () => [...document.querySelectorAll('#r-reports .rep-tr')].map((r) => r.textContent));
    check('rapport « Par enveloppe » : une ligne par enveloppe, une colonne par mois', table.length === 5 && /Courses/.test(table[1]) && /250 €/.test(sp(table[1])), table);
    const view = async (k) => { await act(p, (x) => document.querySelector(`#r-reports [data-report="${x}"]`).click(), k); return act(p, () => ({ cols: document.querySelectorAll('#r-reports .rep-col').length, txt: document.getElementById('r-reports').textContent })); };
    let v = await view('flow');
    check('rapport « Revenus et dépenses » : 3 mois', v.cols === 3 && /Revenus/.test(v.txt), v.cols);
    v = await view('savings');
    check('rapport « Épargne cumulée »', v.cols === 3 && /Mis de côté depuis août 2026/.test(v.txt), v.txt.slice(0, 120));
    v = await view('worth');
    check('rapport « Patrimoine » : comptes et part mise de côté pour les projets', /Patrimoine \(soldes de tes comptes\)/.test(v.txt) && /Dont mis de côté pour tes projets/.test(v.txt) && /Compte courant/.test(v.txt), v.txt.slice(0, 160));
    check('rapports : aucun null/undefined/NaN', !(await act(p, () => /\bnull\b|undefined|NaN/.test(document.body.innerText))));
    await p.close();
  }

  // 4. Prévisions sur 6 mois découpées par type, détail au toucher.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.setTab('agenda'));
    const leg = await act(p, () => [...document.querySelectorAll('#forecast-legend li')].map((l) => l.textContent));
    check('légende : prélèvements, enveloppes, projets, dépenses prévues, marge, manque', JSON.stringify(leg) === JSON.stringify(['Prélèvements', 'Enveloppes', 'Projets', 'Dépenses prévues', 'Marge', 'Manque']), leg);
    check('chaque mois : 4 segments + marge ou manque', await act(p, () => [...document.querySelectorAll('.fc-row')].every((r) => r.querySelectorAll('.fc-seg').length === 4 && r.querySelectorAll('.fc-free, .fc-over').length === 1)));
    await act(p, () => document.querySelector('.fc-row[data-key="2026-12"]').click());
    const det = sp(await act(p, () => document.querySelector('.fc-item[data-open="true"] .fc-detail').textContent));
    check('détail de décembre : revenus, chaque type, manque, dépenses prévues', /Revenus/.test(det) && /Prélèvements/.test(det) && /Manque/.test(det) && /Cadeaux de Noël/.test(det), det);
    check('le calendrier suit le mois touché', await act(p, () => document.getElementById('cal-label').textContent === 'Décembre 2026'));
    await p.close();
  }

  // 5. Heures de dépense.
  {
    const s = clone(demo);
    const at = (h) => new Date(2026, 9, 14, h, 15).getTime();
    s.transactions.push({ id: 'h1', type: 'expense', envId: 'e3', amount: 1200, date: '2026-10-14', note: 'Bar', ts: at(21) }, { id: 'h2', type: 'expense', envId: 'e1', amount: 800, date: '2026-10-14', note: 'Pain', ts: at(8) });
    const p = await H.open({ storage: s });
    const slots = await act(p, () => window.BudgetFold.spendingHours().map((x) => [x.label, x.total]));
    check('heures : soir 12 €, matin 8 €', slots.find((x) => x[0] === 'Soir')[1] === 1200 && slots.find((x) => x[0] === 'Matin')[1] === 800, slots);
    await act(p, () => window.BudgetFold.setTab('report'));
    check('Bilan : « Tes heures de dépense »', await act(p, () => /Tes heures de dépense/.test(document.getElementById('r-days').textContent)));
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
