// Lecture de tickets à partir du texte OCR (sans moteur OCR, donc rapide) : cas du BACKLOG §1.2.
const { start } = require('./harness');
const demo = require('./demo');
const { clone, suite } = require('./util');

const { check, done } = suite('tickets (texte)');

// Texte proche de ce que Tesseract a lu sur le vrai ticket Relay d'Avignon.
const RELAY = [
  'a. LAGAROERE TR FRANCE SNC',
  'RELAY',
  "GARE D'AVIGNON TGV",
  '84000 AVIGNON',
  'Tel 04 90 27 00 00',
  '26/01/2023 07:42 Caisse 2',
  'Qte Designation P.U. TTC Tx',
  '1 x CAFE EXPRESSO 1,60 1,60 10',
  '1 x SAN PELLEGRINO 50CL 8002270014901',
  '2,40 2,40 6',
  'TOTAL 4,00',
  'CB 4,00',
  'Tx TVA HT TVA TTC',
  '10 10,00% 1,45 0,15 1,60',
  'can (5) 5.50% 2,27 0,13 2,40',
  'Merci de votre visite'
].join('\n');

(async () => {
  const H = await start();
  const p = await H.open({ storage: clone(demo) });
  const parse = (text) => p.evaluate((t) => JSON.parse(JSON.stringify(window.BudgetFold.parseReceipt(t))), text);

  const r = await parse(RELAY);
  check('Relay : enseigne « Relay » (et non la raison sociale)', r.merchant === 'Relay', r.merchant);
  check('Relay : total 4,00 €', r.total === 400, r.total);
  check('Relay : 2 articles', r.items.length === 2, r.items);
  check('Relay : café expresso 1,60 € (format colonnes + code TVA « 10 »)', r.items[0] && /expresso/i.test(r.items[0].label) && r.items[0].amount === 160 && !/1,60|^1 /.test(r.items[0].label), r.items[0]);
  check('Relay : San Pellegrino 2,40 € (prix sur la ligne suivante, EAN retiré)', r.items[1] && /pellegrino/i.test(r.items[1].label) && r.items[1].amount === 240 && !/\d{8}/.test(r.items[1].label), r.items[1]);
  check('Relay : bloc TVA ignoré', !r.items.some((it) => /%|can|tva/i.test(it.label)), r.items);
  check('Relay : date ancienne gardée (26/01/2023) et signalée', r.date === '2023-01-26' && r.dateOld === true, { date: r.date, old: r.dateOld });

  const legal = await parse(RELAY.replace('RELAY\n', ''));
  check('raison sociale seule : « Lagardère Travel Retail » malgré la confusion OCR O/D', legal.merchant === 'Lagardère Travel Retail', legal.merchant);

  const rn = await parse('INTERRNARCHE\nCHOCOLAT 2,10\nTOTAL 2,10');
  check('confusion OCR rn/m : « INTERRNARCHE » (m lu rn) → Intermarché', rn.merchant === 'Intermarché', rn.merchant);

  const cols = await parse('BOULANGERIE DU PORT\n2 x CROISSANT 1,10 2,20 10\nBAGUETTE 1,20 1,20 5\nTOTAL 3,40');
  check('colonnes P.U. ≠ TTC : on garde le TTC (2,20 €)', cols.items[0] && cols.items[0].amount === 220 && cols.items[0].label === 'Croissant', cols.items);
  check('colonnes : 2 articles, somme = total', cols.items.length === 2 && cols.itemsSum === 340 && cols.total === 340, cols);

  const recent = await parse('LIDL\n14/10/2026\nPAIN 1,00\nTOTAL 1,00');
  check('date récente : pas d\'avertissement', recent.date === '2026-10-14' && recent.dateOld === false, recent);
  const future = await parse('LIDL\n14/10/2031\nPAIN 1,00\nTOTAL 1,00');
  check('date dans le futur (lecture fausse) : ignorée', future.date === null, future.date);

  const lidl = await parse('LIDL\n13 AV FOCH\n15/10/26 12:01\nBANANES 1,49 A\nEMMENTAL RAPE 2,1O B\nCHIPS NATURE 0,99 A\nREMISE FIDELITE -0,50\nTOTAL 4,08\nCARTE BANCAIRE 4,08 EUR\nRENDU 0,00');
  check('Lidl : total 4,08, 4 lignes dont la remise, « 2,1O » corrigé', lidl.merchant === 'Lidl' && lidl.total === 408 && lidl.items.length === 4 && lidl.items[1].amount === 210, lidl);

  const pct = await parse('MONOPRIX\nREMISE 10% SUR LE LOT\nPOMMES 2,00\nTOTAL 2,00');
  check('ligne avec % jamais prise pour un article', pct.items.length === 1 && pct.items[0].amount === 200, pct.items);

  await p.close();
  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
