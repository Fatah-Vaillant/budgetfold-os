// Interface : agenda (calendrier, prévisions, échéancier), journal, bilan, navigation mobile à 390 px.
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

  console.log(H.logs.length ? `LOGS:\n${H.logs.join('\n')}` : 'no console errors');
  check('no runtime errors', !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
  console.log(`\n${pass}/${pass + failCount} passed${failCount ? ` — ${failCount} FAILED` : ''}`);
  await H.close();
  process.exitCode = failCount ? 1 : 0;
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
