// BudgetFold OS · module engine (voir CLAUDE.md, « Architecture »).
import { FREQS, GOAL_TYPES, KEYWORD_HINTS, MONTH_STEPS, NOTES_MAX, PALETTE, PERIODS, PROJECT_ICONS, TIMINGS, VERSION, addDays, clampDay, clampInt, cleanDetail, cleanName, cleanNote, cleanSim, cleanText, clock, dayOf, daysBetween, fail, hooks, isISO, isMonthKey, isoFor, localISO, maxISO, maxMonth, minISO, mondayOf, money, moneyRound, monthDiff, monthName, monthOf, monthlyEq, normName, normText, ofMonth, ok, parseAmount, plural, relDay, ruleIcon, shiftMonth, shortDate, uid } from './util.mjs';
import { ACCOUNT_KINDS, BACKUP_DAYS, CLOSE_ACTIONS, ENV_ICONS, backupAge, budgetKey, cleanTags, commit, currentMonth, cycleEnd, cycleStart, envLook, findEnv, findRule, inCycle, payDates, projectDone, replaceState, setLastAddedId, spendEnv, state } from './data.mjs';

export function occurrences(rule, from, to) {
  const out = [];
  if (!rule || !from || !to || to < from) return out;
  const end = rule.end && rule.end < to ? rule.end : to;
  if (end < rule.start) return out;
  const lo = maxISO(from, rule.start);
  if (MONTH_STEPS[rule.freq]) {
    const step = MONTH_STEPS[rule.freq];
    const sk = monthOf(rule.start);
    const day = dayOf(rule.start);
    let k = Math.max(0, Math.floor(monthDiff(sk, monthOf(lo)) / step));
    for (let guard = 0; guard < 2400; guard++, k++) {
      const key = shiftMonth(sk, k * step);
      const d = isoFor(key, clampDay(day, key));
      if (d > end) break;
      if (d >= lo) out.push(d);
    }
    return out;
  }
  const step = rule.freq === 'day' ? 1 : rule.freq === 'week' ? 7 : 14;
  const k = Math.ceil(daysBetween(rule.start, lo) / step);
  for (let d = addDays(rule.start, Math.max(0, k) * step), guard = 0; d <= end && guard < 4000; d = addDays(d, step), guard++) out.push(d);
  return out;
}

export const pendingOcc = (rule, from, to) => occurrences(rule, maxISO(from, addDays(rule.postedUntil, 1)), to);
export const nextOccurrence = (rule, from = addDays(clock.today(), 1)) => {
  const list = occurrences(rule, maxISO(from, addDays(rule.postedUntil, 1)), addDays(from, 800));
  return list[0] || null;
};

export function postRecurring() {
  const today = clock.today();
  const posted = [];
  for (const r of state.recurring) {
    const from = addDays(r.postedUntil, 1);
    if (from > today) continue;
    const dates = occurrences(r, from, today).slice(-400);
    const envId = r.type === 'expense' && spendEnv(r.envId) ? r.envId : null;
    for (const date of dates) {
      const tx = { id: uid(), type: r.type, envId, amount: r.amount, note: r.label, date, ts: clock.now(), recId: r.id };
      state.transactions.push(tx);
      posted.push(tx);
    }
    r.postedUntil = today;
  }
  return posted;
}

export function periodWindow(env, iso) {
  const p = env.period || 'month';
  if (p === 'month') {
    const k = budgetKey(iso);
    return { start: cycleStart(k), end: cycleEnd(k) };
  }
  if (p === 'week' || p === '2weeks') {
    const monday = mondayOf(iso);
    if (p === 'week') return { start: monday, end: addDays(monday, 6) };
    const anchor = mondayOf(env.anchor || iso);
    const k = Math.floor(daysBetween(anchor, monday) / 14);
    const s = addDays(anchor, k * 14);
    return { start: s, end: addDays(s, 13) };
  }
  const step = MONTH_STEPS[p] || 1;
  const a = budgetKey(env.anchor || iso);
  const k = Math.floor(monthDiff(a, budgetKey(iso)) / step);
  const sk = shiftMonth(a, k * step);
  const ek = shiftMonth(sk, step - 1);
  return { start: cycleStart(sk), end: cycleEnd(ek) };
}

export const isResetOut = (env, t) => Boolean(env.reset && t.ts < env.reset.ts && t.date <= env.reset.date);

export function envCommitted(env, from, to) {
  const today = clock.today();
  let spent = 0;
  let planned = 0;
  let excluded = 0;
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.envId !== env.id || t.date < from || t.date > to) continue;
    if (isResetOut(env, t)) excluded += t.amount;
    else if (t.date > today) planned += t.amount;
    else spent += t.amount;
  }
  for (const r of state.recurring) {
    if (r.type !== 'expense' || r.envId !== env.id) continue;
    planned += pendingOcc(r, from, to).length * r.amount;
  }
  return { spent, planned, excluded, total: spent + planned };
}

// Reste reporté dans l'enveloppe à la clôture du mois précédent (« le reste reste là »).
export function carryIn(env, key) {
  const c = state.closings.find((x) => x.key === shiftMonth(key, -1));
  if (!c) return 0;
  return c.lines.reduce((s, l) => s + (l.envId === env.id && l.action === 'keep' && l.left > 0 ? l.left : 0), 0);
}
// Argent déplacé vers (+) ou depuis (−) une enveloppe pendant un mois budgétaire.
export const movedNet = (envId, key) => state.moves.reduce((s, m) => s + (m.key !== key ? 0 : m.to === envId ? m.amount : m.from === envId ? -m.amount : 0), 0);
export const isLongPeriod = (env) => !['month', 'week', '2weeks'].includes(env.period);
// Mois budgétaires couverts par la période d'une enveloppe (un seul pour une enveloppe au mois).
export function windowKeys(env, w) {
  const keys = [];
  for (let k = budgetKey(w.start); k <= budgetKey(w.end); k = shiftMonth(k, 1)) keys.push(k);
  return keys;
}

export function envMonthAlloc(env, key) {
  const eq = env.period === 'month' ? env.max : monthlyEq(env.max, env.period);
  const ms = cycleStart(key);
  const me = cycleEnd(key);
  const inMonth = envCommitted(env, ms, me).total;
  const moved = movedNet(env.id, key);
  const carry = carryIn(env, key);
  if (!isLongPeriod(env)) return { alloc: Math.max(0, eq + moved, inMonth - carry), eq, inMonth, moved, carry };
  const w = periodWindow(env, ms);
  const keys = windowKeys(env, w);
  const cap = env.max + carryIn(env, keys[0]) + keys.filter((k) => k < key).reduce((s, k) => s + movedNet(env.id, k), 0);
  const before = w.start < ms ? envCommitted(env, w.start, addDays(ms, -1)).total : 0;
  const excess = Math.max(0, before + inMonth - cap - moved) - Math.max(0, before - cap);
  return { alloc: Math.max(0, eq + moved + excess), eq, inMonth, moved, carry };
}

export function envRow(env, key) {
  const today = clock.today();
  const cm = currentMonth();
  const ref = key === cm ? today : key < cm ? cycleEnd(key) : cycleStart(key);
  const w = periodWindow(env, ref);
  const c = envCommitted(env, w.start, w.end);
  const m = envMonthAlloc(env, key);
  const keys = env.period === 'week' || env.period === '2weeks' ? [] : windowKeys(env, w);
  const carry = keys.length ? carryIn(env, keys[0]) : 0;
  const moved = keys.reduce((s, k) => s + movedNet(env.id, k), 0);
  const budget = env.max + carry + moved;
  return {
    env, window: w, spent: c.spent, planned: c.planned, excluded: c.excluded,
    used: c.total, budget, carry, moved, left: budget - c.total, alloc: m.alloc, eq: m.eq, inMonth: m.inMonth
  };
}

// Versements marqués « c'est la mise de ce mois » : ils remplacent la mise automatique au lieu de s'y ajouter.
export const coveredIn = (e, key) => state.transactions.reduce((s, t) => s + (t.type === 'deposit' && t.envId === e.id && t.covers === key ? t.amount : 0), 0);

// Mise mensuelle effective : fixe, ou recalculée chaque mois pour tenir la date (« atteindre X avant telle date »).
export function monthlyOf(e, key = currentMonth()) {
  if (e.goalType !== 'date' || !e.deadline) return e.monthly;
  const months = Math.max(1, monthDiff(key, e.deadline) + 1);
  return Math.ceil(Math.max(0, e.target - e.saved) / months / 100) * 100;
}

export function projectContribution(e, key) {
  const cm = currentMonth();
  const monthly = monthlyOf(e, key < cm ? key : cm);
  if (e.mode !== 'active' || monthly <= 0 || e.category === 'wish') return 0;
  if (e.startMonth && key < e.startMonth) return 0;
  const due = Math.max(0, monthly - coveredIn(e, key));
  if (key < cm) return projectDone(e) ? 0 : due;
  const k = monthDiff(maxMonth(cm, e.startMonth || cm), key);
  const savedAtStart = e.saved + monthly * k;
  return Math.max(0, Math.min(due, e.target - savedAtStart));
}

// Mois budgétaire de la prochaine paie (aujourd'hui compris).
export const nextPayMonth = () => {
  const today = clock.today();
  const m = monthOf(today);
  let pay = isoFor(m, clampDay(state.salaryDay, m));
  if (pay < today) pay = isoFor(shiftMonth(m, 1), clampDay(state.salaryDay, shiftMonth(m, 1)));
  return budgetKey(pay);
};

