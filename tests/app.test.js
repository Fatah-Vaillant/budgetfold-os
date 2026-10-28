const { start } = require('./harness');
const demo = require('./demo');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let failCount = 0;
const check = (name, cond, info = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); } else { failCount++; console.log(`FAIL ${name} -> ${info}`); }
};
const clone = (o) => JSON.parse(JSON.stringify(o));

async function fillAdd(p, { mode = 'expense', amount, label = '', env, date, repeat = 'once', until = '' }) {
  await p.evaluate((o) => {
    const $ = (id) => document.getElementById(id);
    window.BudgetFold.actions.openAdd({ mode: o.mode });
    $('tx-amount').value = o.amount;
    $('tx-amount').dispatchEvent(new Event('input'));
    $('tx-label').value = o.label;
    $('tx-label').dispatchEvent(new Event('input'));
    if (o.date) { $('tx-date').value = o.date; $('tx-date').dispatchEvent(new Event('input')); }
    $('tx-repeat').value = o.repeat;
    $('tx-repeat').dispatchEvent(new Event('change'));
    if (o.until) { $('tx-until').value = o.until; $('tx-until').dispatchEvent(new Event('input')); }
    if (o.env !== undefined) {
      const chip = document.querySelector(o.mode === 'deposit' ? `#tx-chips [data-project="${o.env}"]` : `#tx-chips [data-env="${o.env}"]`);
      chip.click();
    }
  }, { mode, amount, label, env, date, repeat, until });
}
const submitTx = async (p) => { await p.evaluate(() => document.getElementById('tx-form').requestSubmit()); await wait(400); };
const txErr = (p) => p.evaluate(() => { const e = document.getElementById('tx-error'); return e.hidden ? '' : e.textContent; });
const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.BudgetFold.getState())));
const D = (p, key) => p.evaluate((k) => { const d = window.BudgetFold.derive(k); return { ...d, spend: d.spend.map((r) => ({ name: r.env.name, id: r.env.id, spent: r.spent, planned: r.planned, left: r.left, alloc: r.alloc, eq: r.eq, window: r.window })) }; }, key);

