// BudgetFold OS · module data (voir CLAUDE.md, « Architecture »).
import { DATA_VERSION, FREQS, GOAL_TYPES, LEGACY_KEY, MAX_CENTS, NOTES_MAX, PALETTE, PERIODS, PROJECT_ICONS, STORAGE_KEY, TIMINGS, V2_KEY, V3_KEY, addDays, arr, clampDay, clampInt, cleanDetail, cleanName, cleanNote, cleanSim, cleanText, clock, daysBetween, firstOf, hooks, isISO, isMonthKey, isoFor, maxISO, monthName, monthOf, normName, shiftMonth, shortDate, toCents, uid } from './util.mjs';


export const emptyState = () => ({
  v: DATA_VERSION,
  salary: 0,
  salaryDay: 1,
  openingBalance: null,
  lastRollover: monthOf(clock.today()),
  lastClosed: null,
  envelopes: [],
  recurring: [],
  transactions: [],
  rules: [],
  moves: [],
  closings: [],
  favorites: [],
  accounts: [{ id: 'main', name: 'Compte courant', kind: 'current', opening: null, openingDate: null, reconciledAt: null }],
  prefs: {
    onboarded: false, lastEnvId: null, since: clock.today(), lastExport: null, cycle: 'pay', safetyCreated: false,
    closing: { env: 'keep', free: 'budget', projectId: null, auto: false },
    // Micro-entreprise : taux de cotisations et seuils saisis par l'utilisateur (aucune valeur par défaut).
    pro: { enabled: false, rateBp: 0, ceiling: null, vatThreshold: null },
    lastAccountId: null, lastReminder: null,
    theme: 'auto', textLarge: false, tourDone: false,
    lock: { enabled: false, salt: null, hash: null, credId: null }
  }
});
export const THEMES = { auto: 'Auto', light: 'Clair', dark: 'Sombre', rose: 'Rose pastel', candy: 'Rose bonbon' };
// Enveloppes de dépenses : icônes proposées, et une couleur et une icône devinées d'après le nom.
export const ENV_ICONS = ['wallet', 'shopping-cart', 'car', 'bus', 'fuel', 'utensils', 'coffee', 'shirt', 'heart-pulse', 'scissors', 'gift',
  'gamepad-2', 'music', 'baby', 'dog', 'book-open', 'dumbbell', 'house', 'smartphone', 'sparkles'];
export const ENV_GUESS = [
  [/course|aliment|supermarch|epicerie/, 'shopping-cart', 'emerald'], [/essence|carbu|fuel/, 'fuel', 'orange'], [/transport|bus|metro|train|navigo/, 'bus', 'blue'],
  [/voiture|auto|parking/, 'car', 'blue'], [/sortie|resto|restaurant|bar/, 'utensils', 'rose'], [/cafe/, 'coffee', 'orange'],
  [/vetement|shopping|habit|mode/, 'shirt', 'violet'], [/sante|hygien|pharma|medecin/, 'heart-pulse', 'teal'], [/coiffeur|beaute/, 'scissors', 'violet'],
  [/cadeau|noel|anniv/, 'gift', 'rose'], [/jeu|loisir|game/, 'gamepad-2', 'violet'], [/musique|concert/, 'music', 'violet'],
  [/enfant|bebe|creche|ecole/, 'baby', 'amber'], [/animau|chien|chat|veto/, 'dog', 'amber'], [/livre|etude|formation/, 'book-open', 'teal'],
  [/sport|salle|gym/, 'dumbbell', 'teal'], [/maison|logement|deco|bricol/, 'house', 'slate'], [/telephone|forfait|internet/, 'smartphone', 'slate']
];
export function envLook(name) {
  const n = normName(name);
  const hit = ENV_GUESS.find(([re]) => re.test(n));
  const keys = Object.keys(PALETTE);
  const hash = [...n].reduce((s, c) => s + c.charCodeAt(0), 0);
  return { icon: hit ? hit[1] : 'wallet', color: hit ? hit[2] : keys[hash % keys.length] };
}
export const ACCOUNT_KINDS = { current: { label: 'Compte courant', icon: 'landmark' }, savings: { label: 'Livret / épargne', icon: 'piggy-bank' }, cash: { label: 'Espèces', icon: 'coins' } };
export const CLOSE_ACTIONS = ['keep', 'budget', 'project'];

