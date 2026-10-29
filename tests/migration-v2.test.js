// Migration d'une sauvegarde v2 (clé budgetfold-os:v2) vers le format actuel.
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
    check('v4 key written', await q.evaluate(() => !!localStorage.getItem('budgetfold-os:v4')));
    await q.close();
  }

  console.log(H.logs.length ? `LOGS:\n${H.logs.join('\n')}` : 'no console errors');
  check('no runtime errors', !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
  console.log(`\n${pass}/${pass + failCount} passed${failCount ? ` — ${failCount} FAILED` : ''}`);
  await H.close();
  process.exitCode = failCount ? 1 : 0;
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
