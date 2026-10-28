// BudgetFold OS · module io (voir CLAUDE.md, « Architecture »).
import { MAX_CENTS, capitalize, cleanText, clock, daysBetween, isISO, money, normText, pad, plural, uid } from './util.mjs';
import { findEnv, state } from './data.mjs';

export function parseDelimited(text, delim) {
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

export function detectDelimiter(text) {
  const sample = text.split('\n').filter((l) => l.trim()).slice(0, 8).join('\n');
  const counts = [';', '\t', ','].map((d) => [d, sample.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

export function parseDateCell(raw) {
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

export function parseSignedAmount(raw) {
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

// Préréglages des grandes banques françaises : noms de colonnes (en minuscules, sans accents) ou positions fixes.
export const BANK_PRESETS = {
  auto: { label: 'Détection automatique' },
  bnp: { label: 'BNP Paribas', date: ['date operation'], label2: ['libelle operation', 'libelle court'], amount: ['montant operation'] },
  sg: { label: 'Société Générale', date: ['date de l\'operation', 'date'], label2: ['detail de l\'ecriture', 'libelle'], amount: ['montant de l\'operation'] },
  ca: { label: 'Crédit Agricole', date: ['date'], label2: ['libelle'], debit: ['debit euros', 'debit'], credit: ['credit euros', 'credit'] },
  lcl: { label: 'LCL', fixed: { date: 0, amount: 1, label: 4 } },
  bp: { label: 'Banque Populaire / Caisse d\'Épargne', date: ['date operation', 'date comptable'], label2: ['libelle complet', 'libelle simplifie', 'libelle'], amount: ['montant'], debit: ['debit'], credit: ['credit'] },
  lbp: { label: 'La Banque Postale', date: ['date'], label2: ['libelle'], amount: ['montant(euros)', 'montant(eur)', 'montant'] },
  cm: { label: 'Crédit Mutuel / CIC', date: ['date d\'operation', 'date'], label2: ['libelle'], debit: ['debit'], credit: ['credit'], amount: ['montant'] },
  bourso: { label: 'Boursorama', date: ['dateop'], label2: ['label'], amount: ['amount'] },
  fortuneo: { label: 'Fortuneo', date: ['date operation'], label2: ['libelle'], debit: ['debit'], credit: ['credit'] },
  revolut: { label: 'Revolut', date: ['completed date', 'started date'], label2: ['description'], amount: ['amount'] },
  n26: { label: 'N26', date: ['date', 'booking date'], label2: ['payee', 'partner name'], amount: ['amount (eur)', 'amount'] }
};

export function presetColumns(cells, preset) {
  const pick = (names) => (names ? names.map((n) => cells.indexOf(n)).find((i) => i >= 0) ?? -1 : -1);
  const date = pick(preset.date);
  const label = pick(preset.label2);
  const amount = pick(preset.amount);
  const debit = pick(preset.debit);
  const credit = pick(preset.credit);
  return date >= 0 && (amount >= 0 || debit >= 0 || credit >= 0) ? { date, label, amount: debit >= 0 || credit >= 0 ? -1 : amount, debit, credit } : null;
}

export function parseStatement(text, presetKey = 'auto') {
  const clean = String(text || '').replace(/^﻿/, '');
  const delim = detectDelimiter(clean);
  const rows = parseDelimited(clean, delim);
  if (rows.length < 2) return { rows: [], skipped: 0, error: 'Fichier vide ou illisible.' };
  const preset = BANK_PRESETS[presetKey] || BANK_PRESETS.auto;

  let headerIndex = -1;
  let cols = null;
  if (preset.fixed) {
    cols = { ...preset.fixed, debit: -1, credit: -1 };
  } else if (preset.date) {
    for (let i = 0; i < Math.min(rows.length, 40) && !cols; i++) {
      const found = presetColumns(rows[i].map((c) => normText(c).trim().replace(/\s+/g, ' ')), preset);
      if (found) {
        cols = found;
        headerIndex = i;
      }
    }
  }
  for (let i = 0; i < Math.min(rows.length, 40) && !cols; i++) {
    const cells = rows[i].map((c) => normText(c).trim());
    const find = (re) => cells.findIndex((c) => re.test(c));
    const dateIdx = (() => {
      const all = cells.map((c, idx) => (/date/.test(c) ? idx : -1)).filter((idx) => idx >= 0);
      if (!all.length) return -1;
      return all.find((idx) => /oper|compta/.test(cells[idx])) ?? all[0];
    })();
    const labelIdx = find(/libell|label|description|intitul|detail|motif|objet|reference|nom|tiers|beneficiaire|payee|partner|merchant/);
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

export function decodeBuffer(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}


export const RECEIPT_STORES = [
  ['e.leclerc', 'E.Leclerc'], ['leclerc', 'E.Leclerc'], ['carrefour market', 'Carrefour Market'], ['carrefour city', 'Carrefour City'],
  ['carrefour express', 'Carrefour Express'], ['carrefour', 'Carrefour'], ['intermarche', 'Intermarché'], ['monoprix', 'Monoprix'],
  ['franprix', 'Franprix'], ['auchan', 'Auchan'], ['lidl', 'Lidl'], ['aldi', 'Aldi'], ['casino', 'Casino'], ['hyper u', 'Hyper U'],
  ['super u', 'Super U'], ['u express', 'U Express'], ['picard', 'Picard'], ['biocoop', 'Biocoop'], ['grand frais', 'Grand Frais'],
  ['netto', 'Netto'], ['cora', 'Cora'], ['naturalia', 'Naturalia'], ['decathlon', 'Decathlon'], ['fnac', 'Fnac'], ['darty', 'Darty'],
  ['ikea', 'IKEA'], ['primark', 'Primark'], ['sephora', 'Sephora'], ['pharmacie', 'Pharmacie'], ['mcdonald', "McDonald's"],
  ['burger king', 'Burger King'], ['kfc', 'KFC'], ['starbucks', 'Starbucks'], ['boulangerie', 'Boulangerie'],
  ['totalenergies', 'TotalEnergies'], ['esso', 'Esso'], ['shell', 'Shell'], ['action', 'Action'], ['zara', 'Zara'], ['kiabi', 'Kiabi'],
  ['relay', 'Relay'], ['hudson', 'Hudson'], ['paul', 'Paul'], ['brioche doree', 'Brioche Dorée'], ['la mie caline', 'La Mie Câline'],
  ['marie blachere', 'Marie Blachère'], ['columbus cafe', 'Columbus Café'], ['monop', "Monop'"], ['bricomarche', 'Bricomarché'],
  ['leroy merlin', 'Leroy Merlin'], ['castorama', 'Castorama'], ['boulanger', 'Boulanger'], ['cultura', 'Cultura'], ['gifi', 'Gifi'],
  ['nature et decouvertes', 'Nature & Découvertes'], ['flunch', 'Flunch'], ['quick', 'Quick'], ['subway', 'Subway'],
  ['dominos', "Domino's"], ['five guys', 'Five Guys'], ['o tacos', "O'Tacos"], ['galeries lafayette', 'Galeries Lafayette'],
  ['uniqlo', 'Uniqlo'], ['celio', 'Celio'], ['intersport', 'Intersport'], ['go sport', 'Go Sport'], ['la poste', 'La Poste'],
  ['tabac', 'Tabac'], ['maisons du monde', 'Maisons du Monde'], ['picard surgeles', 'Picard'], ['avia', 'Avia'],
  // Raisons sociales : retenues seulement si aucune enseigne n'est trouvée.
  ['lagardere travel retail', 'Lagardère Travel Retail', 'legal'], ['lagardere', 'Lagardère Travel Retail', 'legal'],
  ['sncf', 'SNCF', 'legal'], ['gare', 'Boutique de gare', 'legal']
];
// Lecture OCR : confusions fréquentes ramenées à une même forme (O/D/0, rn/m, l/i/1, S/5).
export const ocrCanon = (s) => normText(s).replace(/rn/g, 'm').replace(/[d0]/g, 'o').replace(/[1i|!]/g, 'l').replace(/5/g, 's');
// Montant en fin de ligne, éventuellement suivi d'un code TVA (lettre ou nombre de 1 à 2 chiffres : « 1,60 10 »).
export const AMOUNT_TAIL = /(-?\s?\d{1,4}(?:[ .]\d{3})*[.,]\d{2})\s*(?:€|eur(?:os?)?|e)?\s*(?:[a-d*]{1,2}|\d{1,2})?\s*$/i;
export const VAT_BLOCK = /\b(tx|taux|code)\s*(de\s*)?tva\b|\btva\s+ht\b|\bht\s+tva\b/;
export const EAN = /\b\d{8,14}\b/g;
export const NOT_TOTAL = /(sous[\s-]*total|s\/total|tva|\bht\b|rendu|monnaie|remise|econom|fidelit|cagnotte|avantage|nb\s*art|nombre|articles?\b|points?\b)/;
export const NOT_ITEM = /(total|tva|\bht\b|\bcb\b|carte|rendu|esp[eè]ces|especes|montant|paiement|payer|ticket|caisse|siret|\btel\b|merci|bienvenue|date|heure|sous|monnaie|\bn[°o]\s?\d|transaction|autoris|contactless|sans contact|visa|mastercard)/;
export const TOTAL_KEYS = [
  [/net\s*a\s*payer|a\s*payer/, 6], [/total\s*(ttc|eur|€)/, 5], [/\btota[l1]\b/, 4], [/montant\s*(ttc|du|cb|carte)?/, 3],
  [/carte\s*bancaire|\bcb\b|paiement|esp[eè]ces|especes|visa|mastercard/, 2]
];

export function fixOcrNumbers(line) {
  return line.replace(/(^|[\s:=x*])([0-9OoIlS]{1,4})\s?[,.]\s?([0-9OoIlS]{2})(?=\s|€|[a-dA-D*]?$|$)/g, (m, pre, a, b) => {
    if (!/\d/.test(a + b)) return m;
    const fix = (s) => s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5');
    return `${pre}${fix(a)},${fix(b)}`;
  });
}

export function amountOf(line) {
  const m = AMOUNT_TAIL.exec(line);
  if (!m) return null;
  const raw = m[1].replace(/\s/g, '');
  const cents = parseSignedAmount(raw);
  if (cents === null || Math.abs(cents) > 1000000) return null;
  return { cents, index: m.index };
}

export const tidyLabel = (s) => {
  let t = s.replace(EAN, ' ').replace(/(\s+-?\d{1,4}[.,]\d{2})+\s*$/, '')
    .replace(/^[\s\-–*•.]+/, '').replace(/^\d+\s*[x×*]\s*/i, '').replace(/^\d{1,2}\s+(?=[a-zà-ÿ])/i, '').replace(/\s+[x×*]\s*\d+([.,]\d+)?\s*$/i, '')
    .replace(/\s+\d+([.,]\d+)?\s*(kg|g|l|cl|ml)?\s*[x×*@]\s*\d+[.,]\d{2}.*$/i, '')
    .replace(/[\s.:_\-]+$/, '').replace(/\s{2,}/g, ' ').trim();
  if (t && t === t.toUpperCase()) t = capitalize(t.toLowerCase());
  return t.slice(0, 60);
};

export function parseReceipt(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => fixOcrNumbers(l.replace(/\s+/g, ' ').trim())).filter((l) => l.length > 1);
  const norm = lines.map((l) => normText(l));
  const all = norm.join('\n');

  // Enseigne : la plus haute sur le ticket, en tolérant les confusions OCR ; une raison sociale ne passe qu'en dernier.
  let merchant = null;
  let best = Infinity;
  const canon = ocrCanon(all);
  for (const [key, label, kind] of RECEIPT_STORES) {
    const re = new RegExp(`(^|[^a-z])${ocrCanon(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'm');
    const m = re.exec(canon);
    if (!m) continue;
    const rank = m.index + (kind === 'legal' ? 1e6 : 0);
    if (rank < best) {
      best = rank;
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

  // Date : même ancienne, elle est gardée (un justificatif peut dater) ; l'interface prévient au-delà d'un mois.
  let date = null;
  const today = clock.today();
  for (const l of lines) {
    const m = /(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4}|\d{2})(?!\d)/.exec(l);
    if (!m) continue;
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    if (isISO(iso) && iso <= today) {
      date = iso;
      break;
    }
  }
  const dateOld = Boolean(date && daysBetween(date, today) > 31);

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

  // Articles : jusqu'au total ou au récapitulatif TVA. Une ligne sans prix suivie d'une ligne de prix seul
  // forme un article sur deux lignes (désignation + code EAN, puis prix).
  const items = [];
  const totalAt = totalIdx >= 0 ? lines.findIndex((l, i) => TOTAL_KEYS.some(([re]) => re.test(norm[i])) && !NOT_TOTAL.test(norm[i])) : -1;
  const vatAt = norm.findIndex((n) => VAT_BLOCK.test(n));
  const stop = Math.min(totalAt >= 0 ? totalAt : lines.length, vatAt >= 0 ? vatAt : lines.length);
  const letters = (s) => (s.replace(EAN, '').match(/[a-zà-ÿ]/gi) || []).length;
  let pending = null;
  for (let i = 0; i < stop; i++) {
    if (NOT_ITEM.test(norm[i]) || lines[i].includes('%')) { pending = null; continue; }
    const a = amountOf(lines[i]);
    if (!a) {
      pending = letters(lines[i]) >= 3 ? { line: lines[i], i } : null;
      continue;
    }
    let label = tidyLabel(lines[i].slice(0, a.index));
    if (letters(label) < 2 && pending && pending.i === i - 1) label = tidyLabel(pending.line);
    pending = null;
    if (a.cents === 0 || letters(label) < 2) continue;
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
  return { merchant, date, dateOld, total, items, itemsSum: sum, lines: lines.length };
}

export function receiptDetail(r) {
  if (!r.items.length) return '';
  const head = `${r.merchant ? `Ticket ${r.merchant}` : 'Ticket'} · ${r.items.length} ${plural(r.items.length, 'article', 'articles')}`;
  return [head, ...r.items.map((it) => `• ${it.label} — ${money(Math.abs(it.amount)).replace(/ | /g, ' ')}${it.amount < 0 ? ' (remise)' : ''}`)].join('\n');
}

// ——— Justificatifs : photos et PDF dans IndexedDB (localStorage est limité à ~5 Mo) ———
export const PHOTO_DB = 'budgetfold-photos';
export const PHOTO_MAX = 1200;
export const PHOTO_TARGET = 150 * 1024;
export let photoDb = null;
export function openPhotoDb() {
  if (!photoDb) {
    photoDb = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('indexeddb'));
      const req = indexedDB.open(PHOTO_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => { photoDb = null; throw err; });
  }
  return photoDb;
}
export async function photoStore(mode, run) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('photos', mode);
    const req = run(t.objectStore('photos'));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export const Photos = {
  put: (rec) => photoStore('readwrite', (st) => st.put(rec)),
  get: (id) => photoStore('readonly', (st) => st.get(id)),
  del: (id) => photoStore('readwrite', (st) => st.delete(id)),
  all: () => photoStore('readonly', (st) => st.getAll())
};
export const photoUrls = new Map();
export async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const rec = await Photos.get(id).catch(() => null);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  photoUrls.set(id, url);
  return url;
}

export const canvasBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
export async function loadImage(src) {
  const url = src instanceof Blob ? URL.createObjectURL(src) : null;
  try {
    return await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url || src;
    });
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

// Photo compressée : JPEG d'environ 1 200 px et 150 Ko, qualité baissée pas à pas si besoin.
export async function compressPhoto(source) {
  const img = source instanceof HTMLCanvasElement ? source : await loadImage(source);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, PHOTO_MAX / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let blob = null;
  for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    blob = await canvasBlob(canvas, 'image/jpeg', q);
    if (blob && blob.size <= PHOTO_TARGET) break;
  }
  return { blob, type: 'image/jpeg', w: canvas.width, h: canvas.height };
}

export async function savePhoto(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const data = isPdf ? { blob: file, type: 'application/pdf', w: 0, h: 0 } : await compressPhoto(file);
  const rec = { id: uid(), ...data, size: data.blob.size, name: cleanText(file.name || '', 80), createdAt: clock.now() };
  await Photos.put(rec);
  return rec;
}

// Ménage au démarrage : une photo que plus aucune opération ne cite (suppression confirmée lors d'une séance précédente).
export async function cleanupPhotos() {
  try {
    const used = new Set(state.transactions.flatMap((t) => t.photos || []));
    for (const rec of await Photos.all()) if (!used.has(rec.id) && clock.now() - rec.createdAt > 86400000) await Photos.del(rec.id);
  } catch { /* IndexedDB indisponible */ }
}

// ——— ZIP sans dépendance (méthode « stockée » : les JPEG sont déjà compressés) ———
export const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data));
    const crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(8, 0, true);
    head.setUint16(10, dosTime, true);
    head.setUint16(12, dosDate, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, data.length, true);
    head.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(head.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
export async function readZip(buffer) {
  const v = new DataView(buffer);
  let e = buffer.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip');
  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('zip');
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buffer, p + 46, nlen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    let data = new Uint8Array(buffer.slice(start, start + csize));
    if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else if (method !== 0) throw new Error('zip');
    out.set(name, data);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const photoExt = (rec) => (rec.type === 'application/pdf' ? 'pdf' : 'jpg');
export async function photoFiles(ids, naming) {
  const files = [];
  for (const [i, id] of ids.entries()) {
    const rec = await Photos.get(id).catch(() => null);
    if (rec) files.push({ name: naming(rec, i), data: new Uint8Array(await rec.blob.arrayBuffer()), id });
  }
  return files;
}

// Sauvegarde complète : budgetfold.json + photos/ (zip).
export async function fullBackupZip() {
  const ids = [...new Set(state.transactions.flatMap((t) => t.photos || []))];
  const photos = await photoFiles(ids, (rec) => `photos/${rec.id}.${photoExt(rec)}`);
  const meta = Object.fromEntries((await Promise.all(ids.map((id) => Photos.get(id).catch(() => null)))).filter(Boolean).map((r) => [r.id, { type: r.type, w: r.w, h: r.h, name: r.name, createdAt: r.createdAt }]));
  const payload = { app: 'BudgetFold OS', exportedAt: new Date().toISOString(), unit: 'centimes', photos: meta, ...state };
  return makeZip([{ name: 'budgetfold.json', data: JSON.stringify(payload, null, 2) }, ...photos.map(({ name, data }) => ({ name, data }))]);
}

export const csvCell = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const centsText = (c) => `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)},${pad(Math.abs(c) % 100)}`;
export const slug = (s) => normText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'operation';

// Export « justificatifs » d'une période : CSV (séparateur ;) + photos nommées par date, pour la comptabilité.
export async function proofsZip({ from, to, proOnly = false }) {
  const txs = state.transactions
    .filter((t) => (t.type === 'expense' || t.type === 'income') && t.date >= from && t.date <= to && (!proOnly || t.pro))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));
  const rows = [['Date', 'Libellé', 'Montant (€)', 'Type', 'Enveloppe', 'Pro', 'Justificatifs'].join(';')];
  const files = [];
  for (const t of txs) {
    const names = [];
    for (const [i, id] of (t.photos || []).entries()) {
      const rec = await Photos.get(id).catch(() => null);
      if (!rec) continue;
      const name = `justificatifs/${t.date}_${slug(t.note || 'operation')}_${t.id.slice(0, 6)}${i ? `_${i + 1}` : ''}.${photoExt(rec)}`;
      names.push(name.replace('justificatifs/', ''));
      files.push({ name, data: new Uint8Array(await rec.blob.arrayBuffer()) });
    }
    const env = findEnv(t.envId);
    rows.push([t.date, t.note || '', centsText(t.type === 'expense' ? -t.amount : t.amount), t.type === 'income' ? 'Revenu' : 'Dépense', env ? env.name : '', t.pro ? 'pro' : 'perso', names.join(' ')].map(csvCell).join(';'));
  }
  const csv = `﻿${rows.join('\r\n')}\r\n`;
  return { blob: makeZip([{ name: 'justificatifs.csv', data: csv }, ...files]), count: txs.length, photos: files.length };
}

// Facture PDF : lecture du texte (pdf.js chargé à la demande, version figée), puis même analyse qu'un ticket.
export const PDFJS = {
  lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'
};
export let pdfLib = null;
export async function pdfText(file) {
  if (!pdfLib) {
    pdfLib = await import(PDFJS.lib);
    pdfLib.GlobalWorkerOptions.workerSrc = PDFJS.worker;
  }
  const doc = await pdfLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages = [];
  for (let n = 1; n <= Math.min(doc.numPages, 10); n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const lines = new Map();
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ x: it.transform[4], s: it.str });
    }
    pages.push([...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' ')).join('\n'));
  }
  return pages.join('\n');
}

export const TESS = {
  script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int'
};
export const OCR = { worker: null, loading: null, onProgress: null };

export function loadScript(src) {
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

export function getOcrWorker() {
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

// Image prête pour l'OCR : agrandie si besoin, en niveaux de gris contrastés. Accepte une photo ou une découpe (canvas).
export async function prepareImage(source) {
  const img = source instanceof HTMLCanvasElement ? source : await loadImage(source);
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
}

export async function scanReceipt(file, onProgress) {
  OCR.onProgress = onProgress;
  const worker = await getOcrWorker();
  const canvas = await prepareImage(file);
  const { data } = await worker.recognize(canvas);
  OCR.onProgress = null;
  return { ...parseReceipt(data.text || ''), text: data.text || '' };
}


export function resetPhotoDb() { photoDb = null; }