export function derive(key = currentMonth()) {
  const today = clock.today();
  const cm = currentMonth();
  const isCurrent = key === cm;
  const ms = cycleStart(key);
  const me = cycleEnd(key);

  // Report de la clôture du mois précédent : restes remis au budget, reste à vivre non utilisé, ou déficit.
  const prevClose = state.closings.find((c) => c.key === shiftMonth(key, -1));
  const carried = prevClose ? closingCarry(prevClose) : 0;
  let income = state.salary * payDates(key).length + carried;
  let extraIncome = 0;
  let charges = 0;
  let orphan = 0;
  let deposits = 0;
  let spentToDate = 0;
  let upcoming = 0;
  let incomeUpcoming = 0;
  const plannedItems = [];

  for (const t of state.transactions) {
    if (t.date < ms || t.date > me) continue;
    const future = t.date > today;
    if (t.type === 'income') {
      income += t.amount;
      extraIncome += t.amount;
      if (future) incomeUpcoming += t.amount;
    } else if (t.type === 'deposit') {
      if (t.src !== 'close') deposits += t.amount;
    } else if (t.type === 'withdraw' || t.type === 'transfer') {
      // Réserve dépensée (déjà mise de côté) ou virement entre comptes : le reste à vivre ne bouge pas.
    } else {
      if (future) upcoming += t.amount;
      else spentToDate += t.amount;
      const env = spendEnv(t.envId);
      if (env) {
        if (isResetOut(env, t)) orphan += t.amount;
      } else if (t.recId) {
        charges += t.amount;
      } else {
        orphan += t.amount;
      }
      if (future && !t.recId) plannedItems.push({ date: t.date, label: t.note || (env ? env.name : 'Dépense'), amount: -t.amount });
    }
  }

  for (const r of state.recurring) {
    const n = pendingOcc(r, ms, me).length;
    if (!n) continue;
    const total = n * r.amount;
    if (r.type === 'income') {
      income += total;
      extraIncome += total;
      incomeUpcoming += total;
    } else {
      upcoming += total;
      if (!spendEnv(r.envId)) charges += total;
    }
  }

  const spend = state.envelopes.filter((e) => e.kind === 'spend').map((e) => envRow(e, key));
  const envAlloc = spend.reduce((s, r) => s + r.alloc, 0);
  const remaining = spend.reduce((s, r) => s + Math.max(0, r.left), 0);
  const projects = state.envelopes.filter((e) => e.kind === 'project');
  const projectsMonthly = projects.reduce((s, e) => s + projectContribution(e, key), 0);

  // Micro-entreprise : cotisations provisionnées sur le chiffre d'affaires du mois (taux saisi par l'utilisateur).
  const pro = state.prefs.pro;
  const proIncome = pro.enabled ? state.transactions.reduce((s, t) => s + (t.type === 'income' && t.pro && t.date >= ms && t.date <= me ? t.amount : 0), 0) : 0;
  const provision = pro.enabled ? Math.round((proIncome * pro.rateBp) / 10000) : 0;
  const allocated = charges + envAlloc + projectsMonthly + orphan + deposits + provision;
  return {
    key, isCurrent, isFuture: key > cm, isPast: key < cm, proIncome, provision,
    income, salary: state.salary, extraIncome, incomeUpcoming, carried,
    charges, spend, envAlloc, remaining, projectsMonthly, deposits, orphan,
    spentToDate, upcoming, plannedItems, allocated, free: income - allocated
  };
}

// Trésorerie jour par jour sur un mois budgétaire. `day` est la position dans le mois (1 = premier jour du cycle).
export function cashflow(key, depth = 0) {
  const d = derive(key);
  const ms = cycleStart(key);
  const me = cycleEnd(key);
  const n = daysBetween(ms, me) + 1;
  const pos = (iso) => daysBetween(ms, iso) + 1;
  const today = clock.today();
  const cm = currentMonth();
  const t = key === cm ? pos(today) : key < cm ? n : 0;
  const inc = new Array(n + 1).fill(0);
  const out = new Array(n + 1).fill(0);
  const spentDay = new Array(n + 1).fill(0);
  const events = Array.from({ length: n + 1 }, () => []);
  const pays = payDates(key);
  const sd = pays.length ? pos(pays[0]) : 1;

  if (state.salary > 0) {
    for (const p of pays) {
      inc[pos(p)] += state.salary;
      events[pos(p)].push({ label: 'Salaire', amount: state.salary, type: 'income', planned: pos(p) > t });
    }
  }
  for (const tx of state.transactions) {
    if (tx.date < ms || tx.date > me) continue;
    const day = pos(tx.date);
    const planned = tx.date > today;
    if (tx.type === 'income') {
      inc[day] += tx.amount;
      events[day].push({ label: tx.note || 'Revenu', amount: tx.amount, type: 'income', planned, txId: tx.id });
    } else if (tx.type === 'transfer') {
      // Virement entre deux comptes : neutre pour la trésorerie globale.
    } else if (tx.type === 'withdraw') {
      events[day].push({ label: `Depuis la réserve · ${(findEnv(tx.envId) || {}).name || 'projet'}`, amount: 0, type: 'project', planned, txId: tx.id });
    } else if (tx.type === 'deposit') {
      out[day] += tx.amount;
      const env = findEnv(tx.envId);
      events[day].push({ label: `Versement · ${env ? env.name : 'projet'}`, amount: -tx.amount, type: 'project', planned, txId: tx.id });
    } else {
      out[day] += tx.amount;
      if (!planned) spentDay[day] += tx.amount;
      const env = spendEnv(tx.envId);
      const type = tx.recId && !env ? 'charge' : 'spend';
      events[day].push({ label: tx.note || (env ? env.name : 'Dépense'), sub: env ? env.name : tx.recId ? 'Prélèvement' : 'Hors enveloppe', amount: -tx.amount, type, planned, txId: tx.id, envId: env ? env.id : null });
    }
  }
  for (const r of state.recurring) {
    for (const date of pendingOcc(r, ms, me)) {
      const day = pos(date);
      if (r.type === 'income') {
        inc[day] += r.amount;
        events[day].push({ label: r.label, amount: r.amount, type: 'income', planned: true, ruleId: r.id });
      } else {
        out[day] += r.amount;
        const env = spendEnv(r.envId);
        events[day].push({ label: r.label, sub: env ? env.name : 'Prélèvement', amount: -r.amount, type: env ? 'spend' : 'charge', planned: true, ruleId: r.id });
      }
    }
  }
  // Épargne des projets, au moment choisi pour chacun : jour de paie, début ou fin du mois budgétaire.
  const savingDay = { pay: sd, first: 1, end: n };
  const savings = new Map();
  for (const e of state.envelopes) {
    if (e.kind !== 'project') continue;
    const c = projectContribution(e, key);
    if (c > 0) savings.set(savingDay[e.timing] || sd, (savings.get(savingDay[e.timing] || sd) || 0) + c);
  }
  for (const [day, amount] of savings) {
    out[day] += amount;
    events[day].push({ label: 'Épargne projets', amount: -amount, type: 'project', planned: day > t });
  }

  const spread = d.isPast ? 0 : d.spend.reduce((s, r) => s + Math.max(0, r.alloc - r.inMonth), 0);
  const futureDays = n - t;
  const perDay = futureDays > 0 ? Math.round(spread / futureDays) : 0;

  // Solde de départ : celui des comptes courants (si connu), sinon le solde saisi dans les réglages.
  const current = state.accounts.filter((a) => a.kind === 'current');
  const accStart = current.length && current.every((a) => a.opening !== null) ? current.reduce((s, a) => s + accountBalance(a, addDays(ms, -1)), 0) : null;
  let openingKnown = accStart !== null || state.openingBalance !== null;
  let balance = 0;
  if (openingKnown && key === cm) balance = accStart !== null ? accStart : state.openingBalance;
  else if (openingKnown && key > cm && depth < 24) balance = cashflow(shiftMonth(key, -1), depth + 1).end;
  else openingKnown = false;

  const days = [];
  const from = Math.max(t, 1);
  let min = { day: from, value: Infinity };
  let max = -Infinity;
  for (let day = 1; day <= n; day++) {
    balance += inc[day] - out[day] - (day > t ? perDay : 0);
    days.push({ day, date: addDays(ms, day - 1), balance, actual: day <= t, events: events[day], spent: spentDay[day] });
    if (day >= from && balance < min.value) min = { day, value: balance };
    if (balance > max) max = balance;
  }
  return { key, days, n, today: t, min, max, end: balance, openingKnown, perDay };
}

export function forecast(count = 6) {
  const cm = currentMonth();
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(cm, i);
    const d = derive(key);
    const planned = [];
    for (const t of state.transactions) {
      if (t.recId || !inCycle(t.date, key) || t.date <= clock.today()) continue;
      if (t.type === 'expense') planned.push({ label: t.note || (findEnv(t.envId) || {}).name || 'Dépense', amount: -t.amount, date: t.date });
      if (t.type === 'income') planned.push({ label: t.note || 'Revenu', amount: t.amount, date: t.date });
    }
    for (const r of state.recurring) {
      if (MONTH_STEPS[r.freq] && MONTH_STEPS[r.freq] > 1) {
        for (const date of pendingOcc(r, cycleStart(key), cycleEnd(key))) {
          planned.push({ label: r.label, amount: r.type === 'income' ? r.amount : -r.amount, date, rec: true });
        }
      }
    }
    planned.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { key, d, planned };
  });
}

export function upcomingEvents(days = 30) {
  const today = clock.today();
  const until = addDays(today, days);
  const list = [];
  for (const t of state.transactions) {
    if (t.date <= today || t.date > until || t.type === 'withdraw' || t.type === 'transfer') continue;
    const env = findEnv(t.envId);
    list.push({
      date: t.date,
      label: t.note || (t.type === 'income' ? 'Revenu' : env ? env.name : 'Dépense'),
      sub: t.type === 'deposit' ? 'Versement projet' : t.type === 'income' ? 'Revenu prévu' : env ? env.name : 'Dépense prévue',
      amount: t.type === 'income' ? t.amount : -t.amount,
      icon: t.type === 'income' ? 'banknote' : t.type === 'deposit' ? 'piggy-bank' : 'calendar-plus'
    });
  }
  for (const r of state.recurring) {
    const dates = pendingOcc(r, addDays(today, 1), until);
    const env = spendEnv(r.envId);
    const shown = r.freq === 'day' ? dates.slice(0, 1) : dates;
    for (const date of shown) {
      list.push({ date, label: r.label, sub: `${FREQS[r.freq].label}${env ? ` · ${env.name}` : ''}`, amount: r.type === 'income' ? r.amount : -r.amount, icon: ruleIcon(r), freq: r.freq });
    }
  }
  if (state.salary > 0) {
    let key = monthOf(today);
    for (let i = 0; i < 3; i++, key = shiftMonth(key, 1)) {
      const date = isoFor(key, clampDay(state.salaryDay, key));
      if (date > today && date <= until) list.push({ date, label: 'Salaire', sub: 'Revenu', amount: state.salary, icon: 'banknote' });
    }
  }
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.amount - b.amount));
  return list;
}

export function monthsToGoal(e, monthly = monthlyOf(e)) {
  if (projectDone(e)) return 0;
  if (monthly <= 0) return null;
  return Math.ceil((e.target - e.saved) / monthly);
}