export const initialPostedUntil = (start) => addDays(maxISO(start, firstOf(monthOf(clock.today()))), -1);

export function sanitize(raw) {
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
      const deadline = isMonthKey(e.deadline) ? e.deadline : null;
      const monthly = toCents(e.monthly);
      const p = {
        id: takeId(e.id), kind: 'project', name, target,
        saved: e.safety === true ? toCents(e.saved) : Math.min(toCents(e.saved), target),
        monthly,
        mode: e.mode === 'plan' ? 'plan' : 'active',
        deadline,
        startMonth: isMonthKey(e.startMonth) ? e.startMonth : null,
        goalType: GOAL_TYPES[e.goalType] ? e.goalType : !monthly && deadline ? 'date' : 'monthly',
        timing: TIMINGS[e.timing] ? e.timing : 'pay',
        priority: clampInt(e.priority, 1, 3, 2),
        color: PALETTE[e.color] ? e.color : 'amber',
        icon: PROJECT_ICONS.includes(e.icon) ? e.icon : 'target',
        category: e.category === 'wish' ? 'wish' : 'project',
        notes: String(e.notes ?? '').replace(/\r/g, '').slice(0, NOTES_MAX),
        checklist: arr(e.checklist).filter((c) => c && cleanText(c.text, 120)).slice(0, 100)
          .map((c) => ({ id: typeof c.id === 'string' && c.id ? c.id : uid(), text: cleanText(c.text, 120), done: Boolean(c.done) })),
        createdAt
      };
      if (e.safety === true) p.safety = true;
      if (isISO(e.boughtAt)) p.boughtAt = e.boughtAt;
      if (e.sim && typeof e.sim === 'object') p.sim = cleanSim(e.sim);
      s.envelopes.push(p);
    } else {
      const max = toCents(e.max);
      if (max <= 0) continue;
      names.add(key);
      const env = {
        id: takeId(e.id), kind: 'spend', name, max,
        period: PERIODS[e.period] ? e.period : 'month',
        anchor: isISO(e.anchor) ? e.anchor : firstOf(monthOf(today)),
        reset: null,
        createdAt,
        color: PALETTE[e.color] ? e.color : envLook(name).color,
        icon: ENV_ICONS.includes(e.icon) ? e.icon : envLook(name).icon
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
    const type = ['expense', 'income', 'deposit', 'withdraw', 'transfer'].includes(t.type) ? t.type : null;
    if (!type) continue;
    let envId = typeof t.envId === 'string' && envIds.has(t.envId) ? t.envId : null;
    if (type === 'expense' && envId && !isSpend(envId)) envId = null;
    if ((type === 'deposit' || type === 'withdraw') && !(envId && envIds.get(envId).kind === 'project')) continue;
    if (type === 'income') envId = null;
    const tx = { id: takeId(t.id), type, envId, amount, note: cleanNote(t.note), date: t.date, ts: Number.isFinite(t.ts) ? t.ts : 0 };
    const detail = cleanDetail(t.detail);
    if (detail) tx.detail = detail;
    if (typeof t.recId === 'string' && t.recId) tx.recId = t.recId;
    if (type === 'deposit' && isMonthKey(t.covers)) tx.covers = t.covers;
    const photos = arr(t.photos).filter((p) => typeof p === 'string' && /^[\w-]{6,64}$/.test(p)).slice(0, 20);
    if (photos.length) tx.photos = photos;
    if (t.pro === true) tx.pro = true;
    if (typeof t.group === 'string' && t.group) tx.group = t.group.slice(0, 64);
    const tags = cleanTags(t.tags);
    if (tags.length) tx.tags = tags;
    if (typeof t.accountId === 'string' && t.accountId) tx.accountId = t.accountId;
    if (type === 'transfer') {
      if (typeof t.toAccountId !== 'string' || !t.toAccountId || t.toAccountId === tx.accountId) continue;
      tx.toAccountId = t.toAccountId;
    }
    if (t.adjust === true) tx.adjust = true;
    if (type === 'deposit' && t.src === 'close' && isMonthKey(t.closeKey)) Object.assign(tx, { src: 'close', closeKey: t.closeKey });
    if (typeof t.ref === 'string' && t.ref) tx.ref = t.ref.slice(0, 120);
    s.transactions.push(tx);
  }

  for (const r of arr(raw.rules)) {
    if (!r || typeof r.key !== 'string' || r.key.length < 3 || !envIds.has(r.envId)) continue;
    if (!s.rules.some((x) => x.key === r.key)) s.rules.push({ key: r.key.slice(0, 40), envId: r.envId, source: r.source === 'user' ? 'user' : 'auto' });
  }
  s.rules = s.rules.slice(-300);

  s.prefs.onboarded = Boolean(raw.prefs && raw.prefs.onboarded);
  s.prefs.lastEnvId = raw.prefs && isSpend(raw.prefs.lastEnvId) ? raw.prefs.lastEnvId : null;
  if (raw.prefs && isISO(raw.prefs.since)) s.prefs.since = raw.prefs.since;
  if (raw.prefs && isISO(raw.prefs.lastExport)) s.prefs.lastExport = raw.prefs.lastExport;
  const rp = raw.prefs || {};
  if (rp.cycle === 'calendar' || rp.cycle === 'pay') s.prefs.cycle = rp.cycle;
  s.prefs.safetyCreated = Boolean(rp.safetyCreated);
  const rc = rp.closing || {};
  s.prefs.closing = {
    env: CLOSE_ACTIONS.includes(rc.env) ? rc.env : 'keep',
    free: rc.free === 'project' ? 'project' : 'budget',
    projectId: typeof rc.projectId === 'string' && envIds.has(rc.projectId) ? rc.projectId : null,
    auto: Boolean(rc.auto)
  };
  if (isMonthKey(raw.lastClosed)) s.lastClosed = raw.lastClosed;
  const pro = rp.pro || {};
  const optCents = (v) => (v === null || v === undefined || v === '' ? null : toCents(v) || null);
  s.prefs.pro = { enabled: Boolean(pro.enabled), rateBp: clampInt(pro.rateBp, 0, 10000, 0), ceiling: optCents(pro.ceiling), vatThreshold: optCents(pro.vatThreshold) };

  const spendIds = new Set(s.envelopes.filter((e) => e.kind === 'spend').map((e) => e.id));
  const endpoint = (v) => v === 'free' || spendIds.has(v);
  for (const m of arr(raw.moves)) {
    if (!m || !isMonthKey(m.key) || !isISO(m.date) || !endpoint(m.from) || !endpoint(m.to) || m.from === m.to) continue;
    const amount = toCents(m.amount);
    if (amount <= 0) continue;
    s.moves.push({ id: takeId(m.id), key: m.key, date: m.date, from: m.from, to: m.to, amount, ts: Number.isFinite(m.ts) ? m.ts : 0 });
  }
  // Clôtures : l'instantané est recopié tel quel (historique figé), seuls les champs reconnus sont gardés.
  const seen = new Set();
  for (const c of arr(raw.closings)) {
    if (!c || !isMonthKey(c.key) || seen.has(c.key) || !c.snapshot || typeof c.snapshot !== 'object') continue;
    seen.add(c.key);
    const lines = arr(c.lines).filter((l) => l && typeof l.envId === 'string').map((l) => ({
      envId: l.envId, name: cleanName(l.name) || 'Enveloppe', left: clampInt(l.left, -MAX_CENTS, MAX_CENTS, 0),
      action: CLOSE_ACTIONS.includes(l.action) ? l.action : 'keep', projectId: typeof l.projectId === 'string' ? l.projectId : null
    }));
    s.closings.push({
      key: c.key, at: Number.isFinite(c.at) ? c.at : 0, lines,
      free: clampInt(c.free, -MAX_CENTS, MAX_CENTS, 0),
      freeAction: c.freeAction === 'project' ? 'project' : 'budget',
      freeProjectId: typeof c.freeProjectId === 'string' ? c.freeProjectId : null,
      snapshot: JSON.parse(JSON.stringify(c.snapshot))
    });
  }
  s.closings.sort((a, b) => (a.key < b.key ? -1 : 1));

  // Comptes : au moins le compte courant principal ; les opérations sans compte lui appartiennent.
  const accIds = new Set();
  const accounts = arr(raw.accounts).filter((a) => a && cleanName(a.name)).map((a) => {
    const id = typeof a.id === 'string' && a.id && !accIds.has(a.id) ? a.id : uid();
    accIds.add(id);
    return {
      id, name: cleanName(a.name), kind: ACCOUNT_KINDS[a.kind] ? a.kind : 'current',
      opening: a.opening === null || a.opening === undefined ? null : clampInt(a.opening, -MAX_CENTS, MAX_CENTS, 0),
      openingDate: isISO(a.openingDate) ? a.openingDate : null,
      openingTs: Number.isFinite(a.openingTs) ? a.openingTs : 0,
      reconciledAt: isISO(a.reconciledAt) ? a.reconciledAt : null
    };
  });
  if (accounts.length) s.accounts = accounts.slice(0, 20);
  else if (s.openingBalance !== null) Object.assign(s.accounts[0], { opening: s.openingBalance, openingDate: addDays(firstOf(monthOf(clock.today())), -1) });
  const validAcc = new Set(s.accounts.map((a) => a.id));
  s.transactions = s.transactions.filter((t) => {
    if (t.accountId && !validAcc.has(t.accountId)) delete t.accountId;
    return t.type !== 'transfer' || (validAcc.has(t.toAccountId) && (t.accountId || s.accounts[0].id) !== t.toAccountId);
  });
  s.favorites = arr(raw.favorites).filter((f) => f && cleanName(f.label) && toCents(f.amount) > 0).slice(0, 24).map((f) => ({
    id: typeof f.id === 'string' && f.id ? f.id : uid(), label: cleanName(f.label), amount: toCents(f.amount),
    type: f.type === 'income' ? 'income' : 'expense', envId: f.type !== 'income' && isSpend(f.envId) ? f.envId : null,
    accountId: typeof f.accountId === 'string' && validAcc.has(f.accountId) ? f.accountId : null
  }));
  s.prefs.lastAccountId = rp.lastAccountId && validAcc.has(rp.lastAccountId) ? rp.lastAccountId : null;
  s.prefs.lastReminder = isISO(rp.lastReminder) ? rp.lastReminder : null;
  s.prefs.theme = THEMES[rp.theme] ? rp.theme : 'auto';
  s.prefs.textLarge = Boolean(rp.textLarge);
  s.prefs.tourDone = Boolean(rp.tourDone);
  const lk = rp.lock || {};
  const b64ok = (v) => typeof v === 'string' && /^[A-Za-z0-9+/=]{8,200}$/.test(v);
  s.prefs.lock = lk.enabled && b64ok(lk.salt) && b64ok(lk.hash)
    ? { enabled: true, salt: lk.salt, hash: lk.hash, credId: b64ok(lk.credId) ? lk.credId : null }
    : { enabled: false, salt: null, hash: null, credId: null };
  return s;
}

