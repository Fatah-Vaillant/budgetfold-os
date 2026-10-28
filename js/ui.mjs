// BudgetFold OS · module ui (voir CLAUDE.md, « Architecture »).
import { FREQS, GOAL_TYPES, LEGACY_KEY, NOTES_MAX, PALETTE, PERIODS, PRIORITIES, PROJECT_ICONS, RING_C, STORAGE_KEY, TIMINGS, V2_KEY, V3_KEY, addDays, capitalize, clampDay, clampInt, cleanName, cleanSim, cleanText, clock, dayHeading, dayOf, daysBetween, fail, fmtInt, hooks, isISO, isMonthKey, isoFor, maxISO, minISO, money, moneyRound, monthDiff, monthName, monthOf, monthShort, monthlyEq, normName, ofMonth, ok, pad, parseAmount, parseDayInput, parseISO, plural, reduceMotion, relDay, ruleIcon, shiftMonth, shortDate, toInputValue, uid } from './util.mjs';
import { ACCOUNT_KINDS, CLOSE_ACTIONS, ENV_ICONS, budgetKey, commit, currentMonth, cycleEnd, cycleStart, emptyState, envLook, findEnv, findRule, fromAnyVersion, inCycle, lastAddedId, load, payDates, periodLabel, projectDone, replaceState, save, setLastAddedId, spendEnv, state } from './data.mjs';
import { accountBalance, accountOf, addAccount, addFavorite, addRule, addSplit, addSubscription, addTransaction, addWish, buildIcs, cashflow, closableRows, closeMonth, closingDefaults, computeInsights, createEnvelope, deleteAccount, deleteCatRule, deleteEnvelope, deleteFavorite, deleteMove, deleteRule, deleteTransaction, derive, detectSubscriptions, durationLabel, ensureSafety, envMonthAlloc, envRow, envelopeSuggestions, favoriteSuggestions, findAccount, firstKey, forecast, freeAfter, frequentAmounts, guessEnvelope, healthScore, learnRule, mainAccount, monthlyOf, monthlyReport, monthsToGoal, moveMoney, nextOccurrence, nextPayMonth, noSpendStreak, occurrences, pendingClosings, postRecurring, proRevenue, projectAdvice, projectContribution, projectPlan, projectResults, recentTwin, reconcileAccount, reopenMonth, resetAllEnvelopes, resetEnvelope, restoreTransaction, runRollover, runScenarios, saveCatRule, searchTransactions, setProSettings, setSalary, setSettings, simScenarios, spendingHours, splitNeeds, subscriptionsCost, upcomingEvents, updateEnvelope, updateProjectInfo, updateRule, updateTransaction, useFavorite, validateTx } from './engine.mjs';
import { BANK_PRESETS, PHOTO_DB, Photos, amountOf, decodeBuffer, download, fullBackupZip, loadImage, loadScript, parseReceipt, parseStatement, pdfText, photoDb, photoUrl, photoUrls, proofsZip, readZip, receiptDetail, resetPhotoDb, savePhoto, scanReceipt } from './io.mjs';

// Fonctions de l'interface appelées par les modules data et engine.
Object.assign(hooks, { render, toast, proThresholds });

export const byId = (id) => document.getElementById(id);
export const els = Object.fromEntries([
  'month-label', 'status', 'status-text', 'salary-view', 'salary-amount', 'salary-extra', 'salary-edit', 'salary-form',
  'salary-input', 'salary-cancel', 'salary-error', 'remaining-amount', 'remaining-sub', 'seg-charges', 'seg-spend',
  'seg-goal', 'seg-free', 'ring-percent', 'stat-spent', 'stat-left', 'stat-upcoming', 'legend-charges', 'legend-spend',
  'legend-goal', 'legend-free', 'up-sub', 'up-list', 'up-foot', 'up-more', 'mini', 'mini-month', 'mini-free', 'mini-c',
  'mini-s', 'mini-g', 'top-add', 'nav-add', 'tabs', 'insights', 'count-spend', 'add-spend', 'spend-grid', 'empty-spend',
  'count-project', 'add-project', 'project-grid', 'empty-project', 'j-prev', 'j-next', 'j-label', 'j-summary', 'j-filter',
  'j-list', 'j-empty', 'a-prev', 'a-next', 'cal-label', 'calendar', 'day-detail', 'cash-title', 'cash-chart', 'cash-note',
  'cash-edit', 'forecast', 'rec-summary', 'rec-list', 'rec-empty', 'r-prev', 'r-next', 'r-label', 'r-tiles', 'r-bars',
  'r-days', 'r-notes', 'dlg-welcome', 'w-progress', 'w-step-label', 'w-body', 'w-next', 'w-skip', 'w-back',
  'w-error', 'dlg-help', 'help-list', 'help-tour', 'help-wizard', 'tour', 'tour-hole', 'tour-bubble', 'tour-title', 'tour-text',
  'tour-step', 'tour-skip', 'tour-next', 'set-theme', 'set-text-large', 'menu-help', 'tx-repeat-pills', 'tx-date-chips',
  'env-period-pills', 'env-deadline-hint', 'dlg-password', 'pw-form', 'pw-text', 'pw-input', 'pw-error', 'lock', 'lock-form', 'lock-pin',
  'lock-error', 'lock-bio', 'lock-forgot', 'dlg-security', 'sec-lock-state', 'sec-pin-form', 'sec-pin', 'sec-pin2', 'sec-pin-set',
  'sec-pin-off', 'sec-bio-row', 'sec-bio', 'sec-password', 'sec-export', 'sec-qr', 'sec-qr-box', 'sec-qr-img', 'sec-qr-link',
  'sec-qr-copy', 'sec-error', 'menu-security', 'dlg-privacy', 'privacy-usage', 'privacy-wipe', 'menu-privacy', 'foot-privacy',
  'update-bar', 'update-go', 'update-later', 'dlg-tx', 'tx-form', 'tx-title', 'tx-sub', 'tx-mode', 'tx-scan', 'scan-status', 'scan-text', 'tx-amount',
  'tx-label', 'tx-label-title', 'tx-env-field', 'tx-env-label', 'tx-chips', 'tx-covers-field', 'tx-covers', 'tx-covers-text', 'tx-date', 'tx-date-label', 'tx-repeat-field',
  'tx-repeat', 'tx-until-field', 'tx-until', 'tx-detail-box', 'tx-detail', 'tx-series', 'tx-series-text', 'tx-series-edit',
  'tx-hint', 'tx-error', 'tx-delete', 'tx-submit', 'dlg-env', 'env-form', 'env-title', 'env-sub', 'env-kind-wrap',
  'env-name', 'env-spend-fields', 'env-max', 'env-period', 'env-project-fields', 'env-mode-wrap', 'env-target',
  'env-saved', 'env-deadline', 'env-monthly', 'env-start-field', 'env-start-wrap', 'env-start-pay-text', 'env-goal', 'env-goal-hint',
  'env-deadline-field', 'env-deadline-label', 'env-more', 'env-color', 'env-icon', 'env-timing', 'env-priority', 'p-sort', 'p-new', 'p-advice', 'p-groups',
  'wish-form', 'wish-name', 'wish-price', 'wish-error', 'wish-list', 'dlg-project', 'pj-icon', 'pj-title', 'pj-sub', 'pj-progress',
  'pj-deposit', 'pj-withdraw', 'pj-buy', 'pj-edit', 'pj-withdraw-form', 'pj-withdraw-amount', 'pj-withdraw-note', 'pj-error',
  'pj-results', 'pj-sim-section', 'sim-prudent', 'sim-real', 'sim-ambitious', 'sim-yield', 'sim-inflation', 'sim-raise',
  'sim-raise-from', 'sim-compare', 'sim-error', 'sim-out', 'sim-chart', 'pj-notes', 'pj-check-form', 'pj-check-input',
  'pj-checklist', 'pj-history', 'tx-split-btn', 'tx-split', 'tx-split-rows', 'tx-split-add', 'tx-split-off', 'tx-split-hint',
  'tx-proof-field', 'tx-photos', 'tx-pro-field', 'tx-pro', 'dlg-crop', 'crop-stage', 'crop-img', 'crop-box', 'crop-all', 'crop-read',
  'dlg-photo', 'photo-sub', 'photo-view', 'photo-prev', 'photo-replace', 'photo-delete', 'photo-next', 'dlg-rules', 'rule-form',
  'rule-key', 'rule-env', 'rule-error', 'rule-list', 'dlg-proofs', 'proofs-form', 'proofs-from', 'proofs-to', 'proofs-pro-field',
  'proofs-pro', 'proofs-hint', 'proofs-error', 'set-pro-box', 'set-pro', 'set-pro-rate', 'set-pro-ceiling', 'set-pro-vat',
  'menu-rules', 'menu-backup', 'menu-proofs', 'r-pro', 'photo-file', 'photo-replace-file', 'tx-quick', 'tx-account-field',
  'tx-accounts', 'tx-tags-field', 'tx-tags', 'tx-fav-field', 'tx-fav', 'favs', 'favs-manage', 'favs-list', 'j-search', 'j-scope-wrap',
  'j-scope', 'j-results', 'rec-detect', 'rec-ics', 'imp-preset', 'imp-subs', 'dlg-accounts', 'acc-list', 'acc-error',
  'acc-transfer-box', 'acc-transfer-form', 'acc-transfer-amount', 'acc-transfer-from', 'acc-transfer-to', 'acc-transfer-date',
  'acc-new-box', 'acc-new-form', 'acc-new-name', 'acc-new-kind', 'acc-new-balance', 'dlg-subs', 'subs-list', 'dlg-favs',
  'favs-manage-list', 'dlg-shortcut', 'shortcut-url', 'shortcut-copy', 'shortcut-ics', 'menu-accounts', 'menu-shortcut',
  'r-health', 'r-suggest', 'r-reports', 'forecast-legend', 'env-plan', 'env-hint', 'env-error', 'env-extra', 'env-reset',
  'env-delete', 'env-submit', 'dlg-settings', 'set-form', 'set-day', 'set-opening', 'set-error', 'dlg-confirm',
  'confirm-title', 'confirm-text', 'confirm-ok', 'dlg-menu', 'open-menu', 'menu-install', 'menu-csv', 'menu-export',
  'menu-import', 'menu-settings', 'menu-wipe', 'import-file', 'csv-file', 'scan-file', 'dlg-import', 'imp-summary',
  'imp-list', 'imp-confirm', 'imp-error', 'imp-cancel', 'toasts', 'set-cycle', 'set-cycle-pay-text', 'set-auto-close',
  'menu-reset-all', 'env-move', 'order-list', 'r-mode', 'r-month', 'r-history', 'dlg-close', 'close-form', 'close-title',
  'close-sub', 'close-tiles', 'close-all', 'close-list', 'close-hint', 'close-auto', 'close-error', 'close-later',
  'dlg-move', 'move-form', 'move-amount', 'move-from', 'move-to', 'move-hint', 'move-error'
].map((id) => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), byId(id)]));

export const h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') { for (const [dk, dv] of Object.entries(v)) if (dv !== null && dv !== undefined) el.dataset[dk] = dv; }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
};
export const icon = (name) => h('i', { 'data-lucide': name });
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

export let iconQueued = false;
export function flushIcons() {
  if (iconQueued) return;
  iconQueued = true;
  queueMicrotask(() => {
    iconQueued = false;
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  });
}

export const shownMoney = new WeakMap();
export function setMoney(el, target) {
  const from = shownMoney.has(el) ? shownMoney.get(el) : target;
  shownMoney.set(el, target);
  cancelAnimationFrame(el._raf);
  if (reduceMotion || from === target) {
    el.textContent = money(target);
    return;
  }
  const start = performance.now();
  const duration = 480;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = money(Math.round(from + (target - from) * eased));
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

export const signed = (cents) => `${cents < 0 ? '−' : '+'}${money(Math.abs(cents))}`;

export const ui = { tab: 'home', journalMonth: null, journalFilter: 'all', reportMonth: null, agendaMonth: null, agendaDay: null, lastScan: null, reportMode: 'month', historyRange: 3, historyOpen: null };
export const TABS = ['home', 'journal', 'projects', 'agenda', 'report'];
export const TAB_HASH = { home: '', journal: '#journal', projects: '#projets', agenda: '#agenda', report: '#bilan' };

export function render() {
  const d = derive();
  renderEngine(d);
  renderUpcoming();
  renderMini(d);
  renderView(d);
  flushIcons();
}

export function renderView(d = derive()) {
  document.body.dataset.tab = ui.tab;
  els.tabs.querySelectorAll('[data-tab]').forEach((btn) => {
    const on = btn.dataset.tab === ui.tab;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.dataset.view !== ui.tab; });
  if (ui.tab === 'home') renderHome(d);
  else if (ui.tab === 'journal') renderJournal();
  else if (ui.tab === 'agenda') renderAgenda();
  else if (ui.tab === 'projects') renderProjects();
  else renderReport();
}

export function setTab(name, { updateHash = true } = {}) {
  if (!TABS.includes(name)) name = 'home';
  const changed = name !== ui.tab;
  ui.tab = name;
  if (updateHash) {
    try { history.replaceState(null, '', TAB_HASH[name] || location.pathname + location.search); } catch { /* file:// */ }
  }
  renderView();
  flushIcons();
  const view = document.querySelector(`.view[data-view="${name}"]`);
  if (changed && view && !reduceMotion) {
    view.classList.remove('is-switching');
    void view.offsetWidth;
    view.classList.add('is-switching');
  }
  const narrow = window.matchMedia('(max-width: 759px)').matches;
  if (narrow) window.scrollTo({ top: 0, behavior: 'auto' });
  else {
    const top = byId('views').getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}

export function statusOf(d) {
  if (d.income <= 0) return { state: 'idle', text: 'À configurer' };
  if (d.free < 0) return { state: 'alert', text: 'Budget dépassé' };
  if (d.free === 0) return { state: 'full', text: 'Tout est réparti' };
  if (d.free / d.income < 0.1) return { state: 'tight', text: 'Marge serrée' };
  return { state: 'safe', text: 'Budget sain' };
}

export function setSegment(circle, length, offset) {
  circle.style.strokeDasharray = `${Math.max(0, length)} ${RING_C}`;
  circle.style.strokeDashoffset = String(-offset);
}

export const parts = (d) => {
  const base = Math.max(d.income, d.allocated);
  return {
    base,
    charges: d.charges,
    spend: d.envAlloc + d.orphan,
    goal: d.projectsMonthly + d.deposits,
    free: Math.max(0, d.free)
  };
};

export function renderEngine(d) {
  const status = statusOf(d);
  els.status.dataset.state = status.state;
  els.statusText.textContent = status.text;
  els.monthLabel.textContent = monthName(d.key);

  els.salaryAmount.textContent = state.salary > 0 ? money(state.salary) : '—';
  els.salaryExtra.hidden = d.extraIncome <= 0;
  els.salaryExtra.textContent = d.extraIncome > 0 ? `+ ${money(d.extraIncome)} d'autres revenus ce mois-ci` : '';

  setMoney(els.remainingAmount, d.free);
  els.remainingAmount.dataset.negative = String(d.free < 0);
  setMoney(els.statSpent, d.spentToDate);
  setMoney(els.statLeft, d.remaining);
  setMoney(els.statUpcoming, d.upcoming);
  const p = parts(d);
  els.legendCharges.textContent = money(p.charges);
  els.legendSpend.textContent = money(p.spend);
  els.legendGoal.textContent = money(p.goal);
  els.legendFree.textContent = money(p.free);

  els.remainingSub.textContent = d.income <= 0
    ? 'Saisis ton salaire pour démarrer.'
    : d.free < 0
      ? `Dépassement de ${money(-d.free)} sur tes revenus`
      : `${money(d.allocated)} déjà prévus sur ${money(d.income)}`;

  if (d.income > 0 && d.carried) els.remainingSub.textContent += ` · report du mois dernier : ${signed(d.carried)}`;
  const fracs = p.base > 0 ? [p.charges, p.spend, p.goal, p.free].map((v) => v / p.base) : [0, 0, 0, 0];
  const gap = fracs.filter((f) => f > 0).length > 1 ? 3 : 0;
  let offset = 0;
  [els.segCharges, els.segSpend, els.segGoal, els.segFree].forEach((circle, i) => {
    const full = fracs[i] * RING_C;
    setSegment(circle, full > 0 ? full - gap : 0, offset);
    offset += full;
  });
  els.ringPercent.textContent = `${p.base > 0 ? Math.round((p.free / p.base) * 100) : 0}%`;
}

export function renderMini(d) {
  const p = parts(d);
  els.miniMonth.textContent = monthName(d.key);
  els.miniFree.textContent = money(d.free);
  els.mini.dataset.negative = String(d.free < 0);
  const pct = (v) => `${p.base > 0 ? (v / p.base) * 100 : 0}%`;
  els.miniC.style.width = pct(p.charges);
  els.miniS.style.width = pct(p.spend);
  els.miniG.style.width = pct(p.goal);
}

export function eventRow(ev, { withDate = true } = {}) {
  return h('div', { class: 'up-row', dataset: { sign: ev.amount < 0 ? 'out' : 'in' } },
    h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(ev.icon || 'calendar-plus')),
    h('span', { class: 'tx-body' }, h('strong', { text: ev.label }), h('small', { text: withDate ? `${relDay(ev.date)} · ${ev.sub || ''}` : ev.sub || '' })),
    h('span', { class: 'tx-amount', text: signed(ev.amount) }));
}

export function renderUpcoming() {
  const list = upcomingEvents(30);
  const week = list.filter((e) => daysBetween(clock.today(), e.date) <= 7 && e.amount < 0).reduce((s, e) => s - e.amount, 0);
  els.upSub.textContent = list.length
    ? week > 0 ? `${money(week)} à payer dans les 7 prochains jours` : 'Rien à payer dans les 7 prochains jours'
    : 'Les 30 prochains jours';
  const shown = list.slice(0, 5);
  fill(els.upList, shown.length
    ? shown.map((ev) => eventRow(ev))
    : h('p', { class: 'muted up-empty', text: 'Rien de prévu dans les 30 prochains jours. Ajoute un loyer, un abonnement ou une dépense future avec le bouton +.' }));
  els.upFoot.textContent = list.length > shown.length ? `+ ${list.length - shown.length} ${plural(list.length - shown.length, 'autre', 'autres')} dans les 30 prochains jours` : '';
  els.upFoot.hidden = list.length <= shown.length;
}

export function leave(node) {
  node.classList.add('is-leaving');
  node.inert = true;
  const kill = () => node.remove();
  if (reduceMotion) kill();
  else {
    node.addEventListener('animationend', kill, { once: true });
    setTimeout(kill, 400);
  }
}

export function reconcile(container, cache, items, create, update) {
  const alive = new Set(items.map((i) => i.id));
  for (const [id, node] of [...cache]) {
    if (!alive.has(id)) {
      cache.delete(id);
      leave(node);
    }
  }
  let cursor = container.firstElementChild;
  for (const item of items) {
    let node = cache.get(item.id);
    if (!node) {
      node = create(item);
      cache.set(item.id, node);
      if (item.id === lastAddedId) {
        node.classList.add('is-entering');
        node.addEventListener('animationend', () => node.classList.remove('is-entering'), { once: true });
      }
    }
    update(node, item);
    while (cursor && cursor.classList.contains('is-leaving')) cursor = cursor.nextElementSibling;
    if (cursor === node) cursor = cursor.nextElementSibling;
    else container.insertBefore(node, cursor);
  }
}

export const spendCards = new Map();
export const projectCards = new Map();

export function cardShell(kind, id, iconName) {
  const el = h('article', { class: 'envelope', dataset: { id, kind }, tabindex: '0', role: 'button' },
    h('header', { class: 'envelope-head' },
      h('span', { class: 'envelope-icon', 'aria-hidden': 'true' }, icon(iconName)),
      h('div', { class: 'envelope-title' }, h('h3', { class: 'envelope-name' }), h('span', { class: 'envelope-kind' })),
      h('span', { class: 'badge' }),
      h('span', { class: 'envelope-chevron', 'aria-hidden': 'true' }, icon('pencil'))),
    h('div', { class: 'envelope-figure' }, h('span', { class: 'figure-label' }), h('strong', { class: 'figure-value' }), h('span', { class: 'figure-total' })),
    h('div', { class: 'meter' },
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { class: 'bar-plan' }), h('div', { class: 'bar-fill' })),
      h('div', { class: 'meter-row' }, h('span', { class: 'meter-left' }), h('span', { class: 'meter-right' }))),
    h('p', { class: 'envelope-note' }));
  const q = (s) => el.querySelector(s);
  el._r = {
    name: q('.envelope-name'), kind: q('.envelope-kind'), badge: q('.badge'), label: q('.figure-label'), value: q('.figure-value'),
    total: q('.figure-total'), bar: q('.bar'), fill: q('.bar-fill'), plan: q('.bar-plan'), left: q('.meter-left'), right: q('.meter-right'),
    note: q('.envelope-note')
  };
  return el;
}

export const createSpendCard = (row) => cardShell('spend', row.id, row.env.icon || 'wallet');
export const createProjectCard = (env) => cardShell('project', env.id, env.icon || 'target');

// « Bien tenu » : on dépense moins vite que le temps qui passe. Une enveloppe est un plafond, pas un objectif.
export function wellKept(row, today = clock.today()) {
  const w = row.window;
  if (today < w.start || today > w.end || row.budget <= 0 || row.used >= row.budget) return false;
  const elapsed = (daysBetween(w.start, today) + 1) / (daysBetween(w.start, w.end) + 1);
  return elapsed >= 0.33 && row.used / row.budget <= elapsed;
}

export function updateSpendCard(el, row) {
  const r = el._r;
  const { env, spent, planned, used, left, budget, window: w } = row;
  const ratio = budget > 0 ? used / budget : used > 0 ? 2 : 0;
  const pct = (v) => Math.round(Math.min(1, budget > 0 ? v / budget : 0) * 100);
  el.dataset.state = used > budget ? 'over' : used === budget ? 'empty' : ratio >= 0.85 ? 'tight' : 'safe';
  el.dataset.color = env.color || 'blue';
  const iconBox = el.querySelector('.envelope-icon');
  if (iconBox.dataset.icon !== (env.icon || 'wallet')) {
    iconBox.dataset.icon = env.icon || 'wallet';
    fill(iconBox, icon(env.icon || 'wallet'));
    flushIcons();
  }
  r.name.textContent = env.name;
  r.name.title = env.name;
  const per = PERIODS[env.period];
  const extra = [row.carry > 0 ? `+${money(row.carry)} reportés` : null, row.moved ? `${row.moved > 0 ? '+' : '−'}${money(Math.abs(row.moved))} déplacés` : null].filter(Boolean).join(' · ');
  r.kind.textContent = `${env.period === 'month' ? 'Par mois' : `${capitalize(per.per)} · ≈ ${moneyRound(row.eq)}/mois`}${extra ? ` · ${extra}` : ''}`;
  const kept = wellKept(row);
  r.badge.hidden = !kept;
  r.badge.textContent = 'Bien tenu';
  r.badge.dataset.tone = 'ok';
  r.label.textContent = left < 0 ? 'Dépassement' : 'Disponible';
  setMoney(r.value, Math.abs(left));
  r.total.textContent = `sur ${money(budget)}`;
  r.fill.style.width = `${pct(spent)}%`;
  r.plan.style.width = `${pct(used)}%`;
  r.bar.setAttribute('aria-valuenow', String(Math.round(Math.min(1, ratio) * 100)));
  r.bar.setAttribute('aria-label', `${env.name} : ${Math.round(ratio * 100)} %`);
  r.left.textContent = `${money(spent)} dépensés${planned > 0 ? ` · ${money(planned)} prévus` : ''}`;
  r.right.textContent = left < 0 ? `+${money(-left)}` : left === 0 ? 'Épuisée' : `${Math.round(Math.min(1, ratio) * 100)} %`;
  const today = clock.today();
  const nextStart = addDays(w.end, 1);
  const resetToday = env.reset && env.reset.date === today && w.start <= env.reset.date;
  r.note.hidden = false;
  r.note.textContent = resetToday
    ? `Remise à zéro aujourd'hui · repart aussi le ${shortDate(nextStart)}`
    : `Repart à zéro ${daysBetween(today, nextStart) === 1 ? 'demain' : `le ${shortDate(nextStart)}`}`;
  el.setAttribute('aria-label', `Modifier ${env.name}`);
}

export function updateProjectCard(el, env) {
  const r = el._r;
  const done = projectDone(env);
  const plan = env.mode === 'plan';
  const ratio = env.target > 0 ? env.saved / env.target : 0;
  const percent = Math.round(Math.min(1, ratio) * 100);
  el.dataset.state = done ? 'done' : plan ? 'plan' : 'progress';
  el.dataset.color = env.color || 'amber';
  const iconBox = el.querySelector('.envelope-icon');
  if (iconBox.dataset.icon !== (env.icon || 'target')) {
    iconBox.dataset.icon = env.icon || 'target';
    fill(iconBox, icon(env.icon || 'target'));
    flushIcons();
  }
  r.name.textContent = env.name;
  r.name.title = env.name;
  r.kind.textContent = env.goalType === 'fill' ? 'Réserve à remplir' : env.safety ? 'Épargne de précaution' : env.deadline ? `Pour ${monthName(env.deadline).toLowerCase()}` : 'Sans date';
  r.badge.hidden = !plan && !done;
  r.badge.textContent = done ? 'Atteint' : 'Plan';
  r.badge.dataset.tone = done ? 'ok' : 'plan';
  r.label.textContent = 'Épargné';
  setMoney(r.value, env.saved);
  r.total.textContent = `sur ${money(env.target)}`;
  r.fill.style.width = `${percent}%`;
  r.plan.style.width = '0%';
  r.bar.setAttribute('aria-valuenow', String(percent));
  r.bar.setAttribute('aria-label', `${env.name} : ${percent} %`);
  const p = projectPlan(env);
  r.left.textContent = `${percent} %`;
  if (done) {
    r.right.textContent = env.goalType === 'fill' ? 'Réserve pleine' : 'Objectif atteint';
    r.note.textContent = env.goalType === 'fill' ? 'La mise reprendra dès que tu y puises.' : 'Bravo ! Sa mise mensuelle est libérée.';
  } else if (plan) {
    const monthly = p.monthly;
    r.right.textContent = monthly > 0 ? `${money(monthly)}/mois` : 'À définir';
    if (!monthly) r.note.textContent = env.safety ? 'Reçoit les restes de fin de mois que tu choisis d’épargner. Touche pour voir la fiche.' :'Simulation : indique une date ou une mise mensuelle.';
    else if (p.gap > 0) r.note.textContent = `Il te manque ${money(p.gap)}/mois pour le lancer. Avec ta marge (${money(p.capacity)}/mois), objectif vers ${monthName(p.etaCapacity || p.eta).toLowerCase()}.`;
    else r.note.textContent = `Compatible avec ta marge actuelle : il te resterait ${money(-p.gap)}/mois. Touche pour voir la fiche.`;
  } else {
    const months = monthsToGoal(env);
    r.right.textContent = months === null ? 'Sans mise' : `≈ ${durationLabel(months)}`;
    r.note.textContent = months === null
      ? 'Ajoute une mise mensuelle pour avancer automatiquement.'
      : `+${money(monthlyOf(env))}/mois mis de côté ${(TIMINGS[env.timing] || TIMINGS.pay).text} · ${p.late ? 'en retard sur ta date' : `atteint vers ${monthName(p.eta).toLowerCase()}`}`;
  }
  r.note.hidden = false;
  el.setAttribute('aria-label', `Modifier ${env.name}`);
}

export function renderInsights(d) {
  const list = computeInsights(d);
  fill(els.insights, list.map((it) => {
    const body = [
      h('span', { class: 'insight-icon', 'aria-hidden': 'true' }, icon(it.icon)),
      h('span', { class: 'insight-text' }, h('strong', { text: it.title }), h('span', { text: it.text }))
    ];
    return it.tab || it.action
      ? h('button', { type: 'button', class: 'insight', dataset: { tone: it.tone, tab: it.tab || null, action: it.action || null } }, body)
      : h('div', { class: 'insight', dataset: { tone: it.tone } }, body);
  }));
  els.insights.hidden = list.length === 0;
}

// ——— Favoris (accueil) ———
export function renderFavs() {
  const favs = state.favorites;
  const sugg = favs.length < 6 ? favoriteSuggestions(3) : [];
  els.favs.hidden = !favs.length && !sugg.length;
  fill(els.favsList,
    favs.map((f) => h('button', { type: 'button', class: 'fav-chip', dataset: { fav: f.id }, 'aria-label': `Ajouter ${f.label}, ${money(f.amount)}` },
      h('strong', { text: f.label }), h('small', { text: `${f.type === 'income' ? '+' : ''}${money(f.amount)}${f.envId && spendEnv(f.envId) ? ` · ${spendEnv(f.envId).name}` : ''}` }))),
    sugg.map((s, i) => h('button', { type: 'button', class: 'fav-chip is-suggestion', dataset: { suggest: String(i) }, 'aria-label': `Créer le favori ${s.label}` },
      h('strong', {}, icon('plus'), s.label), h('small', { text: `${money(s.amount)} · suggestion` }))));
  els.favsList._sugg = sugg;
  els.favsManage.hidden = !favs.length;
}

els.favsList.addEventListener('click', (e) => {
  const s = e.target.closest('[data-suggest]');
  if (s) {
    const g = els.favsList._sugg[Number(s.dataset.suggest)];
    const res = addFavorite({ label: g.label, amount: g.amount, envId: g.envId, type: 'expense' });
    if (res.ok) toast(`Favori « ${g.label} » créé : touche-le pour l'ajouter.`);
    return;
  }
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  const res = useFavorite(b.dataset.fav);
  if (!res.ok) return toast(res.error, 'error');
  const t = res.data;
  toast(`${t.type === 'income' ? '+' : '−'}${money(t.amount)} · ${t.note}`, { action: { label: 'Annuler', run: () => { if (deleteTransaction(t.id).ok) toast('Opération annulée.'); } } });
});

export function renderFavsManage() {
  fill(els.favsManageList, state.favorites.length
    ? state.favorites.map((f) => h('div', { class: 'fav-row' },
      h('span', {}, h('strong', { text: f.label }), h('small', { text: `${money(f.amount)}${f.envId && spendEnv(f.envId) ? ` · ${spendEnv(f.envId).name}` : ''}` })),
      h('button', { type: 'button', class: 'icon-btn small', dataset: { del: f.id }, 'aria-label': `Supprimer le favori ${f.label}` }, icon('trash-2'))))
    : h('p', { class: 'muted', text: 'Aucun favori.' }));
  flushIcons();
}
els.favsManage.addEventListener('click', () => { renderFavsManage(); openDialog(els.dlgFavs); });
els.favsManageList.addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]');
  if (!b) return;
  const res = deleteFavorite(b.dataset.del);
  if (!res.ok) return;
  renderFavsManage();
  toast(`Favori « ${res.data.fav.label} » supprimé.`, { action: { label: 'Annuler', run: () => { state.favorites.splice(res.data.index, 0, res.data.fav); commit(); if (els.dlgFavs.open) renderFavsManage(); } } });
});

