// Cycle du mois budgétaire, clôture (assistant, reports, déficit, historique figé), déplacements d'argent.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D, flat } = require('./util');

const { check, done } = suite('cycle et clôture');
const DAY = 86400000;
const confirmYes = async (p) => { await p.evaluate(() => document.querySelector('#dlg-confirm [value="confirm"]').click()); await wait(400); };

(async () => {
  const H = await start();

  // 1. Fenêtres du mois budgétaire.
  {
    const s = clone(demo);
    s.v = 4;
    s.prefs.cycle = 'pay';
    s.salaryDay = 25;
    const p = await H.open({ storage: s, key: 'budgetfold-os:v4', today: '2026-10-26' });
    const w = await p.evaluate(() => {
      const B = window.BudgetFold;
      return { cm: B.currentMonth(), s: B.cycleStart('2026-11'), e: B.cycleEnd('2026-11'), k24: B.budgetKey('2026-10-24'), k25: B.budgetKey('2026-10-25') };
    });
    check('paie le 25 : le 26 octobre est dans le budget de novembre', w.cm === '2026-11' && w.k25 === '2026-11' && w.k24 === '2026-10', w);
    check('paie le 25 : novembre va du 25 oct. au 24 nov.', w.s === '2026-10-25' && w.e === '2026-11-24', w);
    const env = await p.evaluate(() => window.BudgetFold.envRow(window.BudgetFold.getState().envelopes.find((e) => e.id === 'e1'), '2026-11').window);
    check('enveloppe au mois : même fenêtre que le mois budgétaire', env.start === '2026-10-25' && env.end === '2026-11-24', env);
    await p.evaluate(() => {
      const B = window.BudgetFold;
      B.actions.addTransaction({ type: 'expense', envId: 'e1', amount: 1000, date: '2026-10-24', note: 'Avant paie' });
      B.actions.addTransaction({ type: 'expense', envId: 'e1', amount: 2000, date: '2026-10-26', note: 'Après paie' });
    });
    const nov = await p.evaluate(() => window.BudgetFold.envRow(window.BudgetFold.getState().envelopes.find((e) => e.id === 'e1'), '2026-11'));
    check('dépense du 26 dans novembre, celle du 24 dans octobre', nov.spent === 2000, nov.spent);
    const label = await p.evaluate(() => { window.BudgetFold.setTab('journal'); return document.getElementById('j-label').textContent; });
    check('journal : période affichée « 25 oct. → 24 nov. »', /Novembre 2026/.test(label) && /25 oct/.test(label) && /24 nov/.test(label), label);
    const edge = await p.evaluate(() => {
      const B = window.BudgetFold;
      B.getState().salaryDay = 31;
      return { s: B.cycleStart('2026-03'), e: B.cycleEnd('2026-03'), s2: B.cycleStart('2026-04') };
    });
    check('paie le 31 : février tronqué au 28, mois contigus', edge.s === '2026-02-28' && edge.e === '2026-03-30' && edge.s2 === '2026-03-31', edge);
    await p.close();

    const q = await H.open({ storage: clone(demo) });
    check('sauvegarde v3 : cycle calendaire conservé (aucun chiffre ne change)', (await S(q)).prefs.cycle === 'calendar');
    await q.evaluate(() => window.BudgetFold.actions.openEnv({ kind: 'spend' }));
    await q.close();
    const e = await H.open({ init: () => localStorage.clear() });
    check('nouvel utilisateur : cycle au jour de paie par défaut', (await S(e)).prefs.cycle === 'pay');
    await e.close();
  }

  // 2. Réglages : passer au cycle de paie.
  {
    const p = await H.open({ storage: clone(demo) });
    await p.evaluate(() => document.getElementById('menu-settings').click());
    const txt = await p.evaluate(() => document.getElementById('set-cycle-pay-text').textContent);
    check('réglages : choix « Jour de paie (le 3) »', txt === 'Jour de paie (le 3)', txt);
    await p.evaluate(() => { document.getElementById('set-cycle-pay').click(); document.getElementById('set-form').requestSubmit(); });
    await wait(400);
    const s = await S(p);
    const w = await p.evaluate(() => [window.BudgetFold.cycleStart('2026-10'), window.BudgetFold.cycleEnd('2026-10')]);
    check('cycle de paie enregistré : octobre = 3 oct. → 2 nov.', s.prefs.cycle === 'pay' && w[0] === '2026-10-03' && w[1] === '2026-11-02', { cycle: s.prefs.cycle, w });
    check('changement de cycle : aucune clôture en attente', (await p.evaluate(() => window.BudgetFold.pendingClosings())).length === 0);
    await p.close();
  }

  // 3. Assistant de clôture : reporter, remettre au budget, épargner ; annuler ; historique figé.
  {
    const p = await H.open({ storage: clone(demo) });
    const safety = (await S(p)).envelopes.find((e) => e.safety);
    check('matelas de sécurité créé par défaut (projet Plan)', safety && safety.mode === 'plan' && safety.name === 'Matelas de sécurité', safety);
    await p.evaluate((ms) => { window.__dateOffset += ms; }, 18 * DAY); // 2 novembre
    await p.evaluate(() => window.BudgetFold.tick());
    check('2 novembre : clôture d\'octobre en attente', JSON.stringify(await p.evaluate(() => window.BudgetFold.pendingClosings())) === '["2026-10"]');
    const insight = await p.evaluate(() => document.getElementById('insights').textContent);
    check('accueil : rappel « Clôture d\'octobre à faire »', /Clôture d'octobre 2026 à faire/.test(insight), insight);
    const oct = await D(p, '2026-10');
    const left = Object.fromEntries(oct.spend.map((r) => [r.id, r.left]));
    await p.evaluate(() => window.BudgetFold.actions.openClosing());
    const ui = await p.evaluate(() => ({ open: document.getElementById('dlg-close').open, rows: [...document.querySelectorAll('#close-list .close-row strong')].map((n) => n.textContent) }));
    check('assistant ouvert : Courses, Transport, puis le reste à vivre (pas les enveloppes à la semaine ni sur 2 mois)', ui.open && ui.rows.length === 3 && /Courses/.test(ui.rows[0]) && /Transport/.test(ui.rows[1]) && /Reste à vivre/.test(ui.rows[2]), ui);
    await p.evaluate((sid) => {
      const set = (line, v) => { const s = document.querySelector(`#close-list select[data-line="${line}"]`); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
      set('e1', 'keep');
      set('e2', 'budget');
      set('__free__', `project:${sid}`);
    }, safety.id);
    const hint = await p.evaluate(() => document.getElementById('close-hint').textContent);
    check('assistant : résumé de ce qui part où', /En novembre 2026/.test(hint) && /épargnés/.test(hint), hint);
    await p.evaluate(() => document.getElementById('close-form').requestSubmit());
    await wait(400);
    const s = await S(p);
    const c = s.closings.find((x) => x.key === '2026-10');
    check('clôture enregistrée avec instantané', c && c.snapshot && c.snapshot.key === '2026-10' && s.lastClosed === '2026-10', c && c.key);
    const nov = await D(p, '2026-11');
    const courses = nov.spend.find((r) => r.id === 'e1');
    check('Courses : le reste d\'octobre reste dans l\'enveloppe', courses.left + courses.spent + courses.planned === 30000 + left.e1, { left: courses.left, carry: left.e1 });
    check('Transport : le reste revient au budget de novembre', nov.carried === left.e2, { carried: nov.carried, e2: left.e2 });
    const saved = s.envelopes.find((e) => e.id === safety.id).saved;
    check('reste à vivre non réparti versé sur le matelas', saved === oct.free && s.transactions.some((t) => t.src === 'close' && t.envId === safety.id), { saved, free: oct.free });
    check('le versement de clôture ne réduit pas le reste à vivre de novembre', nov.deposits === 0, nov.deposits);
    check('préférences mémorisées', s.prefs.closing.free === 'project' && s.prefs.closing.projectId === safety.id, s.prefs.closing);

    const snap = JSON.stringify(c.snapshot);
    await p.evaluate(() => window.BudgetFold.actions.addTransaction({ type: 'expense', envId: 'e1', amount: 999, date: '2026-10-20', note: 'Oubli' }));
    const after = (await S(p)).closings.find((x) => x.key === '2026-10');
    check('historique figé : une saisie après coup ne change pas l\'instantané', JSON.stringify(after.snapshot) === snap);

    await p.evaluate(() => { window.BudgetFold.setTab('report'); document.getElementById('r-mode-history').click(); });
    await wait(200);
    const hist = await p.evaluate(() => document.getElementById('r-history').textContent);
    check('Bilan › Historique : octobre listé avec tendances', /Octobre 2026/.test(hist) && /Tendances par enveloppe/.test(hist) && /Mis de côté/.test(hist), hist.slice(0, 200));
    await p.evaluate(() => document.querySelector('.hist-head[data-key="2026-10"]').click());
    const detail = await p.evaluate(() => document.querySelector('.hist-detail') && document.querySelector('.hist-detail').textContent);
    check('détail du mois : badge « Bien tenu » par enveloppe', /Bien tenu/.test(detail || ''), detail);
    const bad = await p.evaluate(() => /\bnull\b|undefined|NaN/.test(document.body.innerText));
    check('historique : aucun null/undefined/NaN', !bad);

    const r = await p.evaluate(() => window.BudgetFold.actions.reopenMonth('2026-10'));
    const s2 = await S(p);
    check('annuler la clôture : instantané et versement retirés', r.ok && !s2.closings.length && s2.envelopes.find((e) => e.id === safety.id).saved === 0 && s2.lastClosed === '2026-09');
    await p.close();
  }

  // 4. Déficit reporté, clôture automatique.
  {
    const s = clone(demo);
    s.transactions.push({ id: 'big', type: 'expense', envId: null, amount: 100000, date: '2026-10-14', note: 'Réparation' });
    const p = await H.open({ storage: s });
    const free = (await D(p)).free;
    check('octobre dans le rouge', free < 0, free);
    await p.evaluate(() => { window.BudgetFold.getState().prefs.closing.auto = true; });
    await p.evaluate((ms) => { window.__dateOffset += ms; }, 18 * DAY);
    const res = await p.evaluate(() => window.BudgetFold.tick());
    check('clôture automatique au changement de mois', JSON.stringify(res.closed) === '["2026-10"]', res.closed);
    const nov = await D(p, '2026-11');
    const st = await S(p);
    const keep = st.closings[0].lines.filter((l) => l.action === 'keep' && l.left > 0).reduce((a, l) => a + l.left, 0);
    check('déficit d\'octobre retiré du reste à vivre de novembre', nov.carried === free, { carried: nov.carried, free });
    check('par défaut : les restes restent dans les enveloppes', st.closings[0].lines.every((l) => l.action === 'keep') && keep > 0, st.closings[0].lines);
    await p.close();
  }

  // 5. Déplacer de l'argent, couvrir un dépassement, trace au journal.
  {
    const p = await H.open({ storage: clone(demo) });
    const free0 = (await D(p)).free;
    const m1 = await p.evaluate(() => window.BudgetFold.actions.moveMoney({ from: 'e2', to: 'e1', amount: 2000 }));
    let d = await D(p);
    const row = (id) => d.spend.find((r) => r.id === id);
    check('déplacement Transport → Courses : budgets ajustés, reste à vivre inchangé', m1.ok && row('e1').left === 2530 + 2000 && row('e2').left === 5100 - 2000 && d.free === free0, { e1: row('e1').left, e2: row('e2').left, free: d.free });
    await p.evaluate(() => window.BudgetFold.actions.moveMoney({ from: 'free', to: 'e1', amount: 1000 }));
    d = await D(p);
    check('depuis le reste à vivre : il baisse d\'autant', d.free === free0 - 1000, d.free);
    const tooMuch = await p.evaluate(() => window.BudgetFold.actions.moveMoney({ from: 'e2', to: 'e1', amount: 999999 }));
    check('déplacement trop gros refusé', !tooMuch.ok && /Il ne reste que/.test(tooMuch.error), tooMuch);
    const weekly = await p.evaluate(() => window.BudgetFold.actions.moveMoney({ from: 'e3', to: 'e1', amount: 100 }));
    check('enveloppe à la semaine refusée', !weekly.ok, weekly);
    await p.evaluate(() => { window.BudgetFold.setTab('journal'); });
    await p.evaluate(() => { const f = document.getElementById('j-filter'); f.value = 'moves'; f.dispatchEvent(new Event('change')); });
    const rows = await p.evaluate(() => [...document.querySelectorAll('#j-list [data-move]')].map((n) => n.textContent));
    check('journal : 2 déplacements tracés', rows.length === 2 && rows.some((t) => /Transport → Courses/.test(t)), rows);
    await p.evaluate(() => document.querySelector('#j-list [data-move]').click());
    await wait(200);
    await confirmYes(p);
    check('toucher un déplacement puis confirmer : il est annulé', (await S(p)).moves.length === 1);

    await p.evaluate(() => window.BudgetFold.actions.addTransaction({ type: 'expense', envId: 'e2', amount: 6000, date: '2026-10-15', note: 'Taxi' }));
    await p.evaluate(() => window.BudgetFold.setTab('home'));
    const cover = await p.evaluate(() => !!document.querySelector('#insights [data-action="cover:e2"]'));
    check('enveloppe dépassée : conseil « couvrir » proposé', cover);
    await p.evaluate(() => document.querySelector('#insights [data-action="cover:e2"]').click());
    const mv = await p.evaluate(() => ({ open: document.getElementById('dlg-move').open, to: document.getElementById('move-to').value, amount: document.getElementById('move-amount').value }));
    check('couvrir : feuille ouverte vers Transport avec le dépassement prérempli', mv.open && mv.to === 'e2' && mv.amount === '29', mv);
    await p.evaluate(() => document.getElementById('move-form').requestSubmit());
    await wait(400);
    d = await D(p);
    check('dépassement couvert : Transport revient à 0', d.spend.find((r) => r.id === 'e2').left === 0, d.spend.find((r) => r.id === 'e2').left);
    await p.close();
  }

  // 6. Tout remettre à zéro, ordre du mois, badge « Bien tenu ».
  {
    const p = await H.open({ storage: clone(demo) });
    const kept = await p.evaluate(() => [...document.querySelectorAll('#spend-grid .envelope')].filter((c) => !c.querySelector('.badge').hidden).map((c) => c.querySelector('.envelope-name').textContent));
    check('« Bien tenu » sur Transport (29 € sur 80 € à mi-mois), pas sur Courses', kept.includes('Transport') && !kept.includes('Courses'), kept);
    await p.evaluate(() => document.getElementById('menu-reset-all').click());
    await wait(200);
    await confirmYes(p);
    const s = await S(p);
    check('tout remettre à zéro : chaque enveloppe repart aujourd\'hui', s.envelopes.filter((e) => e.kind === 'spend').every((e) => e.reset && e.reset.date === '2026-10-15'));
    const d = await D(p);
    check('après remise à zéro : Courses pleine, journal intact', d.spend.find((r) => r.id === 'e1').left === 30000 && s.transactions.filter((t) => t.envId === 'e1').length === 3);
    await p.evaluate(() => window.BudgetFold.setTab('agenda'));
    const steps = await p.evaluate(() => [...document.querySelectorAll('#order-list .order-step strong')].map((n) => n.textContent));
    check('agenda : ordre du mois paie → épargne → prélèvements → enveloppes → reste', JSON.stringify(steps) === JSON.stringify(['Paie', 'Épargne des projets', 'Prélèvements', 'Enveloppes', 'Reste']), steps);
    const order = await p.evaluate(() => document.getElementById('order-list').textContent);
    check('ordre du mois : paie le 3 oct.', /le 3 oct/.test(order), order);
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
