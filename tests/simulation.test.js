// Projets (phase 3) : types d'objectifs, réserve et retraits, résultats complets, simulateur, fiche, envies, conseils.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D, flat } = require('./util');

const { check, done } = suite('projets et simulations');
const DAY = 86400000;
const act = (p, fn, ...args) => p.evaluate(fn, ...args);

(async () => {
  const H = await start();

  // 1. Migration v3 : valeurs par défaut des nouveaux champs.
  {
    const p = await H.open({ storage: clone(demo) });
    const s = await S(p);
    const p1 = s.envelopes.find((e) => e.id === 'p1');
    const p2 = s.envelopes.find((e) => e.id === 'p2');
    check('v3 → v4 : projet avec mise = « X € par mois »', p1.goalType === 'monthly' && p1.timing === 'pay' && p1.priority === 2 && p1.color === 'amber' && p1.icon === 'target' && p1.category === 'project', p1);
    check('v3 → v4 : plan sans mise avec date = « Pour une date »', p2.goalType === 'date' && Array.isArray(p2.checklist) && p2.notes === '', p2);
    const body = await p.evaluate(() => document.body.innerText);
    check('accueil : jamais « faisable »', !/faisable/i.test(body));
    await p.close();
  }

  // 2. Types d'objectifs : pour une date (mise recalculée), réserve à remplir (retraits).
  {
    const p = await H.open({ storage: clone(demo) });
    const bad = await act(p, () => window.BudgetFold.actions.createEnvelope({ kind: 'project', name: 'Voyage', target: 120000, saved: 0, monthly: 0, deadline: null, mode: 'plan', goalType: 'date' }));
    check('« Pour une date » sans date : refusé', !bad.ok && /date/.test(bad.error), bad);
    const res = await act(p, () => window.BudgetFold.actions.createEnvelope({ kind: 'project', name: 'Voyage', target: 120000, saved: 0, monthly: 0, deadline: '2027-03', mode: 'active', goalType: 'date' }));
    const id = res.data.id;
    const c1 = await act(p, (i) => window.BudgetFold.projectContribution(window.BudgetFold.getState().envelopes.find((e) => e.id === i), '2026-10'), id);
    check('pour mars 2027 (6 mois) : 200 €/mois réservés', res.ok && c1 === 20000, { ok: res.ok, c1 });
    await act(p, (i) => window.BudgetFold.actions.addTransaction({ type: 'deposit', envId: i, amount: 30000, date: '2026-10-15' }), id);
    await act(p, (ms) => { window.__dateOffset += ms; }, 18 * DAY);
    await act(p, () => window.BudgetFold.tick());
    const c2 = await act(p, (i) => window.BudgetFold.projectContribution(window.BudgetFold.getState().envelopes.find((e) => e.id === i), '2026-11'), id);
    const saved = (await S(p)).envelopes.find((e) => e.id === id).saved;
    check('versement de 300 € puis clôture : la mise d\'octobre recalculée (900 € / 6 = 150 €) est versée', saved === 30000 + 15000, saved);
    check('novembre : mise recalculée (750 € sur 5 mois = 150 €)', c2 === 15000, c2);
    await act(p, (ms) => { window.__dateOffset -= ms; }, 18 * DAY);
    await p.close();

    const q = await H.open({ storage: clone(demo) });
    const r = await act(q, () => window.BudgetFold.actions.createEnvelope({ kind: 'project', name: 'Entretien voiture', target: 50000, saved: 50000, monthly: 3000, deadline: null, mode: 'active', goalType: 'fill' }));
    const rid = r.data.id;
    const free0 = (await D(q)).free;
    check('réserve pleine : aucune mise réservée', r.ok && (await act(q, (i) => window.BudgetFold.projectContribution(window.BudgetFold.getState().envelopes.find((e) => e.id === i), '2026-10'), rid)) === 0);
    const w = await act(q, (i) => window.BudgetFold.actions.addTransaction({ type: 'withdraw', envId: i, amount: 12000, date: '2026-10-15', note: 'Vidange' }), rid);
    const d = await D(q);
    check('retrait de 120 € : la réserve baisse, la mise reprend (30 €), le retrait lui-même ne touche pas le reste à vivre', w.ok && (await S(q)).envelopes.find((e) => e.id === rid).saved === 38000 && d.free === free0 - 3000, { free: d.free, free0 });
    const tooMuch = await act(q, (i) => window.BudgetFold.actions.addTransaction({ type: 'withdraw', envId: i, amount: 999999, date: '2026-10-15' }), rid);
    check('retrait plus gros que la réserve : refusé', !tooMuch.ok && /Il n'y a que/.test(tooMuch.error), tooMuch);
    await act(q, () => { window.BudgetFold.setTab('journal'); const f = document.getElementById('j-filter'); f.value = 'deposit'; f.dispatchEvent(new Event('change')); });
    const j = await act(q, () => document.getElementById('j-list').textContent);
    check('journal : retrait affiché « Payé avec « Entretien voiture » »', /Vidange/.test(j) && /Payé avec « Entretien voiture »/.test(j), j.slice(0, 200));
    await act(q, () => document.querySelector('#j-list [data-type="withdraw"]').click());
    check('toucher un retrait ouvre la fiche du projet', await act(q, () => document.getElementById('dlg-project').open && document.getElementById('pj-title').textContent === 'Entretien voiture'));
    const undo = await act(q, (i) => { const B = window.BudgetFold; const t = B.getState().transactions.find((x) => x.type === 'withdraw'); return B.actions.deleteTransaction(t.id).ok && B.getState().envelopes.find((e) => e.id === i).saved; }, rid);
    check('supprimer le retrait : la réserve est rétablie', undo === 50000, undo);
    await q.close();
  }

  // 3. Résultats toujours complets.
  {
    const p = await H.open({ storage: clone(demo) });
    const lines = await act(p, () => {
      const B = window.BudgetFold;
      const e = { id: 'x', kind: 'project', name: 'Moto', target: 300000, saved: 0, monthly: 10000, deadline: '2027-09', mode: 'plan', goalType: 'monthly' };
      return B.projectResults(e).map((l) => l[1]);
    });
    const all = lines.join(' | ');
    check('résultat : mise nécessaire pour la date', /Pour septembre 2027, il faut 250 € par mois \(12 mois\)/.test(flat(all).replace(/(\D)(\d)/g, '$1 $2')) || /Poursept/.test(flat(all)) && /il faut/.test(all), all);
    check('résultat : date atteinte avec la mise choisie + retard', /Avec 100 € par mois, tu l'atteins en/.test(all.replace(/ | /g, ' ')) && /mois de retard/.test(all), all);
    check('résultat : « il te faudrait mettre 150 € de plus par mois »', /Il te faudrait mettre 150/.test(all.replace(/ | /g, ' ')) && /de plus par mois pour tenir ta date/.test(all), all);
    check('résultat : « Compatible avec ta marge actuelle (après charges et enveloppes) »', /Compatible avec ta marge actuelle \(après charges et enveloppes\)/.test(all), all);
    check('résultat : jamais « faisable »', !/faisable/i.test(all));
    await act(p, () => window.BudgetFold.actions.openEnv({ env: window.BudgetFold.getState().envelopes.find((e) => e.id === 'p2') }));
    const box = await act(p, () => document.getElementById('env-plan').textContent);
    check('feuille projet : mêmes résultats complets', /Pour juin 2027/.test(box) && /Avec/.test(box) && /Compatible avec ta marge actuelle/.test(box) && !/faisable/i.test(box), box);
    await p.close();
  }

  // 4. Simulateur (centimes entiers, taux saisis par l'utilisateur).
  {
    const p = await H.open({ storage: clone(demo) });
    const sim = await act(p, () => {
      const B = window.BudgetFold;
      const base = { target: 300000, saved: 0, monthly: 10000, start: '2026-11' };
      const a = B.simulate(base);
      const b = B.simulate({ ...base, yieldBp: 1200 });
      const c = B.simulate({ ...base, inflationBp: 1200 });
      const d = B.simulate({ ...base, raise: 10000, raiseFrom: '2027-02' });
      const ints = [a, b, c, d].every((r) => r.points.every((q) => Number.isInteger(q.bal) && Number.isInteger(q.goal)));
      return { a: [a.months, a.reached], b: b.months, c: c.months, d: d.months, ints, zero: B.simulate({ ...base, monthly: 0 }).reached };
    });
    check('simulation simple : 30 mois, atteint en avril 2029', sim.a[0] === 30 && sim.a[1] === '2029-04', sim);
    check('rendement saisi (12 %/an) : plus rapide', sim.b < 30, sim);
    check('inflation saisie (12 %/an) : plus lent', sim.c > 30, sim);
    check('hausse de 100 €/mois dès février : 17 mois', sim.d === 17, sim);
    check('montants de la simulation toujours en centimes entiers', sim.ints);
    check('sans mise ni rendement : jamais atteint (pas de boucle infinie)', sim.zero === null);

    await act(p, () => window.BudgetFold.actions.openProject('p1'));
    const ui = await act(p, () => ({ cards: document.querySelectorAll('#sim-out .sim-card').length, lines: document.querySelectorAll('#sim-chart .sim-line').length, goal: !!document.querySelector('#sim-chart .sim-goal'), real: document.getElementById('sim-real').value, amb: document.getElementById('sim-ambitious').value }));
    check('fiche : 3 scénarios, 3 courbes et l\'objectif', ui.cards === 3 && ui.lines === 3 && ui.goal, ui);
    check('scénarios par défaut tirés de tes chiffres (réaliste = ta mise, ambitieux = ta marge)', ui.real === '200' && ui.amb === '799,94', ui);
    await act(p, () => { const y = document.getElementById('sim-yield'); y.value = '3'; y.dispatchEvent(new Event('input')); });
    check('rendement saisi : mémorisé en points de base', (await S(p)).envelopes.find((e) => e.id === 'p1').sim.yieldBp === 300);
    await act(p, () => { const y = document.getElementById('sim-yield'); y.value = '3,333'; y.dispatchEvent(new Event('input')); });
    check('pourcentage invalide : message clair', await act(p, () => /pourcentage valide/.test(document.getElementById('sim-error').textContent)));
    await act(p, () => { const y = document.getElementById('sim-yield'); y.value = ''; y.dispatchEvent(new Event('input')); const c = document.getElementById('sim-compare'); c.value = 'p2'; c.dispatchEvent(new Event('change')); });
    const cmp = await act(p, () => ({ card: !!document.querySelector('.sim-card[data-scenario="compare"]'), line: !!document.querySelector('#sim-chart .sim-compare') }));
    check('comparer avec « Voyage Japon » : carte et courbe en plus', cmp.card && cmp.line, cmp);
    check('fiche : aucun null/undefined/NaN', !(await act(p, () => /\bnull\b|undefined|NaN/.test(document.getElementById('dlg-project').innerText))));
    await p.close();
  }

  // 5. Fiche : notes, étapes avec lien, historique des versements.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.addTransaction({ type: 'deposit', envId: 'p1', amount: 5000, date: '2026-10-12', note: 'Prime' }));
    await act(p, () => window.BudgetFold.actions.openProject('p1'));
    await act(p, () => { const n = document.getElementById('pj-notes'); n.value = 'Banque : rdv le 12'; n.dispatchEvent(new Event('input')); n.dispatchEvent(new Event('blur')); });
    await wait(500);
    check('notes enregistrées', (await S(p)).envelopes.find((e) => e.id === 'p1').notes === 'Banque : rdv le 12');
    await act(p, () => { const i = document.getElementById('pj-check-input'); i.value = 'Simulation de prêt https://exemple.fr/pret'; document.getElementById('pj-check-form').requestSubmit(); });
    await wait(400);
    await act(p, () => { const i = document.getElementById('pj-check-input'); i.value = 'Ouvrir un livret'; document.getElementById('pj-check-form').requestSubmit(); });
    await wait(400);
    let list = (await S(p)).envelopes.find((e) => e.id === 'p1').checklist;
    check('étapes ajoutées', list.length === 2 && list[0].text.startsWith('Simulation'), list);
    check('lien cliquable dans une étape', await act(p, () => { const a = document.querySelector('#pj-checklist a'); return !!a && a.getAttribute('href') === 'https://exemple.fr/pret' && a.rel.includes('noopener'); }));
    await act(p, () => document.querySelector('#pj-checklist .check-toggle').click());
    list = (await S(p)).envelopes.find((e) => e.id === 'p1').checklist;
    check('cocher une étape', list[0].done === true && /1\/2 fait/.test(await act(p, () => document.getElementById('pj-checklist').textContent)));
    await act(p, () => document.querySelectorAll('#pj-checklist .check-del')[1].click());
    check('supprimer une étape (avec « Annuler » proposé)', (await S(p)).envelopes.find((e) => e.id === 'p1').checklist.length === 1 && await act(p, () => /Étape supprimée/.test(document.getElementById('toasts').textContent)));
    const hist = await act(p, () => document.getElementById('pj-history').textContent);
    check('historique des versements dans la fiche', /Prime/.test(hist) && /\+50/.test(hist.replace(/\s/g, '')), hist);
    await p.close();
  }

  // 6. Onglet Projets : groupes, tri, conseils, liste d'envies.
  {
    const s = clone(demo);
    s.v = 4;
    s.prefs.cycle = 'calendar';
    s.lastClosed = '2026-09';
    const snap = (key) => ({ key, start: `${key}-01`, end: `${key}-28`, income: 200000, spent: 120000, free: 10000, projects: 20000, charges: 69849,
      envs: [{ id: 'e1', name: 'Courses', period: 'month', budget: 30000, spent: 18000, left: 12000 }, { id: 'e2', name: 'Transport', period: 'month', budget: 8000, spent: 8200, left: -200 }] });
    s.closings = [
      { key: '2026-08', at: 1, lines: [], free: 10000, freeAction: 'budget', snapshot: snap('2026-08') },
      { key: '2026-09', at: 2, lines: [], free: 10000, freeAction: 'budget', snapshot: snap('2026-09') }
    ];
    const p = await H.open({ storage: s, key: 'budgetfold-os:v4' });
    await act(p, () => window.BudgetFold.setTab('projects'));
    const view = await act(p, () => ({
      groups: [...document.querySelectorAll('#p-groups .proj-group h2')].map((n) => n.textContent),
      advice: document.getElementById('p-advice').textContent
    }));
    check('groupes « En cours » puis « Plans et simulations »', view.groups[0] === 'En cours' && view.groups[1] === 'Plans et simulations', view.groups);
    check('conseil : enveloppes sous-utilisées (120 €/mois sur 2 mois)', /sous-utilisées libèrent environ 120/.test(view.advice.replace(/ | /g, ' ')), view.advice);
    check('conseil : « En réduisant « Courses » de 120 €/mois, … plus tôt »', /En réduisant « Courses » de 120/.test(view.advice.replace(/ | /g, ' ')) && /plus tôt/.test(view.advice), view.advice);
    await act(p, () => window.BudgetFold.actions.updateEnvelope('p2', { ...window.BudgetFold.getState().envelopes.find((e) => e.id === 'p2'), priority: 1 }));
    await act(p, () => document.querySelector('#p-sort [data-sort="priority"]').click());
    const prio = await act(p, () => document.querySelector('#p-groups .proj-row[data-id="p2"] .badge[data-tone="bad"]') !== null);
    check('priorité haute signalée, tri par priorité', prio);

    await act(p, () => { document.getElementById('wish-name').value = 'Casque audio'; document.getElementById('wish-price').value = '59'; document.getElementById('wish-form').requestSubmit(); });
    await wait(400);
    const wish = (await S(p)).envelopes.find((e) => e.name === 'Casque audio');
    check('envie ajoutée (Plan, rien réservé)', wish && wish.category === 'wish' && wish.mode === 'plan' && wish.target === 5900, wish);
    check('envie listée à part, pas dans les projets', await act(p, () => /Casque audio/.test(document.getElementById('wish-list').textContent) && !/Casque audio/.test(document.getElementById('p-groups').textContent)));
    await act(p, () => document.querySelector('#wish-list .proj-row').click());
    check('fiche d\'une envie : bouton « C\'est acheté », pas de simulateur', await act(p, () => !document.getElementById('pj-buy').hidden && document.getElementById('pj-sim-section').hidden));
    await act(p, () => document.getElementById('pj-buy').click());
    await wait(300);
    check('« C\'est acheté » : date notée et dépense proposée', (await S(p)).envelopes.find((e) => e.name === 'Casque audio').boughtAt === '2026-10-15' && await act(p, () => document.getElementById('dlg-confirm').open));
    await act(p, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(300);
    const tx = await act(p, () => ({ open: document.getElementById('dlg-tx').open, amount: document.getElementById('tx-amount').value, label: document.getElementById('tx-label').value }));
    check('dépense préremplie (59 €, Casque audio)', tx.open && tx.amount === '59' && tx.label === 'Casque audio', tx);
    await p.close();

    const q = await H.open({ storage: clone(demo), page: '/#projets' });
    check('lien #projets : ouvre l\'onglet Projets', await act(q, () => document.body.dataset.tab === 'projects'));
    await q.close();
  }

  // 7. Formulaire projet : type, versement, priorité, couleur, icône.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openEnv({ kind: 'project' }));
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      for (const [id, v] of [['env-name', 'Moto'], ['env-target', '3000'], ['env-deadline', '2027-09']]) { $(id).value = v; $(id).dispatchEvent(new Event('input')); }
      $('env-goal-date').click();
      $('env-mode-plan').click();
      $('env-more').open = true;
      $('env-timing-end').click();
      $('env-priority-1').click();
      $('env-color-teal').click();
      $('env-icon-bike').click();
    });
    const monthlyDisabled = await act(p, () => document.getElementById('env-monthly').disabled);
    check('« Pour une date » : la mise est calculée (champ désactivé)', monthlyDisabled);
    await act(p, () => document.getElementById('env-form').requestSubmit());
    await wait(400);
    const moto = (await S(p)).envelopes.find((e) => e.name === 'Moto');
    check('projet créé avec type, versement, priorité, couleur, icône', moto && moto.goalType === 'date' && moto.timing === 'end' && moto.priority === 1 && moto.color === 'teal' && moto.icon === 'bike' && moto.monthly === 25000, moto);
    check('carte d\'accueil aux couleurs du projet', await act(p, (i) => { const c = document.querySelector(`#project-grid .envelope[data-id="${i}"]`); return c && c.dataset.color === 'teal'; }, moto.id));
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