export function renderHome(d) {
  renderFavs();
  renderInsights(d);
  const rows = d.spend.map((r) => ({ id: r.env.id, ...r }));
  const projs = state.envelopes.filter((e) => e.kind === 'project');
  reconcile(els.spendGrid, spendCards, rows, createSpendCard, updateSpendCard);
  reconcile(els.projectGrid, projectCards, projs, createProjectCard, updateProjectCard);
  setLastAddedId(null);
  els.countSpend.textContent = String(rows.length);
  els.countProject.textContent = String(projs.length);
  els.emptySpend.hidden = rows.length > 0;
  els.emptyProject.hidden = projs.length > 0;
  flushIcons();
}

export function txIcon(tx) {
  if (tx.type === 'income') return 'banknote';
  if (tx.type === 'deposit') return 'piggy-bank';
  if (tx.type === 'withdraw') return 'battery-low';
  if (tx.type === 'transfer') return 'arrow-left-right';
  if (tx.recId) {
    const r = findRule(tx.recId);
    return r ? ruleIcon(r) : 'repeat';
  }
  return tx.envId ? 'wallet' : 'tag';
}

export function txSub(t) {
  const env = findEnv(t.envId);
  const bits = [];
  if (t.type === 'income') bits.push('Revenu');
  else if (t.type === 'deposit') bits.push(`Projet · ${env ? env.name : ''}`);
  else if (t.type === 'withdraw') bits.push(`Payé avec « ${env ? env.name : 'la réserve'} »`);
  else if (t.type === 'transfer') bits.push(`Virement · ${(findAccount(accountOf(t)) || {}).name} → ${(findAccount(t.toAccountId) || {}).name}`);
  else bits.push(t.adjust ? 'Ajustement' : env ? env.name : t.recId ? 'Prélèvement' : 'Hors enveloppe');
  if (state.accounts.length > 1 && t.type !== 'transfer' && accountOf(t) !== mainAccount().id) bits.push((findAccount(accountOf(t)) || {}).name);
  if (t.recId) {
    const r = findRule(t.recId);
    bits.push(r ? FREQS[r.freq].label.toLowerCase() : 'récurrent');
  }
  if (t.detail) {
    const n = t.detail.split('\n').filter((l) => l.startsWith('•')).length;
    bits.push(n ? `${n} ${plural(n, 'article', 'articles')}` : 'détail');
  }
  if (t.group) bits.push('ticket réparti');
  if (t.tags && t.tags.length) bits.push(t.tags.map((g) => `#${g}`).join(' '));
  if (t.photos && t.photos.length) bits.push(`${t.photos.length} ${plural(t.photos.length, 'justificatif', 'justificatifs')}`);
  return bits.join(' · ');
}

export function txRow(t) {
  const env = findEnv(t.envId);
  const title = t.note || (t.type === 'income' ? 'Revenu' : t.type === 'deposit' ? 'Versement' : t.type === 'withdraw' ? 'Retrait' : t.type === 'transfer' ? 'Virement' : env ? env.name : 'Dépense');
  const planned = t.date > clock.today();
  return h('button', { type: 'button', class: 'tx-row', dataset: { id: t.id, type: t.type, orphan: String(t.type === 'expense' && !env && !t.recId), planned: String(planned) } },
    t.photos && t.photos.length
      ? h('span', { class: 'tx-icon tx-thumb', 'aria-hidden': 'true', dataset: { photo: t.photos[0] } }, icon('paperclip'))
      : h('span', { class: 'tx-icon', 'aria-hidden': 'true', dataset: { color: t.type === 'expense' && !t.recId && env && env.kind === 'spend' ? env.color : null } }, icon(t.type === 'expense' && !t.recId && env && env.kind === 'spend' ? env.icon || 'wallet' : txIcon(t))),
    h('span', { class: 'tx-body' }, h('strong', {}, title, planned ? h('em', { class: 'tag-planned', text: 'Prévu' }) : null, t.pro ? h('em', { class: 'tag-pro', text: 'Pro' }) : null), h('small', { text: txSub(t) })),
    h('span', { class: 'tx-amount', text: `${t.type === 'income' ? '+' : t.type === 'transfer' ? '↔ ' : '−'}${money(t.amount)}` }));
}

export function moveRow(m) {
  const name = (v) => (v === 'free' ? 'Reste à vivre' : (findEnv(v) || {}).name || 'Enveloppe');
  return h('button', { type: 'button', class: 'tx-row', dataset: { move: m.id, type: 'move' } },
    h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon('arrow-left-right')),
    h('span', { class: 'tx-body' }, h('strong', { text: `${name(m.from)} → ${name(m.to)}` }), h('small', { text: 'Déplacement d\'argent · touche pour annuler' })),
    h('span', { class: 'tx-amount', text: `↔ ${money(m.amount)}` }));
}

export function renderJournal() {
  const cm = currentMonth();
  const key = ui.journalMonth || cm;
  ui.journalMonth = key;
  els.jLabel.textContent = periodLabel(key);
  els.jNext.disabled = monthDiff(cm, key) >= 12;

  // Recherche : texte, montant ou #étiquette, sur la période choisie (sinon : le mois affiché).
  const query = (ui.journalQuery || '').trim();
  els.jScopeWrap.hidden = !query;
  const today0 = clock.today();
  const scopeFrom = { month: cycleStart(key), '3m': addDays(today0, -92), year: addDays(today0, -366), all: null }[ui.journalScope || 'month'];
  const scopeTo = (ui.journalScope || 'month') === 'month' ? cycleEnd(key) : null;
  const found = query ? new Set(searchTransactions(query, { from: scopeFrom, to: scopeTo }).map((t) => t.id)) : null;
  const monthTxs = state.transactions.map((t, i) => ({ t, i })).filter((x) => (found ? found.has(x.t.id) : inCycle(x.t.date, key)));
  els.jResults.hidden = !query;
  els.jResults.textContent = query ? `${found.size} ${plural(found.size, 'résultat', 'résultats')} pour « ${query} »` : '';
  const envs = state.envelopes.filter((e) => e.kind === 'spend');
  if (ui.journalFilter.startsWith('env:') && !envs.some((e) => `env:${e.id}` === ui.journalFilter)) ui.journalFilter = 'all';

  fill(els.jFilter,
    h('option', { value: 'all', text: 'Toutes les opérations' }),
    envs.map((e) => h('option', { value: `env:${e.id}`, text: e.name })),
    h('option', { value: 'recurring', text: 'Récurrentes' }),
    h('option', { value: 'planned', text: 'Prévues' }),
    h('option', { value: 'orphan', text: 'Hors enveloppe' }),
    h('option', { value: 'income', text: 'Revenus' }),
    h('option', { value: 'deposit', text: 'Versements projets' }),
    h('option', { value: 'moves', text: 'Déplacements' }));
  els.jFilter.value = ui.journalFilter;

  const today = clock.today();
  const matches = (t) => {
    const f = ui.journalFilter;
    if (f === 'all') return true;
    if (f === 'recurring') return Boolean(t.recId);
    if (f === 'planned') return t.date > today;
    if (f === 'orphan') return t.type === 'expense' && !t.envId && !t.recId;
    if (f === 'income') return t.type === 'income';
    if (f === 'deposit') return t.type === 'deposit' || t.type === 'withdraw';
    if (f === 'moves') return t.type === 'move';
    if (f.startsWith('env:') && t.type === 'move') return `env:${t.from}` === f || `env:${t.to}` === f;
    return t.type === 'expense' && `env:${t.envId}` === f;
  };
  // Les déplacements d'argent apparaissent dans le journal comme une trace (ils ne sont pas des dépenses).
  const moves = query ? [] : state.moves.filter((m) => m.key === key).map((m, i) => ({ t: { ...m, type: 'move' }, i: -1 - i }));
  const rows = [...monthTxs, ...moves].filter((x) => matches(x.t)).sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.t.ts - a.t.ts || b.i - a.i));

  const spent = monthTxs.filter((x) => x.t.type === 'expense' && x.t.date <= today).reduce((s, x) => s + x.t.amount, 0);
  const planned = monthTxs.filter((x) => x.t.type === 'expense' && x.t.date > today).reduce((s, x) => s + x.t.amount, 0);
  const earned = monthTxs.filter((x) => x.t.type === 'income').reduce((s, x) => s + x.t.amount, 0);
  fill(els.jSummary,
    h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(spent) })),
    h('div', { class: 'tile' }, h('span', { text: 'Prévu' }), h('strong', { text: money(planned) })),
    h('div', { class: 'tile' }, h('span', { text: 'Revenus ajoutés' }), h('strong', { text: money(earned) })));

  const groups = [];
  for (const x of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== x.t.date) {
      g = { date: x.t.date, items: [] };
      groups.push(g);
    }
    g.items.push(x.t);
  }

  fill(els.jList, groups.map((g) => {
    const total = g.items.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);
    return h('section', { class: 'tx-group', dataset: { planned: String(g.date > today) } },
      h('header', { class: 'tx-group-head' }, h('span', { text: dayHeading(g.date) }), total > 0 ? h('span', { text: `−${money(total)}` }) : null),
      h('div', { class: 'tx-rows' }, g.items.map((t) => (t.type === 'move' ? moveRow(t) : txRow(t)))));
  }));
  els.jEmpty.hidden = rows.length > 0;
  flushIcons();
  hydrateThumbs(els.jList);
}

export function chartSvg(cash) {
  const W = 640;
  const H = 240;
  const pl = 58;
  const pr = 14;
  const pt = 18;
  const pb = 30;
  const lo = Math.min(0, ...cash.days.map((d) => d.balance));
  const hi = Math.max(cash.max, 0);
  const span = hi - lo || 1;
  const x = (day) => pl + ((day - 1) / Math.max(1, cash.n - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / span) * (H - pt - pb);
  const pts = cash.days.map((dd) => [x(dd.day), y(dd.balance)]);
  const line = (p) => p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const t = cash.today;
  const y0 = y(0).toFixed(1);
  const short = (v) => fmtInt.format(Math.round(v / 100));

  const ticks = [...new Set([hi, 0, lo])];
  const grid = ticks.map((v) => `<line class="c-grid${v === 0 ? ' c-zero' : ''}" x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="c-label" x="${pl - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${short(v)}</text>`).join('');
  const xs = [...new Set([1, Math.ceil(cash.n * 0.25), Math.ceil(cash.n * 0.5), Math.ceil(cash.n * 0.75), cash.n])];
  const xl = xs.map((day) => `<text class="c-label" x="${x(day).toFixed(1)}" y="${H - 8}" text-anchor="middle">${dayOf(cash.days[day - 1].date)}</text>`).join('');
  const markers = new Map();
  for (const dd of cash.days) {
    for (const ev of dd.events) {
      if (ev.type === 'spend') continue;
      const prev = markers.get(dd.day);
      markers.set(dd.day, prev && prev !== ev.type ? 'mixed' : ev.type);
    }
  }
  const dots = [...markers].map(([day, type]) => `<circle class="c-dot c-${type}" cx="${x(day).toFixed(1)}" cy="${y(cash.days[day - 1].balance).toFixed(1)}" r="4.5"/>`).join('');

  let paths = '';
  if (t >= 1) {
    const actual = pts.slice(0, t);
    const area = `${line(actual)} L${actual[actual.length - 1][0].toFixed(1)} ${y0} L${actual[0][0].toFixed(1)} ${y0} Z`;
    paths += `<path class="c-area" d="${area}"/><path class="c-line" d="${line(actual)}"/>`;
  }
  if (t < cash.n) paths += `<path class="c-proj" d="${line(pts.slice(Math.max(0, t - 1)))}"/>`;
  let now = '';
  if (cash.key === currentMonth() && t >= 1) {
    const tx = x(t).toFixed(1);
    now = `<line class="c-today" x1="${tx}" x2="${tx}" y1="${pt}" y2="${H - pb}"/><circle class="c-now" cx="${tx}" cy="${y(cash.days[t - 1].balance).toFixed(1)}" r="6"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution prévue du solde sur le mois" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10b981" stop-opacity=".28"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}${paths}${now}${dots}
  </svg>`;
}

export function renderAgenda() {
  const cm = currentMonth();
  const key = ui.agendaMonth || cm;
  ui.agendaMonth = key;
  const today = clock.today();
  els.calLabel.textContent = periodLabel(key);
  els.aNext.disabled = monthDiff(cm, key) >= 24;
  els.aPrev.disabled = monthDiff(key, cm) >= 24;

  const cash = cashflow(key);
  if (!ui.agendaDay || !inCycle(ui.agendaDay, key)) ui.agendaDay = key === cm ? today : cycleStart(key);

  const maxSpent = Math.max(1, ...cash.days.map((dd) => dd.spent));
  const first = (parseISO(cash.days[0].date).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h('span', { class: 'cal-blank', 'aria-hidden': 'true' }));
  for (const dd of cash.days) {
    const iso = dd.date;
    const kinds = new Set();
    for (const ev of dd.events) {
      if (ev.planned) kinds.add(ev.type === 'income' ? 'income' : 'planned');
      else if (ev.type === 'income') kinds.add('income');
      else if (ev.type === 'charge') kinds.add('charge');
      else if (ev.type === 'spend' || ev.type === 'project') kinds.add('spent');
    }
    const heat = dd.spent > 0 ? Math.min(3, Math.ceil((dd.spent / maxSpent) * 3)) : 0;
    // Puce « dépenses » à la couleur de l'enveloppe la plus dépensée ce jour-là.
    const byEnv = new Map();
    for (const ev of dd.events) if (ev.envId && !ev.planned && ev.type === 'spend') byEnv.set(ev.envId, (byEnv.get(ev.envId) || 0) - ev.amount);
    const topEnv = [...byEnv].sort((a, b) => b[1] - a[1])[0];
    const spentColor = topEnv && spendEnv(topEnv[0]) ? spendEnv(topEnv[0]).color : null;
    cells.push(h('button', {
      type: 'button',
      class: `cal-day${iso === today ? ' is-today' : ''}${iso === ui.agendaDay ? ' is-selected' : ''}${iso < today ? ' is-past' : ''}`,
      dataset: { date: iso, heat: String(heat) },
      'aria-label': `${dayHeading(iso)}${dd.events.length ? `, ${dd.events.length} opération(s)` : ''}`
    },
    h('span', { class: 'cal-num', text: dayOf(iso) === 1 && dd.day > 1 ? `1 ${monthShort(monthOf(iso)).toLowerCase()}` : String(dayOf(iso)) }),
    dd.spent > 0 ? h('small', { class: 'cal-spent', text: `−${Math.round(dd.spent / 100)}` }) : null,
    h('i', { class: 'cal-dots' }, ['spent', 'charge', 'income', 'planned'].filter((k) => kinds.has(k)).map((k) => h('b', { class: `dot-${k}`, dataset: { color: k === 'spent' ? spentColor : null } })))));
  }
  fill(els.calendar, cells);

  const sel = cash.days[daysBetween(cash.days[0].date, ui.agendaDay)];
  const evs = [...sel.events].sort((a, b) => Number(a.planned) - Number(b.planned) || a.amount - b.amount);
  const out = evs.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  fill(els.dayDetail,
    h('div', { class: 'day-head' },
      h('h3', { text: dayHeading(ui.agendaDay) }),
      out > 0 ? h('span', { class: 'day-total', text: `−${money(out)}` }) : null),
    evs.length
      ? h('div', { class: 'day-list' }, evs.map((ev) => h(ev.txId || ev.ruleId ? 'button' : 'div', {
        type: ev.txId || ev.ruleId ? 'button' : null,
        class: 'day-event',
        dataset: { type: ev.type, planned: String(Boolean(ev.planned)), tx: ev.txId || null, rule: ev.ruleId || null }
      },
      h('span', { class: 'day-event-main' }, h('strong', { text: ev.label }), h('small', { text: [ev.sub, ev.planned ? 'prévu' : null].filter(Boolean).join(' · ') })),
      h('b', { text: signed(ev.amount) }))))
      : h('p', { class: 'muted', text: 'Rien ce jour-là.' }),
    cash.openingKnown || key === cm ? h('p', { class: 'muted small', text: `${cash.openingKnown ? 'Solde prévu' : `Variation depuis le ${shortDate(cash.days[0].date)}`} en fin de journée : ${money(sel.balance)}` }) : null,
    h('button', { type: 'button', class: 'btn ghost block add-on-day', dataset: { date: ui.agendaDay } }, icon('calendar-plus'), ui.agendaDay > today ? 'Prévoir une dépense ce jour-là' : 'Ajouter une opération ce jour-là'));

  els.cashTitle.textContent = `Trésorerie · ${monthName(key)}`;
  els.cashChart.innerHTML = chartSvg(cash);
  const dip = cash.openingKnown && cash.min.value < 0;
  els.cashNote.dataset.tone = dip ? 'bad' : 'ok';
  els.cashNote.textContent = dip
    ? `Attention : ton solde prévu descend à ${money(cash.min.value)} le ${shortDate(cash.days[cash.min.day - 1].date)}.`
    : cash.openingKnown
      ? `Fin de mois prévue : ${money(cash.end)} si tu utilises tes enveloppes jusqu'au bout.`
      : `Sans solde de départ, la courbe montre la variation du mois (fin : ${signed(cash.end)}). Renseigne ton solde dans Réglages pour l'affiner.`;

  renderOrder(key);
  renderForecast();
  renderRules();
  flushIcons();
}

// Prévisions découpées par type : prélèvements, enveloppes, projets, dépenses prévues, marge (ou manque).
export const FC_PARTS = [['charges', 'Prélèvements'], ['envelopes', 'Enveloppes'], ['projects', 'Projets'], ['planned', 'Dépenses prévues']];
export function forecastParts(d) {
  return { charges: d.charges, envelopes: d.envAlloc, projects: d.projectsMonthly + d.deposits + (d.provision || 0), planned: d.orphan };
}

export function renderForecast() {
  const rows = forecast(6);
  const peak = Math.max(1, ...rows.map((f) => Math.max(f.d.income, f.d.allocated)));
  const pct = (v) => `${Math.min(100, (Math.max(0, v) / peak) * 100)}%`;
  fill(els.forecastLegend, FC_PARTS.map(([k, label]) => h('li', {}, h('i', { class: `dot fc-dot-${k}` }), label)), h('li', {}, h('i', { class: 'dot fc-dot-free' }), 'Marge'), h('li', {}, h('i', { class: 'dot fc-dot-over' }), 'Manque'));
  fill(els.forecast, rows.map((f) => {
    const { d } = f;
    const neg = d.free < 0;
    const parts = forecastParts(d);
    const open = ui.forecastOpen === f.key;
    const notes = f.planned.slice(0, 3).map((p) => `${p.label} ${signed(p.amount)}`);
    return h('div', { class: 'fc-item', dataset: { open: String(open) } },
      h('button', { type: 'button', class: 'fc-row', dataset: { key: f.key, negative: String(neg), current: String(f.key === currentMonth()) }, 'aria-expanded': String(open) },
        h('span', { class: 'fc-month' }, h('strong', { text: monthShort(f.key) }), h('small', { text: f.key.slice(0, 4) })),
        h('span', { class: 'fc-body' },
          h('span', { class: 'fc-bar', role: 'img', 'aria-label': `${monthName(f.key)} : ${FC_PARTS.map(([k, l]) => `${l} ${money(parts[k])}`).join(', ')}, ${neg ? `manque ${money(-d.free)}` : `marge ${money(d.free)}`}` },
            FC_PARTS.map(([k]) => h('i', { class: `fc-seg fc-${k}`, style: `width:${pct(parts[k])}` })),
            h('i', { class: neg ? 'fc-over' : 'fc-free', style: `width:${pct(Math.abs(d.free))}` })),
          h('small', { text: notes.length ? notes.join(' · ') + (f.planned.length > 3 ? '…' : '') : `${money(d.allocated)} prévus sur ${money(d.income)}` })),
        h('span', { class: 'fc-free-amount' }, h('strong', { text: neg ? `−${money(-d.free)}` : money(d.free) }), h('small', { text: neg ? 'manquant' : 'de marge' }))),
      open ? h('div', { class: 'fc-detail' },
        h('div', { class: 'fc-line' }, h('span', { text: 'Revenus' }), h('b', { text: `+${money(d.income)}` })),
        FC_PARTS.map(([k, label]) => h('div', { class: 'fc-line' }, h('span', {}, h('i', { class: `dot fc-dot-${k}` }), label), h('b', { text: `−${money(parts[k])}` }))),
        h('div', { class: 'fc-line fc-total', dataset: { negative: String(neg) } }, h('span', { text: neg ? 'Manque' : 'Marge' }), h('b', { text: money(d.free) })),
        f.planned.length ? h('p', { class: 'muted small', text: f.planned.map((p) => `${shortDate(p.date)} : ${p.label} ${signed(p.amount)}`).join(' · ') }) : null) : null);
  }));
}

export function renderRules() {
  const items = [...state.recurring].sort((a, b) => (a.type === b.type ? (nextOccurrence(a, clock.today()) || '9') < (nextOccurrence(b, clock.today()) || '9') ? -1 : 1 : a.type === 'expense' ? -1 : 1));
  const perMonth = (type) => items.filter((r) => r.type === type && (!r.end || r.end >= clock.today())).reduce((s, r) => s + monthlyEq(r.amount, r.freq), 0);
  const outM = perMonth('expense');
  const inM = perMonth('income');
  els.recSummary.textContent = items.length ? `≈ ${moneyRound(outM)}/mois de dépenses${inM ? ` · ${moneyRound(inM)}/mois de revenus` : ''}` : '';
  fill(els.recList, items.map((r) => {
    const next = nextOccurrence(r, clock.today());
    const env = spendEnv(r.envId);
    const ended = r.end && r.end < clock.today();
    const when = ended ? `Terminé le ${shortDate(r.end)}` : next ? `Prochain : ${relDay(next).toLowerCase() === "aujourd'hui" ? "aujourd'hui" : relDay(next)}` : 'Terminé';
    return h('button', { type: 'button', class: 'rec-row', dataset: { id: r.id, type: r.type, ended: String(Boolean(ended)) } },
      h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(ruleIcon(r))),
      h('span', { class: 'tx-body' }, h('strong', { text: r.label }), h('small', { text: [FREQS[r.freq].label, env ? env.name : r.type === 'expense' ? 'Prélèvement' : null, when].filter(Boolean).join(' · ') })),
      h('span', { class: 'tx-amount' }, h('span', { text: signed(r.type === 'income' ? r.amount : -r.amount) }), r.freq !== 'month' ? h('small', { text: `≈ ${moneyRound(monthlyEq(r.amount, r.freq))}/mois` }) : null));
  }));
  els.recEmpty.hidden = items.length > 0;
}

// Dépensé dans un mois budgétaire jusqu'à son n-ième jour.
export function spentUpTo(key, day) {
  const from = cycleStart(key);
  const to = minISO(cycleEnd(key), addDays(from, day - 1));
  return state.transactions
    .filter((t) => t.type === 'expense' && t.date >= from && t.date <= to)
    .reduce((s, t) => s + t.amount, 0);
}

export function renderReport() {
  const history = ui.reportMode === 'history';
  els.rMonth.hidden = history;
  els.rHistory.hidden = !history;
  setRadio(els.rMode, 'r-mode', history ? 'history' : 'month');
  if (history) return renderHistory();
  const cm = currentMonth();
  const key = ui.reportMonth || cm;
  ui.reportMonth = key;
  els.rLabel.textContent = periodLabel(key);
  els.rNext.disabled = key >= cm;
  const d = derive(key);
  const today = clock.today();
  const lastDay = key === cm ? today : cycleEnd(key);
  const txs = state.transactions.filter((t) => inCycle(t.date, key) && t.date <= lastDay);
  const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const received = state.salary * payDates(key).filter((p) => p <= lastDay).length + txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const saved = d.projectsMonthly + d.deposits;
  const result = received - spent - saved;

  fill(els.rTiles,
    h('div', { class: 'tile tile-hero', dataset: { negative: String(result < 0) } }, h('span', { text: key === cm ? 'Solde du mois à ce jour' : 'Solde du mois' }), h('strong', { text: money(result) })),
    h('div', { class: 'tile' }, h('span', { text: 'Reçu' }), h('strong', { text: money(received) })),
    h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(spent) })),
    h('div', { class: 'tile' }, h('span', { text: 'Dont prélèvements' }), h('strong', { text: money(txs.filter((t) => t.type === 'expense' && t.recId && !spendEnv(t.envId)).reduce((s, t) => s + t.amount, 0)) })),
    h('div', { class: 'tile' }, h('span', { text: 'Épargné' }), h('strong', { text: money(saved) })));

  const bars = d.spend.map((r) => ({ name: r.env.name, color: r.env.color, spent: r.inMonth, max: r.env.period === 'month' ? r.env.max : r.eq })).sort((a, b) => b.spent / b.max - a.spent / a.max);
  if (d.orphan > 0) bars.push({ name: 'Hors enveloppe', spent: d.orphan, max: 0 });
  if (d.charges > 0) bars.push({ name: 'Prélèvements', spent: d.charges, max: 0, kind: 'charge' });
  fill(els.rBars,
    h('h3', { text: 'Par enveloppe' }),
    bars.length
      ? bars.map((b) => {
        const ratio = b.max > 0 ? b.spent / b.max : 1;
        const stateName = b.kind === 'charge' ? 'charge' : b.max === 0 ? 'orphan' : ratio > 1 ? 'over' : ratio >= 0.85 ? 'tight' : 'safe';
        return h('div', { class: 'bar-row', dataset: { state: stateName, color: b.color || null } },
          h('div', { class: 'bar-row-head' }, h('span', { text: b.name }), h('strong', { text: b.max > 0 ? `${money(b.spent)} / ${money(b.max)}` : money(b.spent) })),
          h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.min(100, ratio * 100)}%` })));
      })
      : h('p', { class: 'muted', text: 'Aucune enveloppe de dépenses.' }));

  const daySpend = new Map();
  for (const t of txs) if (t.type === 'expense' && !t.recId) daySpend.set(t.date, (daySpend.get(t.date) || 0) + t.amount);
  const elapsed = daysBetween(cycleStart(key), lastDay) + 1;
  const activeDays = daySpend.size;
  const wd = [0, 0, 0, 0, 0, 0, 0];
  for (const [date, v] of daySpend) wd[(parseISO(date).getDay() + 6) % 7] += v;
  const wdMax = Math.max(1, ...wd);
  const top = [...daySpend].sort((a, b) => b[1] - a[1])[0];
  const varSpent = [...daySpend.values()].reduce((s, v) => s + v, 0);
  fill(els.rDays,
    h('h3', { text: 'Tes jours de dépenses' }),
    h('div', { class: 'day-stats' },
      h('div', {}, h('strong', { text: `${activeDays} / ${elapsed}` }), h('small', { text: 'jours avec dépenses' })),
      h('div', {}, h('strong', { text: String(elapsed - activeDays) }), h('small', { text: 'jours sans dépense' })),
      h('div', {}, h('strong', { text: activeDays ? money(Math.round(varSpent / activeDays)) : '—' }), h('small', { text: 'par jour de dépense' }))),
    h('div', { class: 'wd-bars' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => h('div', { class: 'wd', title: money(wd[i]) },
      h('span', { class: 'wd-col' }, h('i', { style: `height:${Math.round((wd[i] / wdMax) * 100)}%` })),
      h('small', { text: l })))),
    top ? h('p', { class: 'muted small', text: `Jour le plus dépensier : ${dayHeading(top[0]).toLowerCase()} (${money(top[1])}). Hors prélèvements automatiques.` }) : null,
    renderHours(key));
  renderHealth(key);
  renderSuggestions(key);
  renderReports();

  const notes = [];
  const ranked = [...d.spend].filter((r) => r.inMonth > 0).sort((a, b) => b.inMonth - a.inMonth);
  if (ranked.length && spent > 0) {
    notes.push(['trending-up', `« ${ranked[0].env.name} » est ton premier poste : ${Math.round((ranked[0].inMonth / spent) * 100)} % de tes dépenses.`]);
  }
  const prevKey = shiftMonth(key, -1);
  const upTo = elapsed;
  const prevSpent = spentUpTo(prevKey, upTo);
  if (prevSpent > 0 && spent > 0) {
    const delta = Math.round(((spent - prevSpent) / prevSpent) * 100);
    notes.push([delta > 0 ? 'triangle-alert' : 'circle-check', delta === 0
      ? 'Tu dépenses autant que le mois précédent à la même date.'
      : `Tu dépenses ${Math.abs(delta)} % ${delta > 0 ? 'de plus' : 'de moins'} que le mois précédent à la même date.`]);
  }
  renderProCard(d, key);
  if (saved > 0 && d.income > 0) notes.push(['piggy-bank', `Tu mets de côté ${Math.round((saved / d.income) * 100)} % de tes revenus.`]);
  if (d.orphan > 0) notes.push(['info', `${money(d.orphan)} dépensés hors enveloppe : pense à les ranger.`]);
  fill(els.rNotes,
    h('h3', { text: 'À retenir' }),
    notes.length
      ? notes.map(([ic, text]) => h('p', { class: 'note-line' }, icon(ic), h('span', { text })))
      : h('p', { class: 'muted', text: 'Pas encore assez de données pour ce mois.' }));
  flushIcons();
}

export function showError(el, message) {
  el.hidden = false;
  el.textContent = message;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

export const hideError = (el) => {
  el.hidden = true;
  el.textContent = '';
};

export function setHint(el, text, tone) {
  el.textContent = text;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

export function toast(message, opts = {}) {
  const o = typeof opts === 'string' ? { tone: opts } : opts;
  const tone = o.tone || 'success';
  const dismiss = () => {
    node.classList.add('is-out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 500);
  };
  const node = h('div', { class: 'toast', dataset: { tone } }, icon(tone === 'error' ? 'info' : 'check'), h('span', { text: message }));
  if (o.action) {
    node.append(h('button', { type: 'button', class: 'toast-action', text: o.action.label, onclick: () => { dismiss(); o.action.run(); } }));
  }
  while (els.toasts.children.length >= 3) els.toasts.firstElementChild.remove();
  els.toasts.append(node);
  flushIcons();
  setTimeout(dismiss, o.duration || (o.action ? 6000 : tone === 'error' ? 4800 : 3400));
}

export function openDialog(dlg) {
  if (dlg.open) return;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

export const closeDialog = (dlg) => { if (dlg.open) dlg.close(); };

export function confirmAction({ title, text, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = confirmLabel;
    els.confirmOk.classList.toggle('danger', danger);
    els.dlgConfirm.returnValue = '';
    els.dlgConfirm.addEventListener('close', () => resolve(els.dlgConfirm.returnValue === 'confirm'), { once: true });
    openDialog(els.dlgConfirm);
  });
}

export const checkedValue = (form, name) => {
  const input = form.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
};

export function setRadio(form, name, value) {
  form.querySelectorAll(`input[name="${name}"]`).forEach((input) => { input.checked = input.value === value; });
}

export let busy = false;
export const guard = (fn) => (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  try { fn(event); } finally { setTimeout(() => { busy = false; }, 350); }
};

export const txUi = {
  mode: 'expense', txId: null, ruleId: null, envId: null, projectId: null, envTouched: false, suggested: false, scanning: false, coversTouched: false,
  photos: [], items: [], split: { on: false, rows: [] }, accountId: null
};

export const sheetDate = () => (isISO(els.txDate.value) ? els.txDate.value : clock.today());
export const sheetRepeat = () => (txUi.mode === 'deposit' || txUi.txId ? 'once' : els.txRepeat.value);

export function defaultEnvFor(label, repeat) {
  const guess = guessEnvelope(label, { hints: repeat === 'once' });
  if (guess) return { id: guess, suggested: true };
  if (repeat !== 'once') return { id: null, suggested: false };
  const pref = spendEnv(state.prefs.lastEnvId);
  const first = state.envelopes.find((e) => e.kind === 'spend');
  return { id: pref ? pref.id : first ? first.id : null, suggested: false };
}

export function renderTxChips() {
  const date = sheetDate();
  if (txUi.mode === 'deposit') {
    els.txEnvLabel.textContent = 'Projet';
    const projects = state.envelopes.filter((e) => e.kind === 'project' && (!projectDone(e) || e.id === txUi.projectId));
    fill(els.txChips, projects.length
      ? projects.map((e) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(txUi.projectId === e.id), dataset: { project: e.id } },
        h('span', { text: e.name }), h('small', { text: `${money(e.saved)} / ${money(e.target)}` })))
      : h('p', { class: 'muted', text: "Crée d'abord un projet depuis l'accueil." }));
    return;
  }
  const repeat = sheetRepeat();
  els.txEnvLabel.textContent = txUi.suggested && !txUi.envTouched && txUi.envId ? 'Enveloppe (suggérée)' : 'Enveloppe';
  const key = budgetKey(date);
  const rows = derive(key).spend;
  const chip = (envId, name, sub) => h('button', {
    type: 'button', class: `chip${txUi.suggested && !txUi.envTouched && (txUi.envId || '') === envId && envId ? ' is-suggested' : ''}`, role: 'radio',
    'aria-checked': String((txUi.envId || '') === envId), dataset: { env: envId, color: envId && spendEnv(envId) ? spendEnv(envId).color : null }
  }, h('span', { text: name }), h('small', { text: sub }));
  fill(els.txChips,
    rows.map((r) => chip(r.env.id, r.env.name, r.left < 0 ? `−${money(-r.left)}` : `${money(r.left)} dispo`)),
    chip('', repeat === 'once' ? 'Aucune' : 'Aucune (charge fixe)', repeat === 'once' ? 'hors enveloppe' : 'réservée à part'));
}

// Versement en cours de saisie : mise du mois encore due, case « mise de ce mois », reste à vivre après versement.
export function depositDraft() {
  const env = findEnv(txUi.projectId);
  if (!env || env.kind !== 'project') return null;
  const date = sheetDate();
  const key = budgetKey(date);
  const amount = parseAmount(els.txAmount.value) || 0;
  const prev = txUi.txId ? state.transactions.find((t) => t.id === txUi.txId) : null;
  const own = prev && prev.type === 'deposit' && prev.envId === env.id && prev.covers === key ? prev.amount : 0;
  const due = env.mode === 'active' && env.monthly > 0 ? Math.min(env.monthly, projectContribution(env, key) + own) : 0;
  const offered = due > 0 || Boolean(prev && prev.covers);
  const covers = offered && els.txCovers.checked;
  const after = freeAfter(key, (st) => {
    if (prev) {
      st.transactions = st.transactions.filter((t) => t.id !== prev.id);
      const pe = prev.type === 'deposit' && st.envelopes.find((x) => x.id === prev.envId);
      if (pe) pe.saved = Math.max(0, pe.saved - prev.amount);
    }
    const e = st.envelopes.find((x) => x.id === env.id);
    st.transactions.push({ id: '__draft__', type: 'deposit', envId: env.id, amount, date, ts: 0, ...(covers ? { covers: key } : {}) });
    e.saved = Math.min(e.target, e.saved + amount);
  });
  return { env, key, amount, prev, due, offered, covers, after };
}

export function syncCovers() {
  const draft = txUi.mode === 'deposit' ? depositDraft() : null;
  els.txCoversField.hidden = !(draft && draft.offered);
  if (!draft || !draft.offered) return;
  if (!txUi.coversTouched) els.txCovers.checked = draft.prev ? Boolean(draft.prev.covers) : draft.due > 0;
  els.txCoversText.textContent = draft.due > 0
    ? `Le versement remplace la mise automatique de ${money(draft.due)} prévue en ${monthName(draft.key).toLowerCase()}, au lieu de s'y ajouter.`
    : `La mise ${ofMonth(draft.key)} est déjà couverte.`;
}

// Montants fréquents (saisie en 3 touches : montant, enveloppe, valider).
export function renderQuick(show) {
  const list = show ? frequentAmounts(txUi.envId) : [];
  els.txQuick.hidden = !list.length;
  fill(els.txQuick, list.map((a) => h('button', { type: 'button', class: 'chip quick', dataset: { amount: String(a) }, 'aria-label': `Montant ${money(a)}` }, h('span', { text: money(a) }))));
}
els.txQuick.addEventListener('click', (e) => {
  const b = e.target.closest('[data-amount]');
  if (!b) return;
  els.txAmount.value = toInputValue(Number(b.dataset.amount));
  els.txAmount.dispatchEvent(new Event('input'));
});

export function renderTxAccounts(hide) {
  const show = !hide && state.accounts.length > 1;
  els.txAccountField.hidden = !show;
  if (!show) return;
  if (!findAccount(txUi.accountId)) txUi.accountId = mainAccount().id;
  fill(els.txAccounts, state.accounts.map((a) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(a.id === txUi.accountId), dataset: { account: a.id } },
    h('span', { text: a.name }), h('small', { text: ACCOUNT_KINDS[a.kind].label }))));
}
els.txAccounts.addEventListener('click', (e) => {
  const b = e.target.closest('[data-account]');
  if (!b) return;
  txUi.accountId = b.dataset.account;
  renderTxAccounts(false);
});