export function durationLabel(months) {
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${plural(years, 'an', 'ans')}${rest ? ` ${rest} mois` : ''}`;
}

// `reserved` : ce que ce projet bloque déjà dans `freeNow` (0 pour un projet en cours de saisie).
export function projectPlan(e, freeNow = derive().free, reserved = projectContribution(e, currentMonth())) {
  const cm = currentMonth();
  const missing = Math.max(0, e.target - e.saved);
  const months = e.deadline ? Math.max(1, monthDiff(cm, e.deadline) + 1) : null;
  const needed = months ? Math.ceil(missing / months / 100) * 100 : null;
  const capacity = Math.max(0, freeNow + reserved);
  const monthly = e.goalType === 'date' && needed !== null ? needed : e.monthly > 0 ? e.monthly : needed || 0;
  const gap = monthly - capacity;
  const eta = monthly > 0 ? shiftMonth(cm, Math.max(0, Math.ceil(missing / monthly) - 1)) : null;
  const etaCapacity = capacity > 0 ? shiftMonth(cm, Math.max(0, Math.ceil(missing / capacity) - 1)) : null;
  const delay = e.deadline && eta ? monthDiff(e.deadline, eta) : null;
  return { missing, months, needed, capacity, monthly, gap, eta, etaCapacity, delay, late: Boolean(e.deadline && eta && eta > e.deadline) };
}

// Résultats toujours complets : mise nécessaire pour la date, date atteinte avec la mise, écart, compatibilité avec la marge.
export function projectResults(e, p = projectPlan(e)) {
  const lines = [];
  if (e.saved >= e.target && !e.safety) return [['ok', e.goalType === 'fill' ? 'Réserve pleine : la mise reprendra si tu y puises.' : 'Objectif déjà atteint.']];
  const month = (k) => monthName(k).toLowerCase();
  if (e.deadline) lines.push(['', `Pour ${month(e.deadline)}, il faut ${money(p.needed)} par mois (${p.months} mois).`]);
  if (p.monthly > 0 && p.eta) {
    const when = p.delay === null ? '' : p.delay > 0 ? ` (${p.delay} mois de retard)` : p.delay < 0 ? ` (${-p.delay} mois d'avance)` : ' (pile à l\'heure)';
    lines.push([p.late ? 'bad' : '', `Avec ${money(p.monthly)} par mois, tu l'atteins en ${month(p.eta)}${when}.`]);
  }
  if (e.deadline && p.needed !== null && e.goalType !== 'date' && e.monthly > 0 && e.monthly < p.needed) {
    lines.push(['bad', `Il te faudrait mettre ${money(p.needed - e.monthly)} de plus par mois pour tenir ta date.`]);
  }
  lines.push(['', `Ta marge actuelle : ${money(p.capacity)} par mois.`]);
  if (p.monthly > 0) {
    lines.push(p.gap > 0
      ? ['bad', `Il manque ${money(p.gap)} par mois sur ta marge actuelle pour cette mise de ${money(p.monthly)} (après charges et enveloppes).`]
      : ['ok', `Compatible avec ta marge actuelle (après charges et enveloppes) : il te resterait ${money(-p.gap)} par mois.`]);
  }
  if (p.gap > 0 && p.capacity > 0 && p.etaCapacity) lines.push(['', `Avec toute ta marge (${money(p.capacity)}/mois) : vers ${month(p.etaCapacity)}.`]);
  return lines;
}

// Simulation mois par mois, en centimes entiers : mise (+ hausse prévue), rendement et inflation saisis par l'utilisateur.
export function simulate({ target, saved, monthly, start = currentMonth(), yieldBp = 0, inflationBp = 0, raise = 0, raiseFrom = null, max = 600 }) {
  let bal = saved;
  let goal = target;
  const points = [{ key: shiftMonth(start, -1), bal, goal }];
  if (bal >= goal) return { reached: shiftMonth(start, -1), months: 0, points };
  for (let i = 0; i < max; i++) {
    const key = shiftMonth(start, i);
    bal += monthly + (raise > 0 && raiseFrom && key >= raiseFrom ? raise : 0);
    bal += Math.round((bal * yieldBp) / 120000);
    goal += Math.round((goal * inflationBp) / 120000);
    points.push({ key, bal, goal });
    if (bal >= goal) return { reached: key, months: i + 1, points };
    if (monthly <= 0 && !(raise > 0) && yieldBp <= 0) break;
  }
  return { reached: null, months: null, points };
}

// Scénarios par défaut : tirés des chiffres de l'utilisateur, jamais d'un taux inventé.
export function simScenarios(e, p = projectPlan(e)) {
  const sim = e.sim || {};
  const sc = sim.scenarios || {};
  const real = sc.real ?? (p.monthly || 0);
  const prudent = sc.prudent ?? Math.min(real, p.capacity || real);
  const ambitious = sc.ambitious ?? Math.max(real, p.capacity);
  return { prudent, real, ambitious };
}

export function runScenarios(e, p = projectPlan(e)) {
  const sim = e.sim || {};
  const sc = simScenarios(e, p);
  const base = { target: e.target, saved: e.saved, yieldBp: sim.yieldBp || 0, inflationBp: sim.inflationBp || 0, raise: sim.raise || 0, raiseFrom: sim.raiseFrom || null };
  return Object.fromEntries(Object.entries(sc).map(([k, monthly]) => [k, { monthly, ...simulate({ ...base, monthly }) }]));
}

// Conseils calculés à partir de l'historique (enveloppes sous-utilisées) et de la marge.
export function projectAdvice() {
  const out = [];
  const closed = state.closings.slice(-6);
  const under = new Map();
  for (const c of closed) {
    for (const env of c.snapshot.envs || []) {
      if (!spendEnv(env.id)) continue;
      const u = under.get(env.id) || { name: env.name, gap: 0, n: 0 };
      u.gap += env.budget - env.spent;
      u.n += 1;
      under.set(env.id, u);
    }
  }
  const unused = [...under.values()].map((u) => ({ ...u, avg: Math.round(u.gap / u.n) })).filter((u) => u.avg >= 500).sort((a, b) => b.avg - a.avg);
  const total = unused.reduce((s, u) => s + u.avg, 0);
  if (total > 0) out.push({ icon: 'lightbulb', text: `Tes enveloppes sous-utilisées libèrent environ ${moneyRound(total)} par mois (moyenne sur ${closed.length} ${plural(closed.length, 'mois', 'mois')} clôturés).` });
  const projects = state.envelopes.filter((e) => e.kind === 'project' && e.category !== 'wish' && !projectDone(e) && !e.safety)
    .sort((a, b) => a.priority - b.priority);
  const top = projects.find((e) => projectPlan(e).monthly > 0);
  if (top) {
    const p = projectPlan(top);
    const months = (m) => Math.ceil(p.missing / m);
    if (unused.length) {
      const cut = Math.floor(unused[0].avg / 500) * 500;
      const gain = months(p.monthly) - months(p.monthly + cut);
      if (cut > 0 && gain > 0) out.push({ icon: 'trending-up', text: `En réduisant « ${unused[0].name} » de ${moneyRound(cut)}/mois, « ${top.name} » arrive ${gain} ${plural(gain, 'mois', 'mois')} plus tôt.` });
    }
    if (p.capacity > p.monthly && p.eta && p.etaCapacity && p.etaCapacity < p.eta) {
      out.push({ icon: 'zap', text: `Avec toute ta marge (${money(p.capacity)}/mois), « ${top.name} » serait atteint en ${monthName(p.etaCapacity).toLowerCase()} au lieu de ${monthName(p.eta).toLowerCase()}.` });
    }
  }
  return out;
}

export function computeInsights(d) {
  const list = [];
  const push = (tone, icon, title, text, tab, action) => list.push({ tone, icon, title, text, tab, action });
  const age = backupAge();
  if ((state.transactions.length || state.envelopes.length) && age >= BACKUP_DAYS) {
    push('warn', 'download', 'Pense à sauvegarder', state.prefs.lastExport
      ? `Ton dernier export date de ${age} jours. Tes données ne sont que sur cet appareil : touche pour exporter.`
      : `Aucune sauvegarde depuis ${age} jours. Tes données ne sont que sur cet appareil : touche pour exporter.`, null, 'export');
  }
  if (d.income <= 0) return list;
  const today = clock.today();

  if (d.free < 0) {
    push('bad', 'triangle-alert', 'Budget dépassé', `Tu as prévu ${money(-d.free)} de plus que tes revenus du mois.`);
  }

  const cash = cashflow(d.key);
  if (cash.openingKnown && cash.min.value < 0) {
    push('bad', 'triangle-alert', 'Découvert probable', `Le ${shortDate(cash.days[cash.min.day - 1].date)}, ton solde prévu descend à ${money(cash.min.value)}.`, 'agenda');
  }

  const pending = state.prefs.closing.auto ? [] : pendingClosings();
  if (pending.length && d.isCurrent) {
    push('warn', 'calendar-check', `Clôture ${ofMonth(pending[0])} à faire`, 'Choisis quoi faire de ce qui reste : reporter, remettre au budget ou épargner. Touche pour commencer.', null, 'close');
  }

  const over = d.spend.filter((r) => r.left < 0).sort((a, b) => a.left - b.left);
  for (const r of over.slice(0, 2)) {
    const movable = d.isCurrent && r.env.period !== 'week' && r.env.period !== '2weeks';
    push('bad', 'circle-alert', `« ${r.env.name} » est dépassée`, `+${money(-r.left)} au-dessus du budget ${PERIODS[r.env.period].the}, pris sur ton reste à vivre.${movable ? ' Touche pour le couvrir avec une autre enveloppe.' : ''}`, null, movable ? `cover:${r.env.id}` : null);
  }

  const near = d.spend
    .filter((r) => r.left > 0 && r.budget > 0 && r.used / r.budget >= 0.85 && daysBetween(today, r.window.end) > 2)
    .sort((a, b) => b.used / b.budget - a.used / a.budget);
  for (const r of near.slice(0, 2)) {
    const days = daysBetween(today, r.window.end) + 1;
    push('warn', 'circle-alert', `« ${r.env.name} » à ${Math.round((r.used / r.budget) * 100)} %`, `Il reste ${money(r.left)} pour ${days} jours.`);
  }

  const soon = upcomingEvents(3).filter((e) => e.amount < 0 && e.freq !== 'day');
  if (soon.length === 1) {
    const e = soon[0];
    push('info', 'calendar-clock', `${relDay(e.date)} : ${e.label}`, `${money(-e.amount)} à prévoir.`, 'agenda');
  } else if (soon.length > 1) {
    const total = soon.reduce((s, e) => s - e.amount, 0);
    const names = [...new Set(soon.map((e) => e.label))];
    push('info', 'calendar-clock', `${soon.length} paiements dans les 3 jours`, `${money(total)} au total : ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}.`, 'agenda');
  }

  if (d.isCurrent) {
    const ahead = forecast(6).slice(1).find((f) => f.d.free < 0);
    if (ahead) {
      push('warn', 'calendar-days', `${monthName(ahead.key)} sera serré`, `Ce qui est prévu dépasse tes revenus de ${money(-ahead.d.free)}.`, 'agenda');
    }
  }

  if (d.orphan > 0) {
    push('info', 'info', 'Hors enveloppe', `${money(d.orphan)} ce mois-ci, pris sur ton reste à vivre.`, 'journal');
  }

  if (state.prefs.pro.enabled && d.isCurrent) {
    for (const t of hooks.proThresholds(today.slice(0, 4))) {
      if (t.ratio >= 1) push('bad', 'briefcase', `${t.label} dépassé`, `Ton chiffre d'affaires ${today.slice(0, 4)} (${money(t.ca)}) dépasse ${money(t.limit)}. Vérifie ta situation auprès de l'URSSAF.`, 'report');
      else if (t.ratio >= 0.9) push('warn', 'briefcase', `${t.label} bientôt atteint`, `${money(t.ca)} sur ${money(t.limit)} cette année (${Math.round(t.ratio * 100)} %).`, 'report');
    }
  }

  const order = { bad: 0, warn: 1, info: 2, ok: 3 };
  list.sort((a, b) => order[a.tone] - order[b.tone]);
  const top = list.slice(0, 4);
  if (!top.length) {
    push('ok', 'circle-check', 'Tout est sous contrôle', d.free > 0 ? `Il te reste ${money(d.free)} de libre ce mois-ci.` : 'Tes revenus sont entièrement répartis.');
    return list;
  }
  return top;
}

// Ce que la clôture d'un mois reporte sur le suivant (positif : argent en plus ; négatif : déficit à couvrir).
export function closingCarry(c) {
  const lines = c.lines.reduce((s, l) => s + (l.action === 'budget' && l.left > 0 ? l.left : 0), 0);
  const free = c.free > 0 ? (c.freeAction === 'budget' ? c.free : 0) : c.free;
  return lines + free;
}

// Enveloppes concernées par la clôture d'un mois : celles dont la période se termine avec lui.
export const closableRows = (key) => derive(key).spend.filter((r) => r.env.period !== 'week' && r.env.period !== '2weeks' && r.window.end === cycleEnd(key));

export function pendingClosings() {
  const cm = currentMonth();
  const out = [];
  if (!state.lastClosed) return out;
  for (let k = shiftMonth(state.lastClosed, 1); k < cm && out.length < 36; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

export const safetyProject = () => state.envelopes.find((e) => e.kind === 'project' && e.safety);

// Matelas de sécurité : projet spécial, créé une seule fois (si on le supprime, il ne revient pas).
export function ensureSafety() {
  if (state.prefs.safetyCreated || !state.prefs.onboarded) return null;
  state.prefs.safetyCreated = true;
  const same = state.envelopes.find((e) => e.kind === 'project' && normName(e.name) === normName('Matelas de sécurité'));
  if (same) {
    same.safety = true;
    return same;
  }
  const env = {
    id: uid(), kind: 'project', name: 'Matelas de sécurité', target: Math.max(100000, state.salary * 3), saved: 0, monthly: 0,
    mode: 'plan', deadline: null, startMonth: null, safety: true, createdAt: clock.now()
  };
  state.envelopes.push(env);
  return env;
}

// Choix par défaut pour une clôture, d'après les préférences mémorisées.
export function closingDefaults(key) {
  const pref = state.prefs.closing;
  const proj = findEnv(pref.projectId) || safetyProject() || null;
  const lines = {};
  for (const r of closableRows(key)) {
    const action = pref.env === 'project' && !proj ? 'keep' : pref.env;
    lines[r.env.id] = { action, projectId: action === 'project' ? proj.id : null };
  }
  const freeAction = pref.free === 'project' && proj ? 'project' : 'budget';
  return { lines, freeAction, freeProjectId: freeAction === 'project' ? proj.id : null };
}

// Clôture d'un mois budgétaire : instantané figé, destination des restes, déficit reporté.
export function closeMonth(key, choice = closingDefaults(key)) {
  if (state.closings.some((c) => c.key === key)) return fail('Ce mois est déjà clôturé.');
  if (key >= currentMonth()) return fail('Ce mois n\'est pas encore terminé.');
  const d = derive(key);
  const rows = closableRows(key);
  const nextStart = cycleStart(shiftMonth(key, 1));
  const deposits = [];
  const deposit = (projectId, amount, note) => {
    const p = findEnv(projectId);
    if (!p || p.kind !== 'project' || amount <= 0) return 0;
    const room = p.safety ? amount : Math.max(0, p.target - p.saved);
    const put = Math.min(amount, room);
    if (put <= 0) return 0;
    const tx = { id: uid(), type: 'deposit', envId: p.id, amount: put, note: cleanNote(note), date: nextStart, ts: clock.now(), src: 'close', closeKey: key };
    state.transactions.push(tx);
    p.saved += put;
    deposits.push(tx);
    return put;
  };
  const lines = rows.map((r) => {
    const pick = (choice.lines && choice.lines[r.env.id]) || { action: 'keep' };
    const line = { envId: r.env.id, name: r.env.name, left: r.left, action: CLOSE_ACTIONS.includes(pick.action) ? pick.action : 'keep', projectId: null };
    if (line.action === 'project' && r.left > 0) {
      const put = deposit(pick.projectId, r.left, `Reste de ${r.env.name}`);
      line.projectId = pick.projectId;
      if (put < r.left) line.action = 'budget';
      line.left = r.left;
    } else if (line.action === 'project') {
      line.action = 'keep';
    }
    return line;
  });
  let freeAction = choice.freeAction === 'project' ? 'project' : 'budget';
  let freeProjectId = null;
  if (freeAction === 'project' && d.free > 0) {
    const put = deposit(choice.freeProjectId, d.free, `Reste à vivre de ${monthName(key).toLowerCase()}`);
    if (put === d.free) freeProjectId = choice.freeProjectId;
    else freeAction = 'budget';
  }
  const spentAll = state.transactions.filter((t) => t.type === 'expense' && inCycle(t.date, key)).reduce((s, t) => s + t.amount, 0);
  const snapshot = {
    key, start: cycleStart(key), end: cycleEnd(key), income: d.income, carried: d.carried, charges: d.charges, health: healthScore(key).score,
    envAlloc: d.envAlloc, projects: d.projectsMonthly + d.deposits, orphan: d.orphan, free: d.free, spent: spentAll,
    envs: d.spend.map((r) => ({ id: r.env.id, name: r.env.name, period: r.env.period, budget: r.budget, spent: r.used, left: r.left, alloc: r.alloc })),
    saved: state.envelopes.filter((e) => e.kind === 'project').map((e) => ({ id: e.id, name: e.name, saved: e.saved }))
  };
  const closing = { key, at: clock.now(), lines, free: d.free, freeAction, freeProjectId, snapshot };
  state.closings.push(closing);
  state.closings.sort((a, b) => (a.key < b.key ? -1 : 1));
  state.lastClosed = maxMonth(state.lastClosed || key, key);
  return ok({ closing, deposits });
}

// Annuler une clôture (bouton « Annuler ») : retire les versements créés et l'instantané.
export function reopenMonth(key) {
  const i = state.closings.findIndex((c) => c.key === key);
  if (i === -1) return fail('Mois non clôturé.');
  state.closings.splice(i, 1);
  state.transactions = state.transactions.filter((t) => {
    if (t.src !== 'close' || t.closeKey !== key) return true;
    const p = findEnv(t.envId);
    if (p) p.saved = Math.max(0, p.saved - t.amount);
    return false;
  });
  state.lastClosed = shiftMonth(key, -1);
  return ok();
}

// Déplacer de l'argent entre enveloppes (ou depuis / vers le reste à vivre) pour un mois budgétaire.
export function moveMoney({ from, to, amount, key = currentMonth() }) {
  if (amount === null || !(amount > 0)) return fail('Indique un montant valide, supérieur à 0.');
  if (from === to) return fail('Choisis deux enveloppes différentes.');
  const ok1 = (v) => v === 'free' || Boolean(spendEnv(v));
  if (!ok1(from) || !ok1(to)) return fail('Enveloppe introuvable.');
  if ([from, to].some((v) => v !== 'free' && (spendEnv(v).period === 'week' || spendEnv(v).period === '2weeks'))) {
    return fail('Les enveloppes à la semaine se remettent à zéro chaque semaine : choisis une enveloppe au mois ou plus.');
  }
  if (from === 'free') {
    const free = derive(key).free;
    if (amount > free) return fail(free <= 0 ? 'Ton reste à vivre est déjà entièrement réparti.' : `Ton reste à vivre ne permet que ${money(free)}.`);
  } else {
    const left = envRow(spendEnv(from), key).left;
    if (amount > left) return fail(left <= 0 ? `« ${spendEnv(from).name} » est déjà vide.` : `Il ne reste que ${money(left)} dans « ${spendEnv(from).name} ».`);
  }
  const move = { id: uid(), key, date: key === currentMonth() ? clock.today() : cycleStart(key), from, to, amount, ts: clock.now() };
  state.moves.push(move);
  commit();
  return ok(move);
}

export function deleteMove(id) {
  const i = state.moves.findIndex((m) => m.id === id);
  if (i === -1) return fail('Déplacement introuvable.');
  const [move] = state.moves.splice(i, 1);
  commit();
  return ok(move);
}

// Remettre toutes les enveloppes à zéro d'un coup (les dépenses restent au journal).
export function resetAllEnvelopes() {
  const before = state.envelopes.filter((e) => e.kind === 'spend').map((e) => [e.id, e.reset]);
  if (!before.length) return fail('Aucune enveloppe à remettre à zéro.');
  const stamp = { date: clock.today(), ts: clock.now() + 1 };
  for (const e of state.envelopes) if (e.kind === 'spend') e.reset = { ...stamp };
  commit();
  return ok(before);
}

// ——— Analyses (phase 6) ———
// Besoins / envies pour le repère 50/30/20 (à titre indicatif) : d'après le nom de l'enveloppe.
export const NEEDS = /course|aliment|supermarch|transport|essence|carbu|sante|pharma|medecin|loyer|energie|electric|assurance|enfant|ecole|cantine|creche|hygien|mutuelle|telephone|internet/;
export const isNeed = (env) => NEEDS.test(normName(env.name));
export const firstKey = () => maxMonth(budgetKey(state.prefs.since || clock.today()), shiftMonth(currentMonth(), -23));
// Mois budgétaires analysables : depuis le début d'usage, jusqu'au mois en cours (au plus `count`).
export function analysisKeys(count = 6) {
  const cm = currentMonth();
  const keys = [];
  for (let k = maxMonth(shiftMonth(cm, -(count - 1)), firstKey()); k <= cm; k = shiftMonth(k, 1)) keys.push(k);
  return keys;
}

// Répartition du mois : besoins, envies, épargne (en % des revenus).
export function splitNeeds(d) {
  let needs = d.charges;
  let wants = d.orphan;
  for (const r of d.spend) {
    if (isNeed(r.env)) needs += r.alloc;
    else wants += r.alloc;
  }
  const savings = d.projectsMonthly + d.deposits + Math.max(0, d.free);
  const pct = (v) => (d.income > 0 ? Math.round((v / d.income) * 100) : 0);
  return { needs, wants, savings, pNeeds: pct(needs), pWants: pct(wants), pSavings: pct(savings), rate: pct(d.projectsMonthly + d.deposits) };
}

// Jours sans dépense (hors prélèvements automatiques) : série en cours et record sur 60 jours.
export function noSpendStreak() {
  const today = clock.today();
  const days = new Set(state.transactions.filter((t) => t.type === 'expense' && !t.recId && t.date <= today).map((t) => t.date));
  const since = maxISO(addDays(today, -59), state.prefs.since || today);
  let best = 0;
  let run = 0;
  for (let d = since; d <= today; d = addDays(d, 1)) {
    run = days.has(d) ? 0 : run + 1;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let d = days.has(today) ? addDays(today, -1) : today; d >= since && !days.has(d); d = addDays(d, -1)) current++;
  return { current: days.has(today) ? 0 : current, best };
}

// Abonnements : coût annuel des prélèvements récurrents de type abonnement.
export const SUBSCRIPTION_WORDS = /netflix|spotify|disney|deezer|prime|canal|abonnement|youtube|icloud|apple|google|salle|sport|fitness|basic fit|gym|presse|journal|magazine|forfait|box|cloud|xbox|playstation|nintendo|dropbox|adobe|microsoft/;
export function subscriptionsCost() {
  const today = clock.today();
  const list = state.recurring
    .filter((r) => r.type === 'expense' && r.freq !== 'day' && (!r.end || r.end >= today) && SUBSCRIPTION_WORDS.test(normText(r.label)))
    .map((r) => ({ rule: r, yearly: monthlyEq(r.amount, r.freq) * 12, old: daysBetween(r.start, today) >= 180 }))
    .sort((a, b) => b.yearly - a.yearly);
  return { list, total: list.reduce((s, x) => s + x.yearly, 0) };
}

// Suggestions à partir des mois clôturés : enveloppe sous-utilisée ou dépassée 3 mois de suite → nouveau budget.
export const roundUp5 = (c) => Math.max(500, Math.ceil(c / 500) * 500);
export function envelopeSuggestions() {
  const last = state.closings.slice(-3);
  if (last.length < 3) return [];
  const out = [];
  for (const env of state.envelopes.filter((e) => e.kind === 'spend' && e.period === 'month')) {
    const rows = last.map((c) => (c.snapshot.envs || []).find((x) => x.id === env.id)).filter(Boolean);
    if (rows.length < 3) continue;
    const spent = rows.map((r) => r.spent);
    if (rows.every((r) => r.spent > r.budget)) {
      const to = roundUp5(Math.round(spent.reduce((s, v) => s + v, 0) / 3));
      if (to !== env.max) out.push({ env, kind: 'over', to, text: `« ${env.name} » est dépassée 3 mois de suite (${spent.map(moneyRound).join(', ')}). Un budget de ${moneyRound(to)} serait plus réaliste.` });
    } else if (rows.every((r) => r.spent < r.budget * 0.7)) {
      const to = roundUp5(Math.max(...spent));
      if (to < env.max) out.push({ env, kind: 'under', to, text: `« ${env.name} » reste sous-utilisée 3 mois de suite (au plus ${moneyRound(Math.max(...spent))}). Passer à ${moneyRound(to)} libérerait ${moneyRound(env.max - to)} par mois.` });
    }
  }
  return out;
}

// Score de santé du budget sur 100, expliqué facteur par facteur.
export function healthScore(key = currentMonth()) {
  const d = derive(key);
  const isNow = key === currentMonth();
  const factors = [];
  const add = (id, label, points, max, tip) => factors.push({ id, label, points: Math.max(0, Math.min(max, Math.round(points))), max, tip });
  const ratio = d.income > 0 ? d.free / d.income : -1;
  add('free', 'Reste à vivre', ratio < 0 ? 0 : ratio >= 0.1 ? 25 : 25 * (ratio / 0.1), 25,
    ratio < 0 ? 'Ton mois dépasse tes revenus : réduis une enveloppe ou une mise.' : ratio < 0.1 ? 'Garde au moins 10 % de marge pour les imprévus.' : 'Bonne marge pour les imprévus.');
  const tracked = d.spend.filter((r) => r.budget > 0);
  const kept = tracked.filter((r) => r.used <= r.budget).length;
  add('envelopes', 'Enveloppes respectées', tracked.length ? 20 * (kept / tracked.length) : 20, 20,
    kept === tracked.length ? 'Tous tes plafonds sont tenus.' : `${tracked.length - kept} ${plural(tracked.length - kept, 'enveloppe dépassée', 'enveloppes dépassées')} : couvre-les ou ajuste leur budget.`);
  const rate = d.income > 0 ? (d.projectsMonthly + d.deposits) / d.income : 0;
  add('savings', 'Épargne du mois', 20 * Math.min(1, rate / 0.2), 20,
    rate >= 0.2 ? 'Tu mets de côté au moins 20 % de tes revenus.' : `Tu épargnes ${Math.round(rate * 100)} % de tes revenus ; vise un peu plus si ta marge le permet.`);
  const monthlyNeeds = Math.max(1, d.charges + d.envAlloc);
  const cushion = (safetyProject() ? safetyProject().saved : 0) + state.accounts.filter((a) => a.kind === 'savings').reduce((s, a) => s + Math.max(0, accountBalance(a) || 0), 0);
  const months = cushion / monthlyNeeds;
  add('cushion', 'Matelas de sécurité', 15 * Math.min(1, months / 3), 15,
    months >= 3 ? 'Ton matelas couvre 3 mois de dépenses.' : `Ton matelas couvre ${months.toFixed(1).replace('.', ',')} mois de dépenses ; l'objectif courant est 3 mois.`);
  const negatives = isNow ? forecast(6).slice(1).filter((f) => f.d.free < 0).length : d.free < 0 ? 1 : 0;
  add('forecast', 'Mois à venir', 10 - 4 * negatives, 10, negatives ? `${negatives} ${plural(negatives, 'mois prévu', 'mois prévus')} dans le rouge : anticipe dès maintenant.` : 'Aucun mois à venir dans le rouge.');
  const spentAll = d.spend.reduce((s, r) => s + r.inMonth, 0) + d.orphan;
  const orphanShare = spentAll > 0 ? d.orphan / spentAll : 0;
  const backupOk = !isNow || backupAge() < BACKUP_DAYS;
  add('hygiene', 'Suivi et sauvegarde', (orphanShare <= 0.1 ? 5 : 0) + (backupOk ? 5 : 0), 10,
    orphanShare > 0.1 ? 'Range tes dépenses hors enveloppe pour mieux voir où part ton argent.' : backupOk ? 'Dépenses bien rangées, sauvegarde récente.' : 'Pense à exporter une sauvegarde.');
  const score = factors.reduce((s, f) => s + f.points, 0);
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Solide' : score >= 40 ? 'À surveiller' : 'Fragile';
  return { key, score, label, factors };
}

// Rapports mensuels (6 derniers mois analysables).
export function monthlyReport(count = 6) {
  let cumul = 0;
  return analysisKeys(count).map((key) => {
    const d = derive(key);
    const s = cycleStart(key);
    const e = minISO(cycleEnd(key), clock.today());
    const spent = state.transactions.reduce((a, t) => a + (t.type === 'expense' && t.date >= s && t.date <= e ? t.amount : 0), 0);
    const saved = d.projectsMonthly + d.deposits;
    cumul += saved;
    return { key, income: d.income, spent, saved, cumul, byEnv: d.spend.map((r) => ({ id: r.env.id, name: r.env.name, spent: r.inMonth })), health: healthScore(key).score };
  });
}

// Heures de saisie des dépenses (le jour même) : matin, midi, après-midi, soir, nuit.
export function spendingHours(key = currentMonth()) {
  const slots = [['Nuit', 0, 6], ['Matin', 6, 12], ['Midi', 12, 14], ['Après-midi', 14, 18], ['Soir', 18, 24]].map(([label, from, to]) => ({ label, from, to, total: 0, n: 0 }));
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.recId || !t.ts || !inCycle(t.date, key)) continue;
    const at = new Date(t.ts);
    if (localISO(at) !== t.date) continue;
    const slot = slots.find((s) => at.getHours() >= s.from && at.getHours() < s.to);
    slot.total += t.amount;
    slot.n += 1;
  }
  return slots;
}

export function runRollover() {
  const current = currentMonth();
  if (state.lastRollover >= current) return new Map();
  const credits = new Map();
  let key = state.lastRollover;
  let guard = 0;
  while (key < current && guard++ < 600) {
    const closing = key;
    key = shiftMonth(key, 1);
    for (const e of state.envelopes) {
      if (e.kind !== 'project' || e.mode !== 'active' || e.category === 'wish' || e.saved >= e.target) continue;
      const monthly = monthlyOf(e, closing);
      if (monthly <= 0 || (e.startMonth && closing < e.startMonth)) continue;
      const add = Math.min(Math.max(0, monthly - coveredIn(e, closing)), e.target - e.saved);
      if (add <= 0) continue;
      e.saved += add;
      credits.set(e.id, (credits.get(e.id) || 0) + add);
    }
  }
  state.lastRollover = current;
  return credits;
}

export function validateEnvelope(input, existing) {
  const name = cleanName(input.name);
  if (!name) return fail('Donne un nom.');
  if (state.envelopes.some((e) => e.id !== (existing && existing.id) && normName(e.name) === normName(name))) {
    return fail(`« ${name} » existe déjà.`);
  }
  const d = derive();
  const key = d.key;
  if (input.kind === 'project') {
    if (input.target === null || input.target <= 0) return fail('Indique un objectif valide, supérieur à 0 (ex : 10000).');
    if (input.saved === null) return fail('Indique un montant déjà épargné valide (0 si rien).');
    if (input.saved > input.target) return fail("Le montant déjà épargné ne peut pas dépasser l'objectif.");
    if (input.monthly === null) return fail('Indique une mise mensuelle valide, ou laisse vide.');
    if (input.deadline && input.deadline < key) return fail("L'échéance doit être ce mois-ci ou plus tard.");
    if (input.goalType === 'date' && !input.deadline) return fail('Choisis une date pour cet objectif, ou un autre type d\'objectif.');
    if (input.mode === 'active') {
      if (monthlyOf(input) <= 0 && input.saved < input.target) return fail('Indique une mise par mois, ou une date pour la calculer.');
      const probe = { ...(existing || {}), ...input, mode: 'active' };
      const first = maxMonth(key, probe.startMonth || key);
      const free = first === key ? d.free : derive(first).free;
      const next = projectContribution(probe, first);
      const prev = existing ? projectContribution(existing, first) : 0;
      if (next - prev > free) {
        const cap = Math.max(0, free + prev);
        return fail(`Ta marge actuelle permet ${money(cap)} par mois au maximum. Passe en mode « Plan » pour simuler ce projet sans bloquer d'argent.`);
      }
    }
    return ok(name);
  }
  if (input.max === null || input.max <= 0) return fail('Indique un budget valide, supérieur à 0 (ex : 250).');
  const probe = { ...(existing || { id: '__new__', anchor: clock.today(), reset: null }), kind: 'spend', max: input.max, period: input.period };
  const next = envMonthAlloc(probe, key).alloc;
  const prev = existing ? envMonthAlloc(existing, key).alloc : 0;
  if (next - prev > d.free) {
    return fail(d.free <= 0 ? 'Tout ton budget du mois est déjà réparti.' : `Il ne te reste que ${money(d.free)} à répartir ce mois-ci.`);
  }
  return ok(name);
}

// Champs facultatifs d'un projet (type d'objectif, versement, priorité, couleur, icône, catégorie).
export function projectExtras(input, base = {}) {
  const goalType = GOAL_TYPES[input.goalType] ? input.goalType : base.goalType || 'monthly';
  return {
    goalType,
    timing: TIMINGS[input.timing] ? input.timing : base.timing || 'pay',
    priority: clampInt(input.priority ?? base.priority, 1, 3, 2),
    color: PALETTE[input.color] ? input.color : base.color || 'amber',
    icon: PROJECT_ICONS.includes(input.icon) ? input.icon : base.icon || 'target',
    category: input.category === 'wish' || (input.category === undefined && base.category === 'wish') ? 'wish' : 'project'
  };
}

export function createEnvelope(input) {
  if (derive().income <= 0 && !(input.kind === 'project' && input.mode === 'plan')) return fail('Commence par renseigner ton salaire global.');
  const check = validateEnvelope(input, null);
  if (!check.ok) return check;
  const base = { id: uid(), name: check.data, createdAt: clock.now() };
  const env = input.kind === 'project'
    ? {
      ...base, kind: 'project', target: input.target, saved: input.saved, monthly: input.goalType === 'date' ? monthlyOf(input) : input.monthly, mode: input.mode,
      deadline: input.goalType === 'fill' ? null : input.deadline || null, startMonth: isMonthKey(input.startMonth) ? input.startMonth : null,
      ...projectExtras(input), notes: '', checklist: []
    }
    : {
      ...base, kind: 'spend', max: input.max, period: input.period, anchor: clock.today(), reset: null,
      color: PALETTE[input.color] ? input.color : envLook(check.data).color, icon: ENV_ICONS.includes(input.icon) ? input.icon : envLook(check.data).icon
    };
  state.envelopes.push(env);
  setLastAddedId(env.id);
  commit();
  return ok(env);
}

export function updateEnvelope(id, input) {
  const env = findEnv(id);
  if (!env) return fail('Enveloppe introuvable.');
  const check = validateEnvelope({ ...input, kind: env.kind }, env);
  if (!check.ok) return check;
  env.name = check.data;
  if (env.kind === 'project') {
    Object.assign(env, { target: input.target, saved: input.saved, monthly: input.monthly, mode: input.mode, deadline: input.goalType === 'fill' ? null : input.deadline || null }, projectExtras(input, env));
    if (input.startMonth !== undefined) env.startMonth = isMonthKey(input.startMonth) ? input.startMonth : null;
  } else {
    if (env.period !== input.period) env.anchor = clock.today();
    env.max = input.max;
    env.period = input.period;
    if (PALETTE[input.color]) env.color = input.color;
    if (ENV_ICONS.includes(input.icon)) env.icon = input.icon;
  }
  commit();
  return ok(env);
}

// Notes, étapes, simulation, achat d'une envie : pas de règle de calcul, pas de contrôle de marge.
export function updateProjectInfo(id, patch) {
  const env = findEnv(id);
  if (!env || env.kind !== 'project') return fail('Projet introuvable.');
  if (patch.notes !== undefined) env.notes = String(patch.notes).replace(/\r/g, '').slice(0, NOTES_MAX);
  if (patch.checklist !== undefined) env.checklist = patch.checklist.slice(0, 100).map((c) => ({ id: c.id || uid(), text: cleanText(c.text, 120), done: Boolean(c.done) })).filter((c) => c.text);
  if (patch.sim !== undefined) env.sim = cleanSim(patch.sim);
  if (patch.boughtAt !== undefined) {
    if (isISO(patch.boughtAt)) env.boughtAt = patch.boughtAt;
    else delete env.boughtAt;
  }
  commit();
  return ok(env);
}

export function addWish({ name, price }) {
  if (price === null || !(price > 0)) return fail('Indique un prix valide (ex : 59).');
  return createEnvelope({ kind: 'project', name, target: price, saved: 0, monthly: 0, deadline: null, mode: 'plan', goalType: 'monthly', category: 'wish', icon: 'shopping-bag', color: 'violet', priority: 3 });
}

export function resetEnvelope(id) {
  const env = spendEnv(id);
  if (!env) return fail('Enveloppe introuvable.');
  const before = envRow(env, currentMonth());
  env.reset = { date: clock.today(), ts: clock.now() + 1 };
  commit();
  return ok({ env, cleared: before.spent });
}

export function deleteEnvelope(id) {
  const index = state.envelopes.findIndex((e) => e.id === id);
  if (index === -1) return fail('Enveloppe introuvable.');
  const before = derive().free;
  const [env] = state.envelopes.splice(index, 1);
  state.transactions = state.transactions.filter((t) => !(t.type === 'deposit' && t.envId === id));
  state.transactions.forEach((t) => { if (t.envId === id) t.envId = null; });
  state.recurring.forEach((r) => { if (r.envId === id) r.envId = null; });
  state.rules = state.rules.filter((r) => r.envId !== id);
  state.moves = state.moves.filter((m) => m.from !== id && m.to !== id);
  state.favorites.forEach((f) => { if (f.envId === id) f.envId = null; });
  if (state.prefs.lastEnvId === id) state.prefs.lastEnvId = null;
  if (state.prefs.closing.projectId === id) state.prefs.closing.projectId = null;
  const reinjected = derive().free - before;
  commit();
  return ok({ env, reinjected });
}

export function validateRule(input) {
  const label = cleanName(input.label);
  if (!label) return fail('Donne un nom (ex : Loyer, Café, APL).');
  if (input.amount === null || input.amount <= 0) return fail('Indique un montant valide, supérieur à 0.');
  if (!FREQS[input.freq]) return fail('Choisis une répétition.');
  if (!isISO(input.start)) return fail('Choisis une date de départ valide.');
  if (input.end && (!isISO(input.end) || input.end < input.start)) return fail('La date de fin doit être après la date de départ.');
  if (!['expense', 'income'].includes(input.type)) return fail('Type inconnu.');
  if (input.envId && !spendEnv(input.envId)) return fail('Enveloppe introuvable.');
  return ok(label);
}

export function addRule(input, { silent = false } = {}) {
  const check = validateRule(input);
  if (!check.ok) return check;
  const rule = {
    id: uid(), type: input.type, label: check.data, amount: input.amount, freq: input.freq,
    start: input.start, end: input.end || null, envId: input.type === 'expense' ? input.envId || null : null,
    postedUntil: addDays(maxISO(input.start, cycleStart(currentMonth())), -1)
  };
  state.recurring.push(rule);
  const posted = postRecurring();
  if (rule.envId) state.prefs.lastEnvId = rule.envId;
  if (!silent) commit();
  return ok({ rule, posted: posted.filter((t) => t.recId === rule.id) });
}

export function updateRule(id, input) {
  const rule = findRule(id);
  if (!rule) return fail('Élément récurrent introuvable.');
  const check = validateRule(input);
  if (!check.ok) return check;
  const startChanged = input.start !== rule.start;
  Object.assign(rule, {
    type: input.type, label: check.data, amount: input.amount, freq: input.freq, start: input.start,
    end: input.end || null, envId: input.type === 'expense' ? input.envId || null : null
  });
  if (startChanged && input.start > clock.today()) rule.postedUntil = minISO(rule.postedUntil, addDays(input.start, -1));
  const posted = postRecurring();
  commit();
  return ok({ rule, posted });
}

export function deleteRule(id, { purgeFuture = true } = {}) {
  const index = state.recurring.findIndex((r) => r.id === id);
  if (index === -1) return fail('Élément récurrent introuvable.');
  const [rule] = state.recurring.splice(index, 1);
  if (purgeFuture) state.transactions = state.transactions.filter((t) => !(t.recId === id && t.date > clock.today()));
  commit();
  return ok(rule);
}

export function setSalary(cents) {
  if (cents === null || cents <= 0) return fail('Saisis un montant supérieur à 0 (ex : 1850 ou 1850,50).');
  const d = derive();
  const income = d.income - state.salary + cents;
  if (income < d.allocated) {
    return fail(`Avec ce salaire, tes revenus (${money(income)}) seraient inférieurs aux ${money(d.allocated)} déjà prévus. Réduis d'abord une charge, une enveloppe ou un projet.`);
  }
  state.salary = cents;
  commit();
  return ok();
}

export function setSettings({ salaryDay, openingBalance, cycle, autoClose }) {
  if (!salaryDay) return fail('Indique un jour de paie entre 1 et 31.');
  if (openingBalance === undefined) return fail('Indique un solde valide, ou laisse le champ vide.');
  const before = `${state.prefs.cycle}|${state.salaryDay}`;
  state.salaryDay = salaryDay;
  if (openingBalance !== state.openingBalance) {
    // Le solde « au début du mois » devient le solde de départ du compte courant principal.
    const main = mainAccount();
    Object.assign(main, openingBalance === null ? { opening: null, openingDate: null } : { opening: openingBalance, openingDate: addDays(cycleStart(currentMonth()), -1) });
  }
  state.openingBalance = openingBalance;
  if (cycle === 'pay' || cycle === 'calendar') state.prefs.cycle = cycle;
  if (autoClose !== undefined) state.prefs.closing.auto = Boolean(autoClose);
  // Changer de cycle décale les mois : on repart du mois en cours, sans clôture ni versement rétroactif.
  if (before !== `${state.prefs.cycle}|${state.salaryDay}`) {
    const cm = currentMonth();
    state.lastClosed = shiftMonth(cm, -1);
    if (state.lastRollover < cm) state.lastRollover = cm;
    Object.assign(hooks.ui, { journalMonth: null, reportMonth: null, agendaMonth: null, agendaDay: null });
  }
  commit();
  return ok();
}

export function validateTx(t, prev) {
  if (t.amount === null || t.amount <= 0) return fail('Indique un montant valide, supérieur à 0.');
  if (!isISO(t.date)) return fail('Choisis une date valide.');
  if (t.type === 'expense') {
    if (t.envId && !spendEnv(t.envId)) return fail('Enveloppe introuvable.');
  } else if (t.type === 'deposit') {
    const env = findEnv(t.envId);
    if (!env || env.kind !== 'project') return fail('Choisis le projet à alimenter.');
    const already = env.saved - (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
    const room = env.target - already;
    if (!env.safety && t.amount > room) return fail(room <= 0 ? 'Cet objectif est déjà atteint.' : `Il ne manque que ${money(room)} pour atteindre l'objectif.`);
  } else if (t.type === 'transfer') {
    if (!findAccount(t.accountId) || !findAccount(t.toAccountId)) return fail('Choisis les deux comptes.');
    if (t.accountId === t.toAccountId) return fail('Choisis deux comptes différents.');
  } else if (t.type === 'withdraw') {
    const env = findEnv(t.envId);
    if (!env || env.kind !== 'project') return fail('Choisis la réserve ou le projet.');
    const available = env.saved + (prev && prev.type === 'withdraw' && prev.envId === env.id ? prev.amount : 0) - (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
    if (t.amount > available) return fail(available <= 0 ? `« ${env.name} » est vide.` : `Il n'y a que ${money(available)} dans « ${env.name} ».`);
  } else if (t.type !== 'income') {
    return fail('Type inconnu.');
  }
  return ok();
}

// Effet d'une opération sur l'épargne d'un projet : +1 pour un versement, −1 pour un retrait.
export function applySaved(tx, sign) {
  const env = findEnv(tx.envId);
  if (!env || env.kind !== 'project') return;
  const delta = tx.type === 'deposit' ? tx.amount : tx.type === 'withdraw' ? -tx.amount : 0;
  env.saved = Math.max(0, env.saved + sign * delta);
}

export function addTransaction({ type, envId = null, amount, note = '', date, ref, detail, recId, covers = false, pro = false, photos = null, tags = null, accountId = null, toAccountId = null, adjust = false }, { silent = false } = {}) {
  const t = { id: uid(), type, envId: type === 'income' || type === 'transfer' ? null : envId || null, amount, note: cleanNote(note), date, ts: clock.now() };
  if (accountId && findAccount(accountId)) t.accountId = accountId;
  if (type === 'transfer') Object.assign(t, { accountId: t.accountId || mainAccount().id, toAccountId });
  const check = validateTx(t, null);
  if (!check.ok) return check;
  const tg = cleanTags(tags);
  if (tg.length) t.tags = tg;
  if (adjust) t.adjust = true;
  if (t.accountId && t.type !== 'transfer') state.prefs.lastAccountId = t.accountId;
  if (pro && (type === 'income' || type === 'expense')) t.pro = true;
  if (photos && photos.length) t.photos = photos.slice(0, 20);
  if (type === 'deposit' && covers) t.covers = budgetKey(date);
  const dt = cleanDetail(detail);
  if (dt) t.detail = dt;
  if (ref) t.ref = ref;
  if (recId) t.recId = recId;
  state.transactions.push(t);
  applySaved(t, 1);
  if (type === 'expense' && t.envId) state.prefs.lastEnvId = t.envId;
  if (!silent) commit();
  return ok(t);
}

export function updateTransaction(id, patch) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return fail('Opération introuvable.');
  const next = { ...tx, ...patch };
  if (next.type === 'income') next.envId = null;
  const check = validateTx(next, tx);
  if (!check.ok) return check;
  applySaved(tx, -1);
  Object.assign(tx, { type: next.type, envId: next.envId || null, amount: next.amount, date: next.date, note: cleanNote(next.note) });
  if (patch.pro !== undefined) {
    if (patch.pro && (tx.type === 'income' || tx.type === 'expense')) tx.pro = true;
    else delete tx.pro;
  }
  if (patch.photos !== undefined) {
    if (patch.photos && patch.photos.length) tx.photos = patch.photos.slice(0, 20);
    else delete tx.photos;
  }
  if (patch.tags !== undefined) {
    const tg = cleanTags(patch.tags);
    if (tg.length) tx.tags = tg;
    else delete tx.tags;
  }
  if (patch.accountId !== undefined) {
    if (patch.accountId && findAccount(patch.accountId)) tx.accountId = patch.accountId;
    else delete tx.accountId;
  }
  if (tx.type === 'deposit' && next.covers) tx.covers = budgetKey(tx.date);
  else delete tx.covers;
  const dt = cleanDetail(next.detail);
  if (dt) tx.detail = dt;
  else delete tx.detail;
  applySaved(tx, 1);
  if (tx.type === 'expense' && tx.envId) state.prefs.lastEnvId = tx.envId;
  commit();
  return ok(tx);
}

export function deleteTransaction(id) {
  const index = state.transactions.findIndex((t) => t.id === id);
  if (index === -1) return fail('Opération introuvable.');
  const [tx] = state.transactions.splice(index, 1);
  applySaved(tx, -1);
  commit();
  return ok(tx);
}

export function restoreTransaction(tx) {
  if (state.transactions.some((t) => t.id === tx.id)) return;
  state.transactions.push({ ...tx });
  applySaved(tx, 1);
  commit();
}

// ——— Comptes, virements et rapprochement ———
export const findAccount = (id) => state.accounts.find((a) => a.id === id);
export const mainAccount = () => state.accounts.find((a) => a.kind === 'current') || state.accounts[0];
export const accountOf = (t) => t.accountId || mainAccount().id;

// Solde d'un compte à une date (fin de journée), depuis son solde de départ. null si le solde de départ est inconnu.
export function accountBalance(acc, date = clock.today()) {
  if (!acc || acc.opening === null || !acc.openingDate) return null;
  let bal = acc.opening;
  const after = (t) => t.date > acc.openingDate || (t.date === acc.openingDate && acc.openingTs && t.ts > acc.openingTs);
  // Le salaire n'est pas une opération du journal : il arrive sur le compte courant principal chaque jour de paie.
  if (acc === mainAccount() && state.salary > 0) {
    for (let m = monthOf(acc.openingDate); m <= monthOf(date); m = shiftMonth(m, 1)) {
      const pay = isoFor(m, clampDay(state.salaryDay, m));
      if (pay > acc.openingDate && pay <= date) bal += state.salary;
    }
  }
  for (const t of state.transactions) {
    if (!after(t) || t.date > date) continue;
    if (t.type === 'transfer') {
      if (accountOf(t) === acc.id) bal -= t.amount;
      if (t.toAccountId === acc.id) bal += t.amount;
    } else if (accountOf(t) === acc.id) {
      if (t.type === 'income') bal += t.amount;
      else if (t.type === 'expense') bal -= t.amount;
    }
  }
  return bal;
}

export function addAccount({ name, kind, balance }) {
  const n = cleanName(name);
  if (!n) return fail('Donne un nom au compte (ex : Livret A).');
  if (state.accounts.some((a) => normName(a.name) === normName(n))) return fail(`« ${n} » existe déjà.`);
  if (state.accounts.length >= 20) return fail('20 comptes au maximum.');
  if (balance === undefined) return fail('Indique un solde valide, ou laisse vide.');
  const acc = { id: uid(), name: n, kind: ACCOUNT_KINDS[kind] ? kind : 'current', opening: balance, openingDate: balance === null ? null : clock.today(), openingTs: clock.now(), reconciledAt: balance === null ? null : clock.today() };
  state.accounts.push(acc);
  commit();
  return ok(acc);
}

export function deleteAccount(id) {
  const acc = findAccount(id);
  if (!acc) return fail('Compte introuvable.');
  if (acc === mainAccount()) return fail('Le compte courant principal ne peut pas être supprimé.');
  if (state.transactions.some((t) => t.accountId === id || t.toAccountId === id)) return fail('Ce compte a des opérations : il ne peut pas être supprimé.');
  state.accounts = state.accounts.filter((a) => a.id !== id);
  commit();
  return ok(acc);
}

// Rapprochement : « ton app dit X, ta banque dit Y ». L'écart devient une opération d'ajustement hors enveloppe.
export function reconcileAccount(id, bank) {
  const acc = findAccount(id);
  if (!acc) return fail('Compte introuvable.');
  if (bank === null || bank === undefined || !Number.isInteger(bank)) return fail('Indique le solde affiché par ta banque (ex : 1234,56).');
  const today = clock.today();
  const app = accountBalance(acc, today);
  acc.reconciledAt = today;
  if (app === null) {
    Object.assign(acc, { opening: bank, openingDate: today, openingTs: clock.now() });
    if (acc === mainAccount()) state.openingBalance = null;
    commit();
    return ok({ diff: 0, app: null, bank, tx: null });
  }
  const diff = bank - app;
  let tx = null;
  if (diff !== 0) {
    const res = addTransaction({ type: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), note: 'Ajustement (rapprochement)', date: today, accountId: acc.id, adjust: true }, { silent: true });
    if (!res.ok) return res;
    tx = res.data;
  }
  commit();
  return ok({ diff, app, bank, tx });
}

// ——— Favoris et montants fréquents ———
export function addFavorite({ label, amount, envId = null, type = 'expense', accountId = null }) {
  const l = cleanName(label);
  if (!l) return fail('Donne un nom au favori (ex : Café).');
  if (amount === null || !(amount > 0)) return fail('Indique un montant valide.');
  if (state.favorites.length >= 24) return fail('24 favoris au maximum.');
  const fav = { id: uid(), label: l, amount, type: type === 'income' ? 'income' : 'expense', envId: type !== 'income' && spendEnv(envId) ? envId : null, accountId: findAccount(accountId) ? accountId : null };
  state.favorites.push(fav);
  commit();
  return ok(fav);
}

export function deleteFavorite(id) {
  const i = state.favorites.findIndex((f) => f.id === id);
  if (i === -1) return fail('Favori introuvable.');
  const [fav] = state.favorites.splice(i, 1);
  commit();
  return ok({ fav, index: i });
}

export const useFavorite = (id) => {
  const f = state.favorites.find((x) => x.id === id);
  if (!f) return fail('Favori introuvable.');
  return addTransaction({ type: f.type, envId: f.envId, amount: f.amount, note: f.label, date: clock.today(), accountId: f.accountId });
};

// Montants les plus saisis (120 derniers jours), pour l'enveloppe choisie en priorité.
export function frequentAmounts(envId = null, limit = 4) {
  const since = addDays(clock.today(), -120);
  const stats = new Map();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.recId || t.date < since || t.date > clock.today()) continue;
    const s = stats.get(t.amount) || { n: 0, score: 0 };
    s.n += 1;
    s.score += envId && t.envId === envId ? 3 : 1;
    stats.set(t.amount, s);
  }
  return [...stats].filter(([, s]) => s.n >= 2).sort((a, b) => b[1].score - a[1].score || a[0] - b[0]).slice(0, limit).map(([a]) => a);
}