// Étiquettes : minuscules, sans doublon, 5 au plus.
export function cleanTags(v) {
  const list = (Array.isArray(v) ? v : String(v ?? '').split(/[,;]/)).map((x) => cleanText(String(x).trim().replace(/^#+/, ''), 20).toLowerCase()).filter(Boolean);
  return [...new Set(list)].slice(0, 5);
}

// v3 → v4 : les nouveaux champs (startMonth, covers, since, lastExport…) ont des valeurs par défaut neutres.
export function migrateV3(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const prefs = { ...(raw.prefs || {}) };
  if (!isISO(prefs.since)) prefs.since = clock.today();
  // Les anciennes versions comptaient en mois calendaires : on garde ce cycle pour ne changer aucun chiffre.
  if (!prefs.cycle) prefs.cycle = 'calendar';
  return { ...raw, v: 4, prefs };
}

export function migrateV2(raw) {
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

export function migrateV1(raw) {
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

export function fromAnyVersion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v === DATA_VERSION) return sanitize(raw);
  if (raw.v === 3) return sanitize(migrateV3(raw));
  if (raw.v === 2) return sanitize(migrateV3(migrateV2(raw)));
  if (Array.isArray(raw.envelopes) && raw.salary !== undefined) return sanitize(migrateV3(migrateV1(raw)));
  return null;
}

export function load() {
  try {
    for (const key of [STORAGE_KEY, V3_KEY]) {
      const raw = localStorage.getItem(key);
      if (raw) return fromAnyVersion(JSON.parse(raw)) || emptyState();
    }
    const v2 = localStorage.getItem(V2_KEY);
    if (v2) return sanitize(migrateV3(migrateV2(JSON.parse(v2)))) || emptyState();
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return sanitize(migrateV3(migrateV1(JSON.parse(legacy)))) || emptyState();
  } catch {
    return emptyState();
  }
  return emptyState();
}

export let state = load();
export let lastAddedId = null;

// localStorage tient environ 5 Mo : on prévient bien avant.
export const STORAGE_WARN = 4_000_000;
export let storageWarned = false;

export function save() {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    if (json.length > STORAGE_WARN && !storageWarned) {
      storageWarned = true;
      hooks.toast('Ton stockage local est presque plein : exporte une sauvegarde depuis le menu.', 'error');
    }
  } catch {
    hooks.toast("Impossible d'enregistrer : le stockage du navigateur est plein ou bloqué.", 'error');
  }
}

// Demande au navigateur de ne pas effacer les données de l'app (Safari peut le faire après 7 jours sans visite).
export async function securePersistence() {
  const st = navigator.storage;
  if (!st) return;
  try {
    if (st.persisted && st.persist && !(await st.persisted())) await st.persist();
  } catch { /* refusé : rien à faire */ }
  try {
    if (!st.estimate) return;
    const { usage = 0, quota = 0 } = await st.estimate();
    if (quota > 0 && usage / quota > 0.8 && !storageWarned) {
      storageWarned = true;
      hooks.toast(`Stockage presque plein (${Math.round((usage / quota) * 100)} %) : exporte une sauvegarde.`, 'error');
    }
  } catch { /* estimation indisponible */ }
}

export const BACKUP_DAYS = 30;
export function backupAge() {
  const ref = state.prefs.lastExport || state.prefs.since;
  return ref ? daysBetween(ref, clock.today()) : 0;
}

export function commit() {
  save();
  hooks.render();
}

// Mois budgétaire : il commence au jour de paie (réglage `prefs.cycle = 'pay'`) ou le 1er (`'calendar'`).
// Un mois commencé après le 15 porte le nom du mois suivant (paie le 28 octobre → budget de novembre).
export const cycleDay = () => (state.prefs.cycle === 'pay' ? clampInt(state.salaryDay, 1, 31, 1) : 1);
export function cycleStart(key) {
  const day = cycleDay();
  if (day === 1) return firstOf(key);
  const k = day > 15 ? shiftMonth(key, -1) : key;
  return isoFor(k, clampDay(day, k));
}
export const cycleEnd = (key) => addDays(cycleStart(shiftMonth(key, 1)), -1);
export function budgetKey(iso) {
  const k = monthOf(iso);
  if (iso < cycleStart(k)) return shiftMonth(k, -1);
  if (iso > cycleEnd(k)) return shiftMonth(k, 1);
  return k;
}
export const inCycle = (iso, key) => iso >= cycleStart(key) && iso <= cycleEnd(key);
export const cycleLength = (key) => daysBetween(cycleStart(key), cycleEnd(key)) + 1;
// Jours de paie (salaire) compris dans un mois budgétaire.
export function payDates(key) {
  const s = cycleStart(key);
  const e = cycleEnd(key);
  const out = [];
  for (let m = shiftMonth(monthOf(s), 0); m <= monthOf(e); m = shiftMonth(m, 1)) {
    const d = isoFor(m, clampDay(state.salaryDay, m));
    if (d >= s && d <= e) out.push(d);
  }
  return out;
}
export const periodLabel = (key) => (cycleDay() === 1 ? monthName(key) : `${monthName(key)} · ${shortDate(cycleStart(key))} → ${shortDate(cycleEnd(key))}`);
export const currentMonth = () => budgetKey(clock.today());
export const findEnv = (id) => state.envelopes.find((e) => e.id === id);
export const findRule = (id) => state.recurring.find((r) => r.id === id);
export const spendEnv = (id) => {
  const e = findEnv(id);
  return e && e.kind === 'spend' ? e : null;
};
export const projectDone = (e) => !e.safety && e.saved >= e.target;


// Réaffectations depuis les autres modules (un import est en lecture seule).
export function replaceState(next) { state = next; }
export function setLastAddedId(id) { lastAddedId = id; }