export function updateTxHint() {
  const amount = parseAmount(els.txAmount.value);
  const date = sheetDate();
  const today = clock.today();
  const repeat = txUi.ruleId ? els.txRepeat.value : sheetRepeat();
  const future = date > today;
  const until = isISO(els.txUntil.value) ? ` jusqu'au ${shortDate(els.txUntil.value)}` : '';

  if (txUi.mode === 'deposit') {
    const draft = depositDraft();
    if (!draft) return setHint(els.txHint, 'Choisis le projet à alimenter.');
    const { env, prev } = draft;
    const room = env.target - env.saved + (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
    const left = room - (amount || 0);
    if (left < 0) return setHint(els.txHint, `Dépasse l'objectif de ${money(-left)}.`, 'bad');
    if (amount && draft.after < 0) {
      return setHint(els.txHint, `Attention : ton reste à vivre ${ofMonth(draft.key)} passerait à ${money(draft.after)}.`, 'bad');
    }
    const what = draft.covers ? `Compté comme la mise ${ofMonth(draft.key)}.` : 'Versement exceptionnel, pris sur ton reste à vivre.';
    return setHint(els.txHint, `${what} Encore ${money(left)} pour atteindre l'objectif.${amount ? ` Reste à vivre après : ${money(draft.after)}.` : ''}`, amount ? 'ok' : undefined);
  }

  if (repeat !== 'once') {
    const f = FREQS[repeat];
    const eq = amount ? monthlyEq(amount, repeat) : 0;
    const back = date <= today && !txUi.ruleId ? ` Les échéances depuis le ${shortDate(maxISO(date, cycleStart(currentMonth())))} sont ajoutées tout de suite.` : '';
    if (txUi.mode === 'income') {
      return setHint(els.txHint, amount
        ? `+${money(amount)} ${f.per} à partir du ${shortDate(date)}${until}, ajouté automatiquement (≈ ${moneyRound(eq)}/mois).${back}`
        : `Aide, pension, job… ajouté automatiquement à chaque échéance.`);
    }
    const env = spendEnv(txUi.envId);
    if (!amount) return setHint(els.txHint, `Compté automatiquement à chaque échéance, même quand l'app est fermée.`);
    return setHint(els.txHint, `${money(amount)} ${f.per} à partir du ${shortDate(date)}${until} : ≈ ${moneyRound(eq)}/mois ${env ? `pris automatiquement dans « ${env.name} »` : 'réservés sur ton reste à vivre'}.${back}`, 'ok');
  }

  if (txUi.mode === 'income') {
    return setHint(els.txHint, future
      ? `Revenu prévu le ${shortDate(date)} : compté dans ${monthName(budgetKey(date)).toLowerCase()}.`
      : "Ce revenu s'ajoute à ton reste à vivre du mois.");
  }

  const env = spendEnv(txUi.envId);
  if (future) {
    return setHint(els.txHint, `Dépense prévue le ${shortDate(date)} : ${env ? `réservée dans « ${env.name} »` : `réservée sur ${monthName(budgetKey(date)).toLowerCase()}`}. Elle apparaît dans l'agenda.`);
  }
  if (!env) return setHint(els.txHint, 'Sans enveloppe : le montant est pris directement sur ton reste à vivre.');
  const row = envRow(env, budgetKey(date));
  const prev = txUi.txId ? state.transactions.find((t) => t.id === txUi.txId) : null;
  const own = prev && prev.type === 'expense' && prev.envId === env.id && prev.date >= row.window.start && prev.date <= row.window.end ? prev.amount : 0;
  const base = row.left + own;
  if (!amount) return setHint(els.txHint, `Disponible dans « ${env.name} » : ${money(base)}`);
  const left = base - amount;
  return left < 0
    ? setHint(els.txHint, `Dépasse l'enveloppe de ${money(-left)} : le surplus est pris sur ton reste à vivre.`, 'bad')
    : setHint(els.txHint, `Il restera ${money(left)} dans « ${env.name} ».`, 'ok');
}

export function syncTxForm() {
  const editingTx = Boolean(txUi.txId);
  const editingRule = Boolean(txUi.ruleId);
  const isDeposit = txUi.mode === 'deposit';
  const repeat = editingRule ? els.txRepeat.value : sheetRepeat();
  els.txMode.hidden = editingTx || editingRule;
  els.txScan.hidden = txUi.mode !== 'expense' || editingRule || txUi.scanning;
  els.txEnvField.hidden = txUi.mode === 'income';
  els.txRepeatField.hidden = editingTx || isDeposit;
  els.txUntilField.hidden = repeat === 'once' || isDeposit || editingTx;
  els.txRepeat.querySelector('option[value="once"]').disabled = editingRule;
  els.txDateLabel.textContent = repeat !== 'once' ? 'À partir du' : 'Date';
  els.txLabelTitle.textContent = txUi.mode === 'income' ? 'De quoi ?' : isDeposit ? 'Note (facultatif)' : 'Quoi ?';
  els.txLabel.placeholder = txUi.mode === 'income' ? 'Salaire, APL, bourse, vente…' : isDeposit ? 'Ex : prime, anniversaire…' : 'Courses, loyer, café…';
  els.txDetailBox.hidden = isDeposit;
  els.txProofField.hidden = isDeposit || editingRule;
  els.txTagsField.hidden = isDeposit || editingRule;
  els.txFavField.hidden = isDeposit || editingTx || editingRule || repeat !== 'once';
  renderTxAccounts(isDeposit || editingRule);
  renderQuick(txUi.mode === 'expense' && !editingTx && !editingRule);
  els.txProField.hidden = !state.prefs.pro.enabled || isDeposit || editingRule;
  const canSplit = txUi.mode === 'expense' && !editingTx && !editingRule && repeat === 'once';
  els.txSplitBtn.hidden = !canSplit || txUi.split.on;
  if (!canSplit && txUi.split.on) {
    txUi.split.on = false;
    renderSplit();
  }
  const future = sheetDate() > clock.today();
  els.txSubmit.textContent = editingTx || editingRule
    ? 'Enregistrer'
    : isDeposit ? 'Verser'
      : repeat !== 'once' ? 'Programmer'
        : future ? 'Prévoir' : 'Ajouter';
  if (!editingTx && !editingRule) {
    els.txTitle.textContent = isDeposit ? 'Verser sur un projet' : txUi.mode === 'income'
      ? repeat !== 'once' ? 'Revenu récurrent' : future ? 'Revenu prévu' : 'Nouveau revenu'
      : repeat !== 'once' ? 'Dépense récurrente' : future ? 'Dépense prévue' : 'Nouvelle dépense';
  }
  renderTxChips();
  renderPills(els.txRepeat, els.txRepeatPills, REPEAT_ICONS);
  renderDateChips();
  syncCovers();
  updateTxHint();
  flushIcons();
}

export function resetScanUi() {
  txUi.scanning = false;
  els.scanStatus.hidden = true;
}

export function openAdd({ mode = 'expense', date = null, envId, projectId = null } = {}) {
  const lastAcc = findAccount(state.prefs.lastAccountId);
  Object.assign(txUi, { mode, txId: null, ruleId: null, envTouched: envId !== undefined, suggested: false, projectId, coversTouched: false, photos: [], items: [], split: { on: false, rows: [] }, accountId: (lastAcc || mainAccount()).id });
  els.txPro.checked = false;
  els.txTags.value = '';
  els.txFav.checked = false;
  renderTxPhotos();
  renderSplit();
  resetScanUi();
  els.txSub.textContent = 'Dépense, revenu, prévision ou paiement qui se répète.';
  setRadio(els.txForm, 'tx-mode', mode);
  els.txAmount.value = '';
  els.txLabel.value = '';
  els.txDate.value = date || clock.today();
  els.txRepeat.value = 'once';
  els.txUntil.value = '';
  els.txDetail.value = '';
  els.txDetailBox.open = false;
  els.txSeries.hidden = true;
  els.txDelete.hidden = true;
  if (mode === 'deposit' && !projectId) {
    const p = state.envelopes.find((e) => e.kind === 'project' && !projectDone(e));
    txUi.projectId = p ? p.id : null;
  }
  txUi.envId = envId !== undefined ? envId : defaultEnvFor('', 'once').id;
  hideError(els.txError);
  syncTxForm();
  openDialog(els.dlgTx);
  requestAnimationFrame(() => els.txAmount.focus());
}

export function openTx(tx) {
  Object.assign(txUi, { mode: tx.type, txId: tx.id, ruleId: null, envTouched: true, suggested: false, envId: tx.type === 'expense' ? tx.envId : null, projectId: tx.type === 'deposit' ? tx.envId : null, coversTouched: false, photos: [...(tx.photos || [])], items: [], split: { on: false, rows: [] } });
  els.txPro.checked = Boolean(tx.pro);
  els.txTags.value = (tx.tags || []).join(', ');
  els.txFav.checked = false;
  txUi.accountId = accountOf(tx);
  renderTxPhotos();
  renderSplit();
  resetScanUi();
  els.txTitle.textContent = tx.date > clock.today() ? 'Modifier la prévision' : "Modifier l'opération";
  els.txSub.textContent = tx.type === 'income' ? 'Revenu' : tx.type === 'deposit' ? 'Versement sur un projet' : 'Dépense';
  setRadio(els.txForm, 'tx-mode', tx.type);
  els.txAmount.value = toInputValue(tx.amount);
  els.txLabel.value = tx.note || '';
  els.txDate.value = tx.date;
  els.txRepeat.value = 'once';
  els.txUntil.value = '';
  els.txDetail.value = tx.detail || '';
  els.txDetailBox.open = Boolean(tx.detail);
  const rule = tx.recId ? findRule(tx.recId) : null;
  els.txSeries.hidden = !tx.recId;
  els.txSeriesText.textContent = rule ? `Ajoutée automatiquement · ${FREQS[rule.freq].label.toLowerCase()}` : 'Ajoutée automatiquement (série supprimée)';
  els.txSeriesEdit.hidden = !rule;
  els.txSeriesEdit.dataset.rule = rule ? rule.id : '';
  els.txDelete.hidden = false;
  hideError(els.txError);
  syncTxForm();
  openDialog(els.dlgTx);
}

export function openRule(rule) {
  Object.assign(txUi, { mode: rule.type, txId: null, ruleId: rule.id, envTouched: true, suggested: false, envId: rule.envId, projectId: null, photos: [], items: [], split: { on: false, rows: [] } });
  renderSplit();
  resetScanUi();
  els.txTitle.textContent = 'Modifier la récurrence';
  els.txSub.textContent = 'Les changements s\'appliquent aux prochaines échéances.';
  setRadio(els.txForm, 'tx-mode', rule.type);
  els.txAmount.value = toInputValue(rule.amount);
  els.txLabel.value = rule.label;
  els.txDate.value = rule.start;
  els.txRepeat.value = rule.freq;
  els.txUntil.value = rule.end || '';
  els.txDetail.value = '';
  els.txDetailBox.open = false;
  els.txSeries.hidden = true;
  els.txDelete.hidden = false;
  hideError(els.txError);
  syncTxForm();
  els.txDetailBox.hidden = true;
  openDialog(els.dlgTx);
}

els.txMode.addEventListener('change', () => {
  txUi.mode = checkedValue(els.txForm, 'tx-mode') || 'expense';
  if (txUi.mode === 'deposit') {
    els.txRepeat.value = 'once';
    if (!txUi.projectId) {
      const p = state.envelopes.find((e) => e.kind === 'project' && !projectDone(e));
      txUi.projectId = p ? p.id : null;
    }
  }
  if (txUi.mode === 'expense' && !txUi.envTouched) {
    const g = defaultEnvFor(els.txLabel.value, sheetRepeat());
    txUi.envId = g.id;
    txUi.suggested = g.suggested;
  }
  hideError(els.txError);
  syncTxForm();
});

els.txChips.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-env], [data-project]');
  if (!chip) return;
  if (chip.dataset.project !== undefined) {
    txUi.projectId = chip.dataset.project;
    txUi.coversTouched = false;
  } else {
    txUi.envId = chip.dataset.env || null;
    txUi.envTouched = true;
  }
  renderTxChips();
  syncCovers();
  updateTxHint();
});

els.txCovers.addEventListener('change', () => {
  txUi.coversTouched = true;
  updateTxHint();
});

els.txLabel.addEventListener('input', () => {
  hideError(els.txError);
  if (txUi.mode === 'expense' && !txUi.envTouched && !txUi.txId && !txUi.ruleId) {
    const g = defaultEnvFor(els.txLabel.value, sheetRepeat());
    if (g.suggested || txUi.suggested) {
      txUi.envId = g.id;
      txUi.suggested = g.suggested;
      renderTxChips();
    }
  }
  updateTxHint();
});

els.txRepeat.addEventListener('change', () => {
  if (txUi.mode === 'expense' && !txUi.envTouched && !txUi.ruleId) {
    const g = defaultEnvFor(els.txLabel.value, els.txRepeat.value);
    txUi.envId = g.id;
    txUi.suggested = g.suggested;
  }
  hideError(els.txError);
  syncTxForm();
});

[els.txAmount, els.txUntil].forEach((el) => el.addEventListener('input', () => {
  hideError(els.txError);
  if (txUi.mode === 'deposit') syncCovers();
  if (txUi.split.on) updateSplitHint();
  updateTxHint();
}));
els.txDate.addEventListener('input', () => {
  hideError(els.txError);
  syncTxForm();
});
els.txDate.addEventListener('change', () => syncTxForm());

export function undoRule(id) {
  const i = state.recurring.findIndex((r) => r.id === id);
  if (i >= 0) state.recurring.splice(i, 1);
  state.transactions = state.transactions.filter((t) => t.recId !== id);
  commit();
}

els.txForm.addEventListener('submit', guard(async () => {
  const mode = txUi.mode;
  const amount = parseAmount(els.txAmount.value);
  const label = els.txLabel.value;
  const date = els.txDate.value;
  const detail = els.txDetail.value;

  if (txUi.ruleId) {
    const env = spendEnv(txUi.envId);
    const res = updateRule(txUi.ruleId, {
      type: mode, label: cleanName(label) || (env ? env.name : mode === 'income' ? 'Revenu' : 'Prélèvement'), amount,
      freq: els.txRepeat.value, start: date, end: isISO(els.txUntil.value) ? els.txUntil.value : null, envId: mode === 'expense' ? txUi.envId : null
    });
    if (!res.ok) return showError(els.txError, res.error);
    closeDialog(els.dlgTx);
    toast('Récurrence mise à jour : elle s\'applique aux prochaines échéances.');
    return;
  }

  if (txUi.txId) {
    const res = updateTransaction(txUi.txId, {
      type: mode, envId: mode === 'income' ? null : mode === 'deposit' ? txUi.projectId : txUi.envId, amount, note: label, date, detail,
      covers: mode === 'deposit' && !els.txCoversField.hidden && els.txCovers.checked,
      pro: !els.txProField.hidden && els.txPro.checked, photos: mode === 'deposit' ? undefined : [...txUi.photos],
      tags: els.txTagsField.hidden ? undefined : els.txTags.value,
      accountId: els.txAccountField.hidden ? undefined : txUi.accountId === mainAccount().id ? null : txUi.accountId
    });
    if (!res.ok) return showError(els.txError, res.error);
    if (mode === 'expense' && txUi.envId && label) learnRule(label, txUi.envId);
    closeDialog(els.dlgTx);
    toast('Opération mise à jour.');
    return;
  }

  const repeat = sheetRepeat();
  if (repeat !== 'once') {
    const env = spendEnv(txUi.envId);
    const res = addRule({
      type: mode, label: cleanName(label) || (env ? env.name : mode === 'income' ? 'Revenu' : 'Prélèvement'), amount, freq: repeat,
      start: date, end: isISO(els.txUntil.value) ? els.txUntil.value : null, envId: mode === 'expense' ? txUi.envId : null
    });
    if (!res.ok) return showError(els.txError, res.error);
    if (mode === 'expense' && txUi.envId && txUi.envTouched && label) learnRule(label, txUi.envId);
    closeDialog(els.dlgTx);
    const { rule, posted } = res.data;
    const next = nextOccurrence(rule, addDays(clock.today(), 1));
    const msg = `« ${rule.label} » programmé ${FREQS[rule.freq].label.toLowerCase()}.${posted.length ? ` ${posted.length} ${plural(posted.length, 'échéance ajoutée', 'échéances ajoutées')} au journal.` : ''}${next ? ` Prochaine : ${relDay(next).toLowerCase()}.` : ''}`;
    toast(msg, { action: { label: 'Annuler', run: () => { undoRule(rule.id); toast('Programmation annulée.'); } } });
    return;
  }

  if (txUi.split.on) {
    const parts = txUi.split.rows.filter((r) => r.amount > 0);
    const sum = parts.reduce((s, r) => s + r.amount, 0);
    if (txUi.split.rows.some((r) => r.amount === null && r.envId)) return showError(els.txError, 'Indique un montant pour chaque ligne, ou retire-la.');
    if (amount && sum !== amount) return showError(els.txError, `Les lignes font ${money(sum)} pour un total de ${money(amount)} : ajuste-les.`);
    const res = addSplit({ note: label, date, detail, pro: !els.txProField.hidden && els.txPro.checked }, parts);
    if (!res.ok) return showError(els.txError, res.error);
    if (txUi.photos.length) {
      for (const t of res.data.txs) t.photos = [...txUi.photos];
      commit();
    }
    closeDialog(els.dlgTx);
    const n = new Set(res.data.txs.map((t) => t.envId || '')).size;
    toast(`Ticket de ${money(sum)} réparti sur ${n} ${plural(n, 'enveloppe', 'enveloppes')}.`, { action: { label: 'Annuler', run: () => {
      state.transactions = state.transactions.filter((t) => t.group !== res.data.group);
      commit();
      toast('Répartition annulée.');
    } } });
    return;
  }
  const payload = {
    type: mode,
    envId: mode === 'income' ? null : mode === 'deposit' ? txUi.projectId : txUi.envId,
    amount, note: label, date, detail,
    covers: mode === 'deposit' && !els.txCoversField.hidden && els.txCovers.checked,
    pro: !els.txProField.hidden && els.txPro.checked,
    photos: mode === 'deposit' ? null : [...txUi.photos],
    tags: els.txTagsField.hidden ? null : els.txTags.value,
    accountId: els.txAccountField.hidden || txUi.accountId === mainAccount().id ? null : txUi.accountId
  };
  const pre = validateTx(payload, null);
  if (!pre.ok) return showError(els.txError, pre.error);
  if (recentTwin(payload)) {
    const target = mode === 'deposit' ? ` sur « ${findEnv(payload.envId).name} »` : spendEnv(payload.envId) ? ` dans « ${spendEnv(payload.envId).name} »` : '';
    const again = await confirmAction({
      title: 'Doublon probable',
      text: `Tu viens déjà de saisir ${money(amount)}${target} il y a moins de 2 minutes. L'ajouter une deuxième fois ?`,
      confirmLabel: 'Ajouter quand même'
    });
    if (!again) return;
  }
  if (mode === 'deposit') {
    const draft = depositDraft();
    if (draft && draft.after < 0) {
      const go = await confirmAction({
        title: 'Reste à vivre négatif',
        text: `Après ce versement, ton reste à vivre ${ofMonth(draft.key)} passerait à ${money(draft.after)}. Verser quand même ?`,
        confirmLabel: 'Verser quand même',
        danger: true
      });
      if (!go) return;
    }
  }
  const res = addTransaction(payload);
  if (!res.ok) return showError(els.txError, res.error);
  if (mode === 'expense' && txUi.envId && txUi.envTouched && label) learnRule(label, txUi.envId);
  if (!els.txFavField.hidden && els.txFav.checked) {
    const env = spendEnv(payload.envId);
    addFavorite({ label: cleanName(label) || (env ? env.name : mode === 'income' ? 'Revenu' : 'Dépense'), amount, envId: payload.envId, type: mode, accountId: payload.accountId });
  }
  closeDialog(els.dlgTx);
  const t = res.data;
  const env = findEnv(t.envId);
  const future = t.date > clock.today();
  let message;
  if (t.type === 'income') message = future ? `Revenu de ${money(t.amount)} prévu le ${shortDate(t.date)}.` : `+${money(t.amount)} ajoutés à ton reste à vivre.`;
  else if (t.type === 'deposit') message = `${money(t.amount)} versés dans « ${env.name} ».`;
  else if (future) message = `Dépense de ${money(t.amount)} prévue le ${shortDate(t.date)}.`;
  else if (env) {
    const row = envRow(env, budgetKey(t.date));
    message = row.left >= 0 ? `−${money(t.amount)} · il reste ${money(row.left)} dans « ${env.name} ».` : `−${money(t.amount)} · « ${env.name} » est dépassée.`;
  } else message = `−${money(t.amount)} hors enveloppe.`;
  toast(message, { action: { label: 'Annuler', run: () => { if (deleteTransaction(t.id).ok) toast('Opération annulée.'); } } });
}));

els.txDelete.addEventListener('click', async () => {
  if (txUi.ruleId) {
    const rule = findRule(txUi.ruleId);
    if (!rule) return;
    closeDialog(els.dlgTx);
    const confirmed = await confirmAction({
      title: `Arrêter « ${rule.label} » ?`,
      text: 'Les opérations déjà passées restent dans ton journal. Les prochaines échéances ne seront plus comptées.',
      confirmLabel: 'Arrêter',
      danger: true
    });
    if (confirmed && deleteRule(rule.id).ok) toast('Récurrence arrêtée.');
    return;
  }
  if (!txUi.txId) return;
  const removed = deleteTransaction(txUi.txId);
  if (!removed.ok) return showError(els.txError, removed.error);
  closeDialog(els.dlgTx);
  const t = removed.data;
  toast('Opération supprimée.', { action: { label: 'Annuler', run: () => restoreTransaction(t) } });
});

els.txSeriesEdit.addEventListener('click', () => {
  const rule = findRule(els.txSeriesEdit.dataset.rule);
  if (!rule) return;
  closeDialog(els.dlgTx);
  openRule(rule);
});

export const SCAN_STEPS = {
  'loading tesseract core': 'Chargement du moteur de lecture…',
  'initializing tesseract': 'Préparation…',
  'initialized tesseract': 'Préparation…',
  'loading language traineddata': 'Chargement du français…',
  'loaded language traineddata': 'Chargement du français…',
  'initializing api': 'Préparation…',
  'initialized api': 'Préparation…'
};

// ——— Scan : recadrage, lecture d'un ticket (photo) ou d'une facture (PDF) ———
export const crop = { file: null, url: null, box: { x0: 0, y0: 0, x1: 1, y1: 1 } };
ui.crop = crop.box;

