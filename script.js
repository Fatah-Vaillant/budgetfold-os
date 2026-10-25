(() => {
  'use strict';

  const VERSION = '2.0';
  const STORAGE_KEY = 'budgetfold-os:v2';
  const LEGACY_KEY = 'budgetfold-os:v1';
  const MAX_CENTS = 1_000_000_000;
  const NAME_MAX = 40;
  const NOTE_MAX = 80;
  const RING_C = 2 * Math.PI * 50;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clock = { today: () => localISO(new Date()) };

  const monthOf = (iso) => iso.slice(0, 7);
  const dayOf = (iso) => Number(iso.slice(8, 10));
  const daysInMonth = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };
  const shiftMonth = (key, n) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const clampDay = (day, key) => Math.min(Math.max(1, day), daysInMonth(key));
  const isoFor = (key, day) => `${key}-${pad(day)}`;
  const parseISO = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const isISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return false;
    const [y, mo, d] = m.slice(1).map(Number);
    if (y < 2000 || y > 2100) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  };
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const monthName = (key) => capitalize(parseISO(`${key}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  const shortDate = (iso) => parseISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const dayHeading = (iso) => {
    const today = clock.today();
    if (iso === today) return "Aujourd'hui";
    const y = parseISO(today);
    y.setDate(y.getDate() - 1);
    if (iso === localISO(y)) return 'Hier';
    return capitalize(parseISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  };

  const fmtInt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtDec = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (cents) => (cents % 100 === 0 ? fmtInt : fmtDec).format(cents / 100);
  const plural = (n, one, many) => (n > 1 ? many : one);

  const ok = (data) => ({ ok: true, data });
  const fail = (error) => ({ ok: false, error });

  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const arr = (v) => (Array.isArray(v) ? v : []);
  const clampInt = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const cleanText = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanName = (v) => cleanText(v, NAME_MAX);
  const cleanNote = (v) => cleanText(v, NOTE_MAX);
  const normText = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const normName = (v) => normText(cleanName(v));

  const toCents = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(MAX_CENTS, Math.max(0, Math.round(n))) : 0;
  };

  function parseAmount(raw) {
    const s = String(raw ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const [int, dec = ''] = s.split('.');
    const cents = parseInt(int, 10) * 100 + parseInt((dec + '00').slice(0, 2), 10);
    return cents <= MAX_CENTS ? cents : null;
  }

  function parseDayInput(raw) {
    const s = String(raw ?? '').trim();
    if (!/^\d{1,2}$/.test(s)) return null;
    const n = Number(s);
    return n >= 1 && n <= 31 ? n : null;
  }

  const toInputValue = (cents) => (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2).replace('.', ',');

  const REC_CATS = {
    logement: { label: 'Logement', icon: 'house' },
    energie: { label: 'Énergie & internet', icon: 'zap' },
    abonnement: { label: 'Abonnement', icon: 'repeat' },
    assurance: { label: 'Assurance', icon: 'shield' },
    transport: { label: 'Transport', icon: 'car' },
    telephone: { label: 'Téléphone', icon: 'smartphone' },
    sante: { label: 'Santé', icon: 'heart-pulse' },
    revenu: { label: 'Revenu', icon: 'banknote' },
    autre: { label: 'Autre', icon: 'tag' }
  };

  const TEMPLATES = {
    student: {
      label: 'Étudiant',
      icon: 'graduation-cap',
      blurb: 'Loyer, courses, transports et une petite épargne.',
      recurring: [['Loyer', 35, 1, 'logement'], ['Téléphone & internet', 4, 8, 'telephone'], ['Abonnements', 2, 10, 'abonnement']],
      spend: [['Courses', 20], ['Transport', 5], ['Loisirs', 9], ['Santé & hygiène', 3]],
      projects: [['Épargne de précaution', 5, 3]]
    },
    young: {
      label: 'Jeune actif',
      icon: 'briefcase',
      blurb: 'Logement, énergie, assurances et un fonds d\'urgence.',
      recurring: [['Loyer', 32, 1, 'logement'], ['Énergie & internet', 6, 5, 'energie'], ['Abonnements', 3, 10, 'abonnement'], ['Assurances', 3, 12, 'assurance']],
      spend: [['Courses', 14], ['Transport', 6], ['Loisirs', 8], ['Santé & hygiène', 3]],
      projects: [['Fonds d\'urgence', 8, 3]]
    },
    family: {
      label: 'Famille',
      icon: 'users',
      blurb: 'Charges du foyer, enfants et épargne de projets.',
      recurring: [['Loyer / crédit', 30, 1, 'logement'], ['Énergie & internet', 7, 5, 'energie'], ['Assurances', 4, 8, 'assurance'], ['Abonnements', 2, 10, 'abonnement']],
      spend: [['Courses', 18], ['Transport', 7], ['Enfants', 6], ['Loisirs', 5], ['Santé & hygiène', 3]],
      projects: [['Épargne projets', 7, 6]]
    },
    blank: {
      label: 'Page blanche',
      icon: 'sparkles',
      blurb: 'Je construis mes enveloppes moi-même.',
      recurring: [],
      spend: [],
      projects: []
    }
  };

  const KEYWORD_HINTS = [
    { words: ['carrefour', 'leclerc', 'auchan', 'lidl', 'monoprix', 'intermarche', 'franprix', 'picard', 'aldi', 'casino', 'biocoop', 'grand frais', 'super u', 'u express'], env: /course|aliment|supermarch/ },
    { words: ['sncf', 'ratp', 'navigo', 'uber', 'bolt', 'blablacar', 'total', 'esso', 'shell', 'vinci', 'autoroute', 'tisseo', 'transdev', 'ouigo', 'flixbus', 'velib'], env: /transport|essence|carbu|deplac/ },
    { words: ['netflix', 'spotify', 'disney', 'deezer', 'youtube', 'canal', 'steam', 'playstation', 'cinema', 'ugc', 'pathe', 'fnac', 'decathlon', 'mcdo', 'mcdonald', 'burger', 'kfc', 'deliveroo', 'restaurant', 'cafe'], env: /loisir|sortie|resto|diver/ },
    { words: ['pharmacie', 'doctolib', 'mutuelle', 'optique', 'dentiste', 'hopital', 'medecin'], env: /sant|hygien|pharma/ }
  ];

  const emptyState = () => ({
    v: 2,
    salary: 0,
    salaryDay: 1,
    openingBalance: null,
    lastRollover: monthOf(clock.today()),
    envelopes: [],
    recurring: [],
    transactions: [],
    rules: [],
    prefs: { onboarded: false, lastEnvId: null }
  });

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const s = emptyState();
    s.salary = toCents(raw.salary);
    s.salaryDay = clampInt(raw.salaryDay, 1, 31, 1);
    s.openingBalance = raw.openingBalance === null || raw.openingBalance === undefined ? null : toCents(raw.openingBalance);
    if (/^\d{4}-\d{2}$/.test(raw.lastRollover || '')) s.lastRollover = raw.lastRollover;

    const ids = new Set();
    const names = new Set();
    const takeId = (v) => {
      const id = typeof v === 'string' && v && !ids.has(v) ? v : uid();
      ids.add(id);
      return id;
    };

    for (const e of arr(raw.envelopes)) {
      if (!e || typeof e !== 'object') continue;
      const name = cleanName(e.name);
      const key = normName(name);
      if (!name || names.has(key)) continue;
      const createdAt = Number.isFinite(e.createdAt) ? e.createdAt : Date.now();
      if (e.kind === 'project') {
        const target = toCents(e.target);
        if (target <= 0) continue;
        names.add(key);
        s.envelopes.push({ id: takeId(e.id), kind: 'project', name, target, saved: Math.min(toCents(e.saved), target), monthly: toCents(e.monthly), createdAt });
      } else {
        const max = toCents(e.max);
        if (max <= 0) continue;
        names.add(key);
        s.envelopes.push({ id: takeId(e.id), kind: 'spend', name, max, createdAt });
      }
    }

    for (const r of arr(raw.recurring)) {
      if (!r || typeof r !== 'object') continue;
      const label = cleanName(r.label);
      const amount = toCents(r.amount);
      if (!label || amount <= 0) continue;
      s.recurring.push({
        id: takeId(r.id),
        type: r.type === 'income' ? 'income' : 'charge',
        label,
        amount,
        day: clampInt(r.day, 1, 31, 1),
        cat: REC_CATS[r.cat] ? r.cat : 'autre'
      });
    }

    const envIds = new Map(s.envelopes.map((e) => [e.id, e]));
    for (const t of arr(raw.transactions)) {
      if (!t || typeof t !== 'object') continue;
      const amount = toCents(t.amount);
      if (amount <= 0 || !isISO(t.date)) continue;
      const type = ['expense', 'income', 'deposit'].includes(t.type) ? t.type : null;
      if (!type) continue;
      let envId = typeof t.envId === 'string' && envIds.has(t.envId) ? t.envId : null;
      if (type === 'expense' && envId && envIds.get(envId).kind !== 'spend') envId = null;
      if (type === 'deposit' && !(envId && envIds.get(envId).kind === 'project')) continue;
      if (type === 'income') envId = null;
      const tx = { id: takeId(t.id), type, envId, amount, note: cleanNote(t.note), date: t.date };
      if (typeof t.ref === 'string' && t.ref) tx.ref = t.ref.slice(0, 120);
      s.transactions.push(tx);
    }

    for (const r of arr(raw.rules)) {
      if (!r || typeof r.key !== 'string' || r.key.length < 3 || !envIds.has(r.envId)) continue;
      if (!s.rules.some((x) => x.key === r.key)) s.rules.push({ key: r.key.slice(0, 40), envId: r.envId });
    }
    s.rules = s.rules.slice(-300);

    s.prefs.onboarded = Boolean(raw.prefs && raw.prefs.onboarded);
    s.prefs.lastEnvId = raw.prefs && envIds.has(raw.prefs.lastEnvId) ? raw.prefs.lastEnvId : null;
    return s;
  }

  function migrateV1(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const s = emptyState();
    s.salary = toCents(raw.salary);
    const today = clock.today();
    const names = new Set();
    for (const e of arr(raw.envelopes)) {
      if (!e || typeof e !== 'object') continue;
      const name = cleanName(e.name);
      const max = toCents(e.max);
      if (!name || max <= 0 || names.has(normName(name))) continue;
      names.add(normName(name));
      const id = typeof e.id === 'string' && e.id ? e.id : uid();
      const spent = Math.min(toCents(e.spent), max);
      if (e.kind === 'goal') {
        s.envelopes.push({ id, kind: 'project', name, target: Math.min(MAX_CENTS, max * 12), saved: spent, monthly: max, createdAt: Date.now() });
      } else {
        s.envelopes.push({ id, kind: 'spend', name, max, createdAt: Date.now() });
        if (spent > 0) s.transactions.push({ id: uid(), type: 'expense', envId: id, amount: spent, note: 'Reprise de la version 1', date: today });
      }
    }
    s.prefs.onboarded = true;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw)) || emptyState();
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) return migrateV1(JSON.parse(legacy)) || emptyState();
    } catch {
      return emptyState();
    }
    return emptyState();
  }

  let state = load();

  let lastAddedId = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast("Impossible d'enregistrer : le stockage du navigateur est plein ou bloqué.", 'error');
    }
  }

  function commit() {
    save();
    render();
  }

  const currentMonth = () => monthOf(clock.today());
  const findEnv = (id) => state.envelopes.find((e) => e.id === id);
  const projectDone = (e) => e.saved >= e.target;
  const projectMonthly = (e) => (projectDone(e) ? 0 : e.monthly);

  function monthsToGoal(e) {
    if (projectDone(e)) return 0;
    if (e.monthly <= 0) return null;
    return Math.ceil((e.target - e.saved) / e.monthly);
  }

  function durationLabel(months) {
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return `${years} ${plural(years, 'an', 'ans')}${rest ? ` ${rest} mois` : ''}`;
  }

  function derive(key = currentMonth()) {
    const today = clock.today();
    const isCurrent = key === monthOf(today);
    const spentBy = new Map();
    let orphan = 0;
    let oneOff = 0;
    let spentTotal = 0;
    for (const t of state.transactions) {
      if (!t.date.startsWith(key)) continue;
      if (t.type === 'expense') {
        spentTotal += t.amount;
        const env = findEnv(t.envId);
        if (env && env.kind === 'spend') spentBy.set(env.id, (spentBy.get(env.id) || 0) + t.amount);
        else orphan += t.amount;
      } else if (t.type === 'income') {
        oneOff += t.amount;
      }
    }

    let recurringIncome = 0;
    let charges = 0;
    let chargesUpcoming = 0;
    for (const r of state.recurring) {
      if (r.type === 'income') {
        recurringIncome += r.amount;
      } else {
        charges += r.amount;
        if (isCurrent && clampDay(r.day, key) > dayOf(today)) chargesUpcoming += r.amount;
      }
    }

    const spend = [];
    let reserved = 0;
    let remaining = 0;
    let projectsMonthly = 0;
    for (const e of state.envelopes) {
      if (e.kind === 'spend') {
        const spent = spentBy.get(e.id) || 0;
        const effective = Math.max(e.max, spent);
        reserved += effective;
        remaining += Math.max(0, e.max - spent);
        spend.push({ env: e, spent, left: e.max - spent, effective });
      } else {
        projectsMonthly += projectMonthly(e);
      }
    }

    const extraIncome = recurringIncome + oneOff;
    const income = state.salary + extraIncome;
    const allocated = charges + reserved + projectsMonthly + orphan;
    return {
      key, isCurrent, income, salary: state.salary, extraIncome, recurringIncome, oneOff,
      charges, chargesUpcoming, spend, reserved, remaining, projectsMonthly, orphan,
      spentTotal, allocated, free: income - allocated
    };
  }

  function dailyBudget(d) {
    if (!d.isCurrent) return null;
    const today = clock.today();
    const daysLeft = daysInMonth(d.key) - dayOf(today) + 1;
    let startRemaining = 0;
    let counted = 0;
    for (const row of d.spend) {
      let todaySpent = 0;
      for (const t of state.transactions) {
        if (t.type === 'expense' && t.envId === row.env.id && t.date === today) todaySpent += t.amount;
      }
      const before = Math.max(0, row.env.max - (row.spent - todaySpent));
      const now = Math.max(0, row.env.max - row.spent);
      startRemaining += before;
      counted += before - now;
    }
    const base = Math.round(startRemaining / daysLeft);
    return { base, counted, left: base - counted, daysLeft, hasEnvelopes: d.spend.length > 0, remaining: d.remaining };
  }

  function cashflow(d) {
    const key = d.key;
    const n = daysInMonth(key);
    const today = clock.today();
    const t = d.isCurrent ? dayOf(today) : key < monthOf(today) ? n : 0;
    const inc = new Array(n + 1).fill(0);
    const out = new Array(n + 1).fill(0);
    const spent = new Array(n + 1).fill(0);
    const events = Array.from({ length: n + 1 }, () => []);
    const sd = clampDay(state.salaryDay, key);

    if (state.salary > 0) {
      inc[sd] += state.salary;
      events[sd].push({ label: 'Salaire', amount: state.salary, type: 'income' });
    }
    for (const r of state.recurring) {
      const dd = clampDay(r.day, key);
      if (r.type === 'income') {
        inc[dd] += r.amount;
        events[dd].push({ label: r.label, amount: r.amount, type: 'income', cat: r.cat, id: r.id });
      } else {
        out[dd] += r.amount;
        events[dd].push({ label: r.label, amount: -r.amount, type: 'charge', cat: r.cat, id: r.id });
      }
    }
    if (d.projectsMonthly > 0) {
      out[sd] += d.projectsMonthly;
      events[sd].push({ label: 'Épargne projets', amount: -d.projectsMonthly, type: 'project' });
    }
    for (const tx of state.transactions) {
      if (!tx.date.startsWith(key)) continue;
      const dd = dayOf(tx.date);
      if (tx.type === 'income') {
        inc[dd] += tx.amount;
        events[dd].push({ label: tx.note || 'Revenu', amount: tx.amount, type: 'income' });
      } else if (tx.type === 'expense') {
        spent[dd] += tx.amount;
      }
    }

    const futureDays = n - t;
    const perDay = d.isCurrent && futureDays > 0 ? Math.round(d.remaining / futureDays) : 0;
    const openingKnown = state.openingBalance !== null;
    let balance = state.openingBalance || 0;
    const days = [];
    let min = { day: Math.max(t, 1), value: Infinity };
    let max = -Infinity;
    for (let day = 1; day <= n; day++) {
      const actual = day <= t;
      balance += inc[day] - out[day] - (actual ? spent[day] : spent[day] + perDay);
      days.push({ day, balance, actual, events: events[day] });
      if (day >= Math.max(t, 1) && balance < min.value) min = { day, value: balance };
      if (balance > max) max = balance;
    }
    return { days, n, today: t, min, max, end: balance, openingKnown, perDay };
  }

  function computeInsights(d) {
    const list = [];
    const push = (tone, icon, title, text, tab) => list.push({ tone, icon, title, text, tab });
    if (d.income <= 0) return list;
    const today = clock.today();
    const day = dayOf(today);
    const n = daysInMonth(d.key);
    const daysLeft = n - day + 1;

    if (d.free < 0) {
      push('bad', 'triangle-alert', 'Budget dépassé', `Tu as réservé ${money(-d.free)} de plus que tes revenus du mois.`);
    }

    const cash = cashflow(d);
    if (cash.openingKnown && cash.min.value < 0) {
      push('bad', 'triangle-alert', 'Découvert probable', `Le ${shortDate(isoFor(d.key, cash.min.day))}, ton solde projeté descend à ${money(cash.min.value)}.`, 'agenda');
    }

    const over = d.spend.filter((r) => r.spent > r.env.max).sort((a, b) => (b.spent - b.env.max) - (a.spent - a.env.max));
    for (const r of over.slice(0, 2)) {
      push('bad', 'circle-alert', `« ${r.env.name} » est dépassée`, `+${money(r.spent - r.env.max)} au-dessus du budget, prélevés sur ton reste à vivre.`);
    }

    const near = d.spend
      .filter((r) => r.spent <= r.env.max && r.spent / r.env.max >= 0.85 && r.left > 0 && daysLeft > 3)
      .sort((a, b) => b.spent / b.env.max - a.spent / a.env.max);
    for (const r of near.slice(0, 2)) {
      push('warn', 'circle-alert', `« ${r.env.name} » à ${Math.round((r.spent / r.env.max) * 100)} %`, `Il reste ${money(r.left)} pour ${daysLeft} jours.`);
    }

    if (day >= 5) {
      const elapsed = day / n;
      const pace = d.spend
        .filter((r) => r.spent >= 5000 && r.spent / r.env.max < 0.85 && r.spent / r.env.max - elapsed >= 0.25)
        .sort((a, b) => b.spent / b.env.max - a.spent / a.env.max);
      for (const r of pace.slice(0, 1)) {
        push('warn', 'flame', `Rythme élevé sur « ${r.env.name} »`, `${Math.round((r.spent / r.env.max) * 100)} % dépensés alors que ${Math.round(elapsed * 100)} % du mois est écoulé.`);
      }
    }

    const soon = state.recurring
      .filter((r) => r.type === 'charge')
      .map((r) => ({ r, diff: clampDay(r.day, d.key) - day }))
      .filter((x) => x.diff >= 0 && x.diff <= 3)
      .sort((a, b) => a.diff - b.diff);
    if (soon.length === 1) {
      const { r, diff } = soon[0];
      const when = diff === 0 ? "aujourd'hui" : diff === 1 ? 'demain' : `dans ${diff} jours`;
      push('info', 'calendar-clock', `Prélèvement : ${r.label}`, `${money(r.amount)} ${when}.`, 'agenda');
    } else if (soon.length > 1) {
      const total = soon.reduce((s, x) => s + x.r.amount, 0);
      push('info', 'calendar-clock', `${soon.length} prélèvements dans les 3 jours`, `${money(total)} au total : ${soon.map((x) => x.r.label).join(', ')}.`, 'agenda');
    }

    if (d.orphan > 0) {
      push('info', 'info', 'Dépenses hors enveloppe', `${money(d.orphan)} ce mois-ci, prélevés sur ton reste à vivre.`, 'journal');
    }

    const order = { bad: 0, warn: 1, info: 2, ok: 3 };
    list.sort((a, b) => order[a.tone] - order[b.tone]);
    const top = list.slice(0, 4);
    if (!top.length) {
      push('ok', 'circle-check', 'Tout est sous contrôle', d.free > 0 ? `Il te reste ${money(d.free)} de reste à vivre ce mois-ci.` : 'Tes revenus sont entièrement répartis.');
      return list;
    }
    return top;
  }

  function runRollover() {
    const current = currentMonth();
    if (state.lastRollover >= current) return new Map();
    const credits = new Map();
    let key = state.lastRollover;
    let guard = 0;
    while (key < current && guard++ < 600) {
      key = shiftMonth(key, 1);
      for (const e of state.envelopes) {
        if (e.kind === 'project' && e.monthly > 0 && e.saved < e.target) {
          const add = Math.min(e.monthly, e.target - e.saved);
          e.saved += add;
          credits.set(e.id, (credits.get(e.id) || 0) + add);
        }
      }
    }
    state.lastRollover = current;
    return credits;
  }

  function validateEnvelope(input, existing) {
    const name = cleanName(input.name);
    if (!name) return fail('Donne un nom à ton enveloppe.');
    if (state.envelopes.some((e) => e.id !== (existing && existing.id) && normName(e.name) === normName(name))) {
      return fail(`Une enveloppe « ${name} » existe déjà.`);
    }
    const d = derive();
    let delta;
    if (input.kind === 'project') {
      if (input.target === null || input.target <= 0) return fail('Indique un objectif valide, supérieur à 0 (ex : 10000).');
      if (input.saved === null) return fail('Indique un montant déjà épargné valide (0 si rien).');
      if (input.saved > input.target) return fail("Le montant déjà épargné ne peut pas dépasser l'objectif.");
      if (input.monthly === null) return fail('Indique une mise mensuelle valide (0 si aucune).');
      const next = input.saved >= input.target ? 0 : input.monthly;
      delta = next - (existing ? projectMonthly(existing) : 0);
    } else {
      if (input.max === null || input.max <= 0) return fail('Indique un montant max valide, supérieur à 0 (ex : 250).');
      const row = existing ? d.spend.find((r) => r.env.id === existing.id) : null;
      delta = Math.max(input.max, row ? row.spent : 0) - (row ? row.effective : 0);
    }
    if (delta > d.free) {
      return fail(d.free <= 0 ? 'Tout ton budget du mois est déjà réparti.' : `Il ne te reste que ${money(d.free)} à répartir.`);
    }
    return ok(name);
  }

  function createEnvelope(input) {
    if (state.salary <= 0 && derive().income <= 0) return fail('Commence par renseigner ton salaire global.');
    const check = validateEnvelope(input, null);
    if (!check.ok) return check;
    const base = { id: uid(), name: check.data, createdAt: Date.now() };
    const env = input.kind === 'project'
      ? { ...base, kind: 'project', target: input.target, saved: input.saved, monthly: input.monthly }
      : { ...base, kind: 'spend', max: input.max };
    state.envelopes.push(env);
    lastAddedId = env.id;
    commit();
    return ok(env);
  }

  function updateEnvelope(id, input) {
    const env = findEnv(id);
    if (!env) return fail('Enveloppe introuvable.');
    const check = validateEnvelope({ ...input, kind: env.kind }, env);
    if (!check.ok) return check;
    env.name = check.data;
    if (env.kind === 'project') {
      env.target = input.target;
      env.saved = input.saved;
      env.monthly = input.monthly;
    } else {
      env.max = input.max;
    }
    commit();
    return ok(env);
  }

  function deleteEnvelope(id) {
    const index = state.envelopes.findIndex((e) => e.id === id);
    if (index === -1) return fail('Enveloppe introuvable.');
    const before = derive().free;
    const [env] = state.envelopes.splice(index, 1);
    state.transactions = state.transactions.filter((t) => !(t.type === 'deposit' && t.envId === id));
    state.transactions.forEach((t) => { if (t.envId === id) t.envId = null; });
    state.rules = state.rules.filter((r) => r.envId !== id);
    if (state.prefs.lastEnvId === id) state.prefs.lastEnvId = null;
    const reinjected = derive().free - before;
    commit();
    return ok({ env, reinjected });
  }

  function validateRecurring(input) {
    const label = cleanName(input.label);
    if (!label) return fail('Donne un nom à cette échéance.');
    if (input.amount === null || input.amount <= 0) return fail('Indique un montant valide, supérieur à 0.');
    if (!input.day) return fail('Indique un jour du mois entre 1 et 31.');
    if (!['charge', 'income'].includes(input.type)) return fail('Type inconnu.');
    return ok(label);
  }

  function addRecurring(input) {
    const check = validateRecurring(input);
    if (!check.ok) return check;
    const item = { id: uid(), type: input.type, label: check.data, amount: input.amount, day: input.day, cat: REC_CATS[input.cat] ? input.cat : 'autre' };
    state.recurring.push(item);
    commit();
    return ok(item);
  }

  function updateRecurring(id, input) {
    const item = state.recurring.find((r) => r.id === id);
    if (!item) return fail('Échéance introuvable.');
    const check = validateRecurring(input);
    if (!check.ok) return check;
    Object.assign(item, { type: input.type, label: check.data, amount: input.amount, day: input.day, cat: REC_CATS[input.cat] ? input.cat : 'autre' });
    commit();
    return ok(item);
  }

  function deleteRecurring(id) {
    const index = state.recurring.findIndex((r) => r.id === id);
    if (index === -1) return fail('Échéance introuvable.');
    const [item] = state.recurring.splice(index, 1);
    commit();
    return ok(item);
  }

  function setSalary(cents) {
    if (cents === null || cents <= 0) return fail('Saisis un montant supérieur à 0 (ex : 1850 ou 1850,50).');
    const d = derive();
    if (cents + d.extraIncome < d.allocated) {
      return fail(`Avec ce salaire, tes revenus (${money(cents + d.extraIncome)}) seraient inférieurs aux ${money(d.allocated)} déjà réservés. Réduis d'abord une charge, une enveloppe ou un projet.`);
    }
    state.salary = cents;
    commit();
    return ok();
  }

  function setSettings({ salaryDay, openingBalance }) {
    if (!salaryDay) return fail('Indique un jour de paie entre 1 et 31.');
    if (openingBalance === undefined) return fail('Indique un solde valide, ou laisse le champ vide.');
    state.salaryDay = salaryDay;
    state.openingBalance = openingBalance;
    commit();
    return ok();
  }

  function validateTx(t, prev) {
    if (t.amount === null || t.amount <= 0) return fail('Indique un montant valide, supérieur à 0.');
    if (!isISO(t.date)) return fail('Choisis une date valide.');
    if (t.type === 'expense') {
      if (t.envId && !(findEnv(t.envId) && findEnv(t.envId).kind === 'spend')) return fail('Enveloppe introuvable.');
    } else if (t.type === 'deposit') {
      const env = findEnv(t.envId);
      if (!env || env.kind !== 'project') return fail('Projet introuvable.');
      const already = env.saved - (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
      const room = env.target - already;
      if (t.amount > room) return fail(room <= 0 ? 'Cet objectif est déjà atteint.' : `Il ne manque que ${money(room)} pour atteindre l'objectif.`);
    } else if (t.type !== 'income') {
      return fail('Type inconnu.');
    }
    return ok();
  }

  function addTransaction({ type, envId = null, amount, note = '', date, ref }, { silent = false } = {}) {
    const t = { id: uid(), type, envId: type === 'income' ? null : envId, amount, note: cleanNote(note), date };
    const check = validateTx(t, null);
    if (!check.ok) return check;
    if (ref) t.ref = ref;
    state.transactions.push(t);
    if (type === 'deposit') findEnv(envId).saved += amount;
    if (type === 'expense' && envId) state.prefs.lastEnvId = envId;
    if (!silent) commit();
    return ok(t);
  }

  function updateTransaction(id, patch) {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return fail('Opération introuvable.');
    const next = { ...tx, ...patch };
    if (next.type === 'income') next.envId = null;
    const check = validateTx(next, tx);
    if (!check.ok) return check;
    if (tx.type === 'deposit') {
      const env = findEnv(tx.envId);
      if (env) env.saved = Math.max(0, env.saved - tx.amount);
    }
    Object.assign(tx, { type: next.type, envId: next.envId, amount: next.amount, date: next.date, note: cleanNote(next.note) });
    if (tx.type === 'deposit') findEnv(tx.envId).saved += tx.amount;
    if (tx.type === 'expense' && tx.envId) state.prefs.lastEnvId = tx.envId;
    commit();
    return ok(tx);
  }

  function deleteTransaction(id) {
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) return fail('Opération introuvable.');
    const [tx] = state.transactions.splice(index, 1);
    if (tx.type === 'deposit') {
      const env = findEnv(tx.envId);
      if (env) env.saved = Math.max(0, env.saved - tx.amount);
    }
    commit();
    return ok(tx);
  }

  function labelKey(label) {
    const stop = new Set(['carte', 'cb', 'paiement', 'prlv', 'sepa', 'vir', 'virement', 'prelevement', 'facture', 'achat', 'retrait', 'dab', 'cheque', 'les', 'des', 'chez', 'par', 'sur']);
    const tokens = normText(label).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter((tk) => tk.length >= 3 && !/^\d+$/.test(tk) && !stop.has(tk));
    return tokens.slice(0, 2).join(' ');
  }

  function learnRule(label, envId) {
    const key = labelKey(label);
    if (key.length < 3 || !findEnv(envId)) return;
    const existing = state.rules.find((r) => r.key === key);
    if (existing) existing.envId = envId;
    else state.rules.push({ key, envId });
    state.rules = state.rules.slice(-300);
  }

  function guessEnvelope(label) {
    const text = normText(label);
    for (const rule of state.rules) {
      if (text.includes(rule.key) && findEnv(rule.envId)) return rule.envId;
    }
    for (const hint of KEYWORD_HINTS) {
      if (hint.words.some((w) => text.includes(w))) {
        const env = state.envelopes.find((e) => e.kind === 'spend' && hint.env.test(normName(e.name)));
        if (env) return env.id;
      }
    }
    return null;
  }

  function parseDelimited(text, delim) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
        } else {
          cell += c;
        }
      } else if (c === '"') {
        quoted = true;
      } else if (c === delim) {
        row.push(cell);
        cell = '';
      } else if (c === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (c !== '\r') {
        cell += c;
      }
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  function detectDelimiter(text) {
    const sample = text.split('\n').filter((l) => l.trim()).slice(0, 8).join('\n');
    const counts = [';', '\t', ','].map((d) => [d, sample.split(d).length - 1]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ';';
  }

  function parseDateCell(raw) {
    const s = String(raw ?? '').trim();
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    let y;
    let mo;
    let d;
    if (m) {
      [y, mo, d] = [m[1], m[2], m[3]];
    } else {
      m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
      if (!m) return null;
      [d, mo, y] = [m[1], m[2], m[3]];
      if (y.length === 2) y = `20${y}`;
    }
    const iso = `${y}-${pad(Number(mo))}-${pad(Number(d))}`;
    return isISO(iso) ? iso : null;
  }

  function parseSignedAmount(raw) {
    let s = String(raw ?? '').replace(/[\s  €$]/g, '');
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
    if (s.startsWith('-') || s.startsWith('−')) { negative = true; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (lastComma > -1) {
      s = s.replace(/,/g, '.');
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const cents = Math.round(parseFloat(s) * 100);
    if (!Number.isFinite(cents) || cents > MAX_CENTS) return null;
    return negative ? -cents : cents;
  }

  function parseStatement(text) {
    const clean = String(text || '').replace(/^﻿/, '');
    const delim = detectDelimiter(clean);
    const rows = parseDelimited(clean, delim);
    if (rows.length < 2) return { rows: [], skipped: 0, error: 'Fichier vide ou illisible.' };

    let headerIndex = -1;
    let cols = null;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const cells = rows[i].map((c) => normText(c).trim());
      const find = (re) => cells.findIndex((c) => re.test(c));
      const dateIdx = (() => {
        const all = cells.map((c, idx) => (/date/.test(c) ? idx : -1)).filter((idx) => idx >= 0);
        if (!all.length) return -1;
        return all.find((idx) => /oper|compta/.test(cells[idx])) ?? all[0];
      })();
      const labelIdx = find(/libell|label|description|intitul|detail|motif|objet|reference|nom|tiers|beneficiaire/);
      const amountIdx = find(/^(montant|amount|somme|valeur)/);
      const debitIdx = find(/debit|sortie|retrait/);
      const creditIdx = find(/credit|entree|depot/);
      if (dateIdx >= 0 && (amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0)) {
        headerIndex = i;
        cols = { date: dateIdx, label: labelIdx, amount: amountIdx, debit: debitIdx, credit: creditIdx };
        break;
      }
    }

    if (!cols) {
      const sample = rows.slice(0, 20);
      const width = Math.max(...sample.map((r) => r.length));
      const score = (fn) => Array.from({ length: width }, (_, c) => sample.filter((r) => r[c] !== undefined && fn(r[c])).length);
      const dates = score((v) => parseDateCell(v));
      const nums = score((v) => parseSignedAmount(v) !== null && !parseDateCell(v));
      const dateCol = dates.indexOf(Math.max(...dates));
      if (dates[dateCol] < 2) return { rows: [], skipped: 0, error: "Colonnes introuvables : le fichier doit contenir une date et un montant." };
      const amountCol = nums.lastIndexOf(Math.max(...nums));
      const textLen = Array.from({ length: width }, (_, c) => sample.reduce((s, r) => s + (c !== dateCol && c !== amountCol && r[c] ? r[c].length : 0), 0));
      cols = { date: dateCol, amount: amountCol, label: textLen.indexOf(Math.max(...textLen)), debit: -1, credit: -1 };
      headerIndex = -1;
    }

    const out = [];
    let skipped = 0;
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const r = rows[i];
      const date = parseDateCell(r[cols.date]);
      let amount = null;
      if (cols.amount >= 0) {
        amount = parseSignedAmount(r[cols.amount]);
      } else {
        const debit = parseSignedAmount(r[cols.debit]);
        const credit = parseSignedAmount(r[cols.credit]);
        if (debit !== null || credit !== null) amount = Math.abs(credit || 0) - Math.abs(debit || 0);
      }
      if (!date || amount === null || amount === 0) { skipped++; continue; }
      const label = cleanText(cols.label >= 0 ? r[cols.label] : '', 120);
      out.push({ date, label: label || 'Opération', amount, ref: `${date}|${amount}|${normText(label).replace(/\s+/g, ' ').slice(0, 30)}` });
    }
    return { rows: out, skipped };
  }

  function decodeBuffer(buffer) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder('windows-1252').decode(buffer);
    }
  }

  function applyTemplate(key, income) {
    const tpl = TEMPLATES[key];
    if (!tpl) return fail('Modèle inconnu.');
    const euros = (pct) => Math.max(100, Math.round((income * pct) / 10000) * 100);
    const recurring = tpl.recurring.map(([label, pct, day, cat]) => ({ id: uid(), type: 'charge', label, amount: euros(pct), day, cat }));
    const envelopes = [
      ...tpl.spend.map(([name, pct]) => ({ id: uid(), kind: 'spend', name, max: euros(pct), createdAt: Date.now() })),
      ...tpl.projects.map(([name, pct, mult]) => ({
        id: uid(), kind: 'project', name, target: Math.round((income * mult) / 100) * 100, saved: 0, monthly: euros(pct), createdAt: Date.now()
      }))
    ];
    const reserved = recurring.reduce((s, r) => s + r.amount, 0)
      + envelopes.reduce((s, e) => s + (e.kind === 'spend' ? e.max : e.monthly), 0);
    if (reserved > income) return fail('Ce revenu est trop faible pour ce modèle : choisis « Page blanche » ou augmente-le.');
    state.salary = income;
    state.recurring = recurring;
    state.envelopes = envelopes;
    state.transactions = [];
    state.rules = [];
    state.prefs.onboarded = true;
    return ok();
  }

  const byId = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    'month-label', 'status', 'status-text', 'salary-view', 'salary-amount', 'salary-extra', 'salary-edit', 'salary-form',
    'salary-input', 'salary-cancel', 'salary-error', 'remaining-amount', 'remaining-sub', 'seg-charges', 'seg-spend',
    'seg-goal', 'seg-free', 'ring-percent', 'stat-spent', 'stat-left', 'stat-upcoming', 'legend-charges', 'legend-spend',
    'legend-goal', 'legend-free', 'today', 'today-amount', 'today-caption', 'today-days', 'today-fill', 'today-sub',
    'btn-add', 'tabs', 'fab', 'insights', 'count-spend', 'add-spend', 'spend-grid', 'empty-spend', 'count-project',
    'add-project', 'project-grid', 'empty-project', 'j-prev', 'j-next', 'j-label', 'j-summary', 'j-filter', 'j-list',
    'j-empty', 'j-add', 'cash-chart', 'cash-note', 'cash-edit', 'cal-label', 'calendar', 'day-detail', 'add-recurring',
    'rec-summary', 'rec-list', 'rec-empty', 'r-prev', 'r-next', 'r-label', 'r-tiles', 'r-bars', 'r-notes',
    'dlg-welcome', 'w-step1', 'w-step2', 'w-income', 'w-next', 'w-skip', 'w-back', 'w-templates', 'w-error',
    'dlg-tx', 'tx-form', 'tx-title', 'tx-sub', 'tx-mode', 'tx-amount', 'tx-env-field', 'tx-chips', 'tx-quick', 'tx-note',
    'tx-date', 'tx-hint', 'tx-error', 'tx-delete', 'tx-submit', 'dlg-env', 'env-form', 'env-title', 'env-name', 'env-max',
    'env-target', 'env-saved', 'env-monthly', 'env-spend-fields', 'env-project-fields', 'env-hint', 'env-error',
    'env-submit', 'env-kind-wrap', 'dlg-rec', 'rec-form', 'rec-title', 'rec-label', 'rec-amount', 'rec-day', 'rec-cat',
    'rec-hint', 'rec-error', 'rec-delete', 'rec-type-wrap', 'dlg-settings', 'set-form', 'set-day', 'set-opening',
    'set-error', 'dlg-confirm', 'confirm-title', 'confirm-text', 'confirm-ok', 'dlg-menu', 'open-menu', 'menu-install',
    'menu-csv', 'menu-export', 'menu-import', 'menu-settings', 'menu-wipe', 'import-file', 'csv-file', 'dlg-import',
    'imp-summary', 'imp-list', 'imp-confirm', 'imp-error', 'imp-cancel', 'toasts'
  ].map((id) => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), byId(id)]));

  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const icon = (name) => h('i', { 'data-lucide': name });

  let iconQueued = false;
  function flushIcons() {
    if (iconQueued) return;
    iconQueued = true;
    queueMicrotask(() => {
      iconQueued = false;
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    });
  }

  const shownMoney = new WeakMap();
  function setMoney(el, target) {
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

  const ui = { tab: 'home', journalMonth: null, journalFilter: 'all', reportMonth: null, agendaDay: null };
  const TABS = ['home', 'journal', 'agenda', 'report'];
  const TAB_HASH = { home: '', journal: '#journal', agenda: '#agenda', report: '#bilan' };

  function render() {
    const d = derive();
    renderEngine(d);
    renderToday(d);
    renderView(d);
    flushIcons();
  }

  function renderView(d = derive()) {
    els.tabs.querySelectorAll('[data-tab]').forEach((btn) => {
      const on = btn.dataset.tab === ui.tab;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.view').forEach((view) => { view.hidden = view.dataset.view !== ui.tab; });
    if (ui.tab === 'home') renderHome(d);
    else if (ui.tab === 'journal') renderJournal();
    else if (ui.tab === 'agenda') renderAgenda(d);
    else renderReport();
  }

  function setTab(name, { updateHash = true } = {}) {
    if (!TABS.includes(name)) name = 'home';
    ui.tab = name;
    if (updateHash) {
      try { history.replaceState(null, '', TAB_HASH[name] || location.pathname + location.search); } catch { /* file:// */ }
    }
    renderView();
    flushIcons();
    const top = byId('views').getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function statusOf(d) {
    if (d.income <= 0) return { state: 'idle', text: 'À configurer' };
    if (d.free < 0) return { state: 'alert', text: 'Budget dépassé' };
    if (d.free === 0) return { state: 'full', text: 'Tout est réparti' };
    if (d.free / d.income < 0.1) return { state: 'tight', text: 'Marge serrée' };
    return { state: 'safe', text: 'Budget sain' };
  }

  function setSegment(circle, length, offset) {
    circle.style.strokeDasharray = `${Math.max(0, length)} ${RING_C}`;
    circle.style.strokeDashoffset = String(-offset);
  }

  function renderEngine(d) {
    const status = statusOf(d);
    els.status.dataset.state = status.state;
    els.statusText.textContent = status.text;
    els.monthLabel.textContent = monthName(d.key);

    els.salaryAmount.textContent = state.salary > 0 ? money(state.salary) : '—';
    els.salaryExtra.hidden = d.extraIncome <= 0;
    els.salaryExtra.textContent = d.extraIncome > 0 ? `+ ${money(d.extraIncome)} d'autres revenus` : '';

    setMoney(els.remainingAmount, d.free);
    els.remainingAmount.dataset.negative = String(d.free < 0);
    setMoney(els.statSpent, d.spentTotal);
    setMoney(els.statLeft, d.remaining);
    setMoney(els.statUpcoming, d.chargesUpcoming);
    els.legendCharges.textContent = money(d.charges);
    els.legendSpend.textContent = money(d.reserved + d.orphan);
    els.legendGoal.textContent = money(d.projectsMonthly);
    els.legendFree.textContent = money(Math.max(0, d.free));

    els.remainingSub.textContent = d.income <= 0
      ? 'Saisis ton salaire pour démarrer.'
      : d.free < 0
        ? `Dépassement de ${money(-d.free)} sur tes revenus`
        : `${money(d.allocated)} déjà réservés sur ${money(d.income)}`;

    const base = Math.max(d.income, d.allocated);
    const fracs = base > 0
      ? [d.charges / base, (d.reserved + d.orphan) / base, d.projectsMonthly / base, Math.max(0, d.free) / base]
      : [0, 0, 0, 0];
    const gap = fracs.filter((f) => f > 0).length > 1 ? 3 : 0;
    let offset = 0;
    [els.segCharges, els.segSpend, els.segGoal, els.segFree].forEach((circle, i) => {
      const full = fracs[i] * RING_C;
      setSegment(circle, full > 0 ? full - gap : 0, offset);
      offset += full;
    });
    els.ringPercent.textContent = `${base > 0 ? Math.round((Math.max(0, d.free) / base) * 100) : 0}%`;
  }

  function renderToday(d) {
    const b = dailyBudget(d);
    const today = clock.today();
    els.todayDays.textContent = `Jour ${dayOf(today)} / ${daysInMonth(d.key)}`;
    if (!b || !b.hasEnvelopes) {
      els.todayAmount.textContent = '—';
      shownMoney.delete(els.todayAmount);
      els.todayCaption.textContent = 'Crée une enveloppe pour obtenir ton budget du jour.';
      els.todayFill.style.width = '0%';
      els.todaySub.textContent = '';
      els.today.dataset.state = 'idle';
      return;
    }
    setMoney(els.todayAmount, b.left);
    els.today.dataset.state = b.left < 0 ? 'over' : b.remaining === 0 ? 'empty' : 'safe';
    els.todayCaption.textContent = b.left < 0
      ? "de dépassement aujourd'hui"
      : b.remaining === 0 && b.base === 0
        ? 'Enveloppes épuisées ce mois-ci'
        : "à dépenser aujourd'hui";
    const pct = b.base > 0 ? Math.min(100, (b.counted / b.base) * 100) : b.counted > 0 ? 100 : 0;
    els.todayFill.style.width = `${pct}%`;
    els.todaySub.textContent = `${b.daysLeft} ${plural(b.daysLeft, 'jour restant', 'jours restants')} · ${money(b.remaining)} encore dans tes enveloppes`;
  }

  function leave(node) {
    node.classList.add('is-leaving');
    node.inert = true;
    const kill = () => node.remove();
    if (reduceMotion) kill();
    else {
      node.addEventListener('animationend', kill, { once: true });
      setTimeout(kill, 400);
    }
  }

  function reconcile(container, cache, items, create, update) {
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

  const spendCards = new Map();
  const projectCards = new Map();

  function cardShell(kind, id, iconName, actionIcon, actionText, actionKey) {
    const el = h('article', { class: 'envelope', dataset: { id, kind } },
      h('header', { class: 'envelope-head' },
        h('span', { class: 'envelope-icon', 'aria-hidden': 'true' }, icon(iconName)),
        h('div', { class: 'envelope-title' }, h('h3', { class: 'envelope-name' }), h('span', { class: 'envelope-kind' })),
        h('div', { class: 'envelope-tools' },
          h('button', { type: 'button', class: 'icon-btn small', dataset: { action: 'edit' } }, icon('pencil')),
          h('button', { type: 'button', class: 'icon-btn small danger', dataset: { action: 'delete' } }, icon('trash-2')))),
      h('div', { class: 'envelope-figure' }, h('span', { class: 'figure-label' }), h('strong', { class: 'figure-value' }), h('span', { class: 'figure-total' })),
      h('div', { class: 'meter' },
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { class: 'bar-fill' })),
        h('div', { class: 'meter-row' }, h('span', { class: 'meter-left' }), h('span', { class: 'meter-right' }))),
      h('p', { class: 'envelope-note' }),
      h('button', { type: 'button', class: 'envelope-action', dataset: { action: actionKey } }, icon(actionIcon), h('span', { class: 'action-label', text: actionText })));
    const q = (s) => el.querySelector(s);
    el._r = {
      name: q('.envelope-name'), kind: q('.envelope-kind'), label: q('.figure-label'), value: q('.figure-value'),
      total: q('.figure-total'), bar: q('.bar'), fill: q('.bar-fill'), left: q('.meter-left'), right: q('.meter-right'),
      note: q('.envelope-note'), action: q('.envelope-action'), actionLabel: q('.action-label'),
      edit: q('[data-action="edit"]'), del: q('[data-action="delete"]')
    };
    return el;
  }

  const createSpendCard = (row) => cardShell('spend', row.id, 'wallet', 'minus', 'Dépenser', 'spend');
  const createProjectCard = (env) => cardShell('project', env.id, 'target', 'plus', 'Verser', 'deposit');

  function updateSpendCard(el, row) {
    const r = el._r;
    const { env, spent, left } = row;
    const ratio = env.max > 0 ? spent / env.max : 0;
    const percent = Math.round(Math.min(1, ratio) * 100);
    el.dataset.state = spent > env.max ? 'over' : spent === env.max ? 'empty' : ratio >= 0.85 ? 'tight' : 'safe';
    r.name.textContent = env.name;
    r.name.title = env.name;
    r.kind.textContent = 'Dépenses du mois';
    r.label.textContent = left < 0 ? 'Dépassement' : 'Disponible';
    setMoney(r.value, left < 0 ? -left : left);
    r.total.textContent = `sur ${money(env.max)} ce mois-ci`;
    r.fill.style.width = `${percent}%`;
    r.bar.setAttribute('aria-valuenow', String(percent));
    r.bar.setAttribute('aria-label', `${env.name} : ${percent} %`);
    r.left.textContent = `${money(spent)} dépensés`;
    r.right.textContent = left < 0 ? `+${money(-left)} au-dessus` : left === 0 ? 'Épuisée' : `${percent} % utilisé`;
    r.note.hidden = true;
    r.edit.setAttribute('aria-label', `Modifier ${env.name}`);
    r.del.setAttribute('aria-label', `Supprimer ${env.name}`);
  }

  function updateProjectCard(el, env) {
    const r = el._r;
    const done = projectDone(env);
    const ratio = env.target > 0 ? env.saved / env.target : 0;
    const percent = Math.round(Math.min(1, ratio) * 100);
    el.dataset.state = done ? 'done' : 'progress';
    r.name.textContent = env.name;
    r.name.title = env.name;
    r.kind.textContent = 'Projet de vie';
    r.label.textContent = 'Épargné';
    setMoney(r.value, env.saved);
    r.total.textContent = `sur ${money(env.target)} visés`;
    r.fill.style.width = `${percent}%`;
    r.bar.setAttribute('aria-valuenow', String(percent));
    r.bar.setAttribute('aria-label', `${env.name} : ${percent} %`);
    r.left.textContent = `${percent} % de l'objectif`;
    const months = monthsToGoal(env);
    r.right.textContent = done ? 'Objectif atteint' : months === null ? 'Sans mise mensuelle' : `≈ ${durationLabel(months)}`;
    r.note.hidden = false;
    r.note.textContent = done
      ? 'Bravo : la mise mensuelle est libérée dans ton reste à vivre.'
      : months === null
        ? 'Ajoute une mise mensuelle pour avancer automatiquement.'
        : `+${money(env.monthly)} / mois, versés à la clôture du mois · atteint d'ici ${monthName(shiftMonth(currentMonth(), months)).toLowerCase()}`;
    r.action.disabled = done;
    r.actionLabel.textContent = done ? 'Objectif atteint' : 'Verser';
    r.edit.setAttribute('aria-label', `Modifier ${env.name}`);
    r.del.setAttribute('aria-label', `Supprimer ${env.name}`);
  }

  function renderInsights(d) {
    const list = computeInsights(d);
    els.insights.replaceChildren(...list.map((it) => {
      const body = [
        h('span', { class: 'insight-icon', 'aria-hidden': 'true' }, icon(it.icon)),
        h('span', { class: 'insight-text' }, h('strong', { text: it.title }), h('span', { text: it.text }))
      ];
      return it.tab
        ? h('button', { type: 'button', class: 'insight', dataset: { tone: it.tone, tab: it.tab } }, body)
        : h('div', { class: 'insight', dataset: { tone: it.tone } }, body);
    }));
    els.insights.hidden = list.length === 0;
  }

  function renderHome(d) {
    renderInsights(d);
    const rows = d.spend.map((r) => ({ id: r.env.id, ...r }));
    const projs = state.envelopes.filter((e) => e.kind === 'project');
    reconcile(els.spendGrid, spendCards, rows, createSpendCard, updateSpendCard);
    reconcile(els.projectGrid, projectCards, projs, createProjectCard, updateProjectCard);
    lastAddedId = null;
    els.countSpend.textContent = String(rows.length);
    els.countProject.textContent = String(projs.length);
    els.emptySpend.hidden = rows.length > 0;
    els.emptyProject.hidden = projs.length > 0;
    flushIcons();
  }

  function txIcon(tx) {
    if (tx.type === 'income') return 'banknote';
    if (tx.type === 'deposit') return 'piggy-bank';
    return tx.envId ? 'wallet' : 'tag';
  }

  function renderJournal() {
    const key = ui.journalMonth || currentMonth();
    ui.journalMonth = key;
    els.jLabel.textContent = monthName(key);
    els.jNext.disabled = key >= currentMonth();

    const monthTxs = state.transactions.map((t, i) => ({ t, i })).filter((x) => x.t.date.startsWith(key));
    const filter = ui.journalFilter;
    const envs = state.envelopes.filter((e) => e.kind === 'spend');
    if (filter.startsWith('env:') && !envs.some((e) => `env:${e.id}` === filter)) ui.journalFilter = 'all';

    els.jFilter.replaceChildren(
      h('option', { value: 'all', text: 'Toutes les opérations' }),
      ...envs.map((e) => h('option', { value: `env:${e.id}`, text: e.name })),
      h('option', { value: 'orphan', text: 'Hors enveloppe' }),
      h('option', { value: 'income', text: 'Revenus' }),
      h('option', { value: 'deposit', text: 'Versements projets' })
    );
    els.jFilter.value = ui.journalFilter;

    const matches = (t) => {
      const f = ui.journalFilter;
      if (f === 'all') return true;
      if (f === 'orphan') return t.type === 'expense' && !t.envId;
      if (f === 'income') return t.type === 'income';
      if (f === 'deposit') return t.type === 'deposit';
      return t.type === 'expense' && `env:${t.envId}` === f;
    };
    const rows = monthTxs.filter((x) => matches(x.t)).sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.i - a.i));

    const spent = monthTxs.filter((x) => x.t.type === 'expense').reduce((s, x) => s + x.t.amount, 0);
    const earned = monthTxs.filter((x) => x.t.type === 'income').reduce((s, x) => s + x.t.amount, 0);
    els.jSummary.replaceChildren(
      h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(spent) })),
      h('div', { class: 'tile' }, h('span', { text: 'Revenus ajoutés' }), h('strong', { text: money(earned) })),
      h('div', { class: 'tile' }, h('span', { text: 'Opérations' }), h('strong', { text: String(monthTxs.length) }))
    );

    const groups = [];
    for (const x of rows) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== x.t.date) {
        g = { date: x.t.date, items: [] };
        groups.push(g);
      }
      g.items.push(x.t);
    }

    els.jList.replaceChildren(...groups.map((g) => {
      const total = g.items.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);
      return h('section', { class: 'tx-group' },
        h('header', { class: 'tx-group-head' }, h('span', { text: dayHeading(g.date) }), total > 0 ? h('span', { text: `−${money(total)}` }) : null),
        h('div', { class: 'tx-rows' }, g.items.map((t) => {
          const env = findEnv(t.envId);
          const title = t.note || (t.type === 'income' ? 'Revenu' : t.type === 'deposit' ? 'Versement' : env ? env.name : 'Dépense');
          const sub = t.type === 'income' ? 'Revenu' : t.type === 'deposit' ? `Projet · ${env ? env.name : ''}` : env ? env.name : 'Hors enveloppe';
          const sign = t.type === 'expense' ? '−' : '+';
          return h('button', { type: 'button', class: 'tx-row', dataset: { id: t.id, type: t.type, orphan: t.type === 'expense' && !env ? 'true' : 'false' } },
            h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(txIcon(t))),
            h('span', { class: 'tx-body' }, h('strong', { text: title }), h('small', { text: sub })),
            h('span', { class: 'tx-amount', text: `${sign}${money(t.amount)}` }));
        })));
    }));
    els.jEmpty.hidden = rows.length > 0;
    flushIcons();
  }

  function chartSvg(cash) {
    const W = 640;
    const H = 240;
    const pl = 58;
    const pr = 14;
    const pt = 18;
    const pb = 30;
    const lo = Math.min(0, cash.min.value);
    const hi = Math.max(cash.max, 0);
    const span = hi - lo || 1;
    const x = (day) => pl + ((day - 1) / Math.max(1, cash.n - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - lo) / span) * (H - pt - pb);
    const pts = cash.days.map((dd) => [x(dd.day), y(dd.balance)]);
    const line = (p) => p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
    const t = Math.max(1, cash.today);
    const actual = pts.slice(0, t);
    const proj = pts.slice(t - 1);
    const y0 = y(0).toFixed(1);
    const area = `${line(actual)} L${actual[actual.length - 1][0].toFixed(1)} ${y0} L${actual[0][0].toFixed(1)} ${y0} Z`;
    const short = (v) => fmtInt.format(Math.round(v / 100));

    const ticks = [...new Set([hi, 0, lo])];
    const grid = ticks.map((v) => `<line class="c-grid${v === 0 ? ' c-zero' : ''}" x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="c-label" x="${pl - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${short(v)}</text>`).join('');
    const xs = [...new Set([1, Math.ceil(cash.n * 0.25), Math.ceil(cash.n * 0.5), Math.ceil(cash.n * 0.75), cash.n])];
    const xl = xs.map((day) => `<text class="c-label" x="${x(day).toFixed(1)}" y="${H - 8}" text-anchor="middle">${day}</text>`).join('');
    const markers = cash.days.flatMap((dd) => dd.events.map((ev) => ({ dd, ev }))).reduce((acc, { dd, ev }) => {
      if (!acc.has(dd.day)) acc.set(dd.day, ev.type);
      else if (acc.get(dd.day) !== ev.type) acc.set(dd.day, 'mixed');
      return acc;
    }, new Map());
    const dots = [...markers].map(([day, type]) => `<circle class="c-dot c-${type}" cx="${x(day).toFixed(1)}" cy="${y(cash.days[day - 1].balance).toFixed(1)}" r="4.5"/>`).join('');
    const todayX = x(t).toFixed(1);

    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution projetée du solde sur le mois" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10b981" stop-opacity=".28"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}
      <path class="c-area" d="${area}"/>
      <path class="c-line" d="${line(actual)}"/>
      <path class="c-proj" d="${line(proj)}"/>
      <line class="c-today" x1="${todayX}" x2="${todayX}" y1="${pt}" y2="${H - pb}"/>
      ${dots}
      <circle class="c-now" cx="${todayX}" cy="${y(cash.days[t - 1].balance).toFixed(1)}" r="6"/>
    </svg>`;
  }

  function renderAgenda(d) {
    const cash = cashflow(d);
    els.cashChart.innerHTML = chartSvg(cash);
    const dip = cash.openingKnown && cash.min.value < 0;
    els.cashNote.dataset.tone = dip ? 'bad' : 'ok';
    els.cashNote.textContent = dip
      ? `Attention : ton solde projeté descend à ${money(cash.min.value)} le ${shortDate(isoFor(d.key, cash.min.day))}.`
      : cash.openingKnown
        ? `Fin de mois projetée : ${money(cash.end)} si tu dépenses tes enveloppes jusqu'au bout.`
        : `Projection à partir de 0 € au 1er du mois. Renseigne ton solde de départ pour l'affiner. Fin de mois : ${money(cash.end)}.`;

    els.calLabel.textContent = monthName(d.key);
    const today = clock.today();
    if (!ui.agendaDay || !ui.agendaDay.startsWith(d.key)) ui.agendaDay = today;
    const first = (parseISO(`${d.key}-01`).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(h('span', { class: 'cal-blank', 'aria-hidden': 'true' }));
    for (const dd of cash.days) {
      const iso = isoFor(d.key, dd.day);
      const types = [...new Set(dd.events.map((e) => e.type))];
      cells.push(h('button', {
        type: 'button',
        class: `cal-day${iso === today ? ' is-today' : ''}${iso === ui.agendaDay ? ' is-selected' : ''}`,
        dataset: { date: iso },
        'aria-label': `${dayHeading(iso)}${dd.events.length ? `, ${dd.events.length} échéance(s)` : ''}`
      }, h('span', { text: String(dd.day) }), h('i', { class: 'cal-dots' }, types.slice(0, 3).map((tp) => h('b', { class: `dot-${tp}` })))));
    }
    els.calendar.replaceChildren(...cells);

    const sel = cash.days[dayOf(ui.agendaDay) - 1];
    const spentThatDay = state.transactions.filter((t) => t.type === 'expense' && t.date === ui.agendaDay).reduce((s, t) => s + t.amount, 0);
    els.dayDetail.replaceChildren(
      h('h3', { text: dayHeading(ui.agendaDay) }),
      ...(sel.events.length
        ? sel.events.map((ev) => h('div', { class: 'day-event', dataset: { type: ev.type } },
          h('span', { text: ev.label }),
          h('strong', { text: `${ev.amount >= 0 ? '+' : '−'}${money(Math.abs(ev.amount))}` })))
        : [h('p', { class: 'muted', text: 'Aucune échéance ce jour-là.' })]),
      spentThatDay > 0 ? h('div', { class: 'day-event', dataset: { type: 'spent' } }, h('span', { text: 'Dépenses du jour' }), h('strong', { text: `−${money(spentThatDay)}` })) : null,
      h('p', { class: 'muted', text: `Solde projeté en fin de journée : ${money(sel.balance)}` })
    );

    const items = [...state.recurring].sort((a, b) => clampDay(a.day, d.key) - clampDay(b.day, d.key));
    const dayNow = dayOf(today);
    const chargesTotal = items.filter((r) => r.type === 'charge').reduce((s, r) => s + r.amount, 0);
    const incomesTotal = items.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    els.recSummary.textContent = items.length
      ? `${money(chargesTotal)} de charges fixes${incomesTotal ? ` · ${money(incomesTotal)} de revenus récurrents` : ''} par mois`
      : '';
    els.recList.replaceChildren(...items.map((r) => {
      const dd = clampDay(r.day, d.key);
      const diff = dd - dayNow;
      const status = diff < 0 ? (r.type === 'charge' ? 'Prélevé' : 'Reçu') : diff === 0 ? "Aujourd'hui" : `Dans ${diff} j`;
      return h('button', { type: 'button', class: 'rec-row', dataset: { id: r.id, type: r.type, past: String(diff < 0) } },
        h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon((REC_CATS[r.cat] || REC_CATS.autre).icon)),
        h('span', { class: 'tx-body' }, h('strong', { text: r.label }), h('small', { text: `Le ${dd} du mois · ${status}` })),
        h('span', { class: 'tx-amount', text: `${r.type === 'charge' ? '−' : '+'}${money(r.amount)}` }));
    }));
    els.recEmpty.hidden = items.length > 0;
    flushIcons();
  }

  function spentUpTo(key, day) {
    return state.transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(key) && dayOf(t.date) <= day)
      .reduce((s, t) => s + t.amount, 0);
  }

  function renderReport() {
    const key = ui.reportMonth || currentMonth();
    ui.reportMonth = key;
    els.rLabel.textContent = monthName(key);
    els.rNext.disabled = key >= currentMonth();
    const d = derive(key);
    const result = d.income - d.charges - d.projectsMonthly - d.spentTotal;

    els.rTiles.replaceChildren(
      h('div', { class: 'tile tile-hero', dataset: { negative: String(result < 0) } }, h('span', { text: d.isCurrent ? 'Solde du mois à ce jour' : 'Solde du mois' }), h('strong', { text: money(result) })),
      h('div', { class: 'tile' }, h('span', { text: 'Revenus' }), h('strong', { text: money(d.income) })),
      h('div', { class: 'tile' }, h('span', { text: 'Charges fixes' }), h('strong', { text: money(d.charges) })),
      h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(d.spentTotal) })),
      h('div', { class: 'tile' }, h('span', { text: 'Épargne projets' }), h('strong', { text: money(d.projectsMonthly) }))
    );

    const bars = d.spend.map((r) => ({ name: r.env.name, spent: r.spent, max: r.env.max })).sort((a, b) => b.spent / b.max - a.spent / a.max);
    if (d.orphan > 0) bars.push({ name: 'Hors enveloppe', spent: d.orphan, max: 0 });
    els.rBars.replaceChildren(
      h('h3', { text: 'Enveloppes' }),
      ...(bars.length
        ? bars.map((b) => {
          const ratio = b.max > 0 ? b.spent / b.max : 1;
          const stateName = b.max === 0 ? 'orphan' : ratio > 1 ? 'over' : ratio >= 0.85 ? 'tight' : 'safe';
          return h('div', { class: 'bar-row', dataset: { state: stateName } },
            h('div', { class: 'bar-row-head' }, h('span', { text: b.name }), h('strong', { text: b.max > 0 ? `${money(b.spent)} / ${money(b.max)}` : money(b.spent) })),
            h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.min(100, ratio * 100)}%` })));
        })
        : [h('p', { class: 'muted', text: 'Aucune enveloppe de dépenses.' })])
    );

    const notes = [];
    const ranked = [...d.spend].filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent);
    if (ranked.length && d.spentTotal > 0) {
      notes.push(['trending-up', `« ${ranked[0].env.name} » est ton premier poste : ${Math.round((ranked[0].spent / d.spentTotal) * 100)} % de tes dépenses.`]);
    }
    const prevKey = shiftMonth(key, -1);
    const upTo = d.isCurrent ? dayOf(clock.today()) : daysInMonth(key);
    const prevSpent = spentUpTo(prevKey, upTo);
    if (prevSpent > 0 && d.spentTotal > 0) {
      const delta = Math.round(((d.spentTotal - prevSpent) / prevSpent) * 100);
      notes.push([delta > 0 ? 'triangle-alert' : 'circle-check', delta === 0
        ? 'Tu dépenses autant que le mois précédent à la même date.'
        : `Tu dépenses ${Math.abs(delta)} % ${delta > 0 ? 'de plus' : 'de moins'} que le mois précédent à la même date.`]);
    }
    if (d.projectsMonthly > 0 && d.income > 0) {
      notes.push(['piggy-bank', `Tu mets de côté ${Math.round((d.projectsMonthly / d.income) * 100)} % de tes revenus dans tes projets.`]);
    }
    if (d.orphan > 0) notes.push(['info', `${money(d.orphan)} dépensés hors enveloppe : pense à les ranger dans une catégorie.`]);
    els.rNotes.replaceChildren(
      h('h3', { text: 'À retenir' }),
      ...(notes.length
        ? notes.map(([ic, text]) => h('p', { class: 'note-line' }, icon(ic), h('span', { text })))
        : [h('p', { class: 'muted', text: 'Pas encore assez de données pour ce mois.' })])
    );
    flushIcons();
  }

  function showError(el, message) {
    el.hidden = false;
    el.textContent = message;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  const hideError = (el) => {
    el.hidden = true;
    el.textContent = '';
  };

  function setHint(el, text, tone) {
    el.textContent = text;
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  function toast(message, opts = {}) {
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
    setTimeout(dismiss, o.duration || (o.action ? 6000 : tone === 'error' ? 4800 : 3200));
  }

  function openDialog(dlg) {
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  const closeDialog = (dlg) => { if (dlg.open) dlg.close(); };

  function confirmAction({ title, text, confirmLabel = 'Confirmer', danger = false }) {
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

  const checkedValue = (form, name) => {
    const input = form.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : null;
  };

  function setRadio(form, name, value) {
    form.querySelectorAll(`input[name="${name}"]`).forEach((input) => { input.checked = input.value === value; });
  }

  let busy = false;
  const guard = (fn) => (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try { fn(event); } finally { setTimeout(() => { busy = false; }, 350); }
  };

  const txUi = { mode: 'expense', id: null, envId: null };
  const QUICK = { expense: [5, 10, 20, 50], income: [50, 100, 500, 1000], deposit: [50, 100, 200, 500] };

  function renderTxChips() {
    const date = isISO(els.txDate.value) ? els.txDate.value : clock.today();
    const d = derive(monthOf(date));
    const chip = (envId, name, sub) => h('button', {
      type: 'button', class: 'chip', role: 'radio', 'aria-checked': String((txUi.envId || '') === envId), dataset: { env: envId }
    }, h('span', { text: name }), h('small', { text: sub }));
    els.txChips.replaceChildren(
      ...d.spend.map((r) => chip(r.env.id, r.env.name, r.left < 0 ? `−${money(-r.left)}` : money(r.left))),
      chip('', 'Hors enveloppe', 'sur reste à vivre')
    );
  }

  function updateTxHint() {
    const amount = parseAmount(els.txAmount.value);
    const prev = txUi.id ? state.transactions.find((t) => t.id === txUi.id) : null;
    if (txUi.mode === 'income') return setHint(els.txHint, "Ce revenu s'ajoute à ton reste à vivre.");
    if (txUi.mode === 'deposit') {
      const env = findEnv(txUi.envId);
      if (!env) return setHint(els.txHint, '');
      const room = env.target - env.saved + (prev && prev.type === 'deposit' ? prev.amount : 0);
      const after = room - (amount || 0);
      return after < 0
        ? setHint(els.txHint, `Dépasse l'objectif de ${money(-after)}.`, 'bad')
        : setHint(els.txHint, `Encore ${money(after)} pour atteindre l'objectif.`, amount ? 'ok' : undefined);
    }
    const env = findEnv(txUi.envId);
    if (!env) return setHint(els.txHint, 'Hors enveloppe : le montant est prélevé directement sur ton reste à vivre.');
    const date = isISO(els.txDate.value) ? els.txDate.value : clock.today();
    const row = derive(monthOf(date)).spend.find((r) => r.env.id === env.id);
    const own = prev && prev.type === 'expense' && prev.envId === env.id && monthOf(prev.date) === monthOf(date) ? prev.amount : 0;
    const base = (row ? row.left : 0) + own;
    if (!amount) return setHint(els.txHint, `Disponible dans « ${env.name} » : ${money(base)}`);
    const left = base - amount;
    return left < 0
      ? setHint(els.txHint, `Dépasse l'enveloppe de ${money(-left)} : le surplus est prélevé sur ton reste à vivre.`, 'bad')
      : setHint(els.txHint, `Il restera ${money(left)} dans « ${env.name} ».`, 'ok');
  }

  function renderTxQuick() {
    els.txQuick.replaceChildren(...QUICK[txUi.mode].map((n) => h('button', { type: 'button', dataset: { amount: String(n) }, text: `${n} €` })));
    els.txQuick.hidden = false;
  }

  function openTx({ mode = 'expense', envId, tx = null } = {}) {
    txUi.id = tx ? tx.id : null;
    txUi.mode = tx ? tx.type : mode;
    const envs = state.envelopes.filter((e) => e.kind === 'spend');
    if (txUi.mode === 'deposit') {
      txUi.envId = tx ? tx.envId : envId;
    } else if (txUi.mode === 'expense') {
      const pref = findEnv(state.prefs.lastEnvId);
      txUi.envId = tx ? tx.envId : envId !== undefined ? envId : pref && pref.kind === 'spend' ? pref.id : envs[0] ? envs[0].id : null;
    } else {
      txUi.envId = null;
    }

    const project = txUi.mode === 'deposit' ? findEnv(txUi.envId) : null;
    els.txTitle.textContent = tx
      ? "Modifier l'opération"
      : txUi.mode === 'income' ? 'Nouveau revenu' : txUi.mode === 'deposit' ? `Verser dans « ${project ? project.name : ''} »` : 'Nouvelle dépense';
    els.txSub.textContent = '';
    els.txMode.hidden = Boolean(tx) || txUi.mode === 'deposit';
    setRadio(els.txForm, 'tx-mode', txUi.mode === 'income' ? 'income' : 'expense');
    els.txEnvField.hidden = txUi.mode !== 'expense';
    els.txAmount.value = tx ? toInputValue(tx.amount) : '';
    els.txNote.value = tx ? tx.note : '';
    els.txDate.value = tx ? tx.date : clock.today();
    els.txDelete.hidden = !tx;
    els.txSubmit.textContent = tx ? 'Enregistrer' : txUi.mode === 'income' ? 'Ajouter le revenu' : txUi.mode === 'deposit' ? 'Verser' : 'Ajouter la dépense';
    hideError(els.txError);
    renderTxChips();
    renderTxQuick();
    updateTxHint();
    openDialog(els.dlgTx);
    requestAnimationFrame(() => els.txAmount.focus());
  }

  els.txMode.addEventListener('change', () => {
    txUi.mode = checkedValue(els.txForm, 'tx-mode') === 'income' ? 'income' : 'expense';
    if (txUi.mode === 'expense' && !txUi.envId) {
      const pref = findEnv(state.prefs.lastEnvId);
      txUi.envId = pref && pref.kind === 'spend' ? pref.id : (state.envelopes.find((e) => e.kind === 'spend') || {}).id || null;
    }
    els.txEnvField.hidden = txUi.mode !== 'expense';
    els.txSubmit.textContent = txUi.mode === 'income' ? 'Ajouter le revenu' : 'Ajouter la dépense';
    els.txTitle.textContent = txUi.mode === 'income' ? 'Nouveau revenu' : 'Nouvelle dépense';
    renderTxQuick();
    updateTxHint();
  });

  els.txChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-env]');
    if (!chip) return;
    txUi.envId = chip.dataset.env || null;
    renderTxChips();
    updateTxHint();
  });

  els.txQuick.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-amount]');
    if (!btn) return;
    els.txAmount.value = btn.dataset.amount;
    hideError(els.txError);
    updateTxHint();
    els.txAmount.focus();
  });

  [els.txAmount, els.txDate].forEach((el) => el.addEventListener('input', () => {
    hideError(els.txError);
    if (el === els.txDate) renderTxChips();
    updateTxHint();
  }));

  els.txForm.addEventListener('submit', guard(() => {
    const mode = txUi.mode;
    const payload = {
      type: mode,
      envId: mode === 'income' ? null : txUi.envId,
      amount: parseAmount(els.txAmount.value),
      note: els.txNote.value,
      date: els.txDate.value
    };
    if (txUi.id) {
      const res = updateTransaction(txUi.id, payload);
      if (!res.ok) return showError(els.txError, res.error);
      closeDialog(els.dlgTx);
      toast('Opération mise à jour.');
      return;
    }
    const res = addTransaction(payload);
    if (!res.ok) return showError(els.txError, res.error);
    closeDialog(els.dlgTx);
    const t = res.data;
    const env = findEnv(t.envId);
    let message;
    if (t.type === 'income') {
      message = `+${money(t.amount)} ajoutés à ton reste à vivre.`;
    } else if (t.type === 'deposit') {
      message = `${money(t.amount)} versés dans « ${env.name} ».`;
    } else if (env) {
      const row = derive(monthOf(t.date)).spend.find((r) => r.env.id === env.id);
      message = row && row.left >= 0 ? `−${money(t.amount)} · il reste ${money(row.left)} dans « ${env.name} ».` : `−${money(t.amount)} · « ${env.name} » est dépassée.`;
    } else {
      message = `−${money(t.amount)} hors enveloppe.`;
    }
    toast(message, { action: { label: 'Annuler', run: () => { if (deleteTransaction(t.id).ok) toast('Opération annulée.'); } } });
  }));

  els.txDelete.addEventListener('click', () => {
    if (!txUi.id) return;
    const removed = deleteTransaction(txUi.id);
    if (!removed.ok) return showError(els.txError, removed.error);
    closeDialog(els.dlgTx);
    const t = removed.data;
    toast('Opération supprimée.', {
      action: {
        label: 'Annuler',
        run: () => addTransaction({ type: t.type, envId: t.envId, amount: t.amount, note: t.note, date: t.date, ref: t.ref })
      }
    });
  });

  const envUi = { id: null, kind: 'spend' };

  function syncEnvFields() {
    els.envSpendFields.hidden = envUi.kind !== 'spend';
    els.envProjectFields.hidden = envUi.kind !== 'project';
  }

  function updateEnvHint() {
    const d = derive();
    const existing = envUi.id ? findEnv(envUi.id) : null;
    if (envUi.kind === 'spend') {
      const max = parseAmount(els.envMax.value);
      if (!max) return setHint(els.envHint, `Disponible à répartir : ${money(Math.max(0, d.free))}`);
      const row = existing ? d.spend.find((r) => r.env.id === existing.id) : null;
      const delta = Math.max(max, row ? row.spent : 0) - (row ? row.effective : 0);
      const after = d.free - delta;
      return after < 0
        ? setHint(els.envHint, `Dépasse ton reste à vivre de ${money(-after)}.`, 'bad')
        : setHint(els.envHint, `Reste à vivre après blocage : ${money(after)}`, 'ok');
    }
    const target = parseAmount(els.envTarget.value);
    const saved = els.envSaved.value.trim() === '' ? 0 : parseAmount(els.envSaved.value);
    const monthly = els.envMonthly.value.trim() === '' ? 0 : parseAmount(els.envMonthly.value);
    if (monthly === null || saved === null || !target) return setHint(els.envHint, `Disponible à répartir : ${money(Math.max(0, d.free))}`);
    const next = saved >= target ? 0 : monthly;
    const after = d.free - (next - (existing ? projectMonthly(existing) : 0));
    let eta = '';
    if (saved < target && monthly > 0) eta = ` · objectif atteint dans ≈ ${durationLabel(Math.ceil((target - saved) / monthly))}`;
    return after < 0
      ? setHint(els.envHint, `Dépasse ton reste à vivre de ${money(-after)}.`, 'bad')
      : setHint(els.envHint, `Reste à vivre après blocage : ${money(after)}${eta}`, 'ok');
  }

  function openEnv({ kind = 'spend', env = null } = {}) {
    envUi.id = env ? env.id : null;
    envUi.kind = env ? env.kind : kind;
    els.envTitle.textContent = env ? "Modifier l'enveloppe" : envUi.kind === 'project' ? 'Nouveau projet de vie' : 'Nouvelle enveloppe';
    els.envKindWrap.hidden = Boolean(env);
    setRadio(els.envForm, 'env-kind', envUi.kind);
    els.envName.value = env ? env.name : '';
    els.envMax.value = env && env.kind === 'spend' ? toInputValue(env.max) : '';
    els.envTarget.value = env && env.kind === 'project' ? toInputValue(env.target) : '';
    els.envSaved.value = env && env.kind === 'project' ? toInputValue(env.saved) : '';
    els.envMonthly.value = env && env.kind === 'project' ? toInputValue(env.monthly) : '';
    els.envSubmit.textContent = env ? 'Enregistrer' : 'Créer';
    syncEnvFields();
    hideError(els.envError);
    updateEnvHint();
    openDialog(els.dlgEnv);
    requestAnimationFrame(() => els.envName.focus());
  }

  els.envKindWrap.addEventListener('change', () => {
    envUi.kind = checkedValue(els.envForm, 'env-kind') === 'project' ? 'project' : 'spend';
    els.envTitle.textContent = envUi.kind === 'project' ? 'Nouveau projet de vie' : 'Nouvelle enveloppe';
    syncEnvFields();
    updateEnvHint();
  });

  [els.envName, els.envMax, els.envTarget, els.envSaved, els.envMonthly].forEach((el) =>
    el.addEventListener('input', () => {
      hideError(els.envError);
      updateEnvHint();
    })
  );

  els.envForm.addEventListener('submit', guard(() => {
    const optional = (el) => (el.value.trim() === '' ? 0 : parseAmount(el.value));
    const input = envUi.kind === 'project'
      ? { kind: 'project', name: els.envName.value, target: parseAmount(els.envTarget.value), saved: optional(els.envSaved), monthly: optional(els.envMonthly) }
      : { kind: 'spend', name: els.envName.value, max: parseAmount(els.envMax.value) };
    const res = envUi.id ? updateEnvelope(envUi.id, input) : createEnvelope(input);
    if (!res.ok) return showError(els.envError, res.error);
    closeDialog(els.dlgEnv);
    const env = res.data;
    toast(envUi.id
      ? 'Enveloppe mise à jour.'
      : env.kind === 'project'
        ? `Projet « ${env.name} » créé : ${money(projectMonthly(env))} bloqués chaque mois.`
        : `« ${env.name} » créée : ${money(env.max)} bloqués.`);
  }));

  const recUi = { id: null, type: 'charge' };

  function updateRecHint() {
    const amount = parseAmount(els.recAmount.value);
    const d = derive();
    if (recUi.type === 'income') return setHint(els.recHint, amount ? `+${money(amount)} chaque mois dans ton reste à vivre.` : 'Aide, pension, job étudiant… tout revenu régulier.');
    if (!amount) return setHint(els.recHint, 'Le montant est réservé dès maintenant sur ton reste à vivre.');
    const existing = recUi.id ? state.recurring.find((r) => r.id === recUi.id) : null;
    const after = d.free - amount + (existing && existing.type === 'charge' ? existing.amount : 0);
    return after < 0
      ? setHint(els.recHint, `Ton reste à vivre passera à ${money(after)} : tes revenus ne couvrent plus tout.`, 'bad')
      : setHint(els.recHint, `Reste à vivre après réservation : ${money(after)}`, 'ok');
  }

  function openRec({ item = null, type = 'charge' } = {}) {
    recUi.id = item ? item.id : null;
    recUi.type = item ? item.type : type;
    els.recTitle.textContent = item ? "Modifier l'échéance" : 'Nouvelle échéance';
    setRadio(els.recForm, 'rec-type', recUi.type);
    els.recLabel.value = item ? item.label : '';
    els.recAmount.value = item ? toInputValue(item.amount) : '';
    els.recDay.value = item ? String(item.day) : '';
    els.recCat.value = item ? item.cat : recUi.type === 'income' ? 'revenu' : 'abonnement';
    els.recDelete.hidden = !item;
    hideError(els.recError);
    updateRecHint();
    openDialog(els.dlgRec);
    requestAnimationFrame(() => els.recLabel.focus());
  }

  els.recTypeWrap.addEventListener('change', () => {
    recUi.type = checkedValue(els.recForm, 'rec-type') === 'income' ? 'income' : 'charge';
    if (!recUi.id) els.recCat.value = recUi.type === 'income' ? 'revenu' : 'abonnement';
    updateRecHint();
  });

  [els.recLabel, els.recAmount, els.recDay].forEach((el) => el.addEventListener('input', () => {
    hideError(els.recError);
    updateRecHint();
  }));

  els.recForm.addEventListener('submit', guard(() => {
    const input = { type: recUi.type, label: els.recLabel.value, amount: parseAmount(els.recAmount.value), day: parseDayInput(els.recDay.value), cat: els.recCat.value };
    const res = recUi.id ? updateRecurring(recUi.id, input) : addRecurring(input);
    if (!res.ok) return showError(els.recError, res.error);
    closeDialog(els.dlgRec);
    toast(recUi.id ? 'Échéance mise à jour.' : `« ${res.data.label} » ajoutée à ton agenda.`);
  }));

  els.recDelete.addEventListener('click', async () => {
    const item = state.recurring.find((r) => r.id === recUi.id);
    if (!item) return;
    closeDialog(els.dlgRec);
    const confirmed = await confirmAction({
      title: `Supprimer « ${item.label} » ?`,
      text: item.type === 'charge' ? `Les ${money(item.amount)} réservés chaque mois seront réinjectés dans ton reste à vivre.` : `Ce revenu de ${money(item.amount)} ne sera plus compté chaque mois.`,
      confirmLabel: 'Supprimer',
      danger: true
    });
    if (confirmed && deleteRecurring(item.id).ok) toast('Échéance supprimée.');
  });

  function openSettings() {
    els.setDay.value = String(state.salaryDay);
    els.setOpening.value = state.openingBalance === null ? '' : toInputValue(state.openingBalance);
    hideError(els.setError);
    closeDialog(els.dlgMenu);
    openDialog(els.dlgSettings);
  }

  els.setForm.addEventListener('submit', guard(() => {
    const raw = els.setOpening.value.trim();
    const opening = raw === '' ? null : (parseAmount(raw) ?? undefined);
    const res = setSettings({ salaryDay: parseDayInput(els.setDay.value), openingBalance: opening });
    if (!res.ok) return showError(els.setError, res.error);
    closeDialog(els.dlgSettings);
    toast('Réglages enregistrés.');
  }));

  function openSalaryEdit() {
    els.salaryView.hidden = true;
    els.salaryForm.hidden = false;
    hideError(els.salaryError);
    els.salaryInput.value = state.salary > 0 ? toInputValue(state.salary) : '';
    els.salaryInput.focus();
    els.salaryInput.select();
  }

  function closeSalaryEdit() {
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

  const welcome = { income: 0 };

  function openWelcome() {
    welcome.income = 0;
    els.wStep1.hidden = false;
    els.wStep2.hidden = true;
    els.wSkip.hidden = false;
    els.wNext.hidden = false;
    els.wBack.hidden = true;
    els.wIncome.value = '';
    hideError(els.wError);
    openDialog(els.dlgWelcome);
    requestAnimationFrame(() => els.wIncome.focus());
  }

  function renderTemplates() {
    els.wTemplates.replaceChildren(...Object.entries(TEMPLATES).map(([key, tpl]) => {
      const summary = tpl.recurring.length + tpl.spend.length + tpl.projects.length === 0
        ? 'Aucune enveloppe préremplie'
        : `${tpl.recurring.length} charges fixes · ${tpl.spend.length} enveloppes · ${tpl.projects.length} projet${tpl.projects.length > 1 ? 's' : ''}`;
      return h('button', { type: 'button', class: 'tpl', dataset: { tpl: key } },
        h('span', { class: 'tpl-icon', 'aria-hidden': 'true' }, icon(tpl.icon)),
        h('span', { class: 'tpl-body' }, h('strong', { text: tpl.label }), h('small', { text: tpl.blurb }), h('em', { text: summary })));
    }));
    flushIcons();
  }

  els.wNext.addEventListener('click', () => {
    const income = parseAmount(els.wIncome.value);
    if (!income || income <= 0) return showError(els.wError, 'Indique ton revenu mensuel net (ex : 1450).');
    welcome.income = income;
    hideError(els.wError);
    els.wStep1.hidden = true;
    els.wStep2.hidden = false;
    els.wSkip.hidden = true;
    els.wNext.hidden = true;
    els.wBack.hidden = false;
    renderTemplates();
  });

  els.wIncome.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.wNext.click();
    }
  });

  els.wBack.addEventListener('click', () => {
    els.wStep1.hidden = false;
    els.wStep2.hidden = true;
    els.wSkip.hidden = false;
    els.wNext.hidden = false;
    els.wBack.hidden = true;
    hideError(els.wError);
  });

  els.wSkip.addEventListener('click', () => {
    state.prefs.onboarded = true;
    save();
    closeDialog(els.dlgWelcome);
    openSalaryEdit();
  });

  els.wTemplates.addEventListener('click', (e) => {
    const card = e.target.closest('[data-tpl]');
    if (!card) return;
    const res = applyTemplate(card.dataset.tpl, welcome.income);
    if (!res.ok) return showError(els.wError, res.error);
    commit();
    closeDialog(els.dlgWelcome);
    toast(`C'est prêt : ${state.envelopes.length + state.recurring.length} éléments créés, ajuste-les à ta façon.`);
  });

  const imp = { rows: [], note: '' };

  function updateImportConfirm() {
    const n = imp.rows.filter((r) => r.include).length;
    els.impConfirm.disabled = n === 0;
    els.impConfirm.textContent = n ? `Importer ${n} ${plural(n, 'opération', 'opérations')}` : 'Rien à importer';
  }

  function renderImportRows() {
    const envs = state.envelopes.filter((e) => e.kind === 'spend');
    els.impList.replaceChildren(...imp.rows.map((r, i) => h('div', { class: 'import-row', dataset: { i: String(i), type: r.type } },
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

  async function startCsvImport(file) {
    try {
      const parsed = parseStatement(decodeBuffer(await file.arrayBuffer()));
      if (parsed.error) return toast(parsed.error, 'error');
      const known = new Set(state.transactions.filter((t) => t.ref).map((t) => t.ref));
      let already = 0;
      const rows = [];
      for (const r of parsed.rows) {
        if (known.has(r.ref)) { already++; continue; }
        known.add(r.ref);
        const expense = r.amount < 0;
        const type = expense ? 'expense' : 'income';
        const maybe = state.transactions.some((t) => t.type === type && t.date === r.date && t.amount === Math.abs(r.amount));
        const auto = expense ? guessEnvelope(r.label) || '' : '';
        rows.push({ ...r, type, maybe, include: expense && !maybe, auto, env: auto });
      }
      if (!rows.length) return toast(already ? 'Toutes ces opérations ont déjà été importées.' : 'Aucune opération exploitable dans ce fichier.', 'error');
      const capped = rows.slice(0, 500);
      imp.rows = capped;
      imp.note = `${rows.length} ${plural(rows.length, 'nouvelle opération', 'nouvelles opérations')}${rows.length > 500 ? ' (500 premières affichées)' : ''}`
        + `${already ? ` · ${already} déjà importées` : ''}${parsed.skipped ? ` · ${parsed.skipped} lignes ignorées` : ''}`;
      hideError(els.impError);
      renderImportRows();
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
    commit();
    closeDialog(els.dlgImport);
    ui.journalMonth = null;
    toast(`${count} ${plural(count, 'opération importée', 'opérations importées')}.`);
  });

  function exportData() {
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
    toast('Sauvegarde exportée.');
  }

  async function importJson(file) {
    try {
      const raw = JSON.parse(await file.text());
      const parsed = raw && raw.v === 2 ? sanitize(raw) : migrateV1(raw);
      if (!parsed || (parsed.salary <= 0 && !parsed.envelopes.length)) throw new Error('invalid');
      const confirmed = await confirmAction({
        title: 'Importer cette sauvegarde ?',
        text: `${parsed.envelopes.length} ${plural(parsed.envelopes.length, 'enveloppe', 'enveloppes')}, ${parsed.transactions.length} ${plural(parsed.transactions.length, 'opération', 'opérations')}. Tes données actuelles seront remplacées.`,
        confirmLabel: 'Importer'
      });
      if (!confirmed) return;
      state = parsed;
      state.prefs.onboarded = true;
      announceCredits(runRollover());
      commit();
      toast('Sauvegarde importée.');
    } catch {
      toast("Ce fichier n'est pas une sauvegarde BudgetFold valide.", 'error');
    }
  }

  function announceCredits(credits) {
    if (!credits || !credits.size) return;
    const total = [...credits.values()].reduce((s, v) => s + v, 0);
    const names = [...credits.keys()].map((id) => (findEnv(id) || {}).name).filter(Boolean);
    toast(`Mois clôturé : ${money(total)} versés dans ${names.length > 2 ? `${names.length} projets` : names.map((n) => `« ${n} »`).join(' et ')}.`, { duration: 5200 });
  }

  els.tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  els.tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.indexOf(ui.tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    els.tabs.querySelector(`[data-tab="${next}"]`).focus();
  });

  els.insights.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  async function handleCardClick(e) {
    const button = e.target.closest('[data-action]');
    const card = button && button.closest('.envelope');
    if (!card || card.classList.contains('is-leaving')) return;
    const env = findEnv(card.dataset.id);
    if (!env) return;
    const action = button.dataset.action;
    if (action === 'spend') return openTx({ mode: 'expense', envId: env.id });
    if (action === 'deposit') return openTx({ mode: 'deposit', envId: env.id });
    if (action === 'edit') return openEnv({ env });
    if (action === 'delete') {
      const d = derive();
      const row = d.spend.find((r) => r.env.id === env.id);
      const text = env.kind === 'project'
        ? `Le suivi de ton épargne (${money(env.saved)}) sera supprimé et la mise de ${money(projectMonthly(env))} par mois retournera dans ton reste à vivre.`
        : `Les ${money(row ? Math.max(0, row.left) : env.max)} encore disponibles seront réinjectés dans ton reste à vivre.${row && row.spent > 0 ? ` Tes ${money(row.spent)} déjà dépensés restent dans le journal, hors enveloppe.` : ''}`;
      const confirmed = await confirmAction({ title: `Supprimer « ${env.name} » ?`, text, confirmLabel: 'Supprimer', danger: true });
      if (!confirmed) return;
      const res = deleteEnvelope(env.id);
      if (res.ok) toast(res.data.reinjected > 0 ? `${money(res.data.reinjected)} réinjectés dans ton reste à vivre.` : 'Enveloppe supprimée.');
    }
  }

  els.spendGrid.addEventListener('click', handleCardClick);
  els.projectGrid.addEventListener('click', handleCardClick);
  els.addSpend.addEventListener('click', () => openEnv({ kind: 'spend' }));
  els.addProject.addEventListener('click', () => openEnv({ kind: 'project' }));
  els.btnAdd.addEventListener('click', () => openTx({ mode: 'expense' }));
  els.fab.addEventListener('click', () => openTx({ mode: 'expense' }));
  els.jAdd.addEventListener('click', () => openTx({ mode: 'expense' }));

  els.jPrev.addEventListener('click', () => { ui.journalMonth = shiftMonth(ui.journalMonth || currentMonth(), -1); renderJournal(); });
  els.jNext.addEventListener('click', () => { ui.journalMonth = shiftMonth(ui.journalMonth || currentMonth(), 1); renderJournal(); });
  els.jFilter.addEventListener('change', () => { ui.journalFilter = els.jFilter.value; renderJournal(); });
  els.jList.addEventListener('click', (e) => {
    const row = e.target.closest('.tx-row');
    const tx = row && state.transactions.find((t) => t.id === row.dataset.id);
    if (tx) openTx({ tx });
  });

  els.rPrev.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), -1); renderReport(); });
  els.rNext.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), 1); renderReport(); });

  els.calendar.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (!cell) return;
    ui.agendaDay = cell.dataset.date;
    renderAgenda(derive());
  });
  els.addRecurring.addEventListener('click', () => openRec({}));
  els.cashEdit.addEventListener('click', openSettings);
  els.recList.addEventListener('click', (e) => {
    const row = e.target.closest('.rec-row');
    const item = row && state.recurring.find((r) => r.id === row.dataset.id);
    if (item) openRec({ item });
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
      text: 'Ton salaire, tes enveloppes, ton journal et ton agenda seront définitivement supprimés de cet appareil.',
      confirmLabel: 'Tout effacer',
      danger: true
    });
    if (!confirmed) return;
    state = emptyState();
    commit();
    toast('Toutes les données ont été effacées.');
    openWelcome();
  });

  let installPrompt = null;
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

  function applyHash() {
    const hash = location.hash.replace('#', '');
    if (hash === 'add') {
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file:// */ }
      openTx({ mode: 'expense' });
      return;
    }
    const tab = hash === 'bilan' ? 'report' : TABS.includes(hash) ? hash : null;
    if (tab) setTab(tab, { updateHash: false });
  }
  window.addEventListener('hashchange', applyHash);

  let lastDay = clock.today();
  function checkClock() {
    const today = clock.today();
    if (today === lastDay) return;
    lastDay = today;
    const credits = runRollover();
    if (credits.size) save();
    ui.journalMonth = null;
    ui.reportMonth = null;
    ui.agendaDay = null;
    render();
    announceCredits(credits);
  }
  setInterval(checkClock, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkClock(); });

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    render();
  });

  if (
    'serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  window.BudgetFold = {
    version: VERSION,
    clock,
    ui,
    getState: () => state,
    setState: (raw) => { state = sanitize(raw) || emptyState(); render(); },
    derive, cashflow, dailyBudget, computeInsights, parseStatement, runRollover, applyTemplate, render, setTab,
    actions: { addTransaction, updateTransaction, deleteTransaction, createEnvelope, updateEnvelope, deleteEnvelope, addRecurring, deleteRecurring, setSalary, setSettings }
  };

  const credits = runRollover();
  save();
  render();
  announceCredits(credits);
  applyHash();
  if (!state.prefs.onboarded && state.salary <= 0 && state.envelopes.length === 0) openWelcome();
})();
