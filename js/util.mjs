// BudgetFold OS · module util (voir CLAUDE.md, « Architecture »).

// Registre des fonctions de l'interface appelées par les modules du dessous (rempli par ui.mjs).
export const hooks = {};


export const VERSION = '3.0';
export const DATA_VERSION = 4;
export const STORAGE_KEY = 'budgetfold-os:v4';
export const V3_KEY = 'budgetfold-os:v3';
export const V2_KEY = 'budgetfold-os:v2';
export const LEGACY_KEY = 'budgetfold-os:v1';
export const MAX_CENTS = 1_000_000_000;
export const NAME_MAX = 40;
export const NOTE_MAX = 80;
export const DETAIL_MAX = 1500;
export const RING_C = 2 * Math.PI * 50;
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pad = (n) => String(n).padStart(2, '0');
export const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const clock = { today: () => localISO(new Date()), now: () => Date.now() };

export const monthOf = (iso) => iso.slice(0, 7);
export const dayOf = (iso) => Number(iso.slice(8, 10));
export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const shiftMonth = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const monthDiff = (a, b) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
export const clampDay = (day, key) => Math.min(Math.max(1, day), daysInMonth(key));
export const isoFor = (key, day) => `${key}-${pad(day)}`;
export const firstOf = (key) => `${key}-01`;
export const lastOf = (key) => isoFor(key, daysInMonth(key));
export const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return localISO(d);
};
export const mondayOf = (iso) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
export const maxISO = (a, b) => (a > b ? a : b);
export const maxMonth = maxISO;
export const minISO = (a, b) => (a < b ? a : b);
export const isISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
};
export const isMonthKey = (s) => /^(20\d{2})-(0[1-9]|1[0-2])$/.test(s || '');
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthName = (key) => capitalize(parseISO(`${key}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
// « d'octobre 2026 », « de novembre 2026 »
export const ofMonth = (key) => {
  const n = monthName(key).toLowerCase();
  return /^[aeiouyéèâ]/.test(n) ? `d'${n}` : `de ${n}`;
};
export const monthShort = (key) => capitalize(parseISO(`${key}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''));
export const shortDate = (iso) => parseISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const dayHeading = (iso) => {
  const today = clock.today();
  if (iso === today) return "Aujourd'hui";
  if (iso === addDays(today, -1)) return 'Hier';
  if (iso === addDays(today, 1)) return 'Demain';
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
  return capitalize(parseISO(iso).toLocaleDateString('fr-FR', opts));
};
export const relDay = (iso) => {
  const diff = daysBetween(clock.today(), iso);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff > 1 && diff < 7) return capitalize(parseISO(iso).toLocaleDateString('fr-FR', { weekday: 'long' }));
  return shortDate(iso);
};

export const fmtInt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const fmtDec = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (cents) => (cents % 100 === 0 ? fmtInt : fmtDec).format(cents / 100);
export const moneyRound = (cents) => fmtInt.format(Math.round(cents / 100));
export const plural = (n, one, many) => (n > 1 ? many : one);

export const ok = (data) => ({ ok: true, data });
export const fail = (error) => ({ ok: false, error });

export const uid = () =>
  (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const arr = (v) => (Array.isArray(v) ? v : []);
export const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
export const cleanText = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanName = (v) => cleanText(v, NAME_MAX);
export const cleanNote = (v) => cleanText(v, NOTE_MAX);
export const cleanDetail = (v) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, DETAIL_MAX);
export const normText = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normName = (v) => normText(cleanName(v));

export const toCents = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MAX_CENTS, Math.max(0, Math.round(n))) : 0;
};

export function parseAmount(raw) {
  const s = String(raw ?? '').replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ''] = s.split('.');
  const cents = parseInt(int, 10) * 100 + parseInt((dec + '00').slice(0, 2), 10);
  return cents <= MAX_CENTS ? cents : null;
}

export function parseDayInput(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 31 ? n : null;
}

export const toInputValue = (cents) => (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2).replace('.', ',');

export const FREQS = {
  day: { label: 'Chaque jour', per: 'par jour', factor: 365 / 12 },
  week: { label: 'Chaque semaine', per: 'par semaine', factor: 52 / 12 },
  '2weeks': { label: 'Toutes les 2 semaines', per: 'toutes les 2 semaines', factor: 26 / 12 },
  month: { label: 'Chaque mois', per: 'par mois', factor: 1 },
  '2months': { label: 'Tous les 2 mois', per: 'tous les 2 mois', factor: 1 / 2 },
  quarter: { label: 'Chaque trimestre', per: 'par trimestre', factor: 1 / 3 },
  year: { label: 'Chaque année', per: 'par an', factor: 1 / 12 }
};
export const MONTH_STEPS = { month: 1, '2months': 2, quarter: 3, year: 12 };
export const PERIODS = {
  week: { label: 'semaine', per: 'par semaine', the: 'cette semaine' },
  '2weeks': { label: '2 semaines', per: 'toutes les 2 semaines', the: 'sur ces 2 semaines' },
  month: { label: 'mois', per: 'par mois', the: 'ce mois-ci' },
  '2months': { label: '2 mois', per: 'tous les 2 mois', the: 'sur ces 2 mois' },
  quarter: { label: 'trimestre', per: 'par trimestre', the: 'ce trimestre' },
  year: { label: 'an', per: 'par an', the: 'cette année' }
};
export const monthlyEq = (amount, freq) => Math.round(amount * (FREQS[freq] || FREQS.month).factor);

export const REC_ICONS = [
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
export const ruleIcon = (r) => {
  if (r.type === 'income') return 'banknote';
  const t = normText(r.label);
  for (const [re, ic] of REC_ICONS) if (re.test(t)) return ic;
  return r.envId ? 'wallet' : 'calendar-clock';
};

export const KEYWORD_HINTS = [
  { words: ['carrefour', 'leclerc', 'auchan', 'lidl', 'monoprix', 'intermarche', 'franprix', 'picard', 'aldi', 'casino', 'biocoop', 'grand frais', 'super u', 'hyper u', 'u express', 'netto', 'cora', 'naturalia', 'g20', 'spar', 'leader price', 'boulangerie', 'marche', 'courses'], env: /course|aliment|supermarch|nourrit|bouffe/ },
  { words: ['sncf', 'ratp', 'navigo', 'uber', 'bolt', 'blablacar', 'totalenergies', 'total access', 'esso', 'shell', 'avia', 'vinci', 'autoroute', 'tisseo', 'transdev', 'ouigo', 'flixbus', 'velib', 'carburant', 'essence', 'gazole', 'parking'], env: /transport|essence|carbu|deplac|voiture/ },
  { words: ['netflix', 'spotify', 'disney', 'deezer', 'youtube', 'steam', 'playstation', 'cinema', 'ugc', 'pathe', 'fnac', 'decathlon', 'mcdo', 'mcdonald', 'burger', 'kfc', 'deliveroo', 'uber eats', 'restaurant', 'cafe', 'starbucks', 'bar ', 'brasserie'], env: /loisir|sortie|resto|diver|plaisir/ },
  { words: ['pharmacie', 'doctolib', 'mutuelle', 'optique', 'dentiste', 'hopital', 'medecin', 'parapharmacie', 'sephora'], env: /sant|hygien|pharma|beaute/ },
  { words: ['zara', 'h&m', 'primark', 'kiabi', 'uniqlo', 'celio', 'jules', 'vinted', 'zalando'], env: /vetement|habit|shopping|mode/ }
];

// Projets : types d'objectifs, moment du versement, couleurs et icônes.
export const GOAL_TYPES = {
  monthly: { label: 'X € par mois', short: 'Mise fixe', icon: 'repeat' },
  date: { label: 'Pour une date', short: 'Pour une date', icon: 'calendar-check' },
  fill: { label: 'Réserve à remplir', short: 'Réserve', icon: 'battery-medium' }
};
export const TIMINGS = {
  pay: { label: 'Jour de paie', text: 'le jour de paie' },
  first: { label: 'Le 1er', text: 'au début du mois' },
  end: { label: 'Fin de mois', text: 'en fin de mois' }
};
export const PRIORITIES = { 1: 'Haute', 2: 'Normale', 3: 'Basse' };
export const PALETTE = {
  amber: 'Ambre', emerald: 'Émeraude', blue: 'Bleu', violet: 'Violet', rose: 'Rose', teal: 'Turquoise', orange: 'Orange', slate: 'Ardoise'
};
export const PROJECT_ICONS = ['target', 'house', 'car', 'bike', 'plane', 'graduation-cap', 'baby', 'heart', 'gift', 'laptop', 'smartphone', 'sofa',
  'shield', 'wrench', 'piggy-bank', 'music', 'camera', 'shopping-bag', 'sparkles', 'umbrella'];
export const NOTES_MAX = 4000;
// Simulation : taux en points de base (1 % = 100) saisis par l'utilisateur, montants en centimes.
export function cleanSim(raw) {
  const bp = (v) => clampInt(v, -5000, 5000, 0);
  const sc = raw.scenarios || {};
  const money0 = (v) => (v === null || v === undefined || v === '' ? null : toCents(v));
  return {
    yieldBp: bp(raw.yieldBp), inflationBp: bp(raw.inflationBp),
    raise: toCents(raw.raise), raiseFrom: isMonthKey(raw.raiseFrom) ? raw.raiseFrom : null,
    scenarios: { prudent: money0(sc.prudent), real: money0(sc.real), ambitious: money0(sc.ambitious) },
    compareId: typeof raw.compareId === 'string' ? raw.compareId : null
  };
}