export function placeCropBox() {
  const b = crop.box;
  Object.assign(els.cropBox.style, { left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%` });
}

export function openCrop(file) {
  crop.file = file;
  if (crop.url) URL.revokeObjectURL(crop.url);
  crop.url = URL.createObjectURL(file);
  Object.assign(crop.box, { x0: 0.04, y0: 0.03, x1: 0.96, y1: 0.97 });
  els.cropImg.src = crop.url;
  placeCropBox();
  openDialog(els.dlgCrop);
}

// Coins déplaçables : la sélection garde au moins 10 % de largeur et de hauteur.
els.cropStage.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.crop-handle');
  if (!handle) return;
  e.preventDefault();
  const which = handle.dataset.h;
  const rect = els.cropImg.getBoundingClientRect();
  const move = (ev) => {
    const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
    const b = crop.box;
    if (which.includes('w')) b.x0 = Math.min(x, b.x1 - 0.1);
    if (which.includes('e')) b.x1 = Math.max(x, b.x0 + 0.1);
    if (which.includes('n')) b.y0 = Math.min(y, b.y1 - 0.1);
    if (which.includes('s')) b.y1 = Math.max(y, b.y0 + 0.1);
    placeCropBox();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

// Découpe de la photo d'origine (pleine résolution) selon la sélection.
export async function cropCanvas(file, box) {
  const img = await loadImage(file);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const sx = Math.round(box.x0 * w0);
  const sy = Math.round(box.y0 * h0);
  const sw = Math.max(1, Math.round((box.x1 - box.x0) * w0));
  const sh = Math.max(1, Math.round((box.y1 - box.y0) * h0));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

els.cropAll.addEventListener('click', () => {
  Object.assign(crop.box, { x0: 0, y0: 0, x1: 1, y1: 1 });
  els.cropRead.click();
});
els.cropRead.addEventListener('click', async () => {
  const file = crop.file;
  if (!file) return;
  const box = { ...crop.box };
  closeDialog(els.dlgCrop);
  const full = box.x0 <= 0 && box.y0 <= 0 && box.x1 >= 1 && box.y1 >= 1;
  await runScan(async (progress) => {
    const source = full ? file : await cropCanvas(file, box);
    const r = await scanReceipt(source, progress);
    stagePhoto(await savePhoto(source));
    return r;
  });
});

export const scanProgress = (m) => {
  if (!els.dlgTx.open) return;
  els.scanText.textContent = m.status === 'recognizing text'
    ? `Lecture du ticket… ${Math.round((m.progress || 0) * 100)} %`
    : m.status === 'pdf' ? 'Lecture de la facture…' : SCAN_STEPS[m.status] || 'Préparation…';
};

export async function runScan(read) {
  txUi.scanning = true;
  hideError(els.txError);
  els.scanStatus.hidden = false;
  els.txScan.hidden = true;
  els.scanText.textContent = 'Préparation…';
  try {
    const r = await read(scanProgress);
    if (!els.dlgTx.open) return;
    resetScanUi();
    applyScan(r);
  } catch (err) {
    console.warn('BudgetFold scan', err);
    resetScanUi();
    syncTxForm();
    showError(els.txError, navigator.onLine === false
      ? 'La première lecture a besoin d\'internet pour télécharger le moteur. Ensuite, ça marche hors ligne.'
      : 'Lecture impossible pour le moment. Réessaie, ou saisis le montant à la main.');
  }
}

export function applyScan(r) {
  if (!r.total && !r.items.length) {
    syncTxForm();
    return showError(els.txError, r.pdf ? 'Je n\'ai pas trouvé de montant dans cette facture : saisis-le à la main.' : "Je n'ai pas réussi à lire ce ticket. Reprends la photo bien à plat, avec plus de lumière, ou saisis le montant.");
  }
  if (r.total) els.txAmount.value = toInputValue(Math.abs(r.total));
  if (r.merchant && !els.txLabel.value.trim()) els.txLabel.value = r.merchant;
  if (r.date) els.txDate.value = r.date;
  const detail = receiptDetail(r);
  if (detail) {
    els.txDetail.value = detail;
    els.txDetailBox.open = true;
  }
  ui.lastScan = { merchant: r.merchant, date: r.date, dateOld: r.dateOld, total: r.total, items: r.items };
  txUi.items = r.items.filter((it) => it.amount > 0);
  if (!txUi.envTouched) {
    const guess = guessEnvelope(`${r.merchant || ''} ${r.text.slice(0, 400)}`);
    if (guess) {
      txUi.envId = guess;
      txUi.suggested = true;
    }
  }
  syncTxForm();
  const env = spendEnv(txUi.envId);
  const old = r.dateOld ? ` ${r.pdf ? 'Facture datée' : 'Ticket daté'} du ${parseISO(r.date).toLocaleDateString('fr-FR')} : vérifie la date.` : '';
  const split = txUi.items.length >= 2 ? ' Touche « Répartir » pour ventiler les articles entre enveloppes.' : '';
  setHint(els.txHint, `${r.pdf ? 'Facture lue' : 'Ticket lu'}${r.merchant ? ` (${r.merchant})` : ''} : ${r.total ? money(Math.abs(r.total)) : 'montant à vérifier'}${r.items.length ? `, ${r.items.length} ${plural(r.items.length, 'article', 'articles')}` : ''}. ${env ? `Enveloppe proposée : « ${env.name} ». ` : ''}Vérifie avant d'ajouter.${old}${split}`, r.dateOld ? 'bad' : 'ok');
}

els.txScan.addEventListener('click', () => els.scanFile.click());
els.scanFile.addEventListener('change', async () => {
  const file = els.scanFile.files && els.scanFile.files[0];
  els.scanFile.value = '';
  if (!file) return;
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return runScan(async (progress) => {
      progress({ status: 'pdf' });
      const text = await pdfText(file);
      stagePhoto(await savePhoto(file));
      return { ...parseReceipt(text), text, pdf: true };
    });
  }
  openCrop(file);
});

// ——— Justificatifs dans la saisie ———
export function stagePhoto(rec) {
  if (!rec || txUi.photos.includes(rec.id)) return;
  txUi.photos.push(rec.id);
  renderTxPhotos();
}

export async function hydrateThumbs(root) {
  for (const el of root.querySelectorAll('[data-photo]:not([data-ready])')) {
    el.dataset.ready = '1';
    const rec = await Photos.get(el.dataset.photo).catch(() => null);
    if (!rec) { el.classList.add('is-missing'); continue; }
    if (rec.type === 'application/pdf') { el.classList.add('is-pdf'); fill(el, icon('file-text')); flushIcons(); continue; }
    const url = await photoUrl(rec.id);
    if (url) fill(el, h('img', { src: url, alt: '' }));
  }
}

export function renderTxPhotos() {
  fill(els.txPhotos,
    txUi.photos.map((id, i) => h('button', { type: 'button', class: 'proof', dataset: { photo: id, i: String(i) }, 'aria-label': `Voir le justificatif ${i + 1}` })),
    h('button', { type: 'button', class: 'proof proof-add', id: 'tx-photo-add', 'aria-label': 'Ajouter une photo ou un PDF' }, icon('image-plus')));
  flushIcons();
  hydrateThumbs(els.txPhotos);
}

els.txPhotos.addEventListener('click', (e) => {
  if (e.target.closest('.proof-add')) return els.photoFile.click();
  const p = e.target.closest('[data-photo]');
  if (p) openViewer(Number(p.dataset.i));
});

els.photoFile.addEventListener('change', async () => {
  const files = [...(els.photoFile.files || [])];
  els.photoFile.value = '';
  for (const f of files.slice(0, 10)) {
    try {
      stagePhoto(await savePhoto(f));
    } catch {
      showError(els.txError, 'Impossible d\'enregistrer cette photo sur l\'appareil (stockage plein ou bloqué).');
    }
  }
});

// ——— Visionneuse ———
export const viewer = { index: 0 };
export async function renderViewer() {
  const id = txUi.photos[viewer.index];
  els.photoSub.textContent = `${viewer.index + 1} / ${txUi.photos.length}`;
  els.photoPrev.disabled = viewer.index === 0;
  els.photoNext.disabled = viewer.index >= txUi.photos.length - 1;
  const rec = id ? await Photos.get(id).catch(() => null) : null;
  if (!rec) return fill(els.photoView, h('p', { class: 'muted', text: 'Justificatif introuvable sur cet appareil.' }));
  const url = await photoUrl(id);
  fill(els.photoView, rec.type === 'application/pdf'
    ? h('a', { class: 'btn primary', href: url, target: '_blank', rel: 'noopener', text: 'Ouvrir le PDF' })
    : h('img', { src: url, alt: `Justificatif ${viewer.index + 1}` }));
}
export function openViewer(index) {
  viewer.index = index;
  openDialog(els.dlgPhoto);
  renderViewer();
}
els.photoPrev.addEventListener('click', () => { viewer.index = Math.max(0, viewer.index - 1); renderViewer(); });
els.photoNext.addEventListener('click', () => { viewer.index = Math.min(txUi.photos.length - 1, viewer.index + 1); renderViewer(); });
els.photoDelete.addEventListener('click', () => {
  const [removed] = txUi.photos.splice(viewer.index, 1);
  const at = viewer.index;
  closeDialog(els.dlgPhoto);
  renderTxPhotos();
  toast('Justificatif retiré (pris en compte à l\'enregistrement).', { action: { label: 'Annuler', run: () => { txUi.photos.splice(at, 0, removed); renderTxPhotos(); } } });
});
els.photoReplace.addEventListener('click', () => els.photoReplaceFile.click());
els.photoReplaceFile.addEventListener('change', async () => {
  const f = els.photoReplaceFile.files && els.photoReplaceFile.files[0];
  els.photoReplaceFile.value = '';
  if (!f) return;
  const rec = await savePhoto(f);
  txUi.photos[viewer.index] = rec.id;
  renderTxPhotos();
  renderViewer();
});

// ——— Répartir un ticket entre plusieurs enveloppes ———
export function splitRow(row, i) {
  const envs = state.envelopes.filter((e) => e.kind === 'spend');
  return h('div', { class: 'split-row', dataset: { i: String(i) } },
    h('div', { class: 'money-input' }, h('input', { type: 'text', inputmode: 'decimal', class: 'split-amount', value: row.amount ? toInputValue(row.amount) : '', placeholder: '0', 'aria-label': `Montant ${i + 1}` }), h('span', { text: '€' })),
    h('div', { class: 'select-wrap' }, h('select', { class: 'split-env', 'aria-label': `Enveloppe ${i + 1}` },
      h('option', { value: '', text: 'Aucune' }), envs.map((e) => h('option', { value: e.id, text: e.name })))),
    h('input', { type: 'text', class: 'split-note', maxlength: '80', value: row.note || '', placeholder: 'Article (facultatif)', 'aria-label': `Article ${i + 1}` }),
    h('button', { type: 'button', class: 'icon-btn small split-del', 'aria-label': `Retirer la ligne ${i + 1}` }, icon('x')));
}

export function renderSplit() {
  const on = txUi.split.on;
  els.txSplit.hidden = !on;
  els.txChips.hidden = on;
  if (!on) return;
  fill(els.txSplitRows, txUi.split.rows.map(splitRow));
  els.txSplitRows.querySelectorAll('.split-row').forEach((el) => { el.querySelector('.split-env').value = txUi.split.rows[Number(el.dataset.i)].envId || ''; });
  updateSplitHint();
  flushIcons();
}

export function updateSplitHint() {
  const total = parseAmount(els.txAmount.value) || 0;
  const sum = txUi.split.rows.reduce((s, r) => s + (r.amount || 0), 0);
  const n = new Set(txUi.split.rows.filter((r) => r.amount > 0).map((r) => r.envId || '')).size;
  if (!total) return setHint(els.txSplitHint, `Réparti : ${money(sum)} sur ${n} ${plural(n, 'enveloppe', 'enveloppes')}. Le montant total sera la somme des lignes.`);
  const diff = total - sum;
  setHint(els.txSplitHint, diff === 0 ? `Tout est réparti : ${money(sum)} sur ${n} ${plural(n, 'enveloppe', 'enveloppes')}.` : diff > 0 ? `Il reste ${money(diff)} à répartir.` : `Tu as réparti ${money(-diff)} de trop.`, diff === 0 ? 'ok' : 'bad');
}

els.txSplitBtn.addEventListener('click', () => {
  const total = parseAmount(els.txAmount.value) || 0;
  const items = txUi.items || [];
  txUi.split.rows = items.length >= 2
    ? items.map((it) => ({ amount: it.amount, envId: guessEnvelope(it.label) || txUi.envId || null, note: it.label }))
    : [{ amount: total || null, envId: txUi.envId || null, note: '' }, { amount: null, envId: null, note: '' }];
  if (items.length >= 2 && total) {
    const diff = total - txUi.split.rows.reduce((s, r) => s + r.amount, 0);
    if (diff) txUi.split.rows.push({ amount: diff > 0 ? diff : null, envId: txUi.envId || null, note: diff > 0 ? 'Écart (remise, arrondi…)' : '' });
  }
  txUi.split.on = true;
  renderSplit();
  syncTxForm();
});
els.txSplitOff.addEventListener('click', () => { txUi.split.on = false; renderSplit(); syncTxForm(); });
els.txSplitAdd.addEventListener('click', () => { txUi.split.rows.push({ amount: null, envId: null, note: '' }); renderSplit(); });
els.txSplitRows.addEventListener('input', (e) => {
  const row = e.target.closest('.split-row');
  if (!row) return;
  const r = txUi.split.rows[Number(row.dataset.i)];
  if (e.target.classList.contains('split-amount')) r.amount = parseAmount(e.target.value);
  if (e.target.classList.contains('split-note')) r.note = e.target.value;
  updateSplitHint();
});
els.txSplitRows.addEventListener('change', (e) => {
  const row = e.target.closest('.split-row');
  if (row && e.target.classList.contains('split-env')) txUi.split.rows[Number(row.dataset.i)].envId = e.target.value || null;
});
els.txSplitRows.addEventListener('click', (e) => {
  const del = e.target.closest('.split-del');
  if (!del) return;
  txUi.split.rows.splice(Number(del.closest('.split-row').dataset.i), 1);
  renderSplit();
});

export const envUi = { id: null, kind: 'spend' };

export function envInput() {
  const optional = (el) => (el.value.trim() === '' ? 0 : parseAmount(el.value));
  if (envUi.kind === 'spend') return { kind: 'spend', name: els.envName.value, max: parseAmount(els.envMax.value), period: els.envPeriod.value, color: checkedValue(els.envForm, 'env-color'), icon: checkedValue(els.envForm, 'env-icon') };
  const mode = checkedValue(els.envForm, 'env-mode') === 'plan' ? 'plan' : 'active';
  const target = parseAmount(els.envTarget.value);
  const saved = optional(els.envSaved);
  const deadline = isMonthKey(els.envDeadline.value) ? els.envDeadline.value : null;
  const goalType = GOAL_TYPES[checkedValue(els.envForm, 'env-goal')] ? checkedValue(els.envForm, 'env-goal') : 'monthly';
  let monthly = optional(els.envMonthly);
  if ((goalType === 'date' || els.envMonthly.value.trim() === '') && deadline && target && saved !== null && goalType !== 'fill') {
    monthly = projectPlan({ target, saved, deadline, monthly: 0, mode: 'plan' }).needed || 0;
  }
  const out = {
    kind: 'project', name: els.envName.value, target, saved, monthly, deadline: goalType === 'fill' ? null : deadline, mode, goalType,
    timing: checkedValue(els.envForm, 'env-timing') || 'pay', priority: Number(checkedValue(els.envForm, 'env-priority') || 2),
    color: checkedValue(els.envForm, 'env-color') || 'amber', icon: checkedValue(els.envForm, 'env-icon') || 'target'
  };
  if (!els.envStartField.hidden) out.startMonth = checkedValue(els.envForm, 'env-start') === 'now' ? currentMonth() : nextPayMonth();
  return out;
}

// Le choix « première mise » n'a de sens que pour un nouveau projet Actif quand la paie du mois est déjà passée.
export function syncEnvStart() {
  const show = envUi.kind === 'project' && !envUi.id && checkedValue(els.envForm, 'env-mode') !== 'plan' && nextPayMonth() !== currentMonth();
  els.envStartField.hidden = !show;
  if (show) els.envStartPayText.textContent = `À la prochaine paie (${monthName(nextPayMonth()).toLowerCase()})`;
}

// Pastilles de couleur et grille d'icônes (boutons radio, accessibles au clavier).
export function renderChoices(kind = envUi.kind) {
  if (!els.envColor.children.length) {
    fill(els.envColor, Object.entries(PALETTE).map(([key, label]) => [
      h('input', { type: 'radio', name: 'env-color', id: `env-color-${key}`, value: key }),
      h('label', { for: `env-color-${key}`, class: 'swatch', dataset: { color: key }, title: label }, h('span', { class: 'visually-hidden', text: label }))]));
  }
  if (els.envIcon.dataset.kind !== kind) {
    els.envIcon.dataset.kind = kind;
    fill(els.envIcon, (kind === 'spend' ? ENV_ICONS : PROJECT_ICONS).map((ic) => [
      h('input', { type: 'radio', name: 'env-icon', id: `env-icon-${ic}`, value: ic }),
      h('label', { for: `env-icon-${ic}`, class: 'icon-choice', title: ic }, icon(ic), h('span', { class: 'visually-hidden', text: ic }))]));
    flushIcons();
  }
  // Versement et priorité n'ont de sens que pour un projet.
  els.envTiming.closest('.field').hidden = kind !== 'project';
  els.envPriority.closest('.field').hidden = kind !== 'project';
  els.envMore.querySelector('summary').textContent = kind === 'project' ? 'Versement, priorité, couleur et icône' : 'Couleur et icône';
}

// Pastilles visuelles à la place des listes déroulantes (la liste reste, masquée, pour le clavier et les tests).
export const REPEAT_ICONS = { once: 'circle-dot', day: 'sun', week: 'calendar-days', '2weeks': 'calendar-range', month: 'calendar', '2months': 'calendar-range', quarter: 'calendar-range', year: 'calendar-heart' };
export function renderPills(select, box, icons) {
  fill(box, [...select.options].map((o) => h('button', { type: 'button', class: 'pill', role: 'radio', 'aria-checked': String(o.value === select.value), disabled: o.disabled || null, dataset: { value: o.value } },
    icons && icons[o.value] ? icon(icons[o.value]) : null, o.textContent)));
  flushIcons();
}
export function pillClick(select, box, icons) {
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-value]');
    if (!b || b.disabled) return;
    select.value = b.dataset.value;
    select.dispatchEvent(new Event('change'));
    renderPills(select, box, icons);
  });
}
pillClick(els.txRepeat, els.txRepeatPills, REPEAT_ICONS);
pillClick(els.envPeriod, els.envPeriodPills, null);

// Raccourcis de date : hier, aujourd'hui, demain.
export function renderDateChips() {
  const today = clock.today();
  const opts = [['Hier', addDays(today, -1)], ['Aujourd\'hui', today], ['Demain', addDays(today, 1)]];
  fill(els.txDateChips, opts.map(([label, iso]) => h('button', { type: 'button', class: 'pill', role: 'radio', 'aria-checked': String(els.txDate.value === iso), dataset: { date: iso } }, label)));
}
els.txDateChips.addEventListener('click', (e) => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  els.txDate.value = b.dataset.date;
  els.txDate.dispatchEvent(new Event('input'));
});

export function syncGoalFields() {
  const goal = checkedValue(els.envForm, 'env-goal') || 'monthly';
  els.envDeadlineField.hidden = goal === 'fill';
  els.envDeadlineLabel.textContent = goal === 'date' ? 'Pour quand ?' : 'Pour quand ? (facultatif)';
  els.envMonthly.disabled = goal === 'date';
  els.envMonthly.placeholder = goal === 'date' ? 'Calculée' : goal === 'fill' ? 'Ex : 30' : 'Auto';
  els.envGoalHint.textContent = goal === 'date'
    ? 'La mise est recalculée chaque mois pour tenir ta date.'
    : goal === 'fill'
      ? 'Pour une réserve (entretien voiture, cadeaux…) : la mise s\'arrête quand elle est pleine et reprend quand tu y puises.'
      : 'Tu choisis la mise ; la date d\'arrivée est calculée.';
}

export function syncEnvFields() {
  els.envSpendFields.hidden = envUi.kind !== 'spend';
  els.envProjectFields.hidden = envUi.kind !== 'project';
  renderChoices(envUi.kind);
  renderPills(els.envPeriod, els.envPeriodPills, null);
  syncGoalFields();
  els.envSub.textContent = envUi.kind === 'spend'
    ? 'Un budget qui se remet à zéro à chaque période.'
    : 'Actif : épargné chaque mois. Plan : simulation, rien n\'est bloqué.';
}

export function updateEnvHint() {
  syncEnvStart();
  syncGoalFields();
  const dl = els.envDeadline.value;
  els.envDeadlineHint.textContent = isMonthKey(dl) ? `→ ${monthName(dl).toLowerCase()}, dans ${Math.max(0, monthDiff(currentMonth(), dl))} mois` : '';
  // Nom tapé pour une nouvelle enveloppe : couleur et icône devinées, tant que l'utilisateur ne les a pas choisies.
  if (!envUi.id && envUi.kind === 'spend' && !envUi.lookTouched && els.envName.value.trim()) {
    const look = envLook(els.envName.value);
    setRadio(els.envForm, 'env-color', look.color);
    setRadio(els.envForm, 'env-icon', look.icon);
  }
  const d = derive();
  const existing = envUi.id ? findEnv(envUi.id) : null;
  const input = envInput();
  els.envPlan.hidden = true;
  if (envUi.kind === 'spend') {
    if (!input.max) return setHint(els.envHint, `Disponible à répartir ce mois-ci : ${money(Math.max(0, d.free))}`);
    const probe = { ...(existing || { id: '__new__', anchor: clock.today(), reset: null }), kind: 'spend', max: input.max, period: input.period };
    const next = envMonthAlloc(probe, d.key);
    const prev = existing ? envMonthAlloc(existing, d.key).alloc : 0;
    const after = d.free - (next.alloc - prev);
    const per = input.period === 'month' ? '' : ` (≈ ${moneyRound(next.eq)} mis de côté par mois)`;
    return after < 0
      ? setHint(els.envHint, `Dépasse ton reste à vivre de ${money(-after)}.`, 'bad')
      : setHint(els.envHint, `${money(input.max)} ${PERIODS[input.period].per}${per}. Reste à vivre après : ${money(after)}`, 'ok');
  }
  if (!input.target || input.saved === null || input.monthly === null) return setHint(els.envHint, 'Indique au moins un objectif.');
  const probe = { ...(existing || {}), ...input };
  const p = projectPlan(probe, d.free, existing && existing.kind === 'project' ? projectContribution(existing, d.key) : 0);
  const lines = projectResults(probe, p);
  els.envPlan.hidden = false;
  fill(els.envPlan, lines.map(([tone, text]) => h('p', { dataset: tone ? { tone } : null, text })));
  if (input.mode === 'active' && p.gap > 0 && input.saved < input.target) {
    return setHint(els.envHint, 'En mode Actif, la mise doit tenir dans ta marge. Passe en Plan pour simuler sans bloquer.', 'bad');
  }
  return setHint(els.envHint, input.mode === 'plan'
    ? 'Mode Plan : rien n\'est réservé. Active-le quand ta marge le permet.'
    : input.startMonth && input.startMonth > currentMonth()
      ? `Mode Actif : rien n'est réservé ce mois-ci. Première mise en ${monthName(input.startMonth).toLowerCase()}, puis chaque mois.`
      : 'Mode Actif : la mise est réservée chaque mois et versée en fin de mois.');
}

export function openEnv({ kind = 'spend', env = null } = {}) {
  envUi.lookTouched = false;
  envUi.id = env ? env.id : null;
  envUi.kind = env ? env.kind : kind;
  els.envTitle.textContent = env ? `Modifier « ${env.name} »` : envUi.kind === 'project' ? 'Nouveau projet' : 'Nouvelle enveloppe';
  els.envKindWrap.hidden = Boolean(env);
  setRadio(els.envForm, 'env-kind', envUi.kind);
  els.envName.value = env ? env.name : '';
  els.envMax.value = env && env.kind === 'spend' ? toInputValue(env.max) : '';
  els.envPeriod.value = env && env.kind === 'spend' ? env.period : 'month';
  els.envTarget.value = env && env.kind === 'project' ? toInputValue(env.target) : '';
  els.envSaved.value = env && env.kind === 'project' ? toInputValue(env.saved) : '';
  els.envMonthly.value = env && env.kind === 'project' && env.monthly > 0 ? toInputValue(env.monthly) : '';
  els.envDeadline.value = env && env.kind === 'project' && env.deadline ? env.deadline : '';
  setRadio(els.envForm, 'env-mode', env && env.kind === 'project' ? env.mode : 'active');
  setRadio(els.envForm, 'env-start', 'pay');
  renderChoices(envUi.kind);
  const pj = env && env.kind === 'project' ? env : {};
  setRadio(els.envForm, 'env-goal', pj.goalType || 'monthly');
  setRadio(els.envForm, 'env-timing', pj.timing || 'pay');
  setRadio(els.envForm, 'env-priority', String(pj.priority || 2));
  setRadio(els.envForm, 'env-color', env ? env.color : envUi.kind === 'project' ? 'amber' : 'blue');
  setRadio(els.envForm, 'env-icon', env ? env.icon : envUi.kind === 'project' ? 'target' : 'wallet');
  els.envMore.open = false;
  els.envSubmit.textContent = env ? 'Enregistrer' : 'Créer';
  els.envExtra.hidden = !env;
  els.envReset.hidden = !env || env.kind !== 'spend';
  syncEnvFields();
  hideError(els.envError);
  updateEnvHint();
  openDialog(els.dlgEnv);
  if (!env) requestAnimationFrame(() => els.envName.focus());
}

[els.envColor, els.envIcon].forEach((el) => el.addEventListener('change', () => { envUi.lookTouched = true; }));
els.envKindWrap.addEventListener('change', () => {
  envUi.kind = checkedValue(els.envForm, 'env-kind') === 'project' ? 'project' : 'spend';
  setRadio(els.envForm, 'env-color', envUi.kind === 'project' ? 'amber' : 'blue');
  setRadio(els.envForm, 'env-icon', envUi.kind === 'project' ? 'target' : 'wallet');
  envUi.lookTouched = false;
  els.envTitle.textContent = envUi.kind === 'project' ? 'Nouveau projet' : 'Nouvelle enveloppe';
  syncEnvFields();
  updateEnvHint();
});

[els.envName, els.envMax, els.envTarget, els.envSaved, els.envMonthly, els.envDeadline, els.envPeriod, els.envModeWrap, els.envStartWrap, els.envGoal].forEach((el) => {
  const on = () => {
    hideError(els.envError);
    updateEnvHint();
  };
  el.addEventListener('input', on);
  el.addEventListener('change', on);
});

els.envForm.addEventListener('submit', guard(() => {
  const input = envInput();
  const res = envUi.id ? updateEnvelope(envUi.id, input) : createEnvelope(input);
  if (!res.ok) return showError(els.envError, res.error);
  closeDialog(els.dlgEnv);
  const env = res.data;
  toast(envUi.id
    ? 'Modifications enregistrées.'
    : env.kind === 'project'
      ? env.mode === 'plan' ? `Plan « ${env.name} » créé : rien n'est bloqué.`
        : env.startMonth && env.startMonth > currentMonth()
          ? `Projet « ${env.name} » créé : première mise de ${money(env.monthly)} en ${monthName(env.startMonth).toLowerCase()}.`
          : `Projet « ${env.name} » créé : ${money(projectContribution(env, currentMonth()))} réservés ce mois-ci.`
      : `« ${env.name} » créée : ${money(env.max)} ${PERIODS[env.period].per}.`);
}));

els.envReset.addEventListener('click', async () => {
  const env = spendEnv(envUi.id);
  if (!env) return;
  const row = envRow(env, currentMonth());
  closeDialog(els.dlgEnv);
  const confirmed = await confirmAction({
    title: `Remettre « ${env.name} » à zéro ?`,
    text: `L'enveloppe repart avec ${money(env.max)} disponibles. ${row.spent > 0 ? `Les ${money(row.spent)} déjà dépensés restent dans ton journal et sont pris sur ton reste à vivre.` : ''}`,
    confirmLabel: 'Remettre à zéro'
  });
  if (!confirmed) return;
  const prev = env.reset;
  const res = resetEnvelope(env.id);
  if (res.ok) toast(`« ${env.name} » repart à ${money(env.max)}.`, { action: { label: 'Annuler', run: () => { env.reset = prev; commit(); } } });
});

els.envDelete.addEventListener('click', async () => {
  const env = findEnv(envUi.id);
  if (!env) return;
  closeDialog(els.dlgEnv);
  const row = env.kind === 'spend' ? envRow(env, currentMonth()) : null;
  const text = env.kind === 'project'
    ? `Le suivi de ton épargne (${money(env.saved)}) sera supprimé${env.mode === 'active' ? ` et sa mise de ${money(projectContribution(env, currentMonth()))} par mois retournera dans ton reste à vivre` : ''}.`
    : `Ce qui reste dans l'enveloppe retourne dans ton reste à vivre.${row && row.spent > 0 ? ` Les ${money(row.spent)} déjà dépensés restent dans le journal, hors enveloppe.` : ''}`;
  const confirmed = await confirmAction({ title: `Supprimer « ${env.name} » ?`, text, confirmLabel: 'Supprimer', danger: true });
  if (!confirmed) return;
  const res = deleteEnvelope(env.id);
  if (res.ok) toast(res.data.reinjected > 0 ? `${money(res.data.reinjected)} retournent dans ton reste à vivre.` : 'Supprimé.');
});

// ——— Onglet Projets ———
export const pctOf = (e) => (e.target > 0 ? Math.round(Math.min(1, e.saved / e.target) * 100) : 0);

