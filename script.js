(() => {
  'use strict';

  const VERSION = '3.0';
  const STORAGE_KEY = 'budgetfold-os:v3';
  const V2_KEY = 'budgetfold-os:v2';
  const LEGACY_KEY = 'budgetfold-os:v1';
  const MAX_CENTS = 1_000_000_000;
  const NAME_MAX = 40;
  const NOTE_MAX = 80;
  const DETAIL_MAX = 1500;
  const RING_C = 2 * Math.PI * 50;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clock = { today: () => localISO(new Date()), now: () => Date.now() };

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
  const monthDiff = (a, b) => {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  };
  const clampDay = (day, key) => Math.min(Math.max(1, day), daysInMonth(key));
  const isoFor = (key, day) => `${key}-${pad(day)}`;
  const firstOf = (key) => `${key}-01`;
  const lastOf = (key) => isoFor(key, daysInMonth(key));
  const parseISO = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const dayNumber = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  };
  const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
  const addDays = (iso, n) => {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return localISO(d);
  };
  const mondayOf = (iso) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
  const maxISO = (a, b) => (a > b ? a : b);
  const minISO = (a, b) => (a < b ? a : b);
  const isISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return false;
    const [y, mo, d] = m.slice(1).map(Number);
    if (y < 2000 || y > 2100) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  };
  const isMonthKey = (s) => /^(20\d{2})-(0[1-9]|1[0-2])$/.test(s || '');
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const monthName = (key) => capitalize(parseISO(`${key}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  const monthShort = (key) => capitalize(parseISO(`${key}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''));
  const shortDate = (iso) => parseISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const dayHeading = (iso) => {
    const today = clock.today();
    if (iso === today) return "Aujourd'hui";
    if (iso === addDays(today, -1)) return 'Hier';
    if (iso === addDays(today, 1)) return 'Demain';
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
    return capitalize(parseISO(iso).toLocaleDateString('fr-FR', opts));
  };
  const relDay = (iso) => {
    const diff = daysBetween(clock.today(), iso);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    if (diff > 1 && diff < 7) return capitalize(parseISO(iso).toLocaleDateString('fr-FR', { weekday: 'long' }));
    return shortDate(iso);
  };

  const fmtInt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fmtDec = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (cents) => (cents % 100 === 0 ? fmtInt : fmtDec).format(cents / 100);
  const moneyRound = (cents) => fmtInt.format(Math.round(cents / 100));
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
  const cleanDetail = (v) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, DETAIL_MAX);
  const normText = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const normName = (v) => normText(cleanName(v));

  const toCents = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(MAX_CENTS, Math.max(0, Math.round(n))) : 0;
  };

  function parseAmount(raw) {
    const s = String(raw ?? '').replace(/[\s  €]/g, '').replace(',', '.');
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

  const FREQS = {
    day: { label: 'Chaque jour', per: 'par jour', factor: 365 / 12 },
    week: { label: 'Chaque semaine', per: 'par semaine', factor: 52 / 12 },
    '2weeks': { label: 'Toutes les 2 semaines', per: 'toutes les 2 semaines', factor: 26 / 12 },
    month: { label: 'Chaque mois', per: 'par mois', factor: 1 },
    '2months': { label: 'Tous les 2 mois', per: 'tous les 2 mois', factor: 1 / 2 },
    quarter: { label: 'Chaque trimestre', per: 'par trimestre', factor: 1 / 3 },
    year: { label: 'Chaque année', per: 'par an', factor: 1 / 12 }
  };
  const MONTH_STEPS = { month: 1, '2months': 2, quarter: 3, year: 12 };
  const PERIODS = {
    week: { label: 'semaine', per: 'par semaine', the: 'cette semaine' },
    '2weeks': { label: '2 semaines', per: 'toutes les 2 semaines', the: 'sur ces 2 semaines' },
    month: { label: 'mois', per: 'par mois', the: 'ce mois-ci' },
    '2months': { label: '2 mois', per: 'tous les 2 mois', the: 'sur ces 2 mois' },
    quarter: { label: 'trimestre', per: 'par trimestre', the: 'ce trimestre' },
    year: { label: 'an', per: 'par an', the: 'cette année' }
  };
  const monthlyEq = (amount, freq) => Math.round(amount * (FREQS[freq] || FREQS.month).factor);

  const REC_ICONS = [
    [/loyer|credit immo|pret|logement|habitation/, 'house'],
    [/edf|engie|electric|gaz|eau|energie|internet|box|fibre/, 'zap'],
    [/netflix|spotify|disney|deezer|prime|canal|abonnement|youtube|icloud|apple|google/, 'repeat'],
    [/assurance|mutuelle|maaf|maif|macif|axa|allianz|matmut/, 'shield'],
    [/navigo|essence|carbu|transport|train|sncf|ratp|parking|peage|voiture|auto/, 'car'],
    [/forfait|telephone|mobile|free|sfr|orange|bouygues|sosh|red /, 'smartphone'],
    [/sante|pharma|medecin|docteur|dentiste|kine/, 'heart-pulse'],
    [/cafe|coffee|starbucks/, 'coffee'],
    [/salle|sport|fitness|basic fit|gym/, 'dumbbell'],
    [/courses|supermarche|carrefour|leclerc|lidl|auchan/, 'shopping-cart'],
    [/resto|restaurant|repas|cantine|dejeuner/, 'utensils'],
    [/coiffeur|barbier/, 'scissors']
  ];
  const ruleIcon = (r) => {
    if (r.type === 'income') return 'banknote';
    const t = normText(r.label);
    for (const [re, ic] of REC_ICONS) if (re.test(t)) return ic;
    return r.envId ? 'wallet' : 'calendar-clock';
  };

  const TEMPLATES = {
    student: {
      label: 'Étudiant',
      icon: 'graduation-cap',
      blurb: 'Loyer, courses, transports et une petite épargne.',
      recurring: [['Loyer', 35, 1], ['Téléphone & internet', 4, 8], ['Abonnements', 2, 10]],
      spend: [['Courses', 20, 'month'], ['Transport', 5, 'month'], ['Loisirs', 9, 'month'], ['Santé & hygiène', 3, 'month']],
      projects: [['Épargne de précaution', 5, 3]]
    },
    young: {
      label: 'Jeune actif',
      icon: 'briefcase',
      blurb: 'Logement, énergie, assurances et un fonds d\'urgence.',
      recurring: [['Loyer', 32, 1], ['Énergie & internet', 6, 5], ['Abonnements', 3, 10], ['Assurances', 3, 12]],
      spend: [['Courses', 14, 'month'], ['Transport', 6, 'month'], ['Loisirs', 8, 'month'], ['Santé & hygiène', 3, 'month']],
      projects: [['Fonds d\'urgence', 8, 3]]
    },
    family: {
      label: 'Famille',
      icon: 'users',
      blurb: 'Charges du foyer, enfants et épargne de projets.',
      recurring: [['Loyer / crédit', 30, 1], ['Énergie & internet', 7, 5], ['Assurances', 4, 8], ['Abonnements', 2, 10]],
      spend: [['Courses', 18, 'month'], ['Transport', 7, 'month'], ['Enfants', 6, 'month'], ['Loisirs', 5, 'month'], ['Santé & hygiène', 3, 'month']],
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
    { words: ['carrefour', 'leclerc', 'auchan', 'lidl', 'monoprix', 'intermarche', 'franprix', 'picard', 'aldi', 'casino', 'biocoop', 'grand frais', 'super u', 'hyper u', 'u express', 'netto', 'cora', 'naturalia', 'g20', 'spar', 'leader price', 'boulangerie', 'marche', 'courses'], env: /course|aliment|supermarch|nourrit|bouffe/ },
    { words: ['sncf', 'ratp', 'navigo', 'uber', 'bolt', 'blablacar', 'totalenergies', 'total access', 'esso', 'shell', 'avia', 'vinci', 'autoroute', 'tisseo', 'transdev', 'ouigo', 'flixbus', 'velib', 'carburant', 'essence', 'gazole', 'parking'], env: /transport|essence|carbu|deplac|voiture/ },
    { words: ['netflix', 'spotify', 'disney', 'deezer', 'youtube', 'steam', 'playstation', 'cinema', 'ugc', 'pathe', 'fnac', 'decathlon', 'mcdo', 'mcdonald', 'burger', 'kfc', 'deliveroo', 'uber eats', 'restaurant', 'cafe', 'starbucks', 'bar ', 'brasserie'], env: /loisir|sortie|resto|diver|plaisir/ },
    { words: ['pharmacie', 'doctolib', 'mutuelle', 'optique', 'dentiste', 'hopital', 'medecin', 'parapharmacie', 'sephora'], env: /sant|hygien|pharma|beaute/ },
    { words: ['zara', 'h&m', 'primark', 'kiabi', 'uniqlo', 'celio', 'jules', 'vinted', 'zalando'], env: /vetement|habit|shopping|mode/ }
  ];

  const emptyState = () => ({
    v: 3,
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

  const initialPostedUntil = (start) => addDays(maxISO(start, firstOf(monthOf(clock.today()))), -1);

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const s = emptyState();
    s.salary = toCents(raw.salary);
    s.salaryDay = clampInt(raw.salaryDay, 1, 31, 1);
    s.openingBalance = raw.openingBalance === null || raw.openingBalance === undefined || raw.openingBalance === '' ? null : toCents(raw.openingBalance);
    if (isMonthKey(raw.lastRollover)) s.lastRollover = raw.lastRollover;

    const ids = new Set();
    const names = new Set();
    const takeId = (v) => {
      const id = typeof v === 'string' && v && !ids.has(v) ? v : uid();
      ids.add(id);
      return id;
    };
    const today = clock.today();

    for (const e of arr(raw.envelopes)) {
      if (!e || typeof e !== 'object') continue;
      const name = cleanName(e.name);
      const key = normName(name);
      if (!name || names.has(key)) continue;
      const createdAt = Number.isFinite(e.createdAt) ? e.createdAt : 0;
      if (e.kind === 'project') {
        const target = toCents(e.target);
        if (target <= 0) continue;
        names.add(key);
        s.envelopes.push({
          id: takeId(e.id), kind: 'project', name, target,
          saved: Math.min(toCents(e.saved), target),
          monthly: toCents(e.monthly),
          mode: e.mode === 'plan' ? 'plan' : 'active',
          deadline: isMonthKey(e.deadline) ? e.deadline : null,
          createdAt
        });
      } else {
        const max = toCents(e.max);
        if (max <= 0) continue;
        names.add(key);
        const env = {
          id: takeId(e.id), kind: 'spend', name, max,
          period: PERIODS[e.period] ? e.period : 'month',
          anchor: isISO(e.anchor) ? e.anchor : firstOf(monthOf(today)),
          reset: null,
          createdAt
        };
        if (e.reset && isISO(e.reset.date) && Number.isFinite(e.reset.ts)) env.reset = { date: e.reset.date, ts: e.reset.ts };
        s.envelopes.push(env);
      }
    }

    const envIds = new Map(s.envelopes.map((e) => [e.id, e]));
    const isSpend = (id) => typeof id === 'string' && envIds.has(id) && envIds.get(id).kind === 'spend';

    for (const r of arr(raw.recurring)) {
      if (!r || typeof r !== 'object') continue;
      const label = cleanName(r.label);
      const amount = toCents(r.amount);
      if (!label || amount <= 0 || !isISO(r.start)) continue;
      const type = r.type === 'income' ? 'income' : 'expense';
      const rule = {
        id: takeId(r.id), type, label, amount,
        freq: FREQS[r.freq] ? r.freq : 'month',
        start: r.start,
        end: isISO(r.end) && r.end >= r.start ? r.end : null,
        envId: type === 'expense' && isSpend(r.envId) ? r.envId : null,
        postedUntil: isISO(r.postedUntil) ? r.postedUntil : initialPostedUntil(r.start)
      };
      s.recurring.push(rule);
    }

    for (const t of arr(raw.transactions)) {
      if (!t || typeof t !== 'object') continue;
      const amount = toCents(t.amount);
      if (amount <= 0 || !isISO(t.date)) continue;
      const type = ['expense', 'income', 'deposit'].includes(t.type) ? t.type : null;
      if (!type) continue;
      let envId = typeof t.envId === 'string' && envIds.has(t.envId) ? t.envId : null;
      if (type === 'expense' && envId && !isSpend(envId)) envId = null;
      if (type === 'deposit' && !(envId && envIds.get(envId).kind === 'project')) continue;
      if (type === 'income') envId = null;
      const tx = { id: takeId(t.id), type, envId, amount, note: cleanNote(t.note), date: t.date, ts: Number.isFinite(t.ts) ? t.ts : 0 };
      const detail = cleanDetail(t.detail);
      if (detail) tx.detail = detail;
      if (typeof t.recId === 'string' && t.recId) tx.recId = t.recId;
      if (typeof t.ref === 'string' && t.ref) tx.ref = t.ref.slice(0, 120);
      s.transactions.push(tx);
    }

    for (const r of arr(raw.rules)) {
      if (!r || typeof r.key !== 'string' || r.key.length < 3 || !envIds.has(r.envId)) continue;
      if (!s.rules.some((x) => x.key === r.key)) s.rules.push({ key: r.key.slice(0, 40), envId: r.envId });
    }
    s.rules = s.rules.slice(-300);

    s.prefs.onboarded = Boolean(raw.prefs && raw.prefs.onboarded);
    s.prefs.lastEnvId = raw.prefs && isSpend(raw.prefs.lastEnvId) ? raw.prefs.lastEnvId : null;
    return s;
  }

  function migrateV2(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const cm = monthOf(clock.today());
    const out = { ...raw, v: 3 };
    out.envelopes = arr(raw.envelopes).map((e) => (e && e.kind === 'project'
      ? { ...e, mode: 'active', deadline: null }
      : { ...e, period: 'month', anchor: firstOf(cm) }));
    out.recurring = arr(raw.recurring).map((r) => {
      if (!r || typeof r !== 'object') return null;
      const start = isoFor(cm, clampDay(clampInt(r.day, 1, 31, 1), cm));
      return {
        id: r.id, type: r.type === 'income' ? 'income' : 'expense', label: r.label, amount: r.amount,
        freq: 'month', start, end: null, envId: null, postedUntil: addDays(firstOf(cm), -1)
      };
    }).filter(Boolean);
    out.transactions = arr(raw.transactions).map((t) => ({ ...t, ts: 0 }));
    return out;
  }

  function migrateV1(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const today = clock.today();
    const out = { v: 3, salary: raw.salary, envelopes: [], transactions: [], recurring: [], prefs: { onboarded: true } };
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
        out.envelopes.push({ id, kind: 'project', name, target: Math.min(MAX_CENTS, max * 12), saved: spent, monthly: max, mode: 'active' });
      } else {
        out.envelopes.push({ id, kind: 'spend', name, max, period: 'month' });
        if (spent > 0) out.transactions.push({ id: uid(), type: 'expense', envId: id, amount: spent, note: 'Reprise de la version 1', date: today, ts: 0 });
      }
    }
    return out;
  }

  function fromAnyVersion(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.v === 3) return sanitize(raw);
    if (raw.v === 2) return sanitize(migrateV2(raw));
    if (Array.isArray(raw.envelopes) && raw.salary !== undefined) return sanitize(migrateV1(raw));
    return null;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw)) || emptyState();
      const v2 = localStorage.getItem(V2_KEY);
      if (v2) return sanitize(migrateV2(JSON.parse(v2))) || emptyState();
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) return sanitize(migrateV1(JSON.parse(legacy))) || emptyState();
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
  const findRule = (id) => state.recurring.find((r) => r.id === id);
  const spendEnv = (id) => {
    const e = findEnv(id);
    return e && e.kind === 'spend' ? e : null;
  };
  const projectDone = (e) => e.saved >= e.target;

  function occurrences(rule, from, to) {
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

  const pendingOcc = (rule, from, to) => occurrences(rule, maxISO(from, addDays(rule.postedUntil, 1)), to);
  const nextOccurrence = (rule, from = addDays(clock.today(), 1)) => {
    const list = occurrences(rule, maxISO(from, addDays(rule.postedUntil, 1)), addDays(from, 800));
    return list[0] || null;
  };

  function postRecurring() {
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

  function periodWindow(env, iso) {
    const p = env.period || 'month';
    if (p === 'month') {
      const k = monthOf(iso);
      return { start: firstOf(k), end: lastOf(k) };
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
    const a = monthOf(env.anchor || iso);
    const k = Math.floor(monthDiff(a, monthOf(iso)) / step);
    const sk = shiftMonth(a, k * step);
    const ek = shiftMonth(sk, step - 1);
    return { start: firstOf(sk), end: lastOf(ek) };
  }

  const isResetOut = (env, t) => Boolean(env.reset && t.ts < env.reset.ts && t.date <= env.reset.date);

  function envCommitted(env, from, to) {
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

  function envMonthAlloc(env, key) {
    const eq = env.period === 'month' ? env.max : monthlyEq(env.max, env.period);
    const ms = firstOf(key);
    const me = lastOf(key);
    const inMonth = envCommitted(env, ms, me).total;
    if (['month', 'week', '2weeks'].includes(env.period)) return { alloc: Math.max(eq, inMonth), eq, inMonth };
    const w = periodWindow(env, ms);
    const before = w.start < ms ? envCommitted(env, w.start, addDays(ms, -1)).total : 0;
    const excess = Math.max(0, before + inMonth - env.max) - Math.max(0, before - env.max);
    return { alloc: eq + excess, eq, inMonth };
  }

  function envRow(env, key) {
    const today = clock.today();
    const cm = monthOf(today);
    const ref = key === cm ? today : key < cm ? lastOf(key) : firstOf(key);
    const w = periodWindow(env, ref);
    const c = envCommitted(env, w.start, w.end);
    const m = envMonthAlloc(env, key);
    return {
      env, window: w, spent: c.spent, planned: c.planned, excluded: c.excluded,
      used: c.total, left: env.max - c.total, alloc: m.alloc, eq: m.eq, inMonth: m.inMonth
    };
  }

  function projectContribution(e, key) {
    if (e.mode !== 'active' || e.monthly <= 0) return 0;
    const cm = currentMonth();
    if (key < cm) return projectDone(e) ? 0 : e.monthly;
    const k = monthDiff(cm, key);
    const savedAtStart = e.saved + e.monthly * k;
    return Math.max(0, Math.min(e.monthly, e.target - savedAtStart));
  }

  function derive(key = currentMonth()) {
    const today = clock.today();
    const cm = monthOf(today);
    const isCurrent = key === cm;
    const ms = firstOf(key);
    const me = lastOf(key);

    let income = state.salary;
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
        deposits += t.amount;
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

    const allocated = charges + envAlloc + projectsMonthly + orphan + deposits;
    return {
      key, isCurrent, isFuture: key > cm, isPast: key < cm,
      income, salary: state.salary, extraIncome, incomeUpcoming,
      charges, spend, envAlloc, remaining, projectsMonthly, deposits, orphan,
      spentToDate, upcoming, plannedItems, allocated, free: income - allocated
    };
  }

  function cashflow(key, depth = 0) {
    const d = derive(key);
    const n = daysInMonth(key);
    const today = clock.today();
    const cm = monthOf(today);
    const t = key === cm ? dayOf(today) : key < cm ? n : 0;
    const inc = new Array(n + 1).fill(0);
    const out = new Array(n + 1).fill(0);
    const spentDay = new Array(n + 1).fill(0);
    const events = Array.from({ length: n + 1 }, () => []);
    const sd = clampDay(state.salaryDay, key);
    const ms = firstOf(key);
    const me = lastOf(key);

    if (state.salary > 0) {
      inc[sd] += state.salary;
      events[sd].push({ label: 'Salaire', amount: state.salary, type: 'income', planned: sd > t });
    }
    for (const tx of state.transactions) {
      if (tx.date < ms || tx.date > me) continue;
      const day = dayOf(tx.date);
      const planned = tx.date > today;
      if (tx.type === 'income') {
        inc[day] += tx.amount;
        events[day].push({ label: tx.note || 'Revenu', amount: tx.amount, type: 'income', planned, txId: tx.id });
      } else if (tx.type === 'deposit') {
        out[day] += tx.amount;
        const env = findEnv(tx.envId);
        events[day].push({ label: `Versement · ${env ? env.name : 'projet'}`, amount: -tx.amount, type: 'project', planned, txId: tx.id });
      } else {
        out[day] += tx.amount;
        if (!planned) spentDay[day] += tx.amount;
        const env = spendEnv(tx.envId);
        const type = tx.recId && !env ? 'charge' : 'spend';
        events[day].push({ label: tx.note || (env ? env.name : 'Dépense'), sub: env ? env.name : tx.recId ? 'Prélèvement' : 'Hors enveloppe', amount: -tx.amount, type, planned, txId: tx.id });
      }
    }
    for (const r of state.recurring) {
      for (const date of pendingOcc(r, ms, me)) {
        const day = dayOf(date);
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
    if (d.projectsMonthly > 0) {
      out[sd] += d.projectsMonthly;
      events[sd].push({ label: 'Épargne projets', amount: -d.projectsMonthly, type: 'project', planned: sd > t });
    }

    const spread = d.isPast ? 0 : d.spend.reduce((s, r) => s + Math.max(0, r.alloc - r.inMonth), 0);
    const futureDays = n - t;
    const perDay = futureDays > 0 ? Math.round(spread / futureDays) : 0;

    let openingKnown = state.openingBalance !== null;
    let balance = 0;
    if (openingKnown && key === cm) balance = state.openingBalance;
    else if (openingKnown && key > cm && depth < 24) balance = cashflow(shiftMonth(key, -1), depth + 1).end;
    else openingKnown = false;

    const days = [];
    const from = Math.max(t, 1);
    let min = { day: from, value: Infinity };
    let max = -Infinity;
    for (let day = 1; day <= n; day++) {
      balance += inc[day] - out[day] - (day > t ? perDay : 0);
      days.push({ day, balance, actual: day <= t, events: events[day], spent: spentDay[day] });
      if (day >= from && balance < min.value) min = { day, value: balance };
      if (balance > max) max = balance;
    }
    return { key, days, n, today: t, min, max, end: balance, openingKnown, perDay };
  }

  function forecast(count = 6) {
    const cm = currentMonth();
    return Array.from({ length: count }, (_, i) => {
      const key = shiftMonth(cm, i);
      const d = derive(key);
      const planned = [];
      for (const t of state.transactions) {
        if (t.recId || !t.date.startsWith(key) || t.date <= clock.today()) continue;
        if (t.type === 'expense') planned.push({ label: t.note || (findEnv(t.envId) || {}).name || 'Dépense', amount: -t.amount, date: t.date });
        if (t.type === 'income') planned.push({ label: t.note || 'Revenu', amount: t.amount, date: t.date });
      }
      for (const r of state.recurring) {
        if (MONTH_STEPS[r.freq] && MONTH_STEPS[r.freq] > 1) {
          for (const date of pendingOcc(r, firstOf(key), lastOf(key))) {
            planned.push({ label: r.label, amount: r.type === 'income' ? r.amount : -r.amount, date, rec: true });
          }
        }
      }
      planned.sort((a, b) => (a.date < b.date ? -1 : 1));
      return { key, d, planned };
    });
  }

  function upcomingEvents(days = 30) {
    const today = clock.today();
    const until = addDays(today, days);
    const list = [];
    for (const t of state.transactions) {
      if (t.date <= today || t.date > until) continue;
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

  function monthsToGoal(e, monthly = e.monthly) {
    if (projectDone(e)) return 0;
    if (monthly <= 0) return null;
    return Math.ceil((e.target - e.saved) / monthly);
  }

  function durationLabel(months) {
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return `${years} ${plural(years, 'an', 'ans')}${rest ? ` ${rest} mois` : ''}`;
  }

  function projectPlan(e, freeNow = derive().free) {
    const cm = currentMonth();
    const missing = Math.max(0, e.target - e.saved);
    const months = e.deadline ? Math.max(1, monthDiff(cm, e.deadline) + 1) : null;
    const needed = months ? Math.ceil(missing / months / 100) * 100 : null;
    const own = projectContribution(e, cm);
    const capacity = Math.max(0, freeNow + own);
    const monthly = e.monthly > 0 ? e.monthly : needed || 0;
    const gap = monthly - capacity;
    const eta = monthly > 0 ? shiftMonth(cm, Math.max(0, Math.ceil(missing / monthly) - 1)) : null;
    const etaCapacity = capacity > 0 ? shiftMonth(cm, Math.max(0, Math.ceil(missing / capacity) - 1)) : null;
    return { missing, months, needed, capacity, monthly, gap, eta, etaCapacity, late: Boolean(e.deadline && eta && eta > e.deadline) };
  }

  function computeInsights(d) {
    const list = [];
    const push = (tone, icon, title, text, tab) => list.push({ tone, icon, title, text, tab });
    if (d.income <= 0) return list;
    const today = clock.today();

    if (d.free < 0) {
      push('bad', 'triangle-alert', 'Budget dépassé', `Tu as prévu ${money(-d.free)} de plus que tes revenus du mois.`);
    }

    const cash = cashflow(d.key);
    if (cash.openingKnown && cash.min.value < 0) {
      push('bad', 'triangle-alert', 'Découvert probable', `Le ${shortDate(isoFor(d.key, cash.min.day))}, ton solde prévu descend à ${money(cash.min.value)}.`, 'agenda');
    }

    const over = d.spend.filter((r) => r.used > r.env.max).sort((a, b) => (b.used - b.env.max) - (a.used - a.env.max));
    for (const r of over.slice(0, 2)) {
      push('bad', 'circle-alert', `« ${r.env.name} » est dépassée`, `+${money(r.used - r.env.max)} au-dessus du budget ${PERIODS[r.env.period].the}, pris sur ton reste à vivre.`);
    }

    const near = d.spend
      .filter((r) => r.used <= r.env.max && r.used / r.env.max >= 0.85 && r.left > 0 && daysBetween(today, r.window.end) > 2)
      .sort((a, b) => b.used / b.env.max - a.used / a.env.max);
    for (const r of near.slice(0, 2)) {
      const days = daysBetween(today, r.window.end) + 1;
      push('warn', 'circle-alert', `« ${r.env.name} » à ${Math.round((r.used / r.env.max) * 100)} %`, `Il reste ${money(r.left)} pour ${days} jours.`);
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

    const order = { bad: 0, warn: 1, info: 2, ok: 3 };
    list.sort((a, b) => order[a.tone] - order[b.tone]);
    const top = list.slice(0, 4);
    if (!top.length) {
      push('ok', 'circle-check', 'Tout est sous contrôle', d.free > 0 ? `Il te reste ${money(d.free)} de libre ce mois-ci.` : 'Tes revenus sont entièrement répartis.');
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
        if (e.kind === 'project' && e.mode === 'active' && e.monthly > 0 && e.saved < e.target) {
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
      if (input.mode === 'active') {
        if (input.monthly <= 0 && input.saved < input.target) return fail('Indique une mise par mois, ou une date pour la calculer.');
        const next = projectContribution({ ...input, mode: 'active' }, key);
        const prev = existing ? projectContribution(existing, key) : 0;
        if (next - prev > d.free) {
          const cap = Math.max(0, d.free + prev);
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

  function createEnvelope(input) {
    if (derive().income <= 0) return fail('Commence par renseigner ton salaire global.');
    const check = validateEnvelope(input, null);
    if (!check.ok) return check;
    const base = { id: uid(), name: check.data, createdAt: clock.now() };
    const env = input.kind === 'project'
      ? { ...base, kind: 'project', target: input.target, saved: input.saved, monthly: input.monthly, mode: input.mode, deadline: input.deadline || null }
      : { ...base, kind: 'spend', max: input.max, period: input.period, anchor: clock.today(), reset: null };
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
      Object.assign(env, { target: input.target, saved: input.saved, monthly: input.monthly, mode: input.mode, deadline: input.deadline || null });
    } else {
      if (env.period !== input.period) env.anchor = clock.today();
      env.max = input.max;
      env.period = input.period;
    }
    commit();
    return ok(env);
  }

  function resetEnvelope(id) {
    const env = spendEnv(id);
    if (!env) return fail('Enveloppe introuvable.');
    const before = envRow(env, currentMonth());
    env.reset = { date: clock.today(), ts: clock.now() + 1 };
    commit();
    return ok({ env, cleared: before.spent });
  }

  function deleteEnvelope(id) {
    const index = state.envelopes.findIndex((e) => e.id === id);
    if (index === -1) return fail('Enveloppe introuvable.');
    const before = derive().free;
    const [env] = state.envelopes.splice(index, 1);
    state.transactions = state.transactions.filter((t) => !(t.type === 'deposit' && t.envId === id));
    state.transactions.forEach((t) => { if (t.envId === id) t.envId = null; });
    state.recurring.forEach((r) => { if (r.envId === id) r.envId = null; });
    state.rules = state.rules.filter((r) => r.envId !== id);
    if (state.prefs.lastEnvId === id) state.prefs.lastEnvId = null;
    const reinjected = derive().free - before;
    commit();
    return ok({ env, reinjected });
  }

  function validateRule(input) {
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

  function addRule(input, { silent = false } = {}) {
    const check = validateRule(input);
    if (!check.ok) return check;
    const rule = {
      id: uid(), type: input.type, label: check.data, amount: input.amount, freq: input.freq,
      start: input.start, end: input.end || null, envId: input.type === 'expense' ? input.envId || null : null,
      postedUntil: initialPostedUntil(input.start)
    };
    state.recurring.push(rule);
    const posted = postRecurring();
    if (rule.envId) state.prefs.lastEnvId = rule.envId;
    if (!silent) commit();
    return ok({ rule, posted: posted.filter((t) => t.recId === rule.id) });
  }

  function updateRule(id, input) {
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

  function deleteRule(id, { purgeFuture = true } = {}) {
    const index = state.recurring.findIndex((r) => r.id === id);
    if (index === -1) return fail('Élément récurrent introuvable.');
    const [rule] = state.recurring.splice(index, 1);
    if (purgeFuture) state.transactions = state.transactions.filter((t) => !(t.recId === id && t.date > clock.today()));
    commit();
    return ok(rule);
  }

  function setSalary(cents) {
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
      if (t.envId && !spendEnv(t.envId)) return fail('Enveloppe introuvable.');
    } else if (t.type === 'deposit') {
      const env = findEnv(t.envId);
      if (!env || env.kind !== 'project') return fail('Choisis le projet à alimenter.');
      const already = env.saved - (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
      const room = env.target - already;
      if (t.amount > room) return fail(room <= 0 ? 'Cet objectif est déjà atteint.' : `Il ne manque que ${money(room)} pour atteindre l'objectif.`);
    } else if (t.type !== 'income') {
      return fail('Type inconnu.');
    }
    return ok();
  }

  function addTransaction({ type, envId = null, amount, note = '', date, ref, detail, recId }, { silent = false } = {}) {
    const t = { id: uid(), type, envId: type === 'income' ? null : envId || null, amount, note: cleanNote(note), date, ts: clock.now() };
    const check = validateTx(t, null);
    if (!check.ok) return check;
    const dt = cleanDetail(detail);
    if (dt) t.detail = dt;
    if (ref) t.ref = ref;
    if (recId) t.recId = recId;
    state.transactions.push(t);
    if (type === 'deposit') findEnv(envId).saved += amount;
    if (type === 'expense' && t.envId) state.prefs.lastEnvId = t.envId;
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
    Object.assign(tx, { type: next.type, envId: next.envId || null, amount: next.amount, date: next.date, note: cleanNote(next.note) });
    const dt = cleanDetail(next.detail);
    if (dt) tx.detail = dt;
    else delete tx.detail;
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

  function restoreTransaction(tx) {
    if (state.transactions.some((t) => t.id === tx.id)) return;
    state.transactions.push({ ...tx });
    if (tx.type === 'deposit') {
      const env = findEnv(tx.envId);
      if (env) env.saved = Math.min(env.target, env.saved + tx.amount);
    }
    commit();
  }

  function labelKey(label) {
    const stop = new Set(['carte', 'cb', 'paiement', 'prlv', 'sepa', 'vir', 'virement', 'prelevement', 'facture', 'achat', 'retrait', 'dab', 'cheque', 'les', 'des', 'chez', 'par', 'sur', 'ticket']);
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

  function guessEnvelope(label, { hints = true } = {}) {
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

  function applyTemplate(key, income) {
    const tpl = TEMPLATES[key];
    if (!tpl) return fail('Modèle inconnu.');
    const cm = currentMonth();
    const euros = (pct) => Math.max(100, Math.round((income * pct) / 10000) * 100);
    const recurring = tpl.recurring.map(([label, pct, day]) => {
      const start = isoFor(cm, clampDay(day, cm));
      return { id: uid(), type: 'expense', label, amount: euros(pct), freq: 'month', start, end: null, envId: null, postedUntil: initialPostedUntil(start) };
    });
    const envelopes = [
      ...tpl.spend.map(([name, pct, period]) => ({ id: uid(), kind: 'spend', name, max: euros(pct), period, anchor: clock.today(), reset: null, createdAt: clock.now() })),
      ...tpl.projects.map(([name, pct, mult]) => ({
        id: uid(), kind: 'project', name, target: Math.round((income * mult) / 100) * 100, saved: 0, monthly: euros(pct), mode: 'active', deadline: null, createdAt: clock.now()
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
    postRecurring();
    return ok();
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


  const RECEIPT_STORES = [
    ['e.leclerc', 'E.Leclerc'], ['leclerc', 'E.Leclerc'], ['carrefour market', 'Carrefour Market'], ['carrefour city', 'Carrefour City'],
    ['carrefour express', 'Carrefour Express'], ['carrefour', 'Carrefour'], ['intermarche', 'Intermarché'], ['monoprix', 'Monoprix'],
    ['franprix', 'Franprix'], ['auchan', 'Auchan'], ['lidl', 'Lidl'], ['aldi', 'Aldi'], ['casino', 'Casino'], ['hyper u', 'Hyper U'],
    ['super u', 'Super U'], ['u express', 'U Express'], ['picard', 'Picard'], ['biocoop', 'Biocoop'], ['grand frais', 'Grand Frais'],
    ['netto', 'Netto'], ['cora', 'Cora'], ['naturalia', 'Naturalia'], ['decathlon', 'Decathlon'], ['fnac', 'Fnac'], ['darty', 'Darty'],
    ['ikea', 'IKEA'], ['primark', 'Primark'], ['sephora', 'Sephora'], ['pharmacie', 'Pharmacie'], ['mcdonald', "McDonald's"],
    ['burger king', 'Burger King'], ['kfc', 'KFC'], ['starbucks', 'Starbucks'], ['boulangerie', 'Boulangerie'],
    ['totalenergies', 'TotalEnergies'], ['esso', 'Esso'], ['shell', 'Shell'], ['action', 'Action'], ['zara', 'Zara'], ['kiabi', 'Kiabi']
  ];
  const AMOUNT_TAIL = /(-?\s?\d{1,4}(?:[ .]\d{3})*[.,]\d{2})\s*(?:€|eur(?:os?)?|e)?\s*(?:[a-d1-4*]{1,2})?\s*$/i;
  const NOT_TOTAL = /(sous[\s-]*total|s\/total|tva|\bht\b|rendu|monnaie|remise|econom|fidelit|cagnotte|avantage|nb\s*art|nombre|articles?\b|points?\b)/;
  const NOT_ITEM = /(total|tva|\bht\b|\bcb\b|carte|rendu|esp[eè]ces|especes|montant|paiement|payer|ticket|caisse|siret|\btel\b|merci|bienvenue|date|heure|sous|monnaie|\bn[°o]\s?\d|transaction|autoris|contactless|sans contact|visa|mastercard)/;
  const TOTAL_KEYS = [
    [/net\s*a\s*payer|a\s*payer/, 6], [/total\s*(ttc|eur|€)/, 5], [/\btota[l1]\b/, 4], [/montant\s*(ttc|du|cb|carte)?/, 3],
    [/carte\s*bancaire|\bcb\b|paiement|esp[eè]ces|especes|visa|mastercard/, 2]
  ];

  function fixOcrNumbers(line) {
    return line.replace(/(^|[\s:=x*])([0-9OoIlS]{1,4})\s?[,.]\s?([0-9OoIlS]{2})(?=\s|€|[a-dA-D*]?$|$)/g, (m, pre, a, b) => {
      if (!/\d/.test(a + b)) return m;
      const fix = (s) => s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5');
      return `${pre}${fix(a)},${fix(b)}`;
    });
  }

  function amountOf(line) {
    const m = AMOUNT_TAIL.exec(line);
    if (!m) return null;
    const raw = m[1].replace(/\s/g, '');
    const cents = parseSignedAmount(raw);
    if (cents === null || Math.abs(cents) > 1000000) return null;
    return { cents, index: m.index };
  }

  const tidyLabel = (s) => {
    let t = s.replace(/^[\s\-–*•.]+/, '').replace(/^\d+\s*[x×*]\s*/i, '').replace(/\s+[x×*]\s*\d+([.,]\d+)?\s*$/i, '')
      .replace(/\s+\d+([.,]\d+)?\s*(kg|g|l|cl|ml)?\s*[x×*@]\s*\d+[.,]\d{2}.*$/i, '')
      .replace(/[\s.:_\-]+$/, '').replace(/\s{2,}/g, ' ').trim();
    if (t && t === t.toUpperCase()) t = capitalize(t.toLowerCase());
    return t.slice(0, 60);
  };

  function parseReceipt(text) {
    const lines = String(text || '').split(/\r?\n/).map((l) => fixOcrNumbers(l.replace(/\s+/g, ' ').trim())).filter((l) => l.length > 1);
    const norm = lines.map((l) => normText(l));
    const all = norm.join('\n');

    let merchant = null;
    let best = Infinity;
    for (const [key, label] of RECEIPT_STORES) {
      const re = new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'm');
      const m = re.exec(all);
      if (m && m.index < best) {
        best = m.index;
        merchant = label;
      }
    }
    if (!merchant) {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const letters = (lines[i].match(/[a-zà-ÿ]/gi) || []).length;
        if (letters >= 3 && letters / lines[i].length > 0.55 && !/ticket|bienvenue|caisse|siret|tel|www|http|rue|avenue|bd\b/i.test(norm[i])) {
          merchant = tidyLabel(lines[i]).slice(0, 30);
          break;
        }
      }
    }

    let date = null;
    const today = clock.today();
    for (const l of lines) {
      const m = /(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4}|\d{2})/.exec(l);
      if (!m) continue;
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const iso = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
      if (isISO(iso) && iso <= today && daysBetween(iso, today) <= 400) {
        date = iso;
        break;
      }
    }

    let total = null;
    let totalIdx = -1;
    let totalScore = 0;
    lines.forEach((l, i) => {
      const n = norm[i];
      if (NOT_TOTAL.test(n)) return;
      const key = TOTAL_KEYS.find(([re]) => re.test(n));
      if (!key) return;
      let a = amountOf(l);
      if (!a && i + 1 < lines.length && !TOTAL_KEYS.some(([re]) => re.test(norm[i + 1]))) a = amountOf(lines[i + 1]);
      if (!a || a.cents <= 0) return;
      const score = key[1];
      if (score > totalScore || (score === totalScore && a.cents > total)) {
        total = a.cents;
        totalIdx = i;
        totalScore = score;
      }
    });

    const items = [];
    const stop = totalIdx >= 0 ? lines.findIndex((l, i) => TOTAL_KEYS.some(([re]) => re.test(norm[i])) && !NOT_TOTAL.test(norm[i])) : lines.length;
    for (let i = 0; i < (stop >= 0 ? stop : lines.length); i++) {
      if (NOT_ITEM.test(norm[i])) continue;
      const a = amountOf(lines[i]);
      if (!a || a.cents === 0) continue;
      const label = tidyLabel(lines[i].slice(0, a.index));
      if ((label.match(/[a-zà-ÿ]/gi) || []).length < 2) continue;
      items.push({ label, amount: a.cents });
      if (items.length >= 60) break;
    }

    const sum = items.reduce((s, it) => s + it.amount, 0);
    if (total === null) {
      if (sum > 0) total = sum;
      else {
        const amounts = lines.map((l, i) => (NOT_TOTAL.test(norm[i]) ? null : amountOf(l))).filter((a) => a && a.cents > 0).map((a) => a.cents);
        total = amounts.length ? Math.max(...amounts) : null;
      }
    }
    return { merchant, date, total, items, itemsSum: sum, lines: lines.length };
  }

  function receiptDetail(r) {
    if (!r.items.length) return '';
    const head = `${r.merchant ? `Ticket ${r.merchant}` : 'Ticket'} · ${r.items.length} ${plural(r.items.length, 'article', 'articles')}`;
    return [head, ...r.items.map((it) => `• ${it.label} — ${money(Math.abs(it.amount)).replace(/ | /g, ' ')}${it.amount < 0 ? ' (remise)' : ''}`)].join('\n');
  }

  const TESS = {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int'
  };
  const OCR = { worker: null, loading: null, onProgress: null };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error('script'));
      document.head.append(s);
    });
  }

  function getOcrWorker() {
    if (OCR.worker) return Promise.resolve(OCR.worker);
    if (!OCR.loading) {
      OCR.loading = (async () => {
        if (!window.Tesseract) await loadScript(TESS.script);
        const worker = await window.Tesseract.createWorker('fra', 1, {
          workerPath: TESS.worker,
          corePath: TESS.core,
          langPath: TESS.lang,
          logger: (m) => { if (OCR.onProgress) OCR.onProgress(m); }
        });
        OCR.worker = worker;
        return worker;
      })().catch((err) => {
        OCR.loading = null;
        throw err;
      });
    }
    return OCR.loading;
  }

  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const w0 = img.naturalWidth || img.width;
      const h0 = img.naturalHeight || img.height;
      const scale = Math.min(2200 / Math.max(w0, h0), Math.max(1, 1300 / w0));
      const w = Math.round(w0 * scale);
      const hgt = Math.round(h0 * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = hgt;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, hgt);
      const data = ctx.getImageData(0, 0, w, hgt);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = Math.max(0, Math.min(255, (g - 128) * 1.4 + 140));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function scanReceipt(file, onProgress) {
    OCR.onProgress = onProgress;
    const worker = await getOcrWorker();
    const canvas = await prepareImage(file);
    const { data } = await worker.recognize(canvas);
    OCR.onProgress = null;
    return { ...parseReceipt(data.text || ''), text: data.text || '' };
  }

  const byId = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    'month-label', 'status', 'status-text', 'salary-view', 'salary-amount', 'salary-extra', 'salary-edit', 'salary-form',
    'salary-input', 'salary-cancel', 'salary-error', 'remaining-amount', 'remaining-sub', 'seg-charges', 'seg-spend',
    'seg-goal', 'seg-free', 'ring-percent', 'stat-spent', 'stat-left', 'stat-upcoming', 'legend-charges', 'legend-spend',
    'legend-goal', 'legend-free', 'up-sub', 'up-list', 'up-foot', 'up-more', 'mini', 'mini-month', 'mini-free', 'mini-c',
    'mini-s', 'mini-g', 'top-add', 'nav-add', 'tabs', 'insights', 'count-spend', 'add-spend', 'spend-grid', 'empty-spend',
    'count-project', 'add-project', 'project-grid', 'empty-project', 'j-prev', 'j-next', 'j-label', 'j-summary', 'j-filter',
    'j-list', 'j-empty', 'a-prev', 'a-next', 'cal-label', 'calendar', 'day-detail', 'cash-title', 'cash-chart', 'cash-note',
    'cash-edit', 'forecast', 'rec-summary', 'rec-list', 'rec-empty', 'r-prev', 'r-next', 'r-label', 'r-tiles', 'r-bars',
    'r-days', 'r-notes', 'dlg-welcome', 'w-step1', 'w-step2', 'w-income', 'w-next', 'w-skip', 'w-back', 'w-templates',
    'w-error', 'dlg-tx', 'tx-form', 'tx-title', 'tx-sub', 'tx-mode', 'tx-scan', 'scan-status', 'scan-text', 'tx-amount',
    'tx-label', 'tx-label-title', 'tx-env-field', 'tx-env-label', 'tx-chips', 'tx-date', 'tx-date-label', 'tx-repeat-field',
    'tx-repeat', 'tx-until-field', 'tx-until', 'tx-detail-box', 'tx-detail', 'tx-series', 'tx-series-text', 'tx-series-edit',
    'tx-hint', 'tx-error', 'tx-delete', 'tx-submit', 'dlg-env', 'env-form', 'env-title', 'env-sub', 'env-kind-wrap',
    'env-name', 'env-spend-fields', 'env-max', 'env-period', 'env-project-fields', 'env-mode-wrap', 'env-target',
    'env-saved', 'env-deadline', 'env-monthly', 'env-plan', 'env-hint', 'env-error', 'env-extra', 'env-reset',
    'env-delete', 'env-submit', 'dlg-settings', 'set-form', 'set-day', 'set-opening', 'set-error', 'dlg-confirm',
    'confirm-title', 'confirm-text', 'confirm-ok', 'dlg-menu', 'open-menu', 'menu-install', 'menu-csv', 'menu-export',
    'menu-import', 'menu-settings', 'menu-wipe', 'import-file', 'csv-file', 'scan-file', 'dlg-import', 'imp-summary',
    'imp-list', 'imp-confirm', 'imp-error', 'imp-cancel', 'toasts'
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
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const icon = (name) => h('i', { 'data-lucide': name });
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

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

  const signed = (cents) => `${cents < 0 ? '−' : '+'}${money(Math.abs(cents))}`;

  const ui = { tab: 'home', journalMonth: null, journalFilter: 'all', reportMonth: null, agendaMonth: null, agendaDay: null };
  const TABS = ['home', 'journal', 'agenda', 'report'];
  const TAB_HASH = { home: '', journal: '#journal', agenda: '#agenda', report: '#bilan' };

  function render() {
    const d = derive();
    renderEngine(d);
    renderUpcoming();
    renderMini(d);
    renderView(d);
    flushIcons();
  }

  function renderView(d = derive()) {
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
    else renderReport();
  }

  function setTab(name, { updateHash = true } = {}) {
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

  const parts = (d) => {
    const base = Math.max(d.income, d.allocated);
    return {
      base,
      charges: d.charges,
      spend: d.envAlloc + d.orphan,
      goal: d.projectsMonthly + d.deposits,
      free: Math.max(0, d.free)
    };
  };

  function renderEngine(d) {
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

  function renderMini(d) {
    const p = parts(d);
    els.miniMonth.textContent = monthName(d.key);
    els.miniFree.textContent = money(d.free);
    els.mini.dataset.negative = String(d.free < 0);
    const pct = (v) => `${p.base > 0 ? (v / p.base) * 100 : 0}%`;
    els.miniC.style.width = pct(p.charges);
    els.miniS.style.width = pct(p.spend);
    els.miniG.style.width = pct(p.goal);
  }

  function eventRow(ev, { withDate = true } = {}) {
    return h('div', { class: 'up-row', dataset: { sign: ev.amount < 0 ? 'out' : 'in' } },
      h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(ev.icon || 'calendar-plus')),
      h('span', { class: 'tx-body' }, h('strong', { text: ev.label }), h('small', { text: withDate ? `${relDay(ev.date)} · ${ev.sub || ''}` : ev.sub || '' })),
      h('span', { class: 'tx-amount', text: signed(ev.amount) }));
  }

  function renderUpcoming() {
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

  function cardShell(kind, id, iconName) {
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

  const createSpendCard = (row) => cardShell('spend', row.id, 'wallet');
  const createProjectCard = (env) => cardShell('project', env.id, 'target');

  function updateSpendCard(el, row) {
    const r = el._r;
    const { env, spent, planned, used, left, window: w } = row;
    const ratio = env.max > 0 ? used / env.max : 0;
    const pct = (v) => Math.round(Math.min(1, env.max > 0 ? v / env.max : 0) * 100);
    el.dataset.state = used > env.max ? 'over' : used === env.max ? 'empty' : ratio >= 0.85 ? 'tight' : 'safe';
    r.name.textContent = env.name;
    r.name.title = env.name;
    const per = PERIODS[env.period];
    r.kind.textContent = env.period === 'month' ? 'Par mois' : `${capitalize(per.per)} · ≈ ${moneyRound(row.eq)}/mois`;
    r.badge.hidden = true;
    r.label.textContent = left < 0 ? 'Dépassement' : 'Disponible';
    setMoney(r.value, Math.abs(left));
    r.total.textContent = `sur ${money(env.max)}`;
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

  function updateProjectCard(el, env) {
    const r = el._r;
    const done = projectDone(env);
    const plan = env.mode === 'plan';
    const ratio = env.target > 0 ? env.saved / env.target : 0;
    const percent = Math.round(Math.min(1, ratio) * 100);
    el.dataset.state = done ? 'done' : plan ? 'plan' : 'progress';
    r.name.textContent = env.name;
    r.name.title = env.name;
    r.kind.textContent = env.deadline ? `Pour ${monthName(env.deadline).toLowerCase()}` : 'Sans date';
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
      r.right.textContent = 'Objectif atteint';
      r.note.textContent = 'Bravo ! Sa mise mensuelle est libérée.';
    } else if (plan) {
      const monthly = p.monthly;
      r.right.textContent = monthly > 0 ? `${money(monthly)}/mois` : 'À définir';
      if (!monthly) r.note.textContent = 'Simulation : indique une date ou une mise mensuelle.';
      else if (p.gap > 0) r.note.textContent = `Il te manque ${money(p.gap)}/mois pour le lancer. Avec ta marge (${money(p.capacity)}/mois), objectif vers ${monthName(p.etaCapacity || p.eta).toLowerCase()}.`;
      else r.note.textContent = `Faisable : il te resterait ${money(-p.gap)}/mois. Touche pour l'activer.`;
    } else {
      const months = monthsToGoal(env);
      r.right.textContent = months === null ? 'Sans mise' : `≈ ${durationLabel(months)}`;
      r.note.textContent = months === null
        ? 'Ajoute une mise mensuelle pour avancer automatiquement.'
        : `+${money(env.monthly)}/mois versés en fin de mois · ${p.late ? 'en retard sur ta date' : `atteint vers ${monthName(p.eta).toLowerCase()}`}`;
    }
    r.note.hidden = false;
    el.setAttribute('aria-label', `Modifier ${env.name}`);
  }

  function renderInsights(d) {
    const list = computeInsights(d);
    fill(els.insights, list.map((it) => {
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
    if (tx.recId) {
      const r = findRule(tx.recId);
      return r ? ruleIcon(r) : 'repeat';
    }
    return tx.envId ? 'wallet' : 'tag';
  }

  function txSub(t) {
    const env = findEnv(t.envId);
    const bits = [];
    if (t.type === 'income') bits.push('Revenu');
    else if (t.type === 'deposit') bits.push(`Projet · ${env ? env.name : ''}`);
    else bits.push(env ? env.name : t.recId ? 'Prélèvement' : 'Hors enveloppe');
    if (t.recId) {
      const r = findRule(t.recId);
      bits.push(r ? FREQS[r.freq].label.toLowerCase() : 'récurrent');
    }
    if (t.detail) {
      const n = t.detail.split('\n').filter((l) => l.startsWith('•')).length;
      bits.push(n ? `${n} ${plural(n, 'article', 'articles')}` : 'détail');
    }
    return bits.join(' · ');
  }

  function txRow(t) {
    const env = findEnv(t.envId);
    const title = t.note || (t.type === 'income' ? 'Revenu' : t.type === 'deposit' ? 'Versement' : env ? env.name : 'Dépense');
    const planned = t.date > clock.today();
    return h('button', { type: 'button', class: 'tx-row', dataset: { id: t.id, type: t.type, orphan: String(t.type === 'expense' && !env && !t.recId), planned: String(planned) } },
      h('span', { class: 'tx-icon', 'aria-hidden': 'true' }, icon(txIcon(t))),
      h('span', { class: 'tx-body' }, h('strong', {}, title, planned ? h('em', { class: 'tag-planned', text: 'Prévu' }) : null), h('small', { text: txSub(t) })),
      h('span', { class: 'tx-amount', text: `${t.type === 'expense' || t.type === 'deposit' ? '−' : '+'}${money(t.amount)}` }));
  }

  function renderJournal() {
    const cm = currentMonth();
    const key = ui.journalMonth || cm;
    ui.journalMonth = key;
    els.jLabel.textContent = monthName(key);
    els.jNext.disabled = monthDiff(cm, key) >= 12;

    const monthTxs = state.transactions.map((t, i) => ({ t, i })).filter((x) => x.t.date.startsWith(key));
    const envs = state.envelopes.filter((e) => e.kind === 'spend');
    if (ui.journalFilter.startsWith('env:') && !envs.some((e) => `env:${e.id}` === ui.journalFilter)) ui.journalFilter = 'all';

    fill(els.jFilter,
      h('option', { value: 'all', text: 'Toutes les opérations' }),
      envs.map((e) => h('option', { value: `env:${e.id}`, text: e.name })),
      h('option', { value: 'recurring', text: 'Récurrentes' }),
      h('option', { value: 'planned', text: 'Prévues' }),
      h('option', { value: 'orphan', text: 'Hors enveloppe' }),
      h('option', { value: 'income', text: 'Revenus' }),
      h('option', { value: 'deposit', text: 'Versements projets' }));
    els.jFilter.value = ui.journalFilter;

    const today = clock.today();
    const matches = (t) => {
      const f = ui.journalFilter;
      if (f === 'all') return true;
      if (f === 'recurring') return Boolean(t.recId);
      if (f === 'planned') return t.date > today;
      if (f === 'orphan') return t.type === 'expense' && !t.envId && !t.recId;
      if (f === 'income') return t.type === 'income';
      if (f === 'deposit') return t.type === 'deposit';
      return t.type === 'expense' && `env:${t.envId}` === f;
    };
    const rows = monthTxs.filter((x) => matches(x.t)).sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : b.t.ts - a.t.ts || b.i - a.i));

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
        h('div', { class: 'tx-rows' }, g.items.map(txRow)));
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
    const xl = xs.map((day) => `<text class="c-label" x="${x(day).toFixed(1)}" y="${H - 8}" text-anchor="middle">${day}</text>`).join('');
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

  function renderAgenda() {
    const cm = currentMonth();
    const key = ui.agendaMonth || cm;
    ui.agendaMonth = key;
    const today = clock.today();
    els.calLabel.textContent = monthName(key);
    els.aNext.disabled = monthDiff(cm, key) >= 24;
    els.aPrev.disabled = monthDiff(key, cm) >= 24;

    const cash = cashflow(key);
    if (!ui.agendaDay || !ui.agendaDay.startsWith(key)) ui.agendaDay = key === cm ? today : firstOf(key);

    const maxSpent = Math.max(1, ...cash.days.map((dd) => dd.spent));
    const first = (parseISO(firstOf(key)).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(h('span', { class: 'cal-blank', 'aria-hidden': 'true' }));
    for (const dd of cash.days) {
      const iso = isoFor(key, dd.day);
      const kinds = new Set();
      for (const ev of dd.events) {
        if (ev.planned) kinds.add(ev.type === 'income' ? 'income' : 'planned');
        else if (ev.type === 'income') kinds.add('income');
        else if (ev.type === 'charge') kinds.add('charge');
        else if (ev.type === 'spend' || ev.type === 'project') kinds.add('spent');
      }
      const heat = dd.spent > 0 ? Math.min(3, Math.ceil((dd.spent / maxSpent) * 3)) : 0;
      cells.push(h('button', {
        type: 'button',
        class: `cal-day${iso === today ? ' is-today' : ''}${iso === ui.agendaDay ? ' is-selected' : ''}${iso < today ? ' is-past' : ''}`,
        dataset: { date: iso, heat: String(heat) },
        'aria-label': `${dayHeading(iso)}${dd.events.length ? `, ${dd.events.length} opération(s)` : ''}`
      },
      h('span', { class: 'cal-num', text: String(dd.day) }),
      dd.spent > 0 ? h('small', { class: 'cal-spent', text: `−${Math.round(dd.spent / 100)}` }) : null,
      h('i', { class: 'cal-dots' }, ['spent', 'charge', 'income', 'planned'].filter((k) => kinds.has(k)).map((k) => h('b', { class: `dot-${k}` })))));
    }
    fill(els.calendar, cells);

    const sel = cash.days[dayOf(ui.agendaDay) - 1];
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
      cash.openingKnown || key === cm ? h('p', { class: 'muted small', text: `${cash.openingKnown ? 'Solde prévu' : 'Variation depuis le 1er'} en fin de journée : ${money(sel.balance)}` }) : null,
      h('button', { type: 'button', class: 'btn ghost block add-on-day', dataset: { date: ui.agendaDay } }, icon('calendar-plus'), ui.agendaDay > today ? 'Prévoir une dépense ce jour-là' : 'Ajouter une opération ce jour-là'));

    els.cashTitle.textContent = `Trésorerie · ${monthName(key)}`;
    els.cashChart.innerHTML = chartSvg(cash);
    const dip = cash.openingKnown && cash.min.value < 0;
    els.cashNote.dataset.tone = dip ? 'bad' : 'ok';
    els.cashNote.textContent = dip
      ? `Attention : ton solde prévu descend à ${money(cash.min.value)} le ${shortDate(isoFor(key, cash.min.day))}.`
      : cash.openingKnown
        ? `Fin de mois prévue : ${money(cash.end)} si tu utilises tes enveloppes jusqu'au bout.`
        : `Sans solde de départ, la courbe montre la variation du mois (fin : ${signed(cash.end)}). Renseigne ton solde dans Réglages pour l'affiner.`;

    renderForecast();
    renderRules();
    flushIcons();
  }

  function renderForecast() {
    const rows = forecast(6);
    const peak = Math.max(1, ...rows.map((f) => Math.max(f.d.income, f.d.allocated)));
    fill(els.forecast, rows.map((f) => {
      const { d } = f;
      const neg = d.free < 0;
      const notes = f.planned.slice(0, 3).map((p) => `${p.label} ${signed(p.amount)}`);
      return h('button', { type: 'button', class: 'fc-row', dataset: { key: f.key, negative: String(neg), current: String(f.key === currentMonth()) } },
        h('span', { class: 'fc-month' }, h('strong', { text: monthShort(f.key) }), h('small', { text: f.key.slice(0, 4) })),
        h('span', { class: 'fc-body' },
          h('span', { class: 'fc-bar' },
            h('i', { class: 'fc-used', style: `width:${Math.min(100, (Math.min(d.allocated, d.income) / peak) * 100)}%` }),
            h('i', { class: neg ? 'fc-over' : 'fc-free', style: `width:${Math.min(100, (Math.abs(d.free) / peak) * 100)}%` })),
          h('small', { text: notes.length ? notes.join(' · ') + (f.planned.length > 3 ? '…' : '') : `${money(d.allocated)} prévus sur ${money(d.income)}` })),
        h('span', { class: 'fc-free-amount' }, h('strong', { text: neg ? `−${money(-d.free)}` : money(d.free) }), h('small', { text: neg ? 'manquant' : 'de marge' })));
    }));
  }

  function renderRules() {
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

  function spentUpTo(key, day) {
    return state.transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(key) && dayOf(t.date) <= day)
      .reduce((s, t) => s + t.amount, 0);
  }

  function renderReport() {
    const cm = currentMonth();
    const key = ui.reportMonth || cm;
    ui.reportMonth = key;
    els.rLabel.textContent = monthName(key);
    els.rNext.disabled = key >= cm;
    const d = derive(key);
    const today = clock.today();
    const lastDay = key === cm ? today : lastOf(key);
    const txs = state.transactions.filter((t) => t.date.startsWith(key) && t.date <= lastDay);
    const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const received = state.salary * (key < cm || dayOf(today) >= clampDay(state.salaryDay, key) ? 1 : 0) + txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const saved = d.projectsMonthly + d.deposits;
    const result = received - spent - saved;

    fill(els.rTiles,
      h('div', { class: 'tile tile-hero', dataset: { negative: String(result < 0) } }, h('span', { text: key === cm ? 'Solde du mois à ce jour' : 'Solde du mois' }), h('strong', { text: money(result) })),
      h('div', { class: 'tile' }, h('span', { text: 'Reçu' }), h('strong', { text: money(received) })),
      h('div', { class: 'tile' }, h('span', { text: 'Dépensé' }), h('strong', { text: money(spent) })),
      h('div', { class: 'tile' }, h('span', { text: 'Dont prélèvements' }), h('strong', { text: money(txs.filter((t) => t.type === 'expense' && t.recId && !spendEnv(t.envId)).reduce((s, t) => s + t.amount, 0)) })),
      h('div', { class: 'tile' }, h('span', { text: 'Épargné' }), h('strong', { text: money(saved) })));

    const bars = d.spend.map((r) => ({ name: r.env.name, spent: r.inMonth, max: r.env.period === 'month' ? r.env.max : r.eq })).sort((a, b) => b.spent / b.max - a.spent / a.max);
    if (d.orphan > 0) bars.push({ name: 'Hors enveloppe', spent: d.orphan, max: 0 });
    if (d.charges > 0) bars.push({ name: 'Prélèvements', spent: d.charges, max: 0, kind: 'charge' });
    fill(els.rBars,
      h('h3', { text: 'Par enveloppe' }),
      bars.length
        ? bars.map((b) => {
          const ratio = b.max > 0 ? b.spent / b.max : 1;
          const stateName = b.kind === 'charge' ? 'charge' : b.max === 0 ? 'orphan' : ratio > 1 ? 'over' : ratio >= 0.85 ? 'tight' : 'safe';
          return h('div', { class: 'bar-row', dataset: { state: stateName } },
            h('div', { class: 'bar-row-head' }, h('span', { text: b.name }), h('strong', { text: b.max > 0 ? `${money(b.spent)} / ${money(b.max)}` : money(b.spent) })),
            h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${Math.min(100, ratio * 100)}%` })));
        })
        : h('p', { class: 'muted', text: 'Aucune enveloppe de dépenses.' }));

    const daySpend = new Map();
    for (const t of txs) if (t.type === 'expense' && !t.recId) daySpend.set(t.date, (daySpend.get(t.date) || 0) + t.amount);
    const elapsed = key === cm ? dayOf(today) : daysInMonth(key);
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
      top ? h('p', { class: 'muted small', text: `Jour le plus dépensier : ${dayHeading(top[0]).toLowerCase()} (${money(top[1])}). Hors prélèvements automatiques.` }) : null);

    const notes = [];
    const ranked = [...d.spend].filter((r) => r.inMonth > 0).sort((a, b) => b.inMonth - a.inMonth);
    if (ranked.length && spent > 0) {
      notes.push(['trending-up', `« ${ranked[0].env.name} » est ton premier poste : ${Math.round((ranked[0].inMonth / spent) * 100)} % de tes dépenses.`]);
    }
    const prevKey = shiftMonth(key, -1);
    const upTo = key === cm ? dayOf(today) : daysInMonth(key);
    const prevSpent = spentUpTo(prevKey, upTo);
    if (prevSpent > 0 && spent > 0) {
      const delta = Math.round(((spent - prevSpent) / prevSpent) * 100);
      notes.push([delta > 0 ? 'triangle-alert' : 'circle-check', delta === 0
        ? 'Tu dépenses autant que le mois précédent à la même date.'
        : `Tu dépenses ${Math.abs(delta)} % ${delta > 0 ? 'de plus' : 'de moins'} que le mois précédent à la même date.`]);
    }
    if (saved > 0 && d.income > 0) notes.push(['piggy-bank', `Tu mets de côté ${Math.round((saved / d.income) * 100)} % de tes revenus.`]);
    if (d.orphan > 0) notes.push(['info', `${money(d.orphan)} dépensés hors enveloppe : pense à les ranger.`]);
    fill(els.rNotes,
      h('h3', { text: 'À retenir' }),
      notes.length
        ? notes.map(([ic, text]) => h('p', { class: 'note-line' }, icon(ic), h('span', { text })))
        : h('p', { class: 'muted', text: 'Pas encore assez de données pour ce mois.' }));
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
    setTimeout(dismiss, o.duration || (o.action ? 6000 : tone === 'error' ? 4800 : 3400));
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

  const txUi = { mode: 'expense', txId: null, ruleId: null, envId: null, projectId: null, envTouched: false, suggested: false, scanning: false };

  const sheetDate = () => (isISO(els.txDate.value) ? els.txDate.value : clock.today());
  const sheetRepeat = () => (txUi.mode === 'deposit' || txUi.txId ? 'once' : els.txRepeat.value);

  function defaultEnvFor(label, repeat) {
    const guess = guessEnvelope(label, { hints: repeat === 'once' });
    if (guess) return { id: guess, suggested: true };
    if (repeat !== 'once') return { id: null, suggested: false };
    const pref = spendEnv(state.prefs.lastEnvId);
    const first = state.envelopes.find((e) => e.kind === 'spend');
    return { id: pref ? pref.id : first ? first.id : null, suggested: false };
  }

  function renderTxChips() {
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
    const key = monthOf(date);
    const rows = derive(key).spend;
    const chip = (envId, name, sub) => h('button', {
      type: 'button', class: `chip${txUi.suggested && !txUi.envTouched && (txUi.envId || '') === envId && envId ? ' is-suggested' : ''}`, role: 'radio',
      'aria-checked': String((txUi.envId || '') === envId), dataset: { env: envId }
    }, h('span', { text: name }), h('small', { text: sub }));
    fill(els.txChips,
      rows.map((r) => chip(r.env.id, r.env.name, r.left < 0 ? `−${money(-r.left)}` : `${money(r.left)} dispo`)),
      chip('', repeat === 'once' ? 'Aucune' : 'Aucune (charge fixe)', repeat === 'once' ? 'hors enveloppe' : 'réservée à part'));
  }

  function updateTxHint() {
    const amount = parseAmount(els.txAmount.value);
    const date = sheetDate();
    const today = clock.today();
    const repeat = txUi.ruleId ? els.txRepeat.value : sheetRepeat();
    const future = date > today;
    const until = isISO(els.txUntil.value) ? ` jusqu'au ${shortDate(els.txUntil.value)}` : '';

    if (txUi.mode === 'deposit') {
      const env = findEnv(txUi.projectId);
      if (!env) return setHint(els.txHint, 'Choisis le projet à alimenter.');
      const prev = txUi.txId ? state.transactions.find((t) => t.id === txUi.txId) : null;
      const room = env.target - env.saved + (prev && prev.type === 'deposit' && prev.envId === env.id ? prev.amount : 0);
      const after = room - (amount || 0);
      return after < 0
        ? setHint(els.txHint, `Dépasse l'objectif de ${money(-after)}.`, 'bad')
        : setHint(els.txHint, `Versement exceptionnel, pris sur ton reste à vivre. Encore ${money(after)} pour atteindre l'objectif.`, amount ? 'ok' : undefined);
    }

    if (repeat !== 'once') {
      const f = FREQS[repeat];
      const eq = amount ? monthlyEq(amount, repeat) : 0;
      const back = date <= today && !txUi.ruleId ? ` Les échéances depuis le ${shortDate(maxISO(date, firstOf(monthOf(today))))} sont ajoutées tout de suite.` : '';
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
        ? `Revenu prévu le ${shortDate(date)} : compté dans ${monthName(monthOf(date)).toLowerCase()}.`
        : "Ce revenu s'ajoute à ton reste à vivre du mois.");
    }

    const env = spendEnv(txUi.envId);
    if (future) {
      return setHint(els.txHint, `Dépense prévue le ${shortDate(date)} : ${env ? `réservée dans « ${env.name} »` : `réservée sur ${monthName(monthOf(date)).toLowerCase()}`}. Elle apparaît dans l'agenda.`);
    }
    if (!env) return setHint(els.txHint, 'Sans enveloppe : le montant est pris directement sur ton reste à vivre.');
    const row = envRow(env, monthOf(date));
    const prev = txUi.txId ? state.transactions.find((t) => t.id === txUi.txId) : null;
    const own = prev && prev.type === 'expense' && prev.envId === env.id && prev.date >= row.window.start && prev.date <= row.window.end ? prev.amount : 0;
    const base = row.left + own;
    if (!amount) return setHint(els.txHint, `Disponible dans « ${env.name} » : ${money(base)}`);
    const left = base - amount;
    return left < 0
      ? setHint(els.txHint, `Dépasse l'enveloppe de ${money(-left)} : le surplus est pris sur ton reste à vivre.`, 'bad')
      : setHint(els.txHint, `Il restera ${money(left)} dans « ${env.name} ».`, 'ok');
  }

  function syncTxForm() {
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
    updateTxHint();
    flushIcons();
  }

  function resetScanUi() {
    txUi.scanning = false;
    els.scanStatus.hidden = true;
  }

  function openAdd({ mode = 'expense', date = null, envId, projectId = null } = {}) {
    Object.assign(txUi, { mode, txId: null, ruleId: null, envTouched: envId !== undefined, suggested: false, projectId });
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

  function openTx(tx) {
    Object.assign(txUi, { mode: tx.type, txId: tx.id, ruleId: null, envTouched: true, suggested: false, envId: tx.type === 'expense' ? tx.envId : null, projectId: tx.type === 'deposit' ? tx.envId : null });
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

  function openRule(rule) {
    Object.assign(txUi, { mode: rule.type, txId: null, ruleId: rule.id, envTouched: true, suggested: false, envId: rule.envId, projectId: null });
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
    if (chip.dataset.project !== undefined) txUi.projectId = chip.dataset.project;
    else {
      txUi.envId = chip.dataset.env || null;
      txUi.envTouched = true;
    }
    renderTxChips();
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
    updateTxHint();
  }));
  els.txDate.addEventListener('input', () => {
    hideError(els.txError);
    syncTxForm();
  });
  els.txDate.addEventListener('change', () => syncTxForm());

  function undoRule(id) {
    const i = state.recurring.findIndex((r) => r.id === id);
    if (i >= 0) state.recurring.splice(i, 1);
    state.transactions = state.transactions.filter((t) => t.recId !== id);
    commit();
  }

  els.txForm.addEventListener('submit', guard(() => {
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
        type: mode, envId: mode === 'income' ? null : mode === 'deposit' ? txUi.projectId : txUi.envId, amount, note: label, date, detail
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

    const payload = {
      type: mode,
      envId: mode === 'income' ? null : mode === 'deposit' ? txUi.projectId : txUi.envId,
      amount, note: label, date, detail
    };
    const res = addTransaction(payload);
    if (!res.ok) return showError(els.txError, res.error);
    if (mode === 'expense' && txUi.envId && txUi.envTouched && label) learnRule(label, txUi.envId);
    closeDialog(els.dlgTx);
    const t = res.data;
    const env = findEnv(t.envId);
    const future = t.date > clock.today();
    let message;
    if (t.type === 'income') message = future ? `Revenu de ${money(t.amount)} prévu le ${shortDate(t.date)}.` : `+${money(t.amount)} ajoutés à ton reste à vivre.`;
    else if (t.type === 'deposit') message = `${money(t.amount)} versés dans « ${env.name} ».`;
    else if (future) message = `Dépense de ${money(t.amount)} prévue le ${shortDate(t.date)}.`;
    else if (env) {
      const row = envRow(env, monthOf(t.date));
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

  const SCAN_STEPS = {
    'loading tesseract core': 'Chargement du moteur de lecture…',
    'initializing tesseract': 'Préparation…',
    'initialized tesseract': 'Préparation…',
    'loading language traineddata': 'Chargement du français…',
    'loaded language traineddata': 'Chargement du français…',
    'initializing api': 'Préparation…',
    'initialized api': 'Préparation…'
  };

  els.txScan.addEventListener('click', () => els.scanFile.click());
  els.scanFile.addEventListener('change', async () => {
    const file = els.scanFile.files && els.scanFile.files[0];
    els.scanFile.value = '';
    if (!file) return;
    txUi.scanning = true;
    hideError(els.txError);
    els.scanStatus.hidden = false;
    els.txScan.hidden = true;
    els.scanText.textContent = 'Préparation de la photo…';
    try {
      const r = await scanReceipt(file, (m) => {
        if (!els.dlgTx.open) return;
        els.scanText.textContent = m.status === 'recognizing text'
          ? `Lecture du ticket… ${Math.round((m.progress || 0) * 100)} %`
          : SCAN_STEPS[m.status] || 'Préparation…';
      });
      if (!els.dlgTx.open) return;
      resetScanUi();
      if (!r.total && !r.items.length) {
        syncTxForm();
        return showError(els.txError, "Je n'ai pas réussi à lire ce ticket. Reprends la photo bien à plat, avec plus de lumière, ou saisis le montant.");
      }
      if (r.total) els.txAmount.value = toInputValue(Math.abs(r.total));
      if (r.merchant && !els.txLabel.value.trim()) els.txLabel.value = r.merchant;
      if (r.date) els.txDate.value = r.date;
      const detail = receiptDetail(r);
      if (detail) {
        els.txDetail.value = detail;
        els.txDetailBox.open = true;
      }
      if (!txUi.envTouched) {
        const guess = guessEnvelope(`${r.merchant || ''} ${r.text.slice(0, 400)}`);
        if (guess) {
          txUi.envId = guess;
          txUi.suggested = true;
        }
      }
      syncTxForm();
      const env = spendEnv(txUi.envId);
      setHint(els.txHint, `Ticket lu${r.merchant ? ` (${r.merchant})` : ''} : ${r.total ? money(Math.abs(r.total)) : 'montant à vérifier'}${r.items.length ? `, ${r.items.length} ${plural(r.items.length, 'article', 'articles')}` : ''}. ${env ? `Enveloppe proposée : « ${env.name} ». ` : ''}Vérifie avant d'ajouter.`, 'ok');
    } catch (err) {
      console.warn('BudgetFold scan', err);
      resetScanUi();
      syncTxForm();
      showError(els.txError, navigator.onLine === false
        ? 'La première lecture de ticket a besoin d\'internet pour télécharger le moteur (≈ 5 Mo). Ensuite, ça marche hors ligne.'
        : 'Lecture impossible pour le moment. Réessaie, ou saisis le montant à la main.');
    }
  });

  const envUi = { id: null, kind: 'spend' };

  function envInput() {
    const optional = (el) => (el.value.trim() === '' ? 0 : parseAmount(el.value));
    if (envUi.kind === 'spend') return { kind: 'spend', name: els.envName.value, max: parseAmount(els.envMax.value), period: els.envPeriod.value };
    const mode = checkedValue(els.envForm, 'env-mode') === 'plan' ? 'plan' : 'active';
    const target = parseAmount(els.envTarget.value);
    const saved = optional(els.envSaved);
    const deadline = isMonthKey(els.envDeadline.value) ? els.envDeadline.value : null;
    let monthly = optional(els.envMonthly);
    if (els.envMonthly.value.trim() === '' && deadline && target && saved !== null) {
      monthly = projectPlan({ target, saved, deadline, monthly: 0, mode: 'plan' }).needed || 0;
    }
    return { kind: 'project', name: els.envName.value, target, saved, monthly, deadline, mode };
  }

  function syncEnvFields() {
    els.envSpendFields.hidden = envUi.kind !== 'spend';
    els.envProjectFields.hidden = envUi.kind !== 'project';
    els.envSub.textContent = envUi.kind === 'spend'
      ? 'Un budget qui se remet à zéro à chaque période.'
      : 'Actif : épargné chaque mois. Plan : simulation, rien n\'est bloqué.';
  }

  function updateEnvHint() {
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
    const p = projectPlan(probe, d.free + (existing ? 0 : 0));
    const lines = [];
    if (input.saved >= input.target) lines.push(['ok', 'Objectif déjà atteint.']);
    else {
      if (input.deadline) lines.push(['', `Pour ${monthName(input.deadline).toLowerCase()} : il faut ${money(p.needed)} par mois (${p.months} mois).`]);
      lines.push(['', `Ta marge actuelle : ${money(p.capacity)} par mois.`]);
      if (p.monthly > 0) {
        lines.push(p.gap > 0
          ? ['bad', `Il manque ${money(p.gap)} par mois pour cette mise de ${money(p.monthly)}.`]
          : ['ok', `C'est faisable : il te resterait ${money(-p.gap)} par mois.`]);
        lines.push(['', `À ${money(p.monthly)}/mois, objectif atteint vers ${monthName(p.eta).toLowerCase()}.`]);
      }
      if (p.gap > 0 && p.capacity > 0) lines.push(['', `Avec toute ta marge (${money(p.capacity)}/mois) : vers ${monthName(p.etaCapacity).toLowerCase()}.`]);
    }
    els.envPlan.hidden = false;
    fill(els.envPlan, lines.map(([tone, text]) => h('p', { dataset: tone ? { tone } : null, text })));
    if (input.mode === 'active' && p.gap > 0 && input.saved < input.target) {
      return setHint(els.envHint, 'En mode Actif, la mise doit tenir dans ta marge. Passe en Plan pour simuler sans bloquer.', 'bad');
    }
    return setHint(els.envHint, input.mode === 'plan'
      ? 'Mode Plan : rien n\'est réservé. Active-le quand ta marge le permet.'
      : 'Mode Actif : la mise est réservée chaque mois et versée en fin de mois.');
  }

  function openEnv({ kind = 'spend', env = null } = {}) {
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
    els.envSubmit.textContent = env ? 'Enregistrer' : 'Créer';
    els.envExtra.hidden = !env;
    els.envReset.hidden = !env || env.kind !== 'spend';
    syncEnvFields();
    hideError(els.envError);
    updateEnvHint();
    openDialog(els.dlgEnv);
    if (!env) requestAnimationFrame(() => els.envName.focus());
  }

  els.envKindWrap.addEventListener('change', () => {
    envUi.kind = checkedValue(els.envForm, 'env-kind') === 'project' ? 'project' : 'spend';
    els.envTitle.textContent = envUi.kind === 'project' ? 'Nouveau projet' : 'Nouvelle enveloppe';
    syncEnvFields();
    updateEnvHint();
  });

  [els.envName, els.envMax, els.envTarget, els.envSaved, els.envMonthly, els.envDeadline, els.envPeriod, els.envModeWrap].forEach((el) => {
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
        ? env.mode === 'plan' ? `Plan « ${env.name} » créé : rien n'est bloqué.` : `Projet « ${env.name} » créé : ${money(projectContribution(env, currentMonth()))} réservés ce mois-ci.`
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
    if (ui.tab !== 'home' && window.matchMedia('(max-width: 759px)').matches) setTab('home');
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
    fill(els.wTemplates, Object.entries(TEMPLATES).map(([key, tpl]) => {
      const summary = tpl.recurring.length + tpl.spend.length + tpl.projects.length === 0
        ? 'Aucune enveloppe préremplie'
        : `${tpl.recurring.length} prélèvements · ${tpl.spend.length} enveloppes · ${tpl.projects.length} projet${tpl.projects.length > 1 ? 's' : ''}`;
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
      const parsed = fromAnyVersion(raw);
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
      postRecurring();
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

  function announcePosted(posted) {
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
    const btn = e.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  const addFromAnywhere = () => openAdd({ mode: 'expense' });
  els.navAdd.addEventListener('click', addFromAnywhere);
  els.topAdd.addEventListener('click', addFromAnywhere);
  els.mini.addEventListener('click', () => setTab('home'));
  els.upMore.addEventListener('click', () => setTab('agenda'));

  function cardOpen(e) {
    const card = e.target.closest('.envelope');
    if (!card || card.classList.contains('is-leaving')) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    const env = findEnv(card.dataset.id);
    if (env) openEnv({ env });
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
  els.jList.addEventListener('click', (e) => {
    const row = e.target.closest('.tx-row');
    const tx = row && state.transactions.find((t) => t.id === row.dataset.id);
    if (tx) openTx(tx);
  });

  els.rPrev.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), -1); renderReport(); });
  els.rNext.addEventListener('click', () => { ui.reportMonth = shiftMonth(ui.reportMonth || currentMonth(), 1); renderReport(); });

  const agendaGo = (key) => {
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
      if (tx) openTx(tx);
    } else if (row.dataset.rule) {
      const rule = findRule(row.dataset.rule);
      if (rule) openRule(rule);
    }
  });
  els.forecast.addEventListener('click', (e) => {
    const row = e.target.closest('[data-key]');
    if (!row) return;
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
      openAdd({ mode: 'expense' });
      return;
    }
    const tab = hash === 'bilan' ? 'report' : TABS.includes(hash) ? hash : null;
    if (tab) setTab(tab, { updateHash: false });
  }
  window.addEventListener('hashchange', applyHash);

  function tick() {
    const credits = runRollover();
    const posted = postRecurring();
    if (credits.size || posted.length) save();
    return { credits, posted };
  }

  let lastDay = clock.today();
  function checkClock() {
    const today = clock.today();
    if (today === lastDay) return;
    lastDay = today;
    const { credits, posted } = tick();
    ui.journalMonth = null;
    ui.reportMonth = null;
    ui.agendaMonth = null;
    ui.agendaDay = null;
    render();
    announceCredits(credits);
    announcePosted(posted);
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
    setState: (raw) => { state = fromAnyVersion(raw) || emptyState(); render(); },
    tick: () => { const r = tick(); render(); return r; },
    derive, cashflow, forecast, upcomingEvents, computeInsights, parseStatement, parseReceipt, receiptDetail, runRollover,
    postRecurring, occurrences, periodWindow, envRow, projectPlan, applyTemplate, render, setTab, guessEnvelope,
    actions: {
      addTransaction, updateTransaction, deleteTransaction, createEnvelope, updateEnvelope, deleteEnvelope, resetEnvelope,
      addRule, updateRule, deleteRule, setSalary, setSettings, openAdd, openTx, openRule, openEnv
    }
  };

  const boot = tick();
  save();
  render();
  announceCredits(boot.credits);
  announcePosted(boot.posted);
  applyHash();
  if (!state.prefs.onboarded && state.salary <= 0 && state.envelopes.length === 0) openWelcome();
})();