// Suggestions de favoris : même libellé, même montant, même enveloppe, saisis au moins 3 fois en 60 jours.
export function favoriteSuggestions(limit = 3) {
  const since = addDays(clock.today(), -60);
  const groups = new Map();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.recId || t.date < since || !t.note) continue;
    const k = `${normName(t.note)}|${t.amount}|${t.envId || ''}`;
    groups.set(k, { label: t.note, amount: t.amount, envId: t.envId, n: (groups.get(k) || { n: 0 }).n + 1 });
  }
  const known = new Set(state.favorites.map((f) => `${normName(f.label)}|${f.amount}|${f.envId || ''}`));
  return [...groups.entries()].filter(([k, g]) => g.n >= 3 && !known.has(k)).map(([, g]) => g).sort((a, b) => b.n - a.n).slice(0, limit);
}

// ——— Recherche dans le journal : texte, montant, #étiquette, sur une période ———
export function searchTransactions(q, { from = null, to = null } = {}) {
  const words = normText(q).split(/\s+/).filter(Boolean);
  const tags = words.filter((w) => w.startsWith('#') && w.length > 1).map((w) => w.slice(1));
  const amount = parseAmount(q.trim());
  const texts = words.filter((w) => !w.startsWith('#') && parseAmount(w) === null);
  return state.transactions.filter((t) => {
    if ((from && t.date < from) || (to && t.date > to)) return false;
    if (tags.length && !tags.every((g) => (t.tags || []).some((x) => normText(x).startsWith(g)))) return false;
    if (amount !== null && words.length === 1 && !tags.length) return t.amount === amount;
    const env = findEnv(t.envId);
    const hay = normText([t.note, t.detail, env && env.name, (t.tags || []).join(' '), findAccount(t.accountId) && findAccount(t.accountId).name].filter(Boolean).join(' '));
    return texts.every((w) => hay.includes(w));
  });
}