export function projectRow(e) {
  const p = projectPlan(e);
  const done = projectDone(e);
  const status = e.category === 'wish'
    ? e.boughtAt ? `Acheté le ${shortDate(e.boughtAt)}` : `${money(e.target)}${e.saved ? ` · ${money(e.saved)} de côté` : ''}`
    : done ? (e.goalType === 'fill' ? 'Réserve pleine' : 'Objectif atteint')
      : p.monthly > 0 && p.eta ? `${money(p.monthly)}/mois · vers ${monthName(p.eta).toLowerCase()}${p.late ? ' (en retard)' : ''}`
        : e.deadline ? `Pour ${monthName(e.deadline).toLowerCase()}` : 'Mise à définir';
  return h('button', { type: 'button', class: 'proj-row', dataset: { id: e.id, color: e.color || 'amber', state: done ? 'done' : e.mode } },
    h('span', { class: 'proj-icon', 'aria-hidden': 'true' }, icon(e.icon || 'target')),
    h('span', { class: 'proj-body' },
      h('span', { class: 'proj-line' }, h('strong', { text: e.name }),
        e.mode === 'plan' && !done && e.category !== 'wish' ? h('em', { class: 'badge', text: 'Plan' }) : null,
        e.priority === 1 && !done ? h('em', { class: 'badge', dataset: { tone: 'bad' }, text: 'Priorité' }) : null),
      h('small', { text: status }),
      e.category === 'wish' ? null : h('span', { class: 'proj-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pctOf(e)), 'aria-label': `${e.name} : ${pctOf(e)} %` },
        h('i', { style: `width:${pctOf(e)}%` }))),
    h('span', { class: 'proj-amount' }, h('b', { text: money(e.saved) }), h('small', { text: e.category === 'wish' ? '' : `sur ${money(e.target)}` })));
}

export function renderProjects() {
  const sort = ui.projectSort || 'date';
  els.pSort.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sort === sort)));
  const all = state.envelopes.filter((e) => e.kind === 'project');
  const by = {
    date: (a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : a.priority - b.priority,
    priority: (a, b) => a.priority - b.priority || ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1),
    progress: (a, b) => pctOf(b) - pctOf(a)
  }[sort];
  const projects = all.filter((e) => e.category !== 'wish');
  const groups = [
    ['En cours', 'play', projects.filter((e) => e.mode === 'active' && !projectDone(e))],
    ['Plans et simulations', 'flask-conical', projects.filter((e) => e.mode === 'plan' && !projectDone(e))],
    ['Atteints', 'trophy', projects.filter((e) => projectDone(e))]
  ].filter(([, , list]) => list.length);
  fill(els.pGroups, groups.length
    ? groups.map(([title, ic, list]) => h('section', { class: 'proj-group' },
      h('div', { class: 'section-head' }, h('h2', {}, icon(ic), title), h('span', { class: 'count', text: String(list.length) })),
      h('div', { class: 'proj-list' }, [...list].sort(by).map(projectRow))))
    : h('div', { class: 'empty' },
      h('span', { class: 'empty-icon', 'aria-hidden': 'true' }, icon('target')),
      h('h3', { text: 'Aucun projet pour l\'instant' }),
      h('p', { text: 'Maison, moto, voyage, fonds d\'urgence : fixe un objectif, choisis une mise ou une date, et simule avant de te lancer.' })));
  const advice = projectAdvice();
  fill(els.pAdvice, advice.map((a) => h('div', { class: 'insight', dataset: { tone: 'info' } },
    h('span', { class: 'insight-icon', 'aria-hidden': 'true' }, icon(a.icon)),
    h('span', { class: 'insight-text' }, h('strong', { text: 'Conseil' }), h('span', { text: a.text })))));
  els.pAdvice.hidden = !advice.length;
  const wishes = all.filter((e) => e.category === 'wish').sort((a, b) => Number(Boolean(a.boughtAt)) - Number(Boolean(b.boughtAt)) || a.target - b.target);
  fill(els.wishList, wishes.length ? wishes.map(projectRow) : h('p', { class: 'muted small', text: 'Rien pour l\'instant.' }));
  flushIcons();
}

els.pSort.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  ui.projectSort = b.dataset.sort;
  renderProjects();
});
els.pNew.addEventListener('click', () => openEnv({ kind: 'project' }));
[els.pGroups, els.wishList].forEach((list) => list.addEventListener('click', (e) => {
  const row = e.target.closest('.proj-row');
  if (row) openProject(row.dataset.id);
}));

els.wishForm.addEventListener('submit', guard(() => {
  const res = addWish({ name: els.wishName.value, price: parseAmount(els.wishPrice.value) });
  if (!res.ok) return showError(els.wishError, res.error);
  hideError(els.wishError);
  els.wishName.value = '';
  els.wishPrice.value = '';
  const id = res.data.id;
  toast(`« ${res.data.name} » ajouté à ta liste d'envies.`, { action: { label: 'Annuler', run: () => { deleteEnvelope(id); } } });
}));

// ——— Fiche projet ———
export const pj = { id: null };
export const pjEnv = () => findEnv(pj.id);
export const bpOf = (raw) => {
  const s = String(raw ?? '').replace(/[\s%]/g, '').replace(',', '.');
  if (s === '') return 0;
  if (!/^-?\d{1,2}(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.replace('-', '').split('.');
  const bp = Number(int) * 100 + Number((dec + '00').slice(0, 2));
  return s.startsWith('-') ? -bp : bp;
};
export const bpText = (bp) => (bp ? (bp / 100).toFixed(bp % 100 === 0 ? 0 : 2).replace('.', ',') : '');

export function openProject(id) {
  const e = findEnv(id);
  if (!e || e.kind !== 'project') return;
  pj.id = id;
  const sim = e.sim || {};
  const sc = simScenarios(e);
  els.simPrudent.value = toInputValue(sc.prudent);
  els.simReal.value = toInputValue(sc.real);
  els.simAmbitious.value = toInputValue(sc.ambitious);
  els.simYield.value = bpText(sim.yieldBp || 0);
  els.simInflation.value = bpText(sim.inflationBp || 0);
  els.simRaise.value = sim.raise ? toInputValue(sim.raise) : '';
  els.simRaiseFrom.value = sim.raiseFrom || '';
  els.pjNotes.value = e.notes || '';
  els.pjWithdrawForm.hidden = true;
  els.pjWithdrawAmount.value = '';
  els.pjWithdrawNote.value = '';
  els.pjCheckInput.value = '';
  hideError(els.pjError);
  hideError(els.simError);
  renderProjectSheet();
  openDialog(els.dlgProject);
}

export function renderProjectSheet() {
  const e = pjEnv();
  if (!e) return closeDialog(els.dlgProject);
  const p = projectPlan(e);
  els.dlgProject.dataset.color = e.color || 'amber';
  fill(els.pjIcon, icon(e.icon || 'target'));
  els.pjTitle.textContent = e.name;
  els.pjSub.textContent = [
    e.category === 'wish' ? 'Envie' : GOAL_TYPES[e.goalType || 'monthly'].label,
    e.mode === 'plan' ? 'Plan (rien n\'est réservé)' : `Actif · mis de côté ${(TIMINGS[e.timing] || TIMINGS.pay).text}`,
    `Priorité ${PRIORITIES[e.priority || 2].toLowerCase()}`
  ].join(' · ');
  fill(els.pjProgress,
    h('div', { class: 'pj-figures' }, h('strong', { text: money(e.saved) }), h('span', { text: e.safety ? `objectif conseillé ${money(e.target)}` : `sur ${money(e.target)} · ${pctOf(e)} %` })),
    h('div', { class: 'proj-bar big', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pctOf(e)), 'aria-label': `${e.name} : ${pctOf(e)} %` }, h('i', { style: `width:${pctOf(e)}%` })));
  els.pjBuy.hidden = e.category !== 'wish' || Boolean(e.boughtAt);
  els.pjWithdraw.hidden = e.saved <= 0;
  fill(els.pjResults, projectResults(e, p).map(([tone, text]) => h('p', { dataset: tone ? { tone } : null, text })));
  els.pjSimSection.hidden = e.category === 'wish';
  if (e.category !== 'wish') renderSimulation();
  renderChecklist();
  renderProjectHistory();
  flushIcons();
}

export function simInput() {
  const read = (el) => (el.value.trim() === '' ? 0 : parseAmount(el.value));
  const vals = { prudent: read(els.simPrudent), real: read(els.simReal), ambitious: read(els.simAmbitious), raise: read(els.simRaise) };
  const yieldBp = bpOf(els.simYield.value);
  const inflationBp = bpOf(els.simInflation.value);
  if (Object.values(vals).some((v) => v === null)) return fail('Indique des montants valides (ex : 150).');
  if (yieldBp === null || inflationBp === null) return fail('Indique un pourcentage valide (ex : 2,5).');
  return ok({
    yieldBp, inflationBp, raise: vals.raise, raiseFrom: isMonthKey(els.simRaiseFrom.value) ? els.simRaiseFrom.value : null,
    scenarios: { prudent: vals.prudent, real: vals.real, ambitious: vals.ambitious }, compareId: els.simCompare.value || null
  });
}

export function renderSimulation() {
  const e = pjEnv();
  const others = state.envelopes.filter((x) => x.kind === 'project' && x.id !== e.id && x.category !== 'wish');
  const compareId = (e.sim && e.sim.compareId) || '';
  fill(els.simCompare, h('option', { value: '', text: 'Aucun' }), others.map((x) => h('option', { value: x.id, text: x.name })));
  els.simCompare.value = others.some((x) => x.id === compareId) ? compareId : '';
  const runs = runScenarios(e);
  const capacity = projectPlan(e).capacity;
  const label = { prudent: 'Prudent', real: 'Réaliste', ambitious: 'Ambitieux' };
  const cmp = findEnv(els.simCompare.value);
  const cmpRun = cmp ? runScenarios(cmp).real : null;
  fill(els.simOut, Object.entries(runs).map(([k, r]) => h('div', { class: 'sim-card', dataset: { scenario: k } },
    h('span', { text: label[k] }),
    h('strong', { text: r.reached ? capitalize(monthName(r.reached).toLowerCase()) : r.monthly > 0 ? 'Au-delà de 50 ans' : 'Mise à définir' }),
    h('small', { text: `${money(r.monthly)}/mois${r.months ? ` · ${durationLabel(r.months)}` : ''}${r.monthly > capacity ? ' · au-delà de ta marge' : ''}` }))),
  cmpRun ? h('div', { class: 'sim-card', dataset: { scenario: 'compare' } },
    h('span', { text: `« ${cmp.name} »` }),
    h('strong', { text: cmpRun.reached ? capitalize(monthName(cmpRun.reached).toLowerCase()) : 'Non atteint' }),
    h('small', { text: `réaliste, ${money(cmpRun.monthly)}/mois` })) : null);
  els.simChart.innerHTML = simChartSvg(runs, cmpRun);
}

// Courbes d'épargne des 3 scénarios (et d'un projet comparé) jusqu'à l'objectif.
export function simChartSvg(runs, cmp) {
  const W = 640;
  const H = 220;
  const pl = 58;
  const pr = 14;
  const pt = 14;
  const pb = 26;
  const series = Object.entries(runs).map(([k, r]) => [k, r.points]);
  if (cmp) series.push(['compare', cmp.points]);
  const len = Math.min(240, Math.max(2, ...series.map(([, pts]) => pts.length)));
  const hi = Math.max(1, ...series.flatMap(([, pts]) => pts.slice(0, len).map((q) => Math.max(q.bal, q.goal))));
  const x = (i) => pl + (i / Math.max(1, len - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / hi) * (H - pt - pb);
  const path = (pts, f) => pts.slice(0, len).map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(f(q)).toFixed(1)}`).join(' ');
  const short = (v) => fmtInt.format(Math.round(v / 100));
  const goal = runs.real.points;
  const lines = series.map(([k, pts]) => `<path class="sim-line sim-${k}" d="${path(pts, (q) => q.bal)}"/>`).join('');
  const firstKey = goal[0].key;
  const ticks = [0, Math.floor((len - 1) / 2), len - 1].map((i) => `<text class="c-label" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${monthShort(shiftMonth(firstKey, i))} ${shiftMonth(firstKey, i).slice(2, 4)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression de l'épargne selon les scénarios" preserveAspectRatio="xMidYMid meet">
    <line class="c-grid" x1="${pl}" x2="${W - pr}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
    <text class="c-label" x="${pl - 8}" y="${(y(hi) + 4).toFixed(1)}" text-anchor="end">${short(hi)}</text>
    <text class="c-label" x="${pl - 8}" y="${(y(0) + 4).toFixed(1)}" text-anchor="end">0</text>
    <path class="sim-goal" d="${path(goal, (q) => q.goal)}"/>
    ${lines}${ticks}
  </svg>`;
}

export const saveSim = () => {
  const e = pjEnv();
  const res = simInput();
  if (!res.ok) return showError(els.simError, res.error);
  hideError(els.simError);
  e.sim = cleanSim(res.data);
  save();
  renderSimulation();
};
[els.simPrudent, els.simReal, els.simAmbitious, els.simYield, els.simInflation, els.simRaise, els.simRaiseFrom].forEach((el) => el.addEventListener('input', saveSim));
els.simCompare.addEventListener('change', saveSim);

export let notesTimer = null;
els.pjNotes.addEventListener('input', () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => { const e = pjEnv(); if (e) { e.notes = els.pjNotes.value.slice(0, NOTES_MAX); save(); } }, 400);
});
els.pjNotes.addEventListener('blur', () => { const e = pjEnv(); if (e && e.notes !== els.pjNotes.value) updateProjectInfo(e.id, { notes: els.pjNotes.value }); });

// Un lien (http/https) dans une étape devient cliquable ; le reste reste du texte.
export function linkify(text) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => (i % 2
    ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer', text: part.replace(/^https?:\/\//, '').slice(0, 40) })
    : part));
}

export function renderChecklist() {
  const e = pjEnv();
  const list = e.checklist || [];
  const done = list.filter((c) => c.done).length;
  fill(els.pjChecklist, list.length
    ? [list.map((c) => h('li', { class: 'check-item', dataset: { id: c.id, done: String(c.done) } },
      h('label', {}, h('input', { type: 'checkbox', class: 'check-toggle', checked: c.done, 'aria-label': c.text }), h('span', {}, linkify(c.text))),
      h('button', { type: 'button', class: 'icon-btn small check-del', 'aria-label': `Supprimer « ${c.text} »` }, icon('x')))),
    h('li', { class: 'check-count muted small', text: `${done}/${list.length} fait${done > 1 ? 's' : ''}` })]
    : h('li', { class: 'muted small', text: 'Ajoute les étapes, la liste d\'achats ou des liens utiles.' }));
  els.pjChecklist.querySelectorAll('.check-toggle').forEach((box) => { box.checked = box.closest('li').dataset.done === 'true'; });
}

els.pjCheckForm.addEventListener('submit', guard(() => {
  const e = pjEnv();
  const text = cleanText(els.pjCheckInput.value, 120);
  if (!e || !text) return;
  updateProjectInfo(e.id, { checklist: [...(e.checklist || []), { id: uid(), text, done: false }] });
  els.pjCheckInput.value = '';
  renderChecklist();
  flushIcons();
}));

els.pjChecklist.addEventListener('click', (ev) => {
  const e = pjEnv();
  const li = ev.target.closest('.check-item');
  if (!e || !li) return;
  if (ev.target.closest('.check-del')) {
    const removed = e.checklist.find((c) => c.id === li.dataset.id);
    const index = e.checklist.indexOf(removed);
    updateProjectInfo(e.id, { checklist: e.checklist.filter((c) => c.id !== li.dataset.id) });
    renderChecklist();
    flushIcons();
    toast('Étape supprimée.', { action: { label: 'Annuler', run: () => { const list = [...pjEnv().checklist]; list.splice(index, 0, removed); updateProjectInfo(e.id, { checklist: list }); renderChecklist(); flushIcons(); } } });
  } else if (ev.target.closest('.check-toggle')) {
    updateProjectInfo(e.id, { checklist: e.checklist.map((c) => (c.id === li.dataset.id ? { ...c, done: !c.done } : c)) });
    renderChecklist();
    flushIcons();
  }
});

export function renderProjectHistory() {
  const e = pjEnv();
  const txs = state.transactions.filter((t) => (t.type === 'deposit' || t.type === 'withdraw') && t.envId === e.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts));
  fill(els.pjHistory, txs.length
    ? h('div', { class: 'tx-rows' }, txs.map((t) => h('button', { type: 'button', class: 'tx-row', dataset: { id: t.id, type: t.type } },
      h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(txIcon(t))),
      h('span', { class: 'tx-body' }, h('strong', { text: t.note || (t.type === 'withdraw' ? 'Retrait' : t.src === 'close' ? 'Reste de clôture' : t.covers ? `Mise ${ofMonth(t.covers)}` : 'Versement') }),
        h('small', { text: `${shortDate(t.date)}${t.covers ? ' · compté comme la mise du mois' : ''}${t.src === 'close' ? ' · clôture' : ''}` })),
      h('span', { class: 'tx-amount', text: `${t.type === 'withdraw' ? '−' : '+'}${money(t.amount)}` }))))
    : h('p', { class: 'muted small', text: e.mode === 'active' ? 'Les mises automatiques sont ajoutées à chaque clôture de mois. Les versements exceptionnels apparaîtront ici.' : 'Aucun versement pour l\'instant.' }));
}

els.pjHistory.addEventListener('click', async (ev) => {
  const row = ev.target.closest('.tx-row');
  const tx = row && state.transactions.find((t) => t.id === row.dataset.id);
  if (!tx) return;
  if (tx.type === 'deposit' && tx.src !== 'close') {
    closeDialog(els.dlgProject);
    return openTx(tx);
  }
  const confirmed = await confirmAction({ title: tx.type === 'withdraw' ? 'Annuler ce retrait ?' : 'Supprimer ce versement ?', text: `${money(tx.amount)} ${tx.type === 'withdraw' ? 'reviennent dans' : 'sortent de'} « ${pjEnv().name} ».`, confirmLabel: 'Confirmer' });
  if (!confirmed) return;
  const res = deleteTransaction(tx.id);
  if (res.ok) {
    renderProjectSheet();
    toast('Opération supprimée.', { action: { label: 'Annuler', run: () => { restoreTransaction(res.data); renderProjectSheet(); } } });
  }
});

els.pjDeposit.addEventListener('click', () => {
  const e = pjEnv();
  closeDialog(els.dlgProject);
  openAdd({ mode: 'deposit', projectId: e.id });
});
els.pjEdit.addEventListener('click', () => {
  const e = pjEnv();
  closeDialog(els.dlgProject);
  openEnv({ env: e });
});
els.pjWithdraw.addEventListener('click', () => {
  els.pjWithdrawForm.hidden = !els.pjWithdrawForm.hidden;
  if (!els.pjWithdrawForm.hidden) requestAnimationFrame(() => els.pjWithdrawAmount.focus());
});
els.pjWithdrawForm.addEventListener('submit', guard(() => {
  const e = pjEnv();
  const res = addTransaction({ type: 'withdraw', envId: e.id, amount: parseAmount(els.pjWithdrawAmount.value), note: els.pjWithdrawNote.value, date: clock.today() });
  if (!res.ok) return showError(els.pjError, res.error);
  hideError(els.pjError);
  els.pjWithdrawForm.hidden = true;
  els.pjWithdrawAmount.value = '';
  els.pjWithdrawNote.value = '';
  renderProjectSheet();
  const t = res.data;
  toast(`${money(t.amount)} retirés de « ${e.name} »${e.goalType === 'fill' ? ' : la mise reprendra pour la remplir' : ''}.`, { action: { label: 'Annuler', run: () => { deleteTransaction(t.id); renderProjectSheet(); } } });
}));
els.pjBuy.addEventListener('click', async () => {
  const e = pjEnv();
  updateProjectInfo(e.id, { boughtAt: clock.today() });
  closeDialog(els.dlgProject);
  const add = await confirmAction({ title: `« ${e.name} » est acheté`, text: `Veux-tu ajouter la dépense de ${money(e.target)} au journal ?`, confirmLabel: 'Ajouter la dépense' });
  if (add) {
    openAdd({ mode: 'expense' });
    els.txAmount.value = toInputValue(e.target);
    els.txLabel.value = e.name;
    syncTxForm();
  } else toast('Bien noté.', { action: { label: 'Annuler', run: () => updateProjectInfo(e.id, { boughtAt: null }) } });
});

// ——— Comptes et rapprochement ———
export const accUi = { pending: {} };
export function openAccounts() {
  hideError(els.accError);
  accUi.pending = {};
  renderAccounts();
  closeDialog(els.dlgMenu);
  openDialog(els.dlgAccounts);
}

export function renderAccounts() {
  const today = clock.today();
  fill(els.accList, state.accounts.map((a) => {
    const bal = accountBalance(a, today);
    const p = accUi.pending[a.id];
    return h('div', { class: 'acc-card', dataset: { id: a.id } },
      h('div', { class: 'acc-head' },
        h('span', { class: 'acc-icon', 'aria-hidden': 'true' }, icon(ACCOUNT_KINDS[a.kind].icon)),
        h('span', { class: 'acc-title' }, h('strong', { text: a.name }), h('small', { text: `${ACCOUNT_KINDS[a.kind].label}${a.reconciledAt ? ` · comparé le ${shortDate(a.reconciledAt)}` : ''}` })),
        h('b', { class: 'acc-balance', dataset: { negative: String(bal !== null && bal < 0) }, text: bal === null ? 'Solde inconnu' : money(bal) })),
      h('form', { class: 'acc-reconcile', dataset: { id: a.id }, novalidate: true },
        h('div', { class: 'money-input' }, h('input', { type: 'text', inputmode: 'decimal', class: 'acc-bank', placeholder: bal === null ? 'Solde actuel' : 'Solde banque', 'aria-label': `Solde de ${a.name} selon ta banque` }), h('span', { text: '€' })),
        h('button', { type: 'submit', class: 'btn ghost compact', text: bal === null ? 'Enregistrer' : 'Comparer' }),
        a === mainAccount() ? null : h('button', { type: 'button', class: 'icon-btn small acc-del', 'aria-label': `Supprimer le compte ${a.name}` }, icon('trash-2'))),
      p ? h('div', { class: 'acc-diff', dataset: { tone: p.diff === 0 ? 'ok' : 'bad' } },
        h('p', { text: p.diff === 0 ? `L'app dit ${money(p.app)}, ta banque aussi : tout est juste.` : `L'app dit ${money(p.app)}, ta banque dit ${money(p.bank)} : écart de ${signed(p.diff)}.` }),
        p.diff === 0 ? null : h('button', { type: 'button', class: 'btn primary compact acc-adjust', dataset: { id: a.id } }, `Ajouter un ajustement de ${signed(p.diff)}`)) : null);
  }));
  const opts = (sel, value) => {
    fill(sel, state.accounts.map((a) => h('option', { value: a.id, text: a.name })));
    sel.value = value;
  };
  const others = state.accounts.filter((a) => a !== mainAccount());
  opts(els.accTransferFrom, mainAccount().id);
  opts(els.accTransferTo, others.length ? others[0].id : mainAccount().id);
  els.accTransferBox.hidden = state.accounts.length < 2;
  if (!els.accTransferDate.value) els.accTransferDate.value = today;
  flushIcons();
}

els.accList.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target.closest('.acc-reconcile');
  const acc = findAccount(form.dataset.id);
  const raw = form.querySelector('.acc-bank').value.trim().replace(/^−/, '-');
  const neg = raw.startsWith('-');
  const val = parseAmount(raw.replace(/^-/, ''));
  if (val === null) return showError(els.accError, 'Indique un solde valide (ex : 1234,56 ou -45).');
  hideError(els.accError);
  const bank = neg ? -val : val;
  const app = accountBalance(acc);
  if (app === null) {
    reconcileAccount(acc.id, bank);
    renderAccounts();
    return toast(`Solde de départ de « ${acc.name} » enregistré : ${money(bank)}.`);
  }
  accUi.pending[acc.id] = { app, bank, diff: bank - app };
  if (bank === app) {
    acc.reconciledAt = clock.today();
    commit();
  }
  renderAccounts();
});

els.accList.addEventListener('click', (e) => {
  const adj = e.target.closest('.acc-adjust');
  if (adj) {
    const p = accUi.pending[adj.dataset.id];
    const res = reconcileAccount(adj.dataset.id, p.bank);
    if (!res.ok) return showError(els.accError, res.error);
    delete accUi.pending[adj.dataset.id];
    renderAccounts();
    const t = res.data.tx;
    return toast(`Ajustement de ${signed(res.data.diff)} ajouté au journal.`, { action: { label: 'Annuler', run: () => { if (t) deleteTransaction(t.id); if (els.dlgAccounts.open) renderAccounts(); } } });
  }
  const del = e.target.closest('.acc-del');
  if (del) {
    const res = deleteAccount(del.closest('.acc-card').dataset.id);
    if (!res.ok) return showError(els.accError, res.error);
    renderAccounts();
    toast(`Compte « ${res.data.name} » supprimé.`, { action: { label: 'Annuler', run: () => { state.accounts.push(res.data); commit(); if (els.dlgAccounts.open) renderAccounts(); } } });
  }
});

els.accTransferForm.addEventListener('submit', guard(() => {
  const res = addTransaction({ type: 'transfer', accountId: els.accTransferFrom.value, toAccountId: els.accTransferTo.value, amount: parseAmount(els.accTransferAmount.value), date: els.accTransferDate.value, note: 'Virement' });
  if (!res.ok) return showError(els.accError, res.error);
  hideError(els.accError);
  els.accTransferAmount.value = '';
  renderAccounts();
  const t = res.data;
  toast(`Virement de ${money(t.amount)} enregistré.`, { action: { label: 'Annuler', run: () => { deleteTransaction(t.id); if (els.dlgAccounts.open) renderAccounts(); } } });
}));

els.accNewForm.addEventListener('submit', guard(() => {
  const raw = els.accNewBalance.value.trim();
  const res = addAccount({ name: els.accNewName.value, kind: els.accNewKind.value, balance: raw === '' ? null : (parseAmount(raw) ?? undefined) });
  if (!res.ok) return showError(els.accError, res.error);
  hideError(els.accError);
  els.accNewName.value = '';
  els.accNewBalance.value = '';
  els.accNewBox.open = false;
  renderAccounts();
  toast(`Compte « ${res.data.name} » ajouté.`);
}));
els.menuAccounts.addEventListener('click', openAccounts);

// ——— Abonnements repérés, calendrier, raccourcis ———
export function openSubs() {
  renderSubs();
  openDialog(els.dlgSubs);
}
export function subRow(s, i, { check = false } = {}) {
  const env = spendEnv(s.envId);
  return h('div', { class: 'sub-row', dataset: { i: String(i) } },
    check ? h('input', { type: 'checkbox', class: 'sub-check', checked: true, 'aria-label': `Ajouter ${s.label} à l'échéancier` }) : null,
    h('span', { class: 'sub-main' }, h('strong', { text: s.label }),
      h('small', { text: `${money(s.amount)} ${FREQS[s.freq].per} · ${s.count} fois, dernier le ${shortDate(s.last)}${env ? ` · ${env.name}` : ''}` })),
    check ? null : h('button', { type: 'button', class: 'btn ghost compact sub-add' }, icon('plus'), 'Ajouter'));
}
export function renderSubs() {
  const subs = detectSubscriptions();
  els.subsList._subs = subs;
  fill(els.subsList, subs.length
    ? subs.map((s, i) => subRow(s, i))
    : h('p', { class: 'muted', text: 'Aucun paiement régulier non prévu trouvé. Importe quelques mois de relevé bancaire pour en repérer.' }));
  flushIcons();
}
els.subsList.addEventListener('click', (e) => {
  const b = e.target.closest('.sub-add');
  if (!b) return;
  const s = els.subsList._subs[Number(b.closest('.sub-row').dataset.i)];
  const res = addSubscription(s);
  if (!res.ok) return toast(res.error, 'error');
  renderSubs();
  toast(`« ${s.label} » ajouté à l'échéancier (${FREQS[s.freq].label.toLowerCase()}).`, { action: { label: 'Annuler', run: () => undoRule(res.data.id) } });
});

export function exportIcs() {
  const { text, count } = buildIcs();
  if (!count) return toast('Aucune échéance à exporter pour l\'instant.', 'error');
  download(new Blob([text], { type: 'text/calendar;charset=utf-8' }), 'budgetfold-echeances.ics');
  toast(`${count} ${plural(count, 'échéance exportée', 'échéances exportées')} : ouvre le fichier pour les ajouter à ton calendrier.`);
}
els.recDetect.addEventListener('click', openSubs);
els.recIcs.addEventListener('click', exportIcs);
els.shortcutIcs.addEventListener('click', exportIcs);
els.menuShortcut.addEventListener('click', () => {
  els.shortcutUrl.value = `${location.origin}${location.pathname}#add`;
  closeDialog(els.dlgMenu);
  openDialog(els.dlgShortcut);
});
els.shortcutCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.shortcutUrl.value);
    toast('Lien copié.');
  } catch {
    els.shortcutUrl.select();
    toast('Sélectionne le lien et copie-le.', 'error');
  }
});

// Rappel à l'ouverture : une fois par jour, ce qui tombe demain.
export function remindDue() {
  const today = clock.today();
  if (state.prefs.lastReminder === today || !state.prefs.onboarded) return;
  state.prefs.lastReminder = today;
  save();
  const due = upcomingEvents(1).filter((e) => e.amount < 0 && e.freq !== 'day');
  if (!due.length) return;
  const total = due.reduce((s, e) => s - e.amount, 0);
  toast(`Demain : ${due.slice(0, 3).map((e) => `${e.label} (${money(-e.amount)})`).join(', ')}${due.length > 3 ? '…' : ''} · ${money(total)} au total.`, { duration: 6000 });
}

// ——— Bilan : heures, santé du budget, suggestions, rapports ———
export function renderHours(key) {
  const slots = spendingHours(key);
  const max = Math.max(1, ...slots.map((s) => s.total));
  if (!slots.some((s) => s.n)) return null;
  return h('div', { class: 'hours' },
    h('h4', { text: 'Tes heures de dépense' }),
    slots.map((s) => h('div', { class: 'hour-row' },
      h('span', { text: s.label }),
      h('span', { class: 'hour-bar' }, h('i', { style: `width:${Math.round((s.total / max) * 100)}%` })),
      h('small', { text: s.n ? `${money(s.total)} · ${s.n}` : '—' }))),
    h('p', { class: 'muted small', text: 'D\'après l\'heure de saisie des dépenses notées le jour même.' }));
}

export function renderHealth(key) {
  const hs = healthScore(key);
  const history = monthlyReport(6).map((m) => {
    const c = state.closings.find((x) => x.key === m.key);
    return { key: m.key, score: c && Number.isFinite(c.snapshot.health) ? c.snapshot.health : m.health };
  });
  fill(els.rHealth,
    h('div', { class: 'health-head' },
      h('div', { class: 'health-score', dataset: { level: hs.score >= 80 ? 'top' : hs.score >= 60 ? 'good' : hs.score >= 40 ? 'mid' : 'low' } },
        h('strong', { text: String(hs.score) }), h('small', { text: '/100' })),
      h('div', {}, h('h3', { text: `Santé du budget : ${hs.label.toLowerCase()}` }), h('p', { class: 'muted small', text: 'Un repère pour progresser, calculé sur six points. Touche un point pour le conseil.' }))),
    h('ul', { class: 'health-factors' }, hs.factors.map((f) => h('li', { dataset: { full: String(f.points === f.max) } },
      h('details', {}, h('summary', {}, h('span', { text: f.label }), h('b', { text: `${f.points}/${f.max}` })), h('p', { class: 'muted small', text: f.tip }))))),
    history.length > 1 ? h('div', { class: 'health-trend', 'aria-label': 'Évolution du score' },
      history.map((m) => h('div', { class: 'ht-col', title: `${monthName(m.key)} : ${m.score}/100` },
        h('span', { class: 'ht-bar' }, h('i', { style: `height:${m.score}%` })), h('small', { text: monthShort(m.key) })))) : null);
}