(async () => {
  const H = await start();

  // 1. Onboarding
  {
    const p = await H.open({});
    check('welcome opens on empty state', await p.evaluate(() => document.getElementById('dlg-welcome').open));
    await p.evaluate(() => { document.getElementById('w-income').value = '2000'; document.getElementById('w-next').click(); });
    await wait(200);
    await p.evaluate(() => document.querySelector('[data-tpl="young"]').click());
    await wait(300);
    const s = await S(p);
    check('template: 4 recurring rules monthly', s.recurring.length === 4 && s.recurring.every((r) => r.freq === 'month' && r.type === 'expense'));
    const loyer = s.transactions.find((t) => t.note === 'Loyer');
    check('template: loyer of 1st already posted (today 15)', loyer && loyer.date === '2026-10-01' && loyer.recId, JSON.stringify(loyer));
    const d = await D(p);
    check('template: free = income - allocated', d.free === d.income - d.allocated && d.free > 0, `${d.free}`);
    check('template: welcome closed', !(await p.evaluate(() => document.getElementById('dlg-welcome').open)));
    await p.close();
  }

  // 2. Demo derive
  const p = await H.open({ storage: clone(demo) });
  {
    const d = await D(p);
    check('demo income 2080', d.income === 208000, d.income);
    check('demo charges 698,49 (loyer+élec+netflix pending)', d.charges === 69849, d.charges);
    check('demo free 599,94', d.free === 59994, d.free);
    const sorties = d.spend.find((r) => r.id === 'e3');
    check('weekly window Mon 12 → Sun 18', sorties.window.start === '2026-10-12' && sorties.window.end === '2026-10-18', JSON.stringify(sorties.window));
    check('weekly: café posted 4 days + cinéma', sorties.spent === 2390 && sorties.planned === 600, JSON.stringify(sorties));
    check('weekly monthly eq ≈ 151,67', sorties.eq === 15167, sorties.eq);
    const coif = d.spend.find((r) => r.id === 'e4');
    check('2-month envelope: 15 €/mois, window oct–nov', coif.eq === 1500 && coif.window.end === '2026-11-30', JSON.stringify(coif));
    const s = await S(p);
    check('daily café posted 12→15 (4)', s.transactions.filter((t) => t.recId === 'r6').length === 4);
    check('postedUntil ≥ today', s.recurring.every((r) => r.postedUntil >= '2026-10-15'));
    check('netflix (22) not yet posted', !s.transactions.some((t) => t.recId === 'r3'));
    const nov = await D(p, '2026-11');
    check('Nov: billet 85 > transport 80 → alloc 85', nov.spend.find((r) => r.id === 'e2').alloc === 8500);
    const dec = await D(p, '2026-12');
    check('Dec: annual insurance + christmas → negative margin', dec.free < 0 && dec.charges >= 48000, `${dec.free} ${dec.charges}`);
    const fc = await p.evaluate(() => window.BudgetFold.forecast(6).map((f) => [f.key, f.d.free, f.planned.map((x) => x.label)]));
    check('forecast 6 months from Oct', fc.length === 6 && fc[0][0] === '2026-10' && fc[5][0] === '2027-03');
    check('forecast Dec lists Noël + assurance', fc[2][2].includes('Cadeaux de Noël') && fc[2][2].includes('Assurance auto'), JSON.stringify(fc[2]));
    const ins = await p.evaluate(() => window.BudgetFold.computeInsights(window.BudgetFold.derive()).map((i) => i.title));
    check('insight: Décembre serré', ins.some((t) => /Décembre/.test(t)), JSON.stringify(ins));
    check('no daily café spam in insights', !ins.some((t) => /paiements dans les 3 jours/.test(t)), JSON.stringify(ins));
    const up = await p.evaluate(() => window.BudgetFold.upcomingEvents(30).map((e) => e.label));
    check('upcoming: café only once', up.filter((l) => l === 'Café').length === 1, JSON.stringify(up));
  }

  // 3. Unified add: once / future / recurring / income / deposit
  {
    await fillAdd(p, { amount: '12,50', label: 'Boulangerie', env: 'e1' });
    await submitTx(p);
    let s = await S(p);
    const b = s.transactions.find((t) => t.note === 'Boulangerie');
    check('add once in Courses', b && b.envId === 'e1' && b.amount === 1250 && b.date === '2026-10-15');

    await fillAdd(p, { amount: '60', label: 'Anniversaire Léa', date: '2026-11-08', env: '' });
    check('future date → title Dépense prévue', (await p.evaluate(() => document.getElementById('tx-title').textContent)) === 'Dépense prévue');
    check('future date → button Prévoir', (await p.evaluate(() => document.getElementById('tx-submit').textContent)) === 'Prévoir');
    await submitTx(p);
    s = await S(p);
    check('planned expense stored', s.transactions.some((t) => t.note === 'Anniversaire Léa' && t.date === '2026-11-08'));
    const nov = await D(p, '2026-11');
    check('planned counted in Nov orphan', nov.orphan === 6000, nov.orphan);
    const octFreeBefore = (await D(p)).free;

    await fillAdd(p, { amount: '9,99', label: 'Spotify', repeat: 'month', date: '2026-10-20' });
    check('repeat → chips default to Aucune (charge fixe)', await p.evaluate(() => document.querySelector('#tx-chips [data-env=""]').getAttribute('aria-checked') === 'true'));
    check('repeat → until field visible', await p.evaluate(() => !document.getElementById('tx-until-field').hidden));
    await submitTx(p);
    s = await S(p);
    const sp = s.recurring.find((r) => r.label === 'Spotify');
    check('rule Spotify created monthly from 20', sp && sp.freq === 'month' && sp.start === '2026-10-20' && !sp.envId);
    check('Spotify not posted yet (future)', !s.transactions.some((t) => t.recId === (sp && sp.id)));
    check('Spotify reserved this month (free −9,99)', (await D(p)).free === octFreeBefore - 999);

    await fillAdd(p, { amount: '3', label: 'Bus', repeat: 'week', date: '2026-10-01', env: 'e2', until: '2026-12-31' });
    await submitTx(p);
    s = await S(p);
    const bus = s.recurring.find((r) => r.label === 'Bus');
    const busTx = s.transactions.filter((t) => t.recId === (bus && bus.id)).map((t) => t.date);
    check('weekly bus backfilled 1, 8, 15 Oct', JSON.stringify(busTx) === JSON.stringify(['2026-10-01', '2026-10-08', '2026-10-15']), JSON.stringify(busTx));
    check('bus counted in Transport', busTx.length && s.transactions.filter((t) => t.recId === bus.id).every((t) => t.envId === 'e2'));
    const occ = await p.evaluate((id) => { const B = window.BudgetFold; const r = B.getState().recurring.find((x) => x.id === id); return B.occurrences(r, '2026-12-20', '2027-02-01'); }, bus.id);
    check('weekly rule stops at end date', JSON.stringify(occ) === JSON.stringify(['2026-12-24', '2026-12-31']), JSON.stringify(occ));

    await fillAdd(p, { mode: 'income', amount: '120', label: 'Baby-sitting', repeat: '2weeks', date: '2026-10-17' });
    await submitTx(p);
    const inc = await D(p);
    check('biweekly income 17 & 31 Oct counted', inc.income === 208000 + 24000, inc.income);

    await fillAdd(p, { mode: 'deposit', amount: '100', env: 'p1' });
    await submitTx(p);
    s = await S(p);
    check('deposit raises saved', s.envelopes.find((e) => e.id === 'p1').saved === 260000);
    check('deposit counted in allocated', (await D(p)).deposits === 10000);

    await fillAdd(p, { amount: '', label: 'x' });
    await submitTx(p);
    check('empty amount → error', /montant/.test(await txErr(p)));
    await p.evaluate(() => document.getElementById('dlg-tx').close());
  }

  // 4. Day passes: auto posting
  {
    const before = (await S(p)).transactions.filter((t) => t.recId === 'r6').length;
    await p.evaluate(() => { window.__dateOffset += 3 * 86400000; });
    const r = await p.evaluate(() => window.BudgetFold.tick().posted.map((t) => `${t.note}@${t.date}`));
    const after = (await S(p)).transactions.filter((t) => t.recId === 'r6').length;
    check('3 days later: café posted 3 more times', after === before + 3, `${before}→${after}`);
    check('tick reports postings', r.length >= 3, JSON.stringify(r));
    check('Bus not posted again before 22', !r.some((x) => x.startsWith('Bus')));
    await p.evaluate(() => { window.__dateOffset -= 3 * 86400000; });
  }
  await p.close();

  // 5. Envelopes: create, period, validation, reset, plan project
  {
    const q = await H.open({ storage: clone(demo) });
    const res = await q.evaluate(() => window.BudgetFold.actions.createEnvelope({ kind: 'spend', name: 'Vêtements', max: 15000, period: 'quarter' }));
    check('create quarterly envelope', res.ok, JSON.stringify(res));
    let d = await D(q);
    check('quarterly reserves 50 €/mois', d.spend.find((r) => r.name === 'Vêtements').alloc === 5000);
    const dup = await q.evaluate(() => window.BudgetFold.actions.createEnvelope({ kind: 'spend', name: 'vetements', max: 100, period: 'month' }));
    check('duplicate name refused', !dup.ok);
    const big = await q.evaluate(() => window.BudgetFold.actions.createEnvelope({ kind: 'spend', name: 'Énorme', max: 999999, period: 'month' }));
    check('over-allocation refused', !big.ok && /reste|réparti/.test(big.error), JSON.stringify(big));

    const freeBefore = (await D(q)).free;
    const rs = await q.evaluate(() => window.BudgetFold.actions.resetEnvelope('e1'));
    d = await D(q);
    const c = d.spend.find((r) => r.id === 'e1');
    check('reset: Courses back to full 300', c.left === 30000 && c.spent === 0, JSON.stringify(c));
    check('reset: old spending moved to reste à vivre', d.free === freeBefore - 27470, `${freeBefore} → ${d.free}`);
    check('reset: journal keeps transactions', (await S(q)).transactions.filter((t) => t.envId === 'e1').length === 3 && rs.ok);
    await q.evaluate(() => window.BudgetFold.actions.addTransaction({ type: 'expense', envId: 'e1', amount: 1000, note: 'Après reset', date: '2026-10-15' }));
    d = await D(q);
    check('reset: new spending counts again', d.spend.find((r) => r.id === 'e1').spent === 1000);

    const act = await q.evaluate(() => window.BudgetFold.actions.createEnvelope({ kind: 'project', name: 'Voiture', target: 1500000, saved: 0, monthly: 200000, mode: 'active', deadline: null }));
    check('active project too big refused with plan hint', !act.ok && /Plan/.test(act.error), JSON.stringify(act));
    const plan = await q.evaluate(() => window.BudgetFold.actions.createEnvelope({ kind: 'project', name: 'Voiture', target: 1500000, saved: 0, monthly: 200000, mode: 'plan', deadline: '2027-06' }));
    check('same project accepted as plan', plan.ok, JSON.stringify(plan));
    const f2 = (await D(q)).free;
    check('plan reserves nothing', f2 === d.free, `${d.free} vs ${f2}`);
    const pp = await q.evaluate(() => { const B = window.BudgetFold; const e = B.getState().envelopes.find((x) => x.name === 'Voiture'); return B.projectPlan(e); });
    check('plan: gap computed', pp.gap > 0 && pp.needed === Math.ceil(1500000 / 9 / 100) * 100, JSON.stringify(pp));

    await q.evaluate(() => { const B = window.BudgetFold; B.actions.openEnv({ env: B.getState().envelopes.find((x) => x.name === 'Voiture') }); });
    const box = await q.evaluate(() => document.getElementById('env-plan').textContent);
    check('plan box explains the gap', /Il manque/.test(box) && /juin 2027/.test(box), box);
    await q.evaluate(() => document.getElementById('dlg-env').close());

    await q.evaluate(() => { window.BudgetFold.getState().lastRollover = '2026-09'; });
    const cr = await q.evaluate(() => [...window.BudgetFold.runRollover()]);
    check('rollover credits active, not plan', cr.length === 1 && cr[0][0] === 'p1', JSON.stringify(cr));
    await q.close();
  }

  // 5b. Bug 1.1 : la marge affichée pendant la saisie d'un projet Actif
  {
    const q = await H.open({ storage: clone(demo) });
    const free = (await D(q)).free;
    check('bug 1.1: demo free 599,94', free === 59994, free);
    const sheet = (o) => q.evaluate((o) => {
      const B = window.BudgetFold;
      const $ = (id) => document.getElementById(id);
      B.actions.openEnv(o.edit ? { env: B.getState().envelopes.find((x) => x.id === o.edit) } : { kind: 'project' });
      for (const [id, v] of Object.entries(o.fields)) { $(id).value = v; $(id).dispatchEvent(new Event('input')); }
      const text = $('env-plan').textContent.replace(/[\s  ]/g, '');
      $('dlg-env').close();
      return text;
    }, o);

    let box = await sheet({ fields: { 'env-name': 'Moto', 'env-target': '5000', 'env-monthly': '300' } });
    check('bug 1.1: new active project, margin = real margin', /Tamargeactuelle:599,94€/.test(box), box);
    check('bug 1.1: new active project, 299,94 left after 300 €', /resterait299,94€/.test(box), box);

    box = await sheet({ fields: { 'env-name': 'Moto', 'env-target': '3000', 'env-deadline': '2026-12' } });
    check('bug 1.1: auto mise 1000, margin = real margin', /Tamargeactuelle:599,94€/.test(box), box);
    check('bug 1.1: auto mise 1000 reported as too big', /Ilmanque400,06€/.test(box), box);

    box = await sheet({ edit: 'p1', fields: { 'env-monthly': '300' } });
    check('bug 1.1: editing active project frees its current mise only', /Tamargeactuelle:799,94€/.test(box) && /resterait499,94€/.test(box), box);
    await q.close();
  }

  // 6. Rules edit / delete
  {
    const q = await H.open({ storage: clone(demo) });
    await q.evaluate(() => window.BudgetFold.actions.openRule(window.BudgetFold.getState().recurring.find((r) => r.id === 'r1')));
    check('rule sheet: once option disabled', await q.evaluate(() => document.querySelector('#tx-repeat option[value="once"]').disabled));
    check('rule sheet: date label À partir du', (await q.evaluate(() => document.getElementById('tx-date-label').textContent)) === 'À partir du');
    await q.evaluate(() => { const a = document.getElementById('tx-amount'); a.value = '650'; a.dispatchEvent(new Event('input')); });
    await submitTx(q);
    let s = await S(q);
    check('rule updated to 650', s.recurring.find((r) => r.id === 'r1').amount === 65000);
    check('past loyer tx unchanged', s.transactions.find((t) => t.recId === 'r1').amount === 62000);
    const nov = await D(q, '2026-11');
    check('Nov loyer uses new amount', nov.charges >= 65000);
    const del = await q.evaluate(() => window.BudgetFold.actions.deleteRule('r6'));
    s = await S(q);
    check('delete rule keeps past occurrences', del.ok && s.transactions.filter((t) => t.recId === 'r6').length === 4);
    await q.evaluate(() => window.BudgetFold.actions.openTx(window.BudgetFold.getState().transactions.find((t) => t.recId === 'r1')));
    check('auto tx shows series note', await q.evaluate(() => !document.getElementById('tx-series').hidden && /automatiquement/.test(document.getElementById('tx-series-text').textContent)));
    await q.evaluate(() => document.getElementById('dlg-tx').close());
    await q.close();
  }

  // 7. Agenda UI: null bug, dots, month nav, add on day
  {
    const q = await H.open({ storage: clone(demo) });
    await q.evaluate(() => window.BudgetFold.setTab('agenda'));
    await wait(200);
    const detail = await q.evaluate(() => document.getElementById('day-detail').textContent);
    check('day detail has no "null"', !/null|undefined/.test(detail), detail);
    const spentDots = await q.evaluate(() => document.querySelectorAll('#calendar .dot-spent').length);
    check('calendar shows spending dots', spentDots >= 5, spentDots);
    check('calendar shows planned dots (future café)', await q.evaluate(() => document.querySelectorAll('#calendar .dot-planned').length >= 10));
    check('calendar day 9 shows −99', await q.evaluate(() => document.querySelector('[data-date="2026-10-09"] .cal-spent').textContent === '−99'));
    await q.evaluate(() => document.getElementById('a-next').click());
    await q.evaluate(() => document.getElementById('a-next').click());
    check('nav to December', (await q.evaluate(() => document.getElementById('cal-label').textContent)) === 'Décembre 2026');
    await q.evaluate(() => document.querySelector('[data-date="2026-12-10"]').click());
    const dd = await q.evaluate(() => document.getElementById('day-detail').textContent);
    check('Dec 10 lists Cadeaux de Noël', /Cadeaux de Noël/.test(dd), dd);
    await q.evaluate(() => document.querySelector('.add-on-day').click());
    check('add on day pre-fills date', (await q.evaluate(() => document.getElementById('tx-date').value)) === '2026-12-10');
    check('add on day title is prévue', (await q.evaluate(() => document.getElementById('tx-title').textContent)) === 'Dépense prévue');
    await q.evaluate(() => document.getElementById('dlg-tx').close());
    check('forecast has 6 rows, Dec negative', await q.evaluate(() => document.querySelectorAll('.fc-row').length === 6 && document.querySelector('.fc-row[data-key="2026-12"]').dataset.negative === 'true'));
    await q.evaluate(() => document.querySelector('.fc-row[data-key="2027-01"]').click());
    check('forecast row navigates calendar', (await q.evaluate(() => document.getElementById('cal-label').textContent)) === 'Janvier 2027');
    check('échéancier lists 6 rules', await q.evaluate(() => document.querySelectorAll('#rec-list .rec-row').length === 6));
    await q.evaluate(() => window.BudgetFold.setTab('journal'));
    await q.evaluate(() => document.getElementById('j-next').click());
    check('journal Nov shows planned billet', await q.evaluate(() => /Billet de train/.test(document.getElementById('j-list').textContent) && !!document.querySelector('.tag-planned')));
    await q.evaluate(() => window.BudgetFold.setTab('report'));
    check('report day stats rendered', await q.evaluate(() => document.querySelectorAll('.wd').length === 7 && /jours avec dépenses/.test(document.getElementById('r-days').textContent)));
    const all = await q.evaluate(() => document.body.innerText);
    check('no "null"/"undefined"/"NaN" in report', !/\bnull\b|undefined|NaN/.test(all));
    await q.close();
  }

  // 8. Mobile tab switching
  {
    const q = await H.open({ storage: clone(demo), width: 390, height: 844, mobile: true });
    const vis = (sel) => q.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }, sel);
    check('mobile home: engine visible, mini hidden', (await vis('.engine')) && !(await vis('#mini')));
    await q.evaluate(() => document.querySelector('[data-tab="journal"]').click());
    await wait(300);
    check('mobile journal: engine hidden', !(await vis('.engine')));
    check('mobile journal: mini summary visible', await vis('#mini'));
    check('mobile journal: view title visible', await vis('[data-view="journal"] .view-head'));
    check('mobile: scrolled to top', (await q.evaluate(() => window.scrollY)) === 0);
    check('mobile: desktop add hidden, nav + visible', !(await vis('#top-add')) && (await vis('#nav-add')));
    await q.evaluate(() => document.getElementById('mini').click());
    await wait(200);
    check('mini click → home', await q.evaluate(() => document.body.dataset.tab === 'home'));
    await q.evaluate(() => document.getElementById('nav-add').click());
    check('nav + opens sheet', await q.evaluate(() => document.getElementById('dlg-tx').open));
    const overflow = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal overflow on mobile', overflow <= 0, overflow);
    await q.close();
  }

  // 9. Migration v2 → v3
  {
    const v2 = {
      v: 2, salary: 185000, salaryDay: 3, openingBalance: null, lastRollover: '2026-10', prefs: { onboarded: true },
      envelopes: [{ id: 'e1', kind: 'spend', name: 'Courses', max: 30000 }, { id: 'p1', kind: 'project', name: 'Voyage', target: 100000, saved: 20000, monthly: 10000 }],
      recurring: [{ id: 'r1', type: 'charge', label: 'Loyer', amount: 60000, day: 1, cat: 'logement' }, { id: 'r2', type: 'income', label: 'APL', amount: 15000, day: 25, cat: 'revenu' }],
      transactions: [{ id: 't1', type: 'expense', envId: 'e1', amount: 5000, date: '2026-10-03', note: 'Carrefour' }]
    };
    const q = await H.open({ storage: v2, key: 'budgetfold-os:v2' });
    const s = await S(q);
    check('v2 migrated: rules monthly', s.recurring.length === 2 && s.recurring.every((r) => r.freq === 'month'));
    check('v2 migrated: loyer of Oct 1 posted once', s.transactions.filter((t) => t.recId === 'r1').length === 1);
    check('v2 migrated: APL (25) pending', !s.transactions.some((t) => t.recId === 'r2'));
    check('v2 migrated: project active', s.envelopes.find((e) => e.id === 'p1').mode === 'active');
    const d = await D(q);
    check('v2 migrated: same reste à vivre as v2 logic', d.free === 185000 + 15000 - 60000 - 30000 - 10000, d.free);
    check('v3 key written', await q.evaluate(() => !!localStorage.getItem('budgetfold-os:v3')));
    await q.close();
  }

  // 10. JSON roundtrip + CSV
  {
    const q = await H.open({ storage: clone(demo) });
    const ok = await q.evaluate(() => {
      const B = window.BudgetFold;
      const before = B.derive().free;
      const raw = JSON.parse(JSON.stringify(B.getState()));
      B.setState(raw);
      return B.derive().free === before;
    });
    check('state roundtrip keeps free', ok);
    const csv = await q.evaluate(() => window.BudgetFold.parseStatement('Date;Libellé;Montant\n14/10/2026;CB CARREFOUR;-23,40\n15/10/2026;VIR SALAIRE;1850,00').rows.length);
    check('CSV parse still works', csv === 2);
    await q.close();
  }

  console.log(H.logs.length ? `LOGS:\n${H.logs.join('\n')}` : 'no console errors');
  check('no runtime errors', !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
  console.log(`\n${pass}/${pass + failCount} passed${failCount ? ` — ${failCount} FAILED` : ''}`);
  await H.close();
  process.exitCode = failCount ? 1 : 0;
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