// ——— Abonnements repérés dans l'historique (même libellé, montant proche, rythme régulier) ———
export const SUB_RHYTHMS = [['week', 6, 8], ['2weeks', 13, 16], ['month', 26, 35], ['2months', 55, 65], ['quarter', 85, 97], ['year', 350, 380]];
export function detectSubscriptions(txs = state.transactions) {
  const ruleKeys = new Set(state.recurring.map((r) => labelKey(r.label) || normName(r.label)));
  const groups = new Map();
  for (const t of txs) {
    if (t.type !== 'expense' || t.recId || !t.note) continue;
    const k = labelKey(t.note) || normName(t.note);
    if (!k || [...ruleKeys].some((rk) => rk && (k.includes(rk) || rk.includes(k)))) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const out = [];
  for (const [k, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = sorted[sorted.length - 1];
    const near = sorted.filter((t) => Math.abs(t.amount - last.amount) * 10 <= last.amount);
    if (near.length < 3) continue;
    const gaps = near.slice(1).map((t, i) => daysBetween(near[i].date, t.date));
    const rhythm = SUB_RHYTHMS.find(([, lo, hi]) => gaps.filter((g) => g >= lo && g <= hi).length * 3 >= gaps.length * 2);
    if (!rhythm) continue;
    const envs = near.map((t) => t.envId).filter(Boolean);
    const envId = envs.length ? envs.sort((a, b) => envs.filter((x) => x === b).length - envs.filter((x) => x === a).length)[0] : null;
    out.push({ key: k, label: cleanName(last.note), amount: last.amount, freq: rhythm[0], last: last.date, count: near.length, envId: spendEnv(envId) ? envId : null });
  }
  return out.sort((a, b) => monthlyEq(b.amount, b.freq) - monthlyEq(a.amount, a.freq));
}

// Ajoute un abonnement repéré à l'échéancier, sans repasser les échéances déjà présentes au journal.
export function addSubscription(sub) {
  const check = validateRule({ type: 'expense', label: sub.label, amount: sub.amount, freq: sub.freq, start: sub.last, end: null, envId: sub.envId });
  if (!check.ok) return check;
  const rule = { id: uid(), type: 'expense', label: check.data, amount: sub.amount, freq: sub.freq, start: sub.last, end: null, envId: sub.envId || null, postedUntil: maxISO(sub.last, clock.today()) };
  state.recurring.push(rule);
  commit();
  return ok(rule);
}

// ——— Échéances vers le calendrier du téléphone (.ics) : vraies notifications sans serveur ———
export const ICS_FREQ = { day: 'FREQ=DAILY', week: 'FREQ=WEEKLY', '2weeks': 'FREQ=WEEKLY;INTERVAL=2', month: 'FREQ=MONTHLY', '2months': 'FREQ=MONTHLY;INTERVAL=2', quarter: 'FREQ=MONTHLY;INTERVAL=3', year: 'FREQ=YEARLY' };
export const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
export const icsDate = (iso) => iso.replace(/-/g, '');
export function icsFold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
export function buildIcs() {
  const today = clock.today();
  const stamp = `${icsDate(today)}T000000Z`;
  const plain = (cents) => money(cents).replace(/[\u00a0\u202f]/g, ' ');
  const events = [];
  const event = (uidKey, date, summary, description, rrule) => events.push([
    'BEGIN:VEVENT', `UID:${uidKey}@budgetfold`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`,
    rrule ? `RRULE:${rrule}` : null, `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15H', `DESCRIPTION:${icsText(summary)}`, 'END:VALARM', 'END:VEVENT'
  ].filter(Boolean));
  for (const r of state.recurring) {
    if (r.end && r.end < today) continue;
    const next = nextOccurrence(r, today);
    if (!next) continue;
    const until = r.end ? `;UNTIL=${icsDate(r.end)}` : '';
    event(r.id, next, `${r.type === 'income' ? '+' : '−'} ${plain(r.amount)} · ${r.label}`, `${FREQS[r.freq].label} · BudgetFold`, `${ICS_FREQ[r.freq]}${until}`);
  }
  for (const t of state.transactions) {
    if (t.date <= today || t.recId || t.type === 'transfer' || t.type === 'withdraw' || daysBetween(today, t.date) > 400) continue;
    event(t.id, t.date, `${t.type === 'income' ? '+' : '−'} ${plain(t.amount)} · ${t.note || (t.type === 'income' ? 'Revenu prévu' : 'Dépense prévue')}`, 'Prévu dans BudgetFold', null);
  }
  if (state.salary > 0) {
    const m = monthOf(today);
    let pay = isoFor(m, clampDay(state.salaryDay, m));
    if (pay < today) pay = isoFor(shiftMonth(m, 1), clampDay(state.salaryDay, shiftMonth(m, 1)));
    event('salaire', pay, `+ ${plain(state.salary)} · Salaire`, 'Jour de paie · BudgetFold', state.salaryDay > 28 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY');
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BudgetFold OS//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:BudgetFold · échéances', ...events.flat(), 'END:VCALENDAR'];
  return { text: `${lines.map(icsFold).join('\r\n')}\r\n`, count: events.length };
}

// Reste à vivre d'un mois si l'on appliquait `mutate` : on calcule sur une copie, l'état réel n'est pas touché.
export function freeAfter(key, mutate) {
  const real = state;
  replaceState(JSON.parse(JSON.stringify(real)));
  try {
    mutate(state);
    return derive(key).free;
  } finally {
    replaceState(real);
  }
}

export const DUPLICATE_MS = 2 * 60 * 1000;
// Même type, même montant, même cible, saisi il y a moins de 2 minutes : probablement un double toucher.
export const recentTwin = ({ type, envId = null, amount }) => state.transactions.find((t) => t.type === type && (t.envId || null) === (type === 'income' ? null : envId || null)
  && t.amount === amount && t.ts > 0 && clock.now() - t.ts >= 0 && clock.now() - t.ts < DUPLICATE_MS);

export function labelKey(label) {
  const stop = new Set(['carte', 'cb', 'paiement', 'prlv', 'sepa', 'vir', 'virement', 'prelevement', 'facture', 'achat', 'retrait', 'dab', 'cheque', 'les', 'des', 'chez', 'par', 'sur', 'ticket']);
  const tokens = normText(label).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((tk) => tk.length >= 3 && !/^\d+$/.test(tk) && !stop.has(tk));
  return tokens.slice(0, 2).join(' ');
}

export function learnRule(label, envId) {
  const key = labelKey(label);
  if (key.length < 3 || !findEnv(envId)) return;
  const existing = state.rules.find((r) => r.key === key);
  if (existing && existing.source === 'user') return;
  if (existing) existing.envId = envId;
  else state.rules.push({ key, envId, source: 'auto' });
  state.rules = state.rules.slice(-300);
}

// Règles de classement modifiables : « si le libellé contient X, alors enveloppe Y ».
export function saveCatRule({ key, envId, previous = null }) {
  const k = normText(cleanText(key, 40)).trim();
  if (k.length < 3) return fail('Écris au moins 3 lettres (ex : carrefour).');
  if (!spendEnv(envId)) return fail('Choisis une enveloppe.');
  if (previous !== k && state.rules.some((r) => r.key === k)) return fail(`Une règle pour « ${k} » existe déjà.`);
  const rule = previous !== null && state.rules.find((r) => r.key === previous);
  if (rule) Object.assign(rule, { key: k, envId, source: 'user' });
  else state.rules.unshift({ key: k, envId, source: 'user' });
  commit();
  return ok({ key: k, envId });
}

export function deleteCatRule(key) {
  const i = state.rules.findIndex((r) => r.key === key);
  if (i === -1) return fail('Règle introuvable.');
  const [rule] = state.rules.splice(i, 1);
  commit();
  return ok({ rule, index: i });
}

export function setProSettings({ enabled, rateBp, ceiling, vatThreshold }) {
  if (rateBp === null || rateBp < 0 || rateBp > 10000) return fail('Indique un taux de cotisations valide (ex : 24,6).');
  if (ceiling === undefined || vatThreshold === undefined) return fail('Indique des seuils valides, ou laisse les champs vides.');
  state.prefs.pro = { enabled: Boolean(enabled), rateBp, ceiling, vatThreshold };
  commit();
  return ok(state.prefs.pro);
}

// Chiffre d'affaires pro d'une année civile (les seuils micro-entreprise sont annuels).
export const proRevenue = (year) => state.transactions.reduce((s, t) => s + (t.type === 'income' && t.pro && t.date.startsWith(year) ? t.amount : 0), 0);

// Opération répartie : un ticket, plusieurs enveloppes. Chaque part est une dépense liée aux autres (`group`).
export function addSplit(base, parts) {
  const clean = parts.filter((p) => p.amount > 0);
  if (clean.length < 2) return fail('Répartis au moins deux montants.');
  for (const p of clean) {
    const check = validateTx({ type: 'expense', envId: p.envId || null, amount: p.amount, date: base.date }, null);
    if (!check.ok) return check;
  }
  const group = uid();
  const txs = clean.map((p) => {
    const t = { id: uid(), type: 'expense', envId: p.envId || null, amount: p.amount, note: cleanNote(p.note || base.note), date: base.date, ts: clock.now(), group };
    const dt = cleanDetail(base.detail);
    if (dt) t.detail = dt;
    if (base.pro) t.pro = true;
    state.transactions.push(t);
    if (t.envId && base.note) learnRule(p.note || base.note, t.envId);
    return t;
  });
  commit();
  return ok({ group, txs });
}

export function guessEnvelope(label, { hints = true } = {}) {
  const text = normText(label);
  if (!text.trim()) return null;
  for (const rule of state.rules) {
    if (text.includes(rule.key) && spendEnv(rule.envId)) return rule.envId;
  }
  for (const e of state.envelopes) {
    if (e.kind === 'spend' && normName(e.name).length >= 3 && text.includes(normName(e.name))) return e.id;
  }
  if (!hints) return null;
  for (const hint of KEYWORD_HINTS) {
    if (hint.words.some((w) => text.includes(w))) {
      const env = state.envelopes.find((e) => e.kind === 'spend' && hint.env.test(normName(e.name)));
      if (env) return env.id;
    }
  }
  return null;
}