export function renderSuggestions(key) {
  const isNow = key === currentMonth();
  const items = [];
  if (isNow) {
    for (const s of envelopeSuggestions()) items.push({ icon: s.kind === 'over' ? 'trending-up' : 'trending-down', text: s.text, action: { label: `Passer à ${moneyRound(s.to)}`, run: `budget:${s.env.id}:${s.to}` } });
    if (state.closings.length < 3) items.push({ icon: 'hourglass', text: `Encore ${3 - state.closings.length} ${plural(3 - state.closings.length, 'mois clôturé', 'mois clôturés')} et BudgetFold te proposera des budgets ajustés à tes vraies dépenses.` });
    const subs = subscriptionsCost();
    if (subs.list.length) {
      items.push({ icon: 'repeat', text: `Tes abonnements coûtent ${moneyRound(subs.total)} par an : ${subs.list.slice(0, 3).map((x) => `${x.rule.label} ${moneyRound(x.yearly)}`).join(', ')}${subs.list.length > 3 ? '…' : ''}.` });
      for (const x of subs.list.filter((y) => y.old).slice(0, 2)) items.push({ icon: 'circle-help', text: `« ${x.rule.label} » depuis plus de 6 mois (${moneyRound(x.yearly)}/an) : tu t'en sers toujours ?`, action: { label: 'Arrêter', run: `stop:${x.rule.id}` } });
    }
    const streak = noSpendStreak();
    if (streak.best >= 2) items.push({ icon: 'flame', text: streak.current >= 1 ? `${streak.current} ${plural(streak.current, 'jour', 'jours')} sans dépense d'affilée (hors prélèvements). Ton record sur 60 jours : ${streak.best}.` : `Ton record de jours sans dépense sur 60 jours : ${streak.best}. Prochain défi : le battre !` });
  }
  const d = derive(key);
  if (d.income > 0) {
    const sp = splitNeeds(d);
    items.push({ icon: 'chart-pie', text: `Besoins ${sp.pNeeds} % · envies ${sp.pWants} % · épargne et marge ${sp.pSavings} % de tes revenus. Repère indicatif : 50/30/20. Taux d'épargne du mois : ${sp.rate} %.` });
  }
  fill(els.rSuggest, h('h3', { text: 'Suggestions' }), items.map((it) => h('div', { class: 'note-line suggest' },
    icon(it.icon), h('span', { text: it.text }),
    it.action ? h('button', { type: 'button', class: 'btn ghost compact', dataset: { run: it.action.run } }, it.action.label) : null)));
  flushIcons();
}

els.rSuggest.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-run]');
  if (!b) return;
  const [kind, id, value] = b.dataset.run.split(':');
  if (kind === 'budget') {
    const env = spendEnv(id);
    if (!env) return;
    const before = env.max;
    const res = updateEnvelope(id, { name: env.name, max: Number(value), period: env.period });
    if (!res.ok) return toast(res.error, 'error');
    toast(`« ${env.name} » passe à ${money(Number(value))}.`, { action: { label: 'Annuler', run: () => updateEnvelope(id, { name: env.name, max: before, period: env.period }) } });
  } else if (kind === 'stop') {
    const rule = findRule(id);
    if (!rule) return;
    const ok2 = await confirmAction({ title: `Arrêter « ${rule.label} » ?`, text: 'Les paiements déjà passés restent dans ton journal. Pense aussi à résilier l\'abonnement chez le fournisseur.', confirmLabel: 'Arrêter', danger: true });
    if (ok2 && deleteRule(id).ok) toast('Abonnement retiré de l\'échéancier.', { action: { label: 'Annuler', run: () => { state.recurring.push(rule); commit(); } } });
  }
});

// Rapports : par enveloppe, revenus contre dépenses, épargne cumulée, patrimoine.
export const REPORTS = [['env', 'Par enveloppe'], ['flow', 'Revenus et dépenses'], ['savings', 'Épargne cumulée'], ['worth', 'Patrimoine']];
export function renderReports() {
  const view = ui.reportView || 'env';
  const months = monthlyReport(6);
  const bars = (rows, max) => h('div', { class: 'rep-bars' }, rows.map((r) => h('div', { class: 'rep-col', title: r.title },
    h('span', { class: 'rep-stack' }, r.parts.map((p) => h('i', { class: `rep-${p.cls}`, style: `height:${max > 0 ? Math.round((Math.max(0, p.v) / max) * 100) : 0}%` }))),
    h('small', { text: r.label }))));
  let body;
  if (view === 'env') {
    const names = [...new Map(months.flatMap((m) => m.byEnv.map((x) => [x.id, x.name]))).entries()];
    body = h('div', { class: 'rep-table' },
      h('div', { class: 'rep-tr rep-th' }, h('span', { text: 'Enveloppe' }), months.map((m) => h('span', { text: monthShort(m.key) }))),
      names.map(([id, name]) => h('div', { class: 'rep-tr' }, h('span', { text: name }), months.map((m) => {
        const x = m.byEnv.find((y) => y.id === id);
        return h('span', { text: x && x.spent ? moneyRound(x.spent) : '—' });
      }))));
  } else if (view === 'flow') {
    const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.spent)));
    body = [bars(months.map((m) => ({ label: monthShort(m.key), title: `${monthName(m.key)} : revenus ${money(m.income)}, dépenses ${money(m.spent)}`, parts: [{ cls: 'in', v: m.income }, { cls: 'out', v: m.spent }] })), max),
      h('ul', { class: 'chart-legend' }, h('li', {}, h('i', { class: 'dot dot-income' }), 'Revenus'), h('li', {}, h('i', { class: 'dot dot-spent' }), 'Dépenses'))];
  } else if (view === 'savings') {
    const max = Math.max(1, ...months.map((m) => m.cumul));
    body = [bars(months.map((m) => ({ label: monthShort(m.key), title: `${monthName(m.key)} : ${money(m.cumul)} cumulés`, parts: [{ cls: 'save', v: m.cumul }] })), max),
      h('p', { class: 'muted small', text: `Mis de côté depuis ${monthName(months[0].key).toLowerCase()} : ${money(months[months.length - 1].cumul)} (mises et versements sur tes projets).` })];
  } else {
    const accs = state.accounts.map((a) => ({ a, bal: accountBalance(a) }));
    const known = accs.filter((x) => x.bal !== null);
    const total = known.reduce((s, x) => s + x.bal, 0);
    const projects = state.envelopes.filter((e) => e.kind === 'project').reduce((s, e) => s + e.saved, 0);
    body = h('div', { class: 'worth' },
      h('div', { class: 'tile tile-hero' }, h('span', { text: 'Patrimoine (soldes de tes comptes)' }), h('strong', { text: known.length ? money(total) : 'Inconnu' })),
      accs.map((x) => h('div', { class: 'fc-line' }, h('span', { text: x.a.name }), h('b', { text: x.bal === null ? 'solde inconnu' : money(x.bal) }))),
      h('div', { class: 'fc-line' }, h('span', { text: 'Dont mis de côté pour tes projets' }), h('b', { text: money(projects) })),
      h('p', { class: 'muted small', text: known.length < accs.length ? 'Renseigne le solde de chaque compte (menu › Comptes) pour un patrimoine complet.' : 'Tes projets sont des enveloppes virtuelles à l\'intérieur de tes comptes : ils ne s\'ajoutent pas aux soldes.' }));
  }
  fill(els.rReports,
    h('h3', { text: 'Rapports' }),
    h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Choisir le rapport' }, REPORTS.map(([k, label]) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(view === k), dataset: { report: k } }, h('span', { text: label })))),
    h('div', { class: 'rep-body' }, body));
}
els.rReports.addEventListener('click', (e) => {
  const b = e.target.closest('[data-report]');
  if (!b) return;
  ui.reportView = b.dataset.report;
  renderReports();
});

// ——— Micro-entreprise : bilan pro et seuils ———
export function proThresholds(year) {
  const pro = state.prefs.pro;
  const ca = proRevenue(year);
  return [['Plafond de chiffre d\'affaires', pro.ceiling], ['Franchise de TVA', pro.vatThreshold]]
    .filter(([, limit]) => limit > 0)
    .map(([label, limit]) => ({ label, limit, ca, ratio: ca / limit }));
}

export function renderProCard(d, key) {
  const pro = state.prefs.pro;
  els.rPro.hidden = !pro.enabled;
  if (!pro.enabled) return;
  const year = key.slice(0, 4);
  const from = cycleStart(key);
  const to = cycleEnd(key);
  const costs = state.transactions.reduce((s, t) => s + (t.type === 'expense' && t.pro && t.date >= from && t.date <= to ? t.amount : 0), 0);
  fill(els.rPro,
    h('h3', { text: 'Micro-entreprise' }),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', { text: 'Chiffre d\'affaires du mois' }), h('strong', { text: money(d.proIncome) })),
      h('div', { class: 'tile' }, h('span', { text: `Cotisations à mettre de côté (${bpText(pro.rateBp) || '0'} %)` }), h('strong', { text: money(d.provision) })),
      h('div', { class: 'tile' }, h('span', { text: `Chiffre d'affaires ${year}` }), h('strong', { text: money(proRevenue(year)) })),
      h('div', { class: 'tile' }, h('span', { text: 'Frais pro du mois' }), h('strong', { text: money(costs) }))),
    proThresholds(year).map((t) => h('div', { class: 'bar-row', dataset: { state: t.ratio >= 1 ? 'over' : t.ratio >= 0.9 ? 'tight' : 'safe' } },
      h('div', { class: 'bar-row-head' }, h('span', { text: t.label }), h('strong', { text: `${money(t.ca)} / ${money(t.limit)}` })),
      h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.min(100, t.ratio * 100)}%` })))),
    pro.rateBp ? null : h('p', { class: 'muted small', text: 'Indique ton taux de cotisations dans Réglages pour les mettre de côté automatiquement.' }));
}

// ——— Règles de classement ———
export function openRules() {
  const envs = state.envelopes.filter((e) => e.kind === 'spend');
  fill(els.ruleEnv, envs.map((e) => h('option', { value: e.id, text: e.name })));
  hideError(els.ruleError);
  renderRules2();
  closeDialog(els.dlgMenu);
  openDialog(els.dlgRules);
}

export function renderRules2() {
  const envs = state.envelopes.filter((e) => e.kind === 'spend');
  const rules = state.rules.filter((r) => spendEnv(r.envId));
  fill(els.ruleList, rules.length
    ? rules.map((r) => h('div', { class: 'rule-row', dataset: { key: r.key } },
      h('span', { class: 'rule-if', text: 'Si contient' }),
      h('input', { type: 'text', class: 'rule-edit-key', value: r.key, maxlength: '40', 'aria-label': `Texte de la règle ${r.key}` }),
      h('span', { class: 'rule-then', 'aria-hidden': 'true' }, icon('arrow-right')),
      h('div', { class: 'select-wrap' }, h('select', { class: 'rule-edit-env', 'aria-label': `Enveloppe pour ${r.key}` }, envs.map((e) => h('option', { value: e.id, text: e.name })))),
      r.source === 'user' ? null : h('em', { class: 'tag-planned', text: 'Apprise' }),
      h('button', { type: 'button', class: 'icon-btn small rule-del', 'aria-label': `Supprimer la règle ${r.key}` }, icon('trash-2'))))
    : h('p', { class: 'muted', text: 'Aucune règle pour l\'instant. Classe quelques dépenses, ou ajoute une règle ci-dessus.' }));
  els.ruleList.querySelectorAll('.rule-row').forEach((row) => { row.querySelector('.rule-edit-env').value = state.rules.find((r) => r.key === row.dataset.key).envId; });
  flushIcons();
}

els.ruleForm.addEventListener('submit', guard(() => {
  const res = saveCatRule({ key: els.ruleKey.value, envId: els.ruleEnv.value });
  if (!res.ok) return showError(els.ruleError, res.error);
  hideError(els.ruleError);
  els.ruleKey.value = '';
  renderRules2();
}));
els.ruleList.addEventListener('change', (e) => {
  const row = e.target.closest('.rule-row');
  if (!row) return;
  const res = saveCatRule({ key: row.querySelector('.rule-edit-key').value, envId: row.querySelector('.rule-edit-env').value, previous: row.dataset.key });
  if (!res.ok) showError(els.ruleError, res.error);
  else hideError(els.ruleError);
  renderRules2();
});
els.ruleList.addEventListener('click', (e) => {
  const del = e.target.closest('.rule-del');
  if (!del) return;
  const res = deleteCatRule(del.closest('.rule-row').dataset.key);
  if (!res.ok) return;
  renderRules2();
  toast(`Règle « ${res.data.rule.key} » supprimée.`, { action: { label: 'Annuler', run: () => { state.rules.splice(res.data.index, 0, res.data.rule); commit(); if (els.dlgRules.open) renderRules2(); } } });
});
els.menuRules.addEventListener('click', openRules);

// ——— Exports zip ———
export function openProofs() {
  const key = currentMonth();
  els.proofsFrom.value = cycleStart(key);
  els.proofsTo.value = cycleEnd(key);
  els.proofsProField.hidden = !state.prefs.pro.enabled;
  els.proofsPro.checked = state.prefs.pro.enabled;
  hideError(els.proofsError);
  updateProofsHint();
  closeDialog(els.dlgMenu);
  openDialog(els.dlgProofs);
}
export function updateProofsHint() {
  const from = els.proofsFrom.value;
  const to = els.proofsTo.value;
  if (!isISO(from) || !isISO(to) || to < from) return setHint(els.proofsHint, 'Choisis une période valide.', 'bad');
  const proOnly = !els.proofsProField.hidden && els.proofsPro.checked;
  const txs = state.transactions.filter((t) => (t.type === 'expense' || t.type === 'income') && t.date >= from && t.date <= to && (!proOnly || t.pro));
  const photos = txs.reduce((s, t) => s + (t.photos || []).length, 0);
  setHint(els.proofsHint, `${txs.length} ${plural(txs.length, 'opération', 'opérations')}, ${photos} ${plural(photos, 'justificatif', 'justificatifs')}.`, 'ok');
}
[els.proofsFrom, els.proofsTo, els.proofsPro].forEach((el) => el.addEventListener('change', updateProofsHint));
els.proofsForm.addEventListener('submit', guard(async () => {
  const from = els.proofsFrom.value;
  const to = els.proofsTo.value;
  if (!isISO(from) || !isISO(to) || to < from) return showError(els.proofsError, 'Choisis une période valide.');
  try {
    const res = await proofsZip({ from, to, proOnly: !els.proofsProField.hidden && els.proofsPro.checked });
    download(res.blob, `justificatifs-${from}-au-${to}.zip`);
    closeDialog(els.dlgProofs);
    toast(`Export prêt : ${res.count} ${plural(res.count, 'opération', 'opérations')}, ${res.photos} ${plural(res.photos, 'justificatif', 'justificatifs')}.`);
  } catch {
    showError(els.proofsError, 'Export impossible : les photos ne sont pas accessibles sur cet appareil.');
  }
}));
els.menuProofs.addEventListener('click', openProofs);
els.menuBackup.addEventListener('click', async () => {
  closeDialog(els.dlgMenu);
  try {
    download(await fullBackupZip(), `budgetfold-${clock.today()}.zip`);
    state.prefs.lastExport = clock.today();
    commit();
    toast('Sauvegarde complète exportée (données et photos).');
  } catch {
    toast('Sauvegarde impossible : les photos ne sont pas accessibles sur cet appareil.', 'error');
  }
});

// ——— Clôture du mois ———
export const closeUi = { key: null, choice: null };
export const closeValue = (c) => (c.action === 'project' ? `project:${c.projectId}` : c.action);
export const parseCloseValue = (v) => (v.startsWith('project:') ? { action: 'project', projectId: v.slice(8) } : { action: v === 'budget' ? 'budget' : 'keep', projectId: null });
export const savingTargets = () => state.envelopes.filter((e) => e.kind === 'project' && (e.safety || !projectDone(e)))
  .sort((a, b) => Number(Boolean(b.safety)) - Number(Boolean(a.safety)));

export function openClosing(key = pendingClosings()[0]) {
  if (!key) return;
  closeUi.key = key;
  closeUi.choice = closingDefaults(key);
  const d = derive(key);
  const pending = pendingClosings();
  els.closeTitle.textContent = `Clôture ${ofMonth(key)}`;
  els.closeSub.textContent = `${periodLabel(key)} est terminé${pending.length > 1 ? ` (encore ${pending.length - 1} ${plural(pending.length - 1, 'mois', 'mois')} après celui-ci)` : ''}. Que faire de ce qui reste ?`;
  const spent = state.transactions.filter((t) => t.type === 'expense' && inCycle(t.date, key)).reduce((s, t) => s + t.amount, 0);
  fill(els.closeTiles,
    h('div', { class: 'tile' }, h('span', { text: 'Reçu' }), h('strong', { text: money(d.income) })),
    h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(spent) })),
    h('div', { class: 'tile', dataset: { negative: String(d.free < 0) } }, h('span', { text: d.free < 0 ? 'Déficit' : 'Non réparti' }), h('strong', { text: money(d.free) })));
  setRadio(els.closeForm, 'close-all', state.prefs.closing.env);
  els.closeAuto.checked = state.prefs.closing.auto;
  hideError(els.closeError);
  renderClosingList();
  openDialog(els.dlgClose);
}

export function renderClosingList() {
  const key = closeUi.key;
  const next = monthName(shiftMonth(key, 1)).toLowerCase();
  const d = derive(key);
  const targets = savingTargets();
  const select = (id, value, withKeep, label) => h('select', { class: 'close-select', dataset: { line: id }, 'aria-label': label },
    withKeep ? h('option', { value: 'keep', text: 'Reporter dans l\'enveloppe' }) : null,
    h('option', { value: 'budget', text: `Remettre au budget de ${next}` }),
    targets.map((p) => h('option', { value: `project:${p.id}`, text: `Verser sur « ${p.name} »` })));
  const rows = closableRows(key).map((r) => {
    const c = closeUi.choice.lines[r.env.id];
    const tone = r.left >= 0 ? 'ok' : 'bad';
    const status = r.left > 0 ? `${money(r.left)} restants` : r.left === 0 ? 'Tout juste' : `Dépassée de ${money(-r.left)}`;
    return h('div', { class: 'close-row', dataset: { tone } },
      h('div', { class: 'close-main' },
        h('strong', {}, r.env.name, r.left >= 0 ? h('em', { class: 'badge', dataset: { tone: 'ok' }, text: 'Bien tenu' }) : null),
        h('small', { text: `${money(r.used)} dépensés sur ${money(r.budget)} · ${status}` })),
      r.left > 0
        ? select(r.env.id, closeValue(c), true, `Que faire du reste de ${r.env.name}`)
        : h('span', { class: 'close-note', text: r.left < 0 ? 'Déjà pris sur ton reste à vivre' : 'Rien à reporter' }));
  });
  let freeRow = null;
  if (d.free > 0) {
    freeRow = h('div', { class: 'close-row', dataset: { tone: 'ok' } },
      h('div', { class: 'close-main' }, h('strong', { text: 'Reste à vivre non réparti' }), h('small', { text: `${money(d.free)} jamais attribués à une enveloppe` })),
      select('__free__', closeUi.choice.freeAction === 'project' ? `project:${closeUi.choice.freeProjectId}` : 'budget', false, 'Que faire du reste à vivre'));
  } else if (d.free < 0) {
    freeRow = h('div', { class: 'close-row', dataset: { tone: 'bad' } },
      h('div', { class: 'close-main' }, h('strong', { text: 'Déficit du mois' }), h('small', { text: `${money(-d.free)} retirés du reste à vivre de ${next}.` })));
  }
  fill(els.closeList, rows.length || freeRow ? [rows, freeRow] : h('p', { class: 'muted', text: 'Aucune enveloppe au mois à clôturer.' }));
  els.closeList.querySelectorAll('select').forEach((s) => {
    s.value = s.dataset.line === '__free__'
      ? closeUi.choice.freeAction === 'project' ? `project:${closeUi.choice.freeProjectId}` : 'budget'
      : closeValue(closeUi.choice.lines[s.dataset.line]);
  });
  updateClosingHint();
  flushIcons();
}

export function updateClosingHint() {
  const key = closeUi.key;
  const next = monthName(shiftMonth(key, 1)).toLowerCase();
  let keep = 0;
  let budget = 0;
  let saved = 0;
  for (const r of closableRows(key)) {
    if (r.left <= 0) continue;
    const c = closeUi.choice.lines[r.env.id];
    if (c.action === 'keep') keep += r.left;
    else if (c.action === 'budget') budget += r.left;
    else saved += r.left;
  }
  const free = derive(key).free;
  if (free > 0 && closeUi.choice.freeAction === 'project') saved += free;
  else budget += free;
  const bits = [keep ? `${money(keep)} restent dans tes enveloppes` : null, budget > 0 ? `+${money(budget)} sur ton reste à vivre` : budget < 0 ? `${money(budget)} sur ton reste à vivre` : null, saved ? `${money(saved)} épargnés` : null].filter(Boolean);
  setHint(els.closeHint, bits.length ? `En ${next} : ${bits.join(', ')}.` : 'Rien à reporter : le mois est clôturé tel quel.', budget < 0 ? 'bad' : 'ok');
}

els.closeAll.addEventListener('change', () => {
  const action = checkedValue(els.closeForm, 'close-all');
  const target = savingTargets()[0];
  for (const id of Object.keys(closeUi.choice.lines)) {
    closeUi.choice.lines[id] = action === 'project' && target ? { action, projectId: target.id } : { action: action === 'project' ? 'budget' : action, projectId: null };
  }
  if (action === 'project' && target) Object.assign(closeUi.choice, { freeAction: 'project', freeProjectId: target.id });
  else Object.assign(closeUi.choice, { freeAction: 'budget', freeProjectId: null });
  renderClosingList();
});

els.closeList.addEventListener('change', (e) => {
  const s = e.target.closest('select');
  if (!s) return;
  const v = parseCloseValue(s.value);
  if (s.dataset.line === '__free__') Object.assign(closeUi.choice, { freeAction: v.action === 'project' ? 'project' : 'budget', freeProjectId: v.projectId });
  else closeUi.choice.lines[s.dataset.line] = v;
  updateClosingHint();
});

els.closeLater.addEventListener('click', () => closeDialog(els.dlgClose));

els.closeForm.addEventListener('submit', guard(() => {
  const key = closeUi.key;
  const res = closeMonth(key, closeUi.choice);
  if (!res.ok) return showError(els.closeError, res.error);
  const global = checkedValue(els.closeForm, 'close-all');
  Object.assign(state.prefs.closing, {
    env: CLOSE_ACTIONS.includes(global) ? global : state.prefs.closing.env,
    free: closeUi.choice.freeAction,
    projectId: closeUi.choice.freeProjectId || Object.values(closeUi.choice.lines).map((l) => l.projectId).find(Boolean) || state.prefs.closing.projectId,
    auto: els.closeAuto.checked
  });
  commit();
  closeDialog(els.dlgClose);
  toast(`${capitalize(monthName(key).toLowerCase())} est clôturé : l'instantané est dans Bilan › Historique.`, {
    action: { label: 'Annuler', run: () => { reopenMonth(key); commit(); toast('Clôture annulée.'); } }
  });
  if (pendingClosings().length && !state.prefs.closing.auto) setTimeout(() => openClosing(), 450);
  else if (pendingClosings().length) {
    for (const k of pendingClosings()) closeMonth(k);
    commit();
  }
}));

// ——— Déplacer de l'argent ———
export function moveOptions(select, value) {
  const key = currentMonth();
  const d = derive(key);
  fill(select,
    h('option', { value: 'free', text: `Reste à vivre (${money(d.free)})` }),
    d.spend.filter((r) => r.env.period !== 'week' && r.env.period !== '2weeks')
      .map((r) => h('option', { value: r.env.id, text: `${r.env.name} (${r.left < 0 ? '−' : ''}${money(Math.abs(r.left))})` })));
  select.value = value;
}

export function openMove({ from = null, to = null } = {}) {
  const envs = derive().spend.filter((r) => r.env.period !== 'week' && r.env.period !== '2weeks');
  if (!envs.length) return toast('Crée d\'abord une enveloppe au mois (ou plus) pour y déplacer de l\'argent.', 'error');
  const target = to || (from ? 'free' : envs[0].env.id);
  const source = from || (to ? (envs.filter((r) => r.env.id !== to && r.left > 0).sort((a, b) => b.left - a.left)[0] || { env: { id: 'free' } }).env.id : 'free');
  moveOptions(els.moveFrom, source);
  moveOptions(els.moveTo, target);
  const toRow = to && envs.find((r) => r.env.id === to);
  els.moveAmount.value = toRow && toRow.left < 0 ? toInputValue(-toRow.left) : '';
  hideError(els.moveError);
  updateMoveHint();
  closeDialog(els.dlgEnv);
  openDialog(els.dlgMove);
  requestAnimationFrame(() => els.moveAmount.focus());
}

export function updateMoveHint() {
  const amount = parseAmount(els.moveAmount.value);
  const name = (v) => (v === 'free' ? 'ton reste à vivre' : `« ${(spendEnv(v) || {}).name} »`);
  if (els.moveFrom.value === els.moveTo.value) return setHint(els.moveHint, 'Choisis deux endroits différents.', 'bad');
  if (!amount) return setHint(els.moveHint, `De ${name(els.moveFrom.value)} vers ${name(els.moveTo.value)}, pour ${monthName(currentMonth()).toLowerCase()}.`);
  return setHint(els.moveHint, `${money(amount)} passent de ${name(els.moveFrom.value)} à ${name(els.moveTo.value)}.`, 'ok');
}

[els.moveAmount, els.moveFrom, els.moveTo].forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
  hideError(els.moveError);
  updateMoveHint();
}));

els.moveForm.addEventListener('submit', guard(() => {
  const res = moveMoney({ from: els.moveFrom.value, to: els.moveTo.value, amount: parseAmount(els.moveAmount.value) });
  if (!res.ok) return showError(els.moveError, res.error);
  closeDialog(els.dlgMove);
  const m = res.data;
  const name = (v) => (v === 'free' ? 'reste à vivre' : (spendEnv(v) || {}).name);
  toast(`${money(m.amount)} déplacés : ${name(m.from)} → ${name(m.to)}.`, { action: { label: 'Annuler', run: () => { if (deleteMove(m.id).ok) toast('Déplacement annulé.'); } } });
}));

els.envMove.addEventListener('click', () => {
  const env = spendEnv(envUi.id);
  if (!env) return;
  const row = envRow(env, currentMonth());
  openMove(row.left < 0 ? { to: env.id } : { from: env.id });
});

els.menuResetAll.addEventListener('click', async () => {
  closeDialog(els.dlgMenu);
  const confirmed = await confirmAction({
    title: 'Tout remettre à zéro ?',
    text: 'Toutes tes enveloppes repartent pleines dès aujourd\'hui. Les dépenses déjà faites restent dans le journal et sont prises sur ton reste à vivre.',
    confirmLabel: 'Tout remettre à zéro'
  });
  if (!confirmed) return;
  const res = resetAllEnvelopes();
  if (!res.ok) return toast(res.error, 'error');
  toast('Toutes les enveloppes repartent à zéro.', { action: { label: 'Annuler', run: () => {
    for (const [id, prev] of res.data) { const e = findEnv(id); if (e) e.reset = prev; }
    commit();
  } } });
});

// ——— Ordre du mois (agenda) ———
export function renderOrder(key) {
  const d = derive(key);
  const pays = payDates(key);
  const payDay = pays.length ? `le ${shortDate(pays[0])}` : '';
  const nCharges = state.recurring.filter((r) => r.type === 'expense' && !spendEnv(r.envId)).reduce((s, r) => s + occurrences(r, cycleStart(key), cycleEnd(key)).length, 0);
  const steps = [
    ['banknote', 'Paie', payDay, d.income, d.carried ? `dont ${signed(d.carried)} reportés du mois dernier` : d.extraIncome ? `dont ${money(d.extraIncome)} d'autres revenus` : ''],
    ['piggy-bank', 'Épargne des projets', payDay ? `${payDay}, dès la paie` : 'dès la paie', -(d.projectsMonthly + d.deposits), ''],
    ['repeat', 'Prélèvements', nCharges ? `${nCharges} ${plural(nCharges, 'échéance', 'échéances')}` : 'aucun', -d.charges, ''],
    ['wallet', 'Enveloppes', 'au fil du mois', -(d.envAlloc + d.orphan), d.orphan ? `dont ${money(d.orphan)} hors enveloppe` : ''],
    ['sparkles', 'Reste', 'en fin de mois', d.free, d.free < 0 ? 'à retirer du mois suivant' : '']
  ];
  fill(els.orderList, steps.map(([ic, title, when, amount, sub], i) => h('li', { class: 'order-step', dataset: { last: String(i === steps.length - 1), negative: String(i === steps.length - 1 && amount < 0) } },
    h('span', { class: 'order-dot', 'aria-hidden': 'true' }, icon(ic)),
    h('span', { class: 'order-body' }, h('strong', { text: title }), h('small', { text: [when, sub].filter(Boolean).join(' · ') })),
    h('b', { class: 'order-amount', text: i === steps.length - 1 ? money(amount) : signed(amount) }))));
}

