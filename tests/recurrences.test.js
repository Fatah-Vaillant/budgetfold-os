// Récurrences : modification et arrêt d'une série, échéances déjà passées.
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

  console.log(H.logs.length ? `LOGS:\n${H.logs.join('\n')}` : 'no console errors');
  check('no runtime errors', !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
  console.log(`\n${pass}/${pass + failCount} passed${failCount ? ` — ${failCount} FAILED` : ''}`);
  await H.close();
  process.exitCode = failCount ? 1 : 0;
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