// ——— Historique (bilan) ———
export function renderHistory() {
  const range = ui.historyRange || 3;
  const all = [...state.closings].sort((a, b) => (a.key < b.key ? 1 : -1));
  if (!all.length) {
    fill(els.rHistory, h('div', { class: 'empty' },
      h('span', { class: 'empty-icon', 'aria-hidden': 'true' }, icon('history')),
      h('h3', { text: 'Pas encore d\'historique' }),
      h('p', { text: 'À la fin de chaque mois, la clôture fige un instantané ici : revenus, dépenses par enveloppe, reste et où il est allé. Il n\'est plus jamais modifié ensuite.' })));
    return flushIcons();
  }
  const list = all.slice(0, range);
  const avg = (f) => Math.round(list.reduce((s, c) => s + f(c.snapshot), 0) / list.length);
  const names = new Map();
  for (const c of [...list].reverse()) {
    for (const e of c.snapshot.envs || []) {
      if (!names.has(e.id)) names.set(e.id, { name: e.name, months: [] });
      names.get(e.id).months.push({ key: c.key, spent: e.spent, budget: e.budget });
    }
  }
  const trends = [...names.values()].map((t) => {
    const avgSpent = Math.round(t.months.reduce((s, m) => s + m.spent, 0) / t.months.length);
    const last = t.months[t.months.length - 1];
    const kept = t.months.filter((m) => m.spent <= m.budget).length;
    const delta = avgSpent > 0 ? Math.round(((last.spent - avgSpent) / avgSpent) * 100) : 0;
    const peak = Math.max(1, ...t.months.map((m) => Math.max(m.spent, m.budget)));
    return h('div', { class: 'trend-row' },
      h('div', { class: 'trend-main' }, h('strong', { text: t.name }),
        h('small', { text: `${money(avgSpent)} en moyenne · bien tenu ${kept}/${t.months.length} mois${t.months.length > 1 && Math.abs(delta) >= 10 ? ` · dernier mois ${delta > 0 ? '+' : ''}${delta} %` : ''}` })),
      h('span', { class: 'spark', 'aria-hidden': 'true' }, t.months.map((m) => h('i', { dataset: { over: String(m.spent > m.budget) }, style: `height:${Math.max(6, Math.round((m.spent / peak) * 100))}%` }))));
  });
  const destination = (c) => {
    const bits = [];
    const keep = c.lines.filter((l) => l.action === 'keep' && l.left > 0).reduce((s, l) => s + l.left, 0);
    const budget = c.lines.filter((l) => l.action === 'budget' && l.left > 0).reduce((s, l) => s + l.left, 0) + (c.free > 0 && c.freeAction === 'budget' ? c.free : 0);
    const saved = c.lines.filter((l) => l.action === 'project' && l.left > 0).reduce((s, l) => s + l.left, 0) + (c.free > 0 && c.freeAction === 'project' ? c.free : 0);
    if (keep) bits.push(`${money(keep)} reportés`);
    if (budget) bits.push(`${money(budget)} remis au budget`);
    if (saved) bits.push(`${money(saved)} épargnés`);
    if (c.free < 0) bits.push(`déficit ${money(c.free)}`);
    return bits.join(' · ') || 'rien à reporter';
  };
  const open = ui.historyOpen;
  fill(els.rHistory,
    h('div', { class: 'chips range', role: 'radiogroup', 'aria-label': 'Période comparée' }, [3, 6, 12].map((n) => h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(range === n), dataset: { range: String(n) } }, h('span', { text: `${n} mois` })))),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', { text: 'Revenus moyens' }), h('strong', { text: money(avg((s) => s.income)) })),
      h('div', { class: 'tile' }, h('span', { text: 'Dépensé en moyenne' }), h('strong', { text: money(avg((s) => s.spent)) })),
      h('div', { class: 'tile' }, h('span', { text: 'Reste moyen' }), h('strong', { text: money(avg((s) => s.free)) })),
      h('div', { class: 'tile' }, h('span', { text: 'Mis de côté' }), h('strong', { text: money(list.reduce((s, c) => s + (c.snapshot.projects || 0), 0)) }))),
    h('article', { class: 'card pad' }, h('h3', { text: 'Tendances par enveloppe' }), trends.length ? trends : h('p', { class: 'muted', text: 'Aucune enveloppe sur cette période.' })),
    h('article', { class: 'card pad' }, h('h3', { text: 'Mois clôturés' }),
      list.map((c) => h('div', { class: 'hist-month', dataset: { open: String(open === c.key) } },
        h('button', { type: 'button', class: 'hist-head', dataset: { key: c.key }, 'aria-expanded': String(open === c.key) },
          h('span', { class: 'hist-title' }, h('strong', { text: monthName(c.key) }), h('small', { text: `${money(c.snapshot.spent)} dépensés · ${destination(c)}` })),
          h('b', { dataset: { negative: String(c.snapshot.free < 0) }, text: money(c.snapshot.free) })),
        open === c.key ? h('div', { class: 'hist-detail' },
          h('p', { class: 'muted small', text: `Du ${shortDate(c.snapshot.start)} au ${shortDate(c.snapshot.end)} · revenus ${money(c.snapshot.income)} · prélèvements ${money(c.snapshot.charges)} · projets ${money(c.snapshot.projects)}` }),
          (c.snapshot.envs || []).map((e) => h('div', { class: 'hist-env', dataset: { tone: e.left >= 0 ? 'ok' : 'bad' } },
            h('span', { text: e.name }),
            h('small', { text: `${money(e.spent)} / ${money(e.budget)}` }),
            h('em', { class: 'badge', dataset: { tone: e.left >= 0 ? 'ok' : 'bad' }, text: e.left >= 0 ? 'Bien tenu' : 'Dépassée' })))) : null))));
  flushIcons();
}

// ——— Thèmes et taille du texte ———
export const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
export function applyTheme() {
  const pick = state.prefs.theme || 'auto';
  const theme = pick === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : pick;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.text = state.prefs.textLarge ? 'large' : 'normal';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', { light: '#0f172a', dark: '#0a1020', rose: '#4a1230', candy: '#5d0f37' }[theme]);
  els.setTheme.querySelectorAll('[data-theme-pick]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themePick === pick)));
}
if (darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (state.prefs.theme === 'auto') applyTheme(); });
els.setTheme.addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-pick]');
  if (!b) return;
  state.prefs.theme = b.dataset.themePick;
  applyTheme();
  save();
});
els.setTextLarge.addEventListener('change', () => {
  state.prefs.textLarge = els.setTextLarge.checked;
  applyTheme();
  save();
});
els.menuHelp.addEventListener('click', () => openHelp());
els.helpTour.addEventListener('click', () => { closeDialog(els.dlgHelp); startTour(); });
els.helpWizard.addEventListener('click', () => { closeDialog(els.dlgHelp); openWelcome(); });

export function openSettings() {
  els.setTextLarge.checked = state.prefs.textLarge;
  applyTheme();
  els.setDay.value = String(state.salaryDay);
  els.setOpening.value = state.openingBalance === null ? '' : toInputValue(state.openingBalance);
  setRadio(els.setForm, 'set-cycle', state.prefs.cycle);
  els.setCyclePayText.textContent = `Jour de paie (le ${state.salaryDay})`;
  els.setAutoClose.checked = state.prefs.closing.auto;
  const pro = state.prefs.pro;
  els.setPro.checked = pro.enabled;
  els.setProRate.value = bpText(pro.rateBp);
  els.setProCeiling.value = pro.ceiling ? toInputValue(pro.ceiling) : '';
  els.setProVat.value = pro.vatThreshold ? toInputValue(pro.vatThreshold) : '';
  els.setProBox.open = pro.enabled;
  hideError(els.setError);
  closeDialog(els.dlgMenu);
  openDialog(els.dlgSettings);
}

els.setDay.addEventListener('input', () => {
  const day = parseDayInput(els.setDay.value);
  els.setCyclePayText.textContent = day ? `Jour de paie (le ${day})` : 'Jour de paie';
});

els.setForm.addEventListener('submit', guard(() => {
  const raw = els.setOpening.value.trim();
  const opening = raw === '' ? null : (parseAmount(raw) ?? undefined);
  const optional = (el) => (el.value.trim() === '' ? null : (parseAmount(el.value) ?? undefined));
  const rate = bpOf(els.setProRate.value);
  const proRes = setProSettings({ enabled: els.setPro.checked, rateBp: rate === null || rate > 10000 ? null : rate, ceiling: optional(els.setProCeiling), vatThreshold: optional(els.setProVat) });
  if (!proRes.ok) return showError(els.setError, proRes.error);
  const res = setSettings({ salaryDay: parseDayInput(els.setDay.value), openingBalance: opening, cycle: checkedValue(els.setForm, 'set-cycle'), autoClose: els.setAutoClose.checked });
  if (!res.ok) return showError(els.setError, res.error);
  closeDialog(els.dlgSettings);
  toast('Réglages enregistrés.');
}));

export function openSalaryEdit() {
  if (ui.tab !== 'home' && window.matchMedia('(max-width: 759px)').matches) setTab('home');
  els.salaryView.hidden = true;
  els.salaryForm.hidden = false;
  hideError(els.salaryError);
  els.salaryInput.value = state.salary > 0 ? toInputValue(state.salary) : '';
  els.salaryInput.focus();
  els.salaryInput.select();
}

export function closeSalaryEdit() {
  els.salaryForm.hidden = true;
  els.salaryView.hidden = false;
  hideError(els.salaryError);
}

els.salaryEdit.addEventListener('click', openSalaryEdit);
els.salaryAmount.addEventListener('dblclick', openSalaryEdit);
els.salaryCancel.addEventListener('click', closeSalaryEdit);
els.salaryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.salary > 0) closeSalaryEdit();
});
els.salaryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const res = setSalary(parseAmount(els.salaryInput.value));
  if (!res.ok) return showError(els.salaryError, res.error);
  closeSalaryEdit();
  toast('Salaire mis à jour.');
});

// ——— Questionnaire d'installation (relançable depuis le menu) ———
export const WIZ_INCOMES = ['APL / aide au logement', 'Prime d\'activité', 'Bourse', 'Allocations familiales', 'Pension', 'Autre revenu'];
export const WIZ_CHARGES = [['Loyer / crédit', 1], ['Électricité / gaz', 5], ['Internet / box', 8], ['Téléphone', 8], ['Assurances', 10], ['Mutuelle', 10], ['Abonnement transport', 1], ['Streaming / abonnements', 15]];
export const WIZ_HABITS = ['Courses', 'Transport / essence', 'Sorties / restaurants', 'Shopping / vêtements', 'Santé / hygiène', 'Enfants', 'Animaux'];
export const WIZ_STEPS = ['Revenus', 'Aides', 'Charges fixes', 'Habitudes', 'Projets', 'Solde', 'Récapitulatif'];
export const wiz = { step: 0, data: null };

export function wizDefaults() {
  return {
    income: state.salary || null, payday: state.salaryDay || 1,
    incomes: WIZ_INCOMES.map((label) => ({ label, amount: null, day: 5 })),
    charges: WIZ_CHARGES.map(([label, day]) => ({ label, amount: null, day })),
    habits: WIZ_HABITS.map((label) => ({ label, amount: null })),
    projects: [{ name: '', target: null, deadline: '' }, { name: '', target: null, deadline: '' }, { name: '', target: null, deadline: '' }],
    balance: null
  };
}

export function openWelcome() {
  wiz.step = 0;
  wiz.data = wizDefaults();
  hideError(els.wError);
  renderWizard();
  openDialog(els.dlgWelcome);
  requestAnimationFrame(() => { const i = els.wBody.querySelector('input'); if (i) i.focus(); });
}

export const moneyField = (cls, value, label) => h('div', { class: 'money-input' }, h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: cls, value: value ? toInputValue(value) : '', placeholder: '0', 'aria-label': label }), h('span', { text: '€' }));
export const dayField = (value, label) => h('input', { type: 'text', inputmode: 'numeric', class: 'wiz-day', value: String(value), maxlength: '2', 'aria-label': label });

export function renderWizard() {
  const d = wiz.data;
  const step = wiz.step;
  fill(els.wProgress, WIZ_STEPS.map((_, i) => h('i', { dataset: { done: String(i <= step) } })));
  els.wStepLabel.textContent = `Étape ${step + 1} sur ${WIZ_STEPS.length} · ${WIZ_STEPS[step]}`;
  const intro = (title, text) => [h('h2', { id: 'welcome-title', text: title }), h('p', { class: 'muted', text })];
  let body;
  if (step === 0) {
    body = [intro(state.prefs.onboarded ? 'Questionnaire d\'installation' : 'Bienvenue sur BudgetFold', 'Quelques questions pour préparer ton budget. Tout reste sur ton appareil, et tu pourras tout modifier ensuite.'),
      h('div', { class: 'field' }, h('label', { for: 'w-income', text: 'Salaire mensuel net' }),
        h('div', { class: 'money-input large' }, h('input', { id: 'w-income', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '1 450', value: d.income ? toInputValue(d.income) : '' }), h('span', { text: '€' }))),
      h('div', { class: 'field' }, h('label', { for: 'w-payday', text: 'Jour de paie' }), h('input', { id: 'w-payday', type: 'text', inputmode: 'numeric', maxlength: '2', value: String(d.payday) })),
      h('p', { class: 'hint small-hint', text: 'Pas de salaire fixe ? Laisse 0 et indique tes revenus à l\'étape suivante.' })];
  } else if (step === 1) {
    body = [intro('Aides et autres revenus', 'Ce qui arrive chaque mois en plus du salaire. Laisse vide ce qui ne te concerne pas.'),
      h('div', { class: 'wiz-rows' }, d.incomes.map((r, i) => h('div', { class: 'wiz-row', dataset: { i: String(i), list: 'incomes' } },
        h('label', { text: r.label }), moneyField('wiz-amount', r.amount, `${r.label} : montant`), dayField(r.day, `${r.label} : jour`))))];
  } else if (step === 2) {
    body = [intro('Charges fixes', 'Ce qui est prélevé chaque mois. Le jour sert à les placer dans ton agenda.'),
      h('div', { class: 'wiz-rows' }, d.charges.map((r, i) => h('div', { class: 'wiz-row', dataset: { i: String(i), list: 'charges' } },
        h('label', { text: r.label }), moneyField('wiz-amount', r.amount, `${r.label} : montant`), dayField(r.day, `${r.label} : jour`))))];
  } else if (step === 3) {
    body = [intro('Tes habitudes', 'Combien tu veux t\'accorder par mois : chaque montant devient une enveloppe, un plafond à ne pas dépasser.'),
      h('div', { class: 'wiz-rows' }, d.habits.map((r, i) => h('div', { class: 'wiz-row two', dataset: { i: String(i), list: 'habits' } },
        h('label', { text: r.label }), moneyField('wiz-amount', r.amount, `${r.label} : budget par mois`))))];
  } else if (step === 4) {
    body = [intro('Tes projets', 'Voyage, permis, moto, apport… Ils sont créés en simulation : tu les actives quand ta marge le permet. Un matelas de sécurité est créé d\'office.'),
      h('div', { class: 'wiz-rows' }, d.projects.map((r, i) => h('div', { class: 'wiz-row', dataset: { i: String(i), list: 'projects' } },
        h('input', { type: 'text', class: 'wiz-name', maxlength: '40', value: r.name, placeholder: `Projet ${i + 1}`, 'aria-label': `Nom du projet ${i + 1}` }),
        moneyField('wiz-amount', r.target, `Objectif du projet ${i + 1}`),
        h('input', { type: 'month', class: 'wiz-month', value: r.deadline, 'aria-label': `Date du projet ${i + 1} (facultatif)` }))))];
  } else if (step === 5) {
    body = [intro('Ton solde actuel', 'Ce qu\'affiche ta banque aujourd\'hui sur ton compte courant. Facultatif, mais l\'agenda pourra t\'alerter avant un découvert.'),
      h('div', { class: 'field' }, h('label', { for: 'w-balance', text: 'Solde du compte courant' }),
        h('div', { class: 'money-input large' }, h('input', { id: 'w-balance', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Ex : 640', value: d.balance !== null ? toInputValue(Math.abs(d.balance)) : '' }), h('span', { text: '€' })))];
  } else {
    const r = wizRecap();
    body = [intro('Ton budget est prêt', 'Voici ce qui va être créé. Tu pourras tout ajuster ensuite.'),
      h('div', { class: 'wiz-recap' },
        h('div', { class: 'fc-line' }, h('span', { text: 'Revenus du mois' }), h('b', { text: `+${money(r.income)}` })),
        h('div', { class: 'fc-line' }, h('span', { text: `${r.charges.length} ${plural(r.charges.length, 'charge fixe', 'charges fixes')}` }), h('b', { text: `−${money(r.chargesTotal)}` })),
        h('div', { class: 'fc-line' }, h('span', { text: `${r.habits.length} ${plural(r.habits.length, 'enveloppe', 'enveloppes')}` }), h('b', { text: `−${money(r.habitsTotal)}` })),
        h('div', { class: 'fc-line fc-total', dataset: { negative: String(r.free < 0) } }, h('span', { text: 'Reste à vivre estimé' }), h('b', { text: money(r.free) })),
        r.projects.length ? h('p', { class: 'muted small', text: `Projets en simulation : ${r.projects.map((p) => p.name).join(', ')}.` }) : null,
        r.free < 0 ? h('p', { class: 'hint', dataset: { tone: 'bad' }, text: 'Tes charges et enveloppes dépassent tes revenus : reviens en arrière pour baisser une enveloppe, ou ajuste après.' }) : null)];
  }
  fill(els.wBody, body);
  els.wBack.hidden = step === 0;
  els.wSkip.hidden = step !== 0;
  els.wNext.textContent = step === WIZ_STEPS.length - 1 ? 'Créer mon budget' : step === 0 ? 'Continuer' : 'Suivant';
  flushIcons();
}

// Lit l'étape affichée ; renvoie un message d'erreur si une saisie est invalide.
export function readWizardStep() {
  const d = wiz.data;
  const amountOf = (input) => (input.value.trim() === '' ? null : parseAmount(input.value));
  if (wiz.step === 0) {
    const income = $id('w-income').value.trim() === '' ? 0 : parseAmount($id('w-income').value);
    const day = parseDayInput($id('w-payday').value);
    if (income === null) return 'Indique ton salaire net (ex : 1450), ou 0.';
    if (!day) return 'Indique un jour de paie entre 1 et 31.';
    Object.assign(d, { income, payday: day });
  } else if (wiz.step === 5) {
    const v = $id('w-balance').value.trim();
    if (v === '') d.balance = null;
    else {
      const b = parseAmount(v.replace(/^[-−]/, ''));
      if (b === null) return 'Indique un solde valide (ex : 640), ou laisse vide.';
      d.balance = /^[-−]/.test(v) ? -b : b;
    }
  } else if (wiz.step >= 1 && wiz.step <= 4) {
    for (const row of els.wBody.querySelectorAll('.wiz-row')) {
      const item = d[row.dataset.list][Number(row.dataset.i)];
      const amount = amountOf(row.querySelector('.wiz-amount'));
      if (amount === null && row.querySelector('.wiz-amount').value.trim() !== '') return `Montant invalide pour « ${item.label || item.name || 'ce projet'} ».`;
      if (row.dataset.list === 'projects') {
        item.name = cleanName(row.querySelector('.wiz-name').value);
        item.target = amount;
        item.deadline = isMonthKey(row.querySelector('.wiz-month').value) ? row.querySelector('.wiz-month').value : '';
        if (item.name && !item.target) return `Indique l'objectif de « ${item.name} ».`;
      } else {
        item.amount = amount;
        const dayInput = row.querySelector('.wiz-day');
        if (dayInput) {
          const day = parseDayInput(dayInput.value);
          if (!day) return `Jour invalide pour « ${item.label} » (1 à 31).`;
          item.day = day;
        }
      }
    }
  }
  return null;
}
export const $id = (id) => document.getElementById(id);

export function wizRecap() {
  const d = wiz.data;
  const incomes = d.incomes.filter((r) => r.amount > 0);
  const charges = d.charges.filter((r) => r.amount > 0);
  const habits = d.habits.filter((r) => r.amount > 0);
  const projects = d.projects.filter((p) => p.name && p.target > 0);
  const income = (d.income || 0) + incomes.reduce((s, r) => s + r.amount, 0);
  const chargesTotal = charges.reduce((s, r) => s + r.amount, 0);
  const habitsTotal = habits.reduce((s, r) => s + r.amount, 0);
  return { incomes, charges, habits, projects, income, chargesTotal, habitsTotal, free: income - chargesTotal - habitsTotal };
}

// Crée l'échéancier, les enveloppes et les projets ; ce qui existe déjà (même nom) n'est pas dupliqué.
export function applyWizard() {
  const d = wiz.data;
  const r = wizRecap();
  const cm = currentMonth();
  const first = !state.prefs.onboarded;
  state.salary = d.income || 0;
  state.salaryDay = d.payday;
  if (first) state.prefs.cycle = 'pay';
  const known = new Set(state.recurring.map((x) => normName(x.label)));
  const startFor = (day) => {
    const k = monthOf(cycleStart(cm));
    let iso = isoFor(k, clampDay(day, k));
    if (iso < cycleStart(cm)) iso = isoFor(shiftMonth(k, 1), clampDay(day, shiftMonth(k, 1)));
    return iso;
  };
  let created = 0;
  for (const [type, rows] of [['income', r.incomes], ['expense', r.charges]]) {
    for (const row of rows) {
      if (known.has(normName(row.label))) continue;
      const start = startFor(row.day);
      state.recurring.push({ id: uid(), type, label: cleanName(row.label), amount: row.amount, freq: 'month', start, end: null, envId: null, postedUntil: addDays(maxISO(start, cycleStart(cm)), -1) });
      created++;
    }
  }
  const names = new Set(state.envelopes.map((e) => normName(e.name)));
  for (const row of r.habits) {
    if (names.has(normName(row.label))) continue;
    state.envelopes.push({ id: uid(), kind: 'spend', name: cleanName(row.label), max: row.amount, period: 'month', anchor: clock.today(), reset: null, createdAt: clock.now(), ...envLook(row.label) });
    created++;
  }
  for (const p of r.projects) {
    if (names.has(normName(p.name))) continue;
    const deadline = p.deadline && p.deadline >= cm ? p.deadline : null;
    state.envelopes.push({
      id: uid(), kind: 'project', name: p.name, target: p.target, saved: 0, monthly: 0, mode: 'plan', deadline, startMonth: null,
      goalType: deadline ? 'date' : 'monthly', timing: 'pay', priority: 2, color: 'violet', icon: 'target', category: 'project', notes: '', checklist: [], createdAt: clock.now()
    });
    created++;
  }
  if (d.balance !== null) Object.assign(mainAccount(), { opening: d.balance, openingDate: clock.today(), openingTs: clock.now(), reconciledAt: clock.today() });
  state.prefs.onboarded = true;
  if (first) state.lastClosed = shiftMonth(currentMonth(), -1);
  if (first) state.lastRollover = currentMonth();
  ensureSafety();
  postRecurring();
  commit();
  return created;
}

els.wNext.addEventListener('click', () => {
  const err = readWizardStep();
  if (err) return showError(els.wError, err);
  hideError(els.wError);
  if (wiz.step < WIZ_STEPS.length - 1) {
    wiz.step++;
    renderWizard();
    const i = els.wBody.querySelector('input');
    if (i) i.focus();
    return;
  }
  const n = applyWizard();
  closeDialog(els.dlgWelcome);
  toast(`C'est prêt : ${n} ${plural(n, 'élément créé', 'éléments créés')}. Ajuste-les à ta façon.`);
  if (!state.prefs.tourDone) setTimeout(() => startTour(), 500);
});

els.wBack.addEventListener('click', () => {
  readWizardStep();
  hideError(els.wError);
  wiz.step = Math.max(0, wiz.step - 1);
  renderWizard();
});

els.wBody.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    e.preventDefault();
    els.wNext.click();
  }
});

els.wSkip.addEventListener('click', () => {
  state.prefs.onboarded = true;
  if (!state.lastClosed) state.lastClosed = shiftMonth(currentMonth(), -1);
  save();
  closeDialog(els.dlgWelcome);
  openSalaryEdit();
});

// ——— Visite guidée (bulles sur chaque zone, relançable) ———
export const narrow = () => window.matchMedia('(max-width: 759px)').matches;
export const TOUR = [
  { sel: () => (narrow() ? '#engine' : '#engine'), title: 'Ton reste à vivre', text: 'Ce qui te reste pour le mois, une fois tes charges, tes enveloppes et tes projets réservés. C\'est le chiffre à surveiller.' },
  { sel: () => (narrow() ? '#nav-add' : '#top-add'), title: 'Le bouton +', text: 'Une dépense, un revenu, un ticket à scanner, un paiement qui revient chaque mois : tout passe par ici.' },
  { sel: () => '#spend-grid', fallback: '#empty-spend', title: 'Tes enveloppes', text: 'Un plafond par poste (courses, sorties…). Dépenser moins que prévu, c\'est « bien tenu » : rien ne t\'oblige à tout dépenser.' },
  { sel: () => '[data-tab="projects"]', title: 'Projets et simulations', text: 'Voyage, permis, matelas de sécurité : simule avant de te lancer, puis épargne chaque mois.' },
  { sel: () => '[data-tab="agenda"]', title: 'Agenda', text: 'Ce qui arrive : prélèvements, paie, ton solde jour par jour et les 6 prochains mois.' },
  { sel: () => '[data-tab="report"]', title: 'Bilan', text: 'Où part ton argent, ton score de santé, tes conseils et l\'historique des mois clôturés.' },
  { sel: () => '#open-menu', title: 'Options', text: 'Réglages, thèmes, comptes, sauvegarde, aide et glossaire. Tu peux relancer cette visite depuis ce menu.' }
];
export const tour = { i: 0 };

export function startTour() {
  closeDialog(els.dlgMenu);
  setTab('home');
  tour.i = 0;
  els.tour.hidden = false;
  showTourStep();
}

export function showTourStep() {
  const step = TOUR[tour.i];
  let target = document.querySelector(step.sel());
  if (!target || !target.getClientRects().length || target.getBoundingClientRect().height === 0) target = step.fallback ? document.querySelector(step.fallback) : null;
  els.tourTitle.textContent = step.title;
  els.tourText.textContent = step.text;
  els.tourStep.textContent = `${tour.i + 1} / ${TOUR.length}`;
  els.tourNext.textContent = tour.i === TOUR.length - 1 ? 'Terminer' : 'Suivant';
  if (target) {
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
    const r = target.getBoundingClientRect();
    const pad = 6;
    Object.assign(els.tourHole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const below = r.bottom + 180 < window.innerHeight;
    Object.assign(els.tourBubble.style, below ? { top: `${Math.min(window.innerHeight - 190, r.bottom + 14)}px`, bottom: 'auto' } : { top: 'auto', bottom: `${Math.max(16, window.innerHeight - r.top + 14)}px` });
  } else {
    Object.assign(els.tourHole.style, { left: '50%', top: '50%', width: '0px', height: '0px' });
    Object.assign(els.tourBubble.style, { top: '30%', bottom: 'auto' });
  }
  els.tourNext.focus();
}

export function endTour() {
  els.tour.hidden = true;
  state.prefs.tourDone = true;
  save();
}

els.tourNext.addEventListener('click', () => {
  if (tour.i >= TOUR.length - 1) return endTour();
  tour.i++;
  showTourStep();
});
els.tourSkip.addEventListener('click', endTour);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.tour.hidden) endTour(); });
window.addEventListener('resize', () => { if (!els.tour.hidden) showTourStep(); });

// ——— Aide contextuelle et glossaire ———
export const GLOSSARY = [
  ['reste', 'Reste à vivre', 'Revenus du mois moins tout ce qui est déjà prévu : prélèvements, enveloppes, mises de tes projets, dépenses hors enveloppe et versements. C\'est l\'argent encore libre.'],
  ['enveloppe', 'Enveloppe', 'Un budget pour un poste (courses, sorties…) sur une période. C\'est un plafond, pas un objectif : dépenser moins que prévu, c\'est bien tenu. Un dépassement est pris sur le reste à vivre.'],
  ['mois', 'Mois budgétaire', 'La période de ton budget. Par défaut, elle commence le jour de ta paie ; tu peux choisir le 1er du mois dans Réglages.'],
  ['projet', 'Projet actif', 'Un objectif d\'épargne : sa mise mensuelle est réservée chaque mois et versée à la clôture.'],
  ['plan', 'Plan (simulation)', 'Un projet que tu simules sans rien réserver. Tu l\'actives quand ta marge le permet.'],
  ['matelas', 'Matelas de sécurité', 'Une réserve pour les coups durs. Le repère courant : 3 mois de dépenses.'],
  ['cloture', 'Clôture', 'À la fin d\'un mois, tu choisis quoi faire de ce qui reste : le garder dans l\'enveloppe, le remettre au budget ou l\'épargner. Un instantané du mois est figé dans l\'historique.'],
  ['report', 'Report', 'Le reste d\'une enveloppe gardé pour le mois suivant (« le reste reste là »).'],
  ['ordre', 'Ordre du mois', 'Le bon ordre : la paie arrive, tu mets de côté pour tes projets, les prélèvements passent, puis tu dépenses tes enveloppes au fil du mois.'],
  ['sante', 'Score de santé', 'Un repère sur 100 calculé sur six points (marge, enveloppes, épargne, matelas, mois à venir, suivi). Chaque point a son conseil.'],
  ['rapprochement', 'Rapprochement', 'Comparer le solde de l\'app avec celui de ta banque ; l\'écart peut être ajouté comme ajustement.'],
  ['justificatif', 'Justificatif', 'La photo d\'un ticket ou une facture PDF, gardée sur ton appareil avec l\'opération.']
];

export function openHelp(term = null) {
  fill(els.helpList, GLOSSARY.map(([id, title, text]) => [h('dt', { id: `g-${id}`, dataset: { focus: String(id === term) } }, title), h('dd', { text })]));
  closeDialog(els.dlgMenu);
  openDialog(els.dlgHelp);
  if (term) requestAnimationFrame(() => { const el = document.getElementById(`g-${term}`); if (el) el.scrollIntoView({ block: 'center' }); });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-help]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  openHelp(b.dataset.help);
}, true);

export const imp = { rows: [], note: '', file: null, subs: [] };

export function updateImportConfirm() {
  const n = imp.rows.filter((r) => r.include).length;
  els.impConfirm.disabled = n === 0;
  els.impConfirm.textContent = n ? `Importer ${n} ${plural(n, 'opération', 'opérations')}` : 'Rien à importer';
}

export function renderImportRows() {
  const envs = state.envelopes.filter((e) => e.kind === 'spend');
  fill(els.impList, imp.rows.map((r, i) => h('div', { class: 'import-row', dataset: { i: String(i), type: r.type } },
    h('input', { type: 'checkbox', class: 'imp-check', checked: r.include, 'aria-label': `Importer ${r.label}` }),
    h('div', { class: 'imp-main' },
      h('strong', { text: r.label }),
      h('small', { text: `${shortDate(r.date)}${r.maybe ? ' · doublon possible' : ''}` })),
    h('span', { class: 'imp-amount', text: `${r.type === 'expense' ? '−' : '+'}${money(Math.abs(r.amount))}` }),
    r.type === 'expense'
      ? h('select', { class: 'imp-env', 'aria-label': `Enveloppe pour ${r.label}` },
        h('option', { value: '', text: 'Hors enveloppe' }),
        ...envs.map((e) => h('option', { value: e.id, text: e.name })))
      : h('span', { class: 'imp-tag', text: 'Revenu' }))));
  els.impList.querySelectorAll('.import-row').forEach((row) => {
    const r = imp.rows[Number(row.dataset.i)];
    row.querySelector('.imp-check').checked = r.include;
    const select = row.querySelector('.imp-env');
    if (select) select.value = r.env;
  });
  els.impSummary.textContent = imp.note;
  updateImportConfirm();
}

export async function startCsvImport(file, preset = els.impPreset.value || 'auto') {
  try {
    imp.file = file;
    const parsed = parseStatement(decodeBuffer(await file.arrayBuffer()), preset);
    if (parsed.error) return toast(parsed.error, 'error');
    const known = new Set(state.transactions.filter((t) => t.ref).map((t) => t.ref));
    let already = 0;
    const rows = [];
    for (const r of parsed.rows) {
      if (known.has(r.ref)) { already++; continue; }
      known.add(r.ref);
      const expense = r.amount < 0;
      const type = expense ? 'expense' : 'income';
      const maybe = state.transactions.some((t) => t.type === type && t.amount === Math.abs(r.amount) && Math.abs(daysBetween(t.date, r.date)) <= 2);
      const auto = expense ? guessEnvelope(r.label) || '' : '';
      rows.push({ ...r, type, maybe, include: expense && !maybe, auto, env: auto });
    }
    if (!rows.length) return toast(already ? 'Toutes ces opérations ont déjà été importées.' : 'Aucune opération exploitable dans ce fichier.', 'error');
    const capped = rows.slice(0, 500);
    imp.rows = capped;
    imp.note = `${rows.length} ${plural(rows.length, 'nouvelle opération', 'nouvelles opérations')}${rows.length > 500 ? ' (500 premières affichées)' : ''}`
      + `${already ? ` · ${already} déjà importées` : ''}${parsed.skipped ? ` · ${parsed.skipped} lignes ignorées` : ''}`;
    hideError(els.impError);
    // Abonnements : rythme régulier dans l'historique + ce relevé, pas encore à l'échéancier.
    const pseudo = rows.filter((r) => r.type === 'expense').map((r) => ({ type: 'expense', note: r.label, amount: Math.abs(r.amount), date: r.date, envId: r.env || null }));
    imp.subs = detectSubscriptions([...state.transactions, ...pseudo]);
    renderImportRows();
    renderImportSubs();
    closeDialog(els.dlgMenu);
    openDialog(els.dlgImport);
  } catch {
    toast('Impossible de lire ce fichier.', 'error');
  }
}

els.impList.addEventListener('change', (e) => {
  const row = e.target.closest('.import-row');
  if (!row) return;
  const r = imp.rows[Number(row.dataset.i)];
  if (e.target.classList.contains('imp-check')) r.include = e.target.checked;
  if (e.target.classList.contains('imp-env')) {
    r.env = e.target.value;
    if (r.env) {
      r.include = true;
      row.querySelector('.imp-check').checked = true;
    }
  }
  updateImportConfirm();
});

els.impCancel.addEventListener('click', () => closeDialog(els.dlgImport));
fill(els.impPreset, Object.entries(BANK_PRESETS).map(([k, p]) => h('option', { value: k, text: p.label })));
els.impPreset.addEventListener('change', () => { if (imp.file) startCsvImport(imp.file, els.impPreset.value); });

export function renderImportSubs() {
  const subs = imp.subs || [];
  els.impSubs.hidden = !subs.length;
  fill(els.impSubs, subs.length ? [h('h3', { class: 'small-title', text: `${subs.length} ${plural(subs.length, 'abonnement repéré', 'abonnements repérés')}` }),
    h('p', { class: 'muted small', text: 'Coche ceux à ajouter à l\'échéancier : ils seront prévus chaque mois.' }),
    subs.map((s, i) => subRow(s, i, { check: true }))] : []);
}

els.impConfirm.addEventListener('click', () => {
  let count = 0;
  for (const r of imp.rows) {
    if (!r.include) continue;
    const res = addTransaction({ type: r.type, envId: r.type === 'expense' ? r.env || null : null, amount: Math.abs(r.amount), note: r.label, date: r.date, ref: r.ref }, { silent: true });
    if (res.ok) {
      count++;
      if (r.type === 'expense' && r.env && r.env !== r.auto) learnRule(r.label, r.env);
    }
  }
  let subsAdded = 0;
  els.impSubs.querySelectorAll('.sub-row').forEach((row) => {
    if (!row.querySelector('.sub-check').checked) return;
    if (addSubscription(imp.subs[Number(row.dataset.i)]).ok) subsAdded++;
  });
  commit();
  closeDialog(els.dlgImport);
  ui.journalMonth = null;
  toast(`${count} ${plural(count, 'opération importée', 'opérations importées')}${subsAdded ? ` · ${subsAdded} ${plural(subsAdded, 'abonnement ajouté', 'abonnements ajoutés')} à l'échéancier` : ''}.`);
});

export function exportData() {
  const payload = { app: 'BudgetFold OS', exportedAt: new Date().toISOString(), unit: 'centimes', ...state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `budgetfold-${clock.today()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  state.prefs.lastExport = clock.today();
  commit();
  toast('Sauvegarde exportée.');
}

// ——— Import d'une sauvegarde : .json, .zip (avec photos) ou fichier chiffré ———
export async function importJson(file) {
  try {
    let text = null;
    let bytes = null;
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') bytes = new Uint8Array(await file.arrayBuffer());
    else text = await file.text();
    if (text !== null) {
      const raw = JSON.parse(text);
      if (raw && raw.format === CRYPT_FORMAT) {
        const plain = await askPasswordAndDecrypt(raw, 'Cette sauvegarde est chiffrée. Saisis le mot de passe choisi à l\'export.');
        if (!plain) return;
        if (raw.content === 'zip') bytes = plain;
        else return importPayload(JSON.parse(new TextDecoder().decode(plain)), null);
      } else {
        return importPayload(raw, null);
      }
    }
    const entries = await readZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const json = entries.get('budgetfold.json');
    if (!json) throw new Error('invalid');
    return importPayload(JSON.parse(new TextDecoder().decode(json)), entries);
  } catch {
    toast("Ce fichier n'est pas une sauvegarde BudgetFold valide.", 'error');
  }
}

export async function importPayload(raw, entries) {
  const parsed = fromAnyVersion(raw);
  if (!parsed || (parsed.salary <= 0 && !parsed.envelopes.length)) return toast("Ce fichier n'est pas une sauvegarde BudgetFold valide.", 'error');
  const confirmed = await confirmAction({
    title: 'Importer cette sauvegarde ?',
    text: `${parsed.envelopes.length} ${plural(parsed.envelopes.length, 'enveloppe', 'enveloppes')}, ${parsed.transactions.length} ${plural(parsed.transactions.length, 'opération', 'opérations')}. Tes données actuelles seront remplacées.`,
    confirmLabel: 'Importer'
  });
  if (!confirmed) return;
  if (entries) {
    const meta = raw.photos || {};
    for (const [name, data] of entries) {
      const m = /^photos\/([\w-]+)\.(jpg|pdf)$/.exec(name);
      if (!m) continue;
      const info = meta[m[1]] || {};
      const type = m[2] === 'pdf' ? 'application/pdf' : 'image/jpeg';
      await Photos.put({ id: m[1], blob: new Blob([data], { type }), type, w: info.w || 0, h: info.h || 0, size: data.length, name: info.name || '', createdAt: info.createdAt || clock.now() });
    }
  }
  const keepLock = state.prefs.lock;
  replaceState(parsed);
  state.prefs.onboarded = true;
  // Le verrou reste celui de cet appareil (Face ID est propre à chaque téléphone).
  state.prefs.lock = keepLock;
  announceCredits(runRollover());
  postRecurring();
  applyTheme();
  commit();
  toast('Sauvegarde importée.');
}

// ——— Chiffrement (WebCrypto) : AES-GCM 256 bits, clé dérivée du mot de passe par PBKDF2-SHA-256 ———
export const CRYPT_FORMAT = 'budgetfold-encrypted';
export const KDF_ITERATIONS = 310000;
export const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (str) => unb64(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(bytes, password, content) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { app: 'BudgetFold OS', format: CRYPT_FORMAT, version: 1, cipher: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: b64(salt), iv: b64(iv), content, data: b64(data) };
}

export async function decryptBytes(env, password) {
  const key = await deriveKey(password, unb64(env.salt), clampInt(env.iterations, 1000, 10000000, KDF_ITERATIONS));
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.data)));
}

export const passwordIssue = (pw) => (pw.length < 8 ? 'Choisis un mot de passe d\'au moins 8 caractères.' : null);

// Sauvegarde complète (données et photos) chiffrée par mot de passe.
export async function encryptedBackup(password) {
  const issue = passwordIssue(password);
  if (issue) return fail(issue);
  const zip = new Uint8Array(await (await fullBackupZip()).arrayBuffer());
  const env = await encryptBytes(zip, password, 'zip');
  return ok(new Blob([JSON.stringify(env)], { type: 'application/json' }));
}

// Demande le mot de passe (feuille dédiée) puis déchiffre ; null si l'utilisateur annule.
export function askPasswordAndDecrypt(env, text) {
  return new Promise((resolve) => {
    els.pwText.textContent = text;
    els.pwInput.value = '';
    hideError(els.pwError);
    let done = false;
    const finish = (v) => { if (!done) { done = true; els.pwForm.onsubmit = null; resolve(v); } };
    els.pwForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const plain = await decryptBytes(env, els.pwInput.value);
        closeDialog(els.dlgPassword);
        finish(plain);
      } catch {
        showError(els.pwError, 'Mot de passe incorrect.');
      }
    };
    els.dlgPassword.addEventListener('close', () => finish(null), { once: true });
    openDialog(els.dlgPassword);
    requestAnimationFrame(() => els.pwInput.focus());
  });
}

// ——— Transfert vers un autre appareil par QR code (sans serveur) ———
// Les données (sans photos) sont compressées, chiffrées, et mises dans le fragment d'un lien (#import=…),
// qui n'est jamais envoyé au serveur : on scanne le QR avec l'appareil photo de l'autre téléphone.
export const QR_MAX = 2300;
export const QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
export async function deflate(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}
export async function inflate(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}
export async function transferLink(password) {
  const issue = passwordIssue(password);
  if (issue) return fail(issue);
  const json = new TextEncoder().encode(JSON.stringify({ ...state, transactions: state.transactions.map(({ photos, ...t }) => t) }));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await deflate(json)));
  const packed = new Uint8Array(28 + data.length);
  packed.set(salt, 0);
  packed.set(iv, 16);
  packed.set(data, 28);
  const url = `${location.origin}${location.pathname}#import=${b64url(packed)}`;
  if (url.length > QR_MAX) return fail(`Trop de données pour un QR code (${Math.round(url.length / 100) / 10} k caractères). Utilise plutôt la sauvegarde chiffrée (fichier).`);
  return ok(url);
}
export async function readTransfer(code, password) {
  const packed = unb64url(code);
  const key = await deriveKey(password, packed.slice(0, 16), KDF_ITERATIONS);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(16, 28) }, key, packed.slice(28)));
  return JSON.parse(new TextDecoder().decode(await inflate(plain)));
}
export async function qrSvg(text) {
  if (!window.qrcode) await loadScript(QRLIB);
  const qr = window.qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 3, scalable: true, alt: 'QR code de transfert' });
}

export async function receiveTransfer(code) {
  els.pwText.textContent = 'Des données arrivent d\'un autre appareil. Saisis le mot de passe choisi pour le transfert.';
  els.pwInput.value = '';
  hideError(els.pwError);
  const raw = await new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; els.pwForm.onsubmit = null; resolve(v); } };
    els.pwForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = await readTransfer(code, els.pwInput.value);
        closeDialog(els.dlgPassword);
        finish(data);
      } catch {
        showError(els.pwError, 'Mot de passe incorrect, ou lien abîmé.');
      }
    };
    els.dlgPassword.addEventListener('close', () => finish(null), { once: true });
    openDialog(els.dlgPassword);
  });
  if (raw) await importPayload(raw, null);
}

// ——— Verrou de l'app : code PIN (haché, jamais stocké en clair) et Face ID / empreinte (WebAuthn) ———
export const PIN_ITERATIONS = 150000;
export async function hashPin(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PIN_ITERATIONS, hash: 'SHA-256' }, base, 256)));
}

export async function setPin(pin) {
  if (!/^\d{4,8}$/.test(pin || '')) return fail('Choisis un code de 4 à 8 chiffres.');
  const salt = randomBytes(16);
  state.prefs.lock = { ...state.prefs.lock, enabled: true, salt: b64(salt), hash: await hashPin(pin, salt) };
  save();
  return ok();
}

export async function checkPin(pin) {
  const lock = state.prefs.lock;
  if (!lock.enabled || !lock.hash) return true;
  return (await hashPin(String(pin || ''), unb64(lock.salt))) === lock.hash;
}

export function disableLock() {
  state.prefs.lock = { enabled: false, salt: null, hash: null, credId: null };
  save();
}

export const biometricAvailable = async () => {
  try {
    return Boolean(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
};

// Face ID / empreinte : une clé locale est créée sur l'appareil ; la déverrouiller demande la vérification du système.
export async function enableBiometric() {
  if (!state.prefs.lock.enabled) return fail('Choisis d\'abord un code.');
  if (!(await biometricAvailable())) return fail('Face ID ou l\'empreinte ne sont pas disponibles sur cet appareil.');
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32), rp: { name: 'BudgetFold' }, user: { id: randomBytes(16), name: 'budgetfold', displayName: 'BudgetFold' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000
      }
    });
    state.prefs.lock.credId = b64(new Uint8Array(cred.rawId));
    save();
    return ok();
  } catch {
    return fail('Activation annulée.');
  }
}

export async function unlockBiometric() {
  const id = state.prefs.lock.credId;
  if (!id) return false;
  try {
    await navigator.credentials.get({ publicKey: { challenge: randomBytes(32), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000 } });
    return true;
  } catch {
    return false;
  }
}

export const lockUi = { hiddenAt: 0 };
export const LOCK_AFTER_MS = 60000;
export function lockApp() {
  if (!state.prefs.lock.enabled) return;
  els.lock.hidden = false;
  document.querySelector('.app-shell').inert = true;
  els.lockPin.value = '';
  hideError(els.lockError);
  els.lockBio.hidden = !state.prefs.lock.credId;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  requestAnimationFrame(() => els.lockPin.focus());
}
export function unlockApp() {
  els.lock.hidden = true;
  document.querySelector('.app-shell').inert = false;
}
export const isLocked = () => !els.lock.hidden;

els.lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await checkPin(els.lockPin.value)) return unlockApp();
  els.lockPin.value = '';
  showError(els.lockError, 'Code incorrect.');
});
els.lockBio.addEventListener('click', async () => {
  if (await unlockBiometric()) unlockApp();
  else showError(els.lockError, 'Vérification annulée : saisis ton code.');
});
els.lockForgot.addEventListener('click', async () => {
  const sure = await confirmAction({
    title: 'Code oublié ?',
    text: 'Le code protège l\'accès à l\'app sur cet appareil. Sans lui, la seule solution est de tout effacer, puis de restaurer une sauvegarde (fichier ou chiffrée).',
    confirmLabel: 'Tout effacer',
    danger: true
  });
  if (!sure) return;
  await wipeEverything();
  unlockApp();
  openWelcome();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lockUi.hiddenAt = Date.now();
  else if (state.prefs.lock.enabled && lockUi.hiddenAt && Date.now() - lockUi.hiddenAt > LOCK_AFTER_MS) lockApp();
});

// ——— Tout effacer : données, photos, ancien stockage, cache hors ligne ———
export async function wipeEverything() {
  for (const k of [STORAGE_KEY, V3_KEY, V2_KEY, LEGACY_KEY]) {
    try { localStorage.removeItem(k); } catch { /* bloqué */ }
  }
  try {
    if (photoDb) (await photoDb).close();
    resetPhotoDb();
    await new Promise((resolve) => { const r = indexedDB.deleteDatabase(PHOTO_DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); });
  } catch { /* indisponible */ }
  try {
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* indisponible */ }
  photoUrls.forEach((url) => URL.revokeObjectURL(url));
  photoUrls.clear();
  replaceState(emptyState());
  applyTheme();
  commit();
}

// ——— Feuille « Sécurité et appareils » ———
export async function openSecurity() {
  closeDialog(els.dlgMenu);
  renderSecurity();
  openDialog(els.dlgSecurity);
  els.secBioRow.hidden = !(await biometricAvailable()) || !state.prefs.lock.enabled;
}
export function renderSecurity() {
  const lock = state.prefs.lock;
  els.secLockState.textContent = lock.enabled ? `Code activé${lock.credId ? ' · Face ID / empreinte activé' : ''}.` : 'Pas de code : l\'app s\'ouvre directement.';
  els.secPinSet.textContent = lock.enabled ? 'Changer le code' : 'Choisir un code';
  els.secPinOff.hidden = !lock.enabled;
  els.secBio.textContent = lock.credId ? 'Face ID / empreinte activé' : 'Activer Face ID / empreinte';
  els.secBio.disabled = Boolean(lock.credId);
  els.secQrBox.hidden = true;
  hideError(els.secError);
}
els.secPinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (els.secPin.value !== els.secPin2.value) return showError(els.secError, 'Les deux codes ne sont pas identiques.');
  const res = await setPin(els.secPin.value);
  if (!res.ok) return showError(els.secError, res.error);
  els.secPin.value = '';
  els.secPin2.value = '';
  renderSecurity();
  els.secBioRow.hidden = !(await biometricAvailable());
  toast('Code enregistré : il sera demandé à l\'ouverture.');
});
els.secPinOff.addEventListener('click', async () => {
  const sure = await confirmAction({ title: 'Retirer le code ?', text: 'L\'app s\'ouvrira sans code sur cet appareil.', confirmLabel: 'Retirer' });
  if (!sure) return;
  disableLock();
  renderSecurity();
  els.secBioRow.hidden = true;
  toast('Code retiré.');
});
els.secBio.addEventListener('click', async () => {
  const res = await enableBiometric();
  if (!res.ok) return showError(els.secError, res.error);
  renderSecurity();
  toast('Face ID / empreinte activé.');
});
els.secExport.addEventListener('click', async () => {
  const res = await encryptedBackup(els.secPassword.value);
  if (!res.ok) return showError(els.secError, res.error);
  hideError(els.secError);
  download(res.data, `budgetfold-${clock.today()}.bfold`);
  state.prefs.lastExport = clock.today();
  commit();
  els.secPassword.value = '';
  toast('Sauvegarde chiffrée exportée. Garde bien le mot de passe : sans lui, impossible de la relire.');
});
els.secQr.addEventListener('click', async () => {
  const res = await transferLink(els.secPassword.value);
  if (!res.ok) return showError(els.secError, res.error);
  hideError(els.secError);
  try {
    els.secQrImg.innerHTML = await qrSvg(res.data);
  } catch {
    els.secQrImg.textContent = 'QR code indisponible hors ligne : copie le lien.';
  }
  els.secQrLink.value = res.data;
  els.secQrBox.hidden = false;
});
els.secQrCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(els.secQrLink.value);
    toast('Lien copié.');
  } catch {
    els.secQrLink.select();
  }
});
els.menuSecurity.addEventListener('click', openSecurity);

// ——— Confidentialité ———
export function openPrivacy() {
  closeDialog(els.dlgMenu);
  let size = 0;
  try { size = (localStorage.getItem(STORAGE_KEY) || '').length; } catch { /* bloqué */ }
  const photos = new Set(state.transactions.flatMap((t) => t.photos || [])).size;
  els.privacyUsage.textContent = `Sur cet appareil : ${Math.round(size / 1024)} Ko de données, ${photos} ${plural(photos, 'justificatif', 'justificatifs')}.`;
  openDialog(els.dlgPrivacy);
}
els.menuPrivacy.addEventListener('click', openPrivacy);
els.footPrivacy.addEventListener('click', openPrivacy);
els.privacyWipe.addEventListener('click', () => {
  closeDialog(els.dlgPrivacy);
  els.menuWipe.click();
});

// ——— Nouvelle version (service worker) ———
export let waitingWorker = null;
export function showUpdate(worker) {
  waitingWorker = worker;
  els.updateBar.hidden = false;
}
els.updateGo.addEventListener('click', () => {
  els.updateBar.hidden = true;
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
});
els.updateLater.addEventListener('click', () => { els.updateBar.hidden = true; });

export function announceCredits(credits) {
  if (!credits || !credits.size) return;
  const total = [...credits.values()].reduce((s, v) => s + v, 0);
  const names = [...credits.keys()].map((id) => (findEnv(id) || {}).name).filter(Boolean);
  toast(`Mois clôturé : ${money(total)} versés dans ${names.length > 2 ? `${names.length} projets` : names.map((n) => `« ${n} »`).join(' et ')}.`, { duration: 5200 });
}

export function announceClosed(keys) {
  if (!keys || !keys.length) return;
  toast(`${keys.length > 1 ? `${keys.length} mois clôturés` : `${capitalize(monthName(keys[0]).toLowerCase())} clôturé`} automatiquement : voir Bilan › Historique.`, { duration: 5200 });
}

export function announcePosted(posted) {
  if (!posted.length) return;
  const names = [...new Set(posted.map((t) => t.note))];
  const list = names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '.');
  toast(`${posted.length} ${plural(posted.length, 'opération récurrente ajoutée', 'opérations récurrentes ajoutées')} automatiquement : ${list}`, { duration: 5200 });
}

els.tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) setTab(btn.dataset.tab);
});

els.tabs.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (!e.target.closest('[data-tab]')) return;
  const i = TABS.indexOf(ui.tab);
  const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  setTab(next);
  els.tabs.querySelector(`[data-tab="${next}"]`).focus();
});

els.insights.addEventListener('click', (e) => {
  const act = e.target.closest('[data-action]');
  if (act && act.dataset.action === 'export') return exportData();
  if (act && act.dataset.action === 'close') return openClosing();
  if (act && act.dataset.action.startsWith('cover:')) return openMove({ to: act.dataset.action.slice(6) });
  const btn = e.target.closest('[data-tab]');
  if (btn) setTab(btn.dataset.tab);
});

export const addFromAnywhere = () => openAdd({ mode: 'expense' });
els.navAdd.addEventListener('click', addFromAnywhere);
els.topAdd.addEventListener('click', addFromAnywhere);
els.mini.addEventListener('click', () => setTab('home'));
els.upMore.addEventListener('click', () => setTab('agenda'));

export function cardOpen(e) {
  const card = e.target.closest('.envelope');
  if (!card || card.classList.contains('is-leaving')) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  if (e.type === 'keydown') e.preventDefault();
  const env = findEnv(card.dataset.id);
  if (env && env.kind === 'project') openProject(env.id);
  else if (env) openEnv({ env });
}
[els.spendGrid, els.projectGrid].forEach((grid) => {
  grid.addEventListener('click', cardOpen);
  grid.addEventListener('keydown', cardOpen);
});
els.addSpend.addEventListener('click', () => openEnv({ kind: 'spend' }));
els.addProject.addEventListener('click', () => openEnv({ kind: 'project' }));

els.jPrev.addEventListener('click', () => { ui.journalMonth = shiftMonth(ui.journalMonth || currentMonth(), -1); renderJournal(); });
els.jNext.addEventListener('click', () => { ui.journalMonth = shiftMonth(ui.journalMonth || currentMonth(), 1); renderJournal(); });
els.jFilter.addEventListener('change', () => { ui.journalFilter = els.jFilter.value; renderJournal(); });
els.jSearch.addEventListener('input', () => { ui.journalQuery = els.jSearch.value; renderJournal(); });
els.jScope.addEventListener('change', () => { ui.journalScope = els.jScope.value; renderJournal(); });
els.jList.addEventListener('click', async (e) => {
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const m = state.moves.find((x) => x.id === mv.dataset.move);
    if (!m) return;
    const confirmed = await confirmAction({ title: 'Annuler ce déplacement ?', text: `${money(m.amount)} reviennent à leur place d'origine.`, confirmLabel: 'Annuler le déplacement' });
    if (!confirmed) return;
    const res = deleteMove(m.id);
    if (res.ok) toast('Déplacement annulé.', { action: { label: 'Rétablir', run: () => { state.moves.push(res.data); commit(); } } });
    return;
  }
  const row = e.target.closest('.tx-row');
  const tx = row && state.transactions.find((t) => t.id === row.dataset.id);
  if (tx && tx.type === 'transfer') {
    const confirmed = await confirmAction({ title: 'Supprimer ce virement ?', text: `${money(tx.amount)} · ${txSub(tx)}.`, confirmLabel: 'Supprimer', danger: true });
    if (!confirmed) return;
    const res = deleteTransaction(tx.id);
    if (res.ok) toast('Virement supprimé.', { action: { label: 'Annuler', run: () => restoreTransaction(res.data) } });
    return;
  }
  if (tx && tx.type === 'withdraw') openProject(tx.envId);
  else if (tx) openTx(tx);
});

els.rMode.addEventListener('change', () => {
  ui.reportMode = checkedValue(els.rMode, 'r-mode') === 'history' ? 'history' : 'month';
  renderReport();
});
els.rHistory.addEventListener('click', (e) => {
  const range = e.target.closest('[data-range]');
  if (range) { ui.historyRange = Number(range.dataset.range); return renderHistory(); }
  const head = e.target.closest('.hist-head');
  if (head) { ui.historyOpen = ui.historyOpen === head.dataset.key ? null : head.dataset.key; renderHistory(); }
});
els.rPrev.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), -1); renderReport(); });
els.rNext.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), 1); renderReport(); });

export const agendaGo = (key) => {
  ui.agendaMonth = key;
  ui.agendaDay = null;
  renderAgenda();
};
els.aPrev.addEventListener('click', () => agendaGo(shiftMonth(ui.agendaMonth || currentMonth(), -1)));
els.aNext.addEventListener('click', () => agendaGo(shiftMonth(ui.agendaMonth || currentMonth(), 1)));
els.calendar.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-date]');
  if (!cell) return;
  ui.agendaDay = cell.dataset.date;
  renderAgenda();
});
els.dayDetail.addEventListener('click', (e) => {
  const add = e.target.closest('.add-on-day');
  if (add) return openAdd({ mode: 'expense', date: add.dataset.date });
  const row = e.target.closest('.day-event');
  if (!row) return;
  if (row.dataset.tx) {
    const tx = state.transactions.find((t) => t.id === row.dataset.tx);
    if (tx && tx.type === 'withdraw') openProject(tx.envId);
  else if (tx) openTx(tx);
  } else if (row.dataset.rule) {
    const rule = findRule(row.dataset.rule);
    if (rule) openRule(rule);
  }
});
els.forecast.addEventListener('click', (e) => {
  const row = e.target.closest('[data-key]');
  if (!row) return;
  ui.forecastOpen = ui.forecastOpen === row.dataset.key ? null : row.dataset.key;
  agendaGo(row.dataset.key);
  const top = els.calendar.closest('.card').getBoundingClientRect().top;
  window.scrollTo({ top: window.scrollY + top - 90, behavior: reduceMotion ? 'auto' : 'smooth' });
});
els.cashEdit.addEventListener('click', openSettings);
els.recList.addEventListener('click', (e) => {
  const row = e.target.closest('.rec-row');
  const rule = row && findRule(row.dataset.id);
  if (rule) openRule(rule);
});

els.openMenu.addEventListener('click', () => openDialog(els.dlgMenu));
els.menuSettings.addEventListener('click', openSettings);
els.menuCsv.addEventListener('click', () => els.csvFile.click());
els.csvFile.addEventListener('change', () => {
  const file = els.csvFile.files && els.csvFile.files[0];
  els.csvFile.value = '';
  if (file) startCsvImport(file);
});
els.menuExport.addEventListener('click', () => { closeDialog(els.dlgMenu); exportData(); });
els.menuImport.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', () => {
  const file = els.importFile.files && els.importFile.files[0];
  els.importFile.value = '';
  if (!file) return;
  closeDialog(els.dlgMenu);
  importJson(file);
});

els.menuWipe.addEventListener('click', async () => {
  closeDialog(els.dlgMenu);
  const confirmed = await confirmAction({
    title: 'Tout effacer ?',
    text: 'Ton budget, ton journal, tes projets, tes photos de justificatifs et le cache hors ligne seront définitivement supprimés de cet appareil. Pense à exporter une sauvegarde avant.',
    confirmLabel: 'Tout effacer',
    danger: true
  });
  if (!confirmed) return;
  await wipeEverything();
  toast('Toutes les données ont été effacées de cet appareil.');
  openWelcome();
});

export let installPrompt = null;
els.menuInstall.addEventListener('click', async () => {
  if (!installPrompt) return;
  closeDialog(els.dlgMenu);
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  els.menuInstall.hidden = true;
});
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  els.menuInstall.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  els.menuInstall.hidden = true;
  toast('BudgetFold est installée.');
});

document.querySelectorAll('input[inputmode="decimal"]').forEach((input) =>
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/[^\d.,\s]/g, '');
    if (cleaned !== input.value) input.value = cleaned;
  })
);
document.querySelectorAll('input[inputmode="numeric"]').forEach((input) =>
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/\D/g, '').slice(0, 2);
    if (cleaned !== input.value) input.value = cleaned;
  })
);

document.querySelectorAll('dialog.sheet').forEach((dlg) => {
  dlg.addEventListener('click', (e) => {
    if ((e.target === dlg && !dlg.hasAttribute('data-lock')) || e.target.closest('[data-close]')) dlg.close();
  });
  dlg.addEventListener('cancel', (e) => {
    if (dlg.hasAttribute('data-lock')) e.preventDefault();
  });
});

export function applyHash() {
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('import=')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file:// */ }
    receiveTransfer(hash.slice(7));
    return;
  }
  if (hash === 'add' || hash === 'add-income') {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file:// */ }
    openAdd({ mode: hash === 'add' ? 'expense' : 'income' });
    return;
  }
  const tab = hash === 'bilan' ? 'report' : hash === 'projets' ? 'projects' : TABS.includes(hash) ? hash : null;
  if (tab) setTab(tab, { updateHash: false });
}
window.addEventListener('hashchange', applyHash);

export function tick() {
  if (!state.lastClosed) state.lastClosed = shiftMonth(currentMonth(), -1);
  const credits = runRollover();
  const posted = postRecurring();
  const safety = ensureSafety();
  const closed = [];
  if (state.prefs.closing.auto) {
    for (const key of pendingClosings()) {
      const res = closeMonth(key);
      if (res.ok) closed.push(key);
    }
  }
  if (credits.size || posted.length || safety || closed.length) save();
  return { credits, posted, closed };
}

export let lastDay = clock.today();
export function checkClock() {
  const today = clock.today();
  if (today === lastDay) return;
  lastDay = today;
  const { credits, posted, closed } = tick();
  ui.journalMonth = null;
  ui.reportMonth = null;
  ui.agendaMonth = null;
  ui.agendaDay = null;
  render();
  announceCredits(credits);
  announcePosted(posted);
  announceClosed(closed);
  if (pendingClosings().length && !state.prefs.closing.auto && !document.querySelector('dialog[open]')) openClosing();
}
setInterval(checkClock, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkClock(); });

window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  replaceState(load());
  applyTheme();
  render();
});

if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
) {
  // Nouvelle version : le nouveau service worker attend ; l'utilisateur choisit quand recharger.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
        });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !waitingWorker) return;
    reloading = true;
    location.reload();
  });
}


// Après sa déclaration : l'état de l'interface, remis à zéro par engine (setSettings).
Object.assign(hooks, { ui });
