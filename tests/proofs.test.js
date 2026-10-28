// Justificatifs (IndexedDB), exports zip, micro-entreprise, règles de classement, ticket réparti, facture PDF.
const path = require('path');
const fs = require('fs');
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D } = require('./util');

const { check, done } = suite('justificatifs et règles');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const act = (p, fn, ...args) => p.evaluate(fn, ...args);
const submit = async (p) => { await act(p, () => document.getElementById('tx-form').requestSubmit()); await wait(500); };

(async () => {
  const H = await start();

  // Fichiers de test : une grande photo (à compresser) et une facture PDF générée par Chrome.
  const g = await H.browser.newPage();
  await g.setViewport({ width: 2400, height: 1600 });
  await g.setContent('<body style="margin:0;background:linear-gradient(45deg,#f59e0b,#10b981,#1e3a8a)"><h1 style="font:120px sans-serif;color:#fff;padding:200px">Ticket de test</h1></body>');
  await g.screenshot({ path: path.join(OUT, 'big-photo.png') });
  await g.setContent(`<body style="font:16px Arial;padding:40px"><h1>FNAC</h1><p>Facture n° F-2026-1012</p><p>Date : 12/10/2026</p>
    <table><tr><td>Casque Bluetooth</td><td>79,90</td></tr><tr><td>Câble USB-C</td><td>10,00</td></tr></table>
    <p>TOTAL TTC 89,90 €</p><p>Dont TVA 20% 14,98</p></body>`);
  await g.pdf({ path: path.join(OUT, 'facture.pdf'), format: 'A4' });
  await g.close();

  // 1. Photo jointe : compressée, enregistrée, miniature au journal, visionneuse.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '12,50'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Boulangerie'; });
    await (await p.$('#photo-file')).uploadFile(path.join(OUT, 'big-photo.png'), path.join(OUT, 'big-photo.png'));
    await p.waitForFunction(() => document.querySelectorAll('#tx-photos [data-photo]').length === 2, { timeout: 10000 });
    await act(p, () => document.querySelector('#tx-photos [data-photo]').click());
    await wait(300);
    check('visionneuse : 1 / 2, image affichée', await act(p, () => document.getElementById('dlg-photo').open && document.getElementById('photo-sub').textContent === '1 / 2' && !!document.querySelector('#photo-view img')));
    await act(p, () => document.getElementById('photo-next').click());
    await wait(200);
    check('visionneuse : suivant → 2 / 2', await act(p, () => document.getElementById('photo-sub').textContent === '2 / 2'));
    await act(p, () => document.getElementById('photo-delete').click());
    await wait(200);
    check('retirer une photo (avec « Annuler » proposé)', await act(p, () => document.querySelectorAll('#tx-photos [data-photo]').length === 1 && /Justificatif retiré/.test(document.getElementById('toasts').textContent)));
    await submit(p);
    const tx = (await S(p)).transactions.find((t) => t.note === 'Boulangerie');
    check('dépense enregistrée avec 1 justificatif', tx && tx.photos && tx.photos.length === 1, tx);
    const rec = await act(p, async (id) => { const r = await window.BudgetFold.Photos.get(id); return { type: r.type, size: r.size, w: r.w, h: r.h }; }, tx.photos[0]);
    check('photo compressée en JPEG ≤ 150 Ko et ≤ 1 200 px (photo de 2 400 px)', rec.type === 'image/jpeg' && rec.size <= 150 * 1024 && rec.w === 1200, rec);
    check('photos hors localStorage (dans IndexedDB)', await act(p, () => localStorage.getItem('budgetfold-os:v4').length < 20000));
    await act(p, () => window.BudgetFold.setTab('journal'));
    await wait(400);
    check('journal : miniature de la photo', await act(p, () => !!document.querySelector('#j-list .tx-thumb img')));
    check('journal : « 1 justificatif » dans le détail', await act(p, () => /1 justificatif/.test(document.getElementById('j-list').textContent)));
    await act(p, (id) => window.BudgetFold.actions.openTx(window.BudgetFold.getState().transactions.find((t) => t.id === id)), tx.id);
    await wait(300);
    check('modifier : la photo est rechargée dans la saisie', await act(p, () => document.querySelectorAll('#tx-photos [data-photo] img').length === 1));
    await act(p, () => document.querySelector('#tx-photos [data-photo]').click());
    await wait(200);
    await act(p, () => document.getElementById('photo-delete').click());
    await submit(p);
    check('justificatif retiré à l\'enregistrement', !(await S(p)).transactions.find((t) => t.id === tx.id).photos);
    await p.close();
  }

  // 2. Zip : aller-retour, sauvegarde complète avec photos, restauration.
  {
    const p = await H.open({ storage: clone(demo) });
    const round = await act(p, async () => {
      const B = window.BudgetFold;
      const bin = new Uint8Array([0, 1, 2, 250, 255]);
      const blob = B.makeZip([{ name: 'a.txt', data: 'Bonjour é€' }, { name: 'dir/b.bin', data: bin }]);
      const files = await B.readZip(await blob.arrayBuffer());
      return { a: new TextDecoder().decode(files.get('a.txt')), b: [...files.get('dir/b.bin')] };
    });
    check('zip : aller-retour texte et binaire', round.a === 'Bonjour é€' && JSON.stringify(round.b) === '[0,1,2,250,255]', round);
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '9'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Pharmacie'; });
    await (await p.$('#photo-file')).uploadFile(path.join(OUT, 'big-photo.png'));
    await p.waitForFunction(() => document.querySelectorAll('#tx-photos [data-photo]').length === 1);
    await submit(p);
    const backup = await act(p, async () => {
      const B = window.BudgetFold;
      const blob = await B.fullBackupZip();
      const files = await B.readZip(await blob.arrayBuffer());
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { names: [...files.keys()], json: JSON.parse(new TextDecoder().decode(files.get('budgetfold.json'))), b64: btoa(bin) };
    });
    const photoName = backup.names.find((n) => n.startsWith('photos/'));
    check('sauvegarde complète : budgetfold.json + photos/', backup.names.includes('budgetfold.json') && /^photos\/[\w-]+\.jpg$/.test(photoName || ''), backup.names);
    check('sauvegarde : format v4 lisible', backup.json.v === 4 && backup.json.transactions.some((t) => t.note === 'Pharmacie' && t.photos), backup.json.v);
    fs.writeFileSync(path.join(OUT, 'sauvegarde.zip'), Buffer.from(backup.b64, 'base64'));
    await p.close();

    const q = await H.open({ storage: clone(demo), init: () => { indexedDB.deleteDatabase('budgetfold-photos'); } });
    await act(q, () => window.BudgetFold.actions.importJson);
    const input = await q.$('#import-file');
    await input.uploadFile(path.join(OUT, 'sauvegarde.zip'));
    await q.waitForFunction(() => document.getElementById('dlg-confirm').open, { timeout: 10000 });
    await act(q, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(800);
    const restored = await act(q, async () => {
      const t = window.BudgetFold.getState().transactions.find((x) => x.note === 'Pharmacie');
      const rec = t && t.photos ? await window.BudgetFold.Photos.get(t.photos[0]) : null;
      return { tx: Boolean(t), photo: Boolean(rec && rec.blob && rec.blob.size > 0) };
    });
    check('import du .zip : opérations et photos restaurées', restored.tx && restored.photo, restored);
    await q.close();
  }

  // 3. Export « justificatifs » d'une période (CSV + photos).
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '23,40'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Fournitures; bureau'; });
    await (await p.$('#photo-file')).uploadFile(path.join(OUT, 'big-photo.png'));
    await p.waitForFunction(() => document.querySelectorAll('#tx-photos [data-photo]').length === 1);
    await submit(p);
    const res = await act(p, async () => {
      const B = window.BudgetFold;
      const r = await B.proofsZip({ from: '2026-10-01', to: '2026-10-31' });
      const files = await B.readZip(await r.blob.arrayBuffer());
      return { count: r.count, photos: r.photos, names: [...files.keys()], csv: new TextDecoder().decode(files.get('justificatifs.csv')) };
    });
    check('export justificatifs : tableau + photos de la période', res.names[0] === 'justificatifs.csv' && res.photos === 1 && res.names.some((n) => /^justificatifs\/2026-10-15_fournitures-bureau_.+\.jpg$/.test(n)), res.names);
    const lines = res.csv.replace(/^﻿/, '').trim().split('\r\n');
    check('CSV : en-tête, séparateur ;, montants avec virgule', lines[0] === 'Date;Libellé;Montant (€);Type;Enveloppe;Pro;Justificatifs' && lines.some((l) => l.startsWith('2026-10-15;"Fournitures; bureau";-23,40;Dépense;Courses;perso;2026-10-15_fournitures-bureau_')), lines.slice(0, 3));
    check('CSV : revenus en positif', lines.some((l) => /^2026-10-12;Vente Vinted;80,00;Revenu/.test(l)));
    await act(p, () => window.BudgetFold.actions.openProofs());
    check('feuille d\'export : période du mois et décompte', await act(p, () => document.getElementById('proofs-from').value === '2026-10-01' && /opérations, 1 justificatif/.test(document.getElementById('proofs-hint').textContent)));
    await p.close();
  }

  // 4. Mode micro-entreprise (taux et seuils saisis par l'utilisateur).
  {
    const p = await H.open({ storage: clone(demo) });
    check('aucun taux ni seuil par défaut', JSON.stringify((await S(p)).prefs.pro) === JSON.stringify({ enabled: false, rateBp: 0, ceiling: null, vatThreshold: null }));
    await act(p, () => document.getElementById('menu-settings').click());
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('set-pro').checked = true;
      $('set-pro-rate').value = '24,6';
      $('set-pro-ceiling').value = '77700';
      $('set-pro-vat').value = '37500';
      $('set-form').requestSubmit();
    });
    await wait(400);
    const pro = (await S(p)).prefs.pro;
    check('réglages pro enregistrés (24,6 % = 2 460 points de base)', pro.enabled && pro.rateBp === 2460 && pro.ceiling === 7770000 && pro.vatThreshold === 3750000, pro);
    const free0 = (await D(p)).free;
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'income' }));
    check('saisie : case « Opération pro » visible', await act(p, () => !document.getElementById('tx-pro-field').hidden));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '1000'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Facture client'; document.getElementById('tx-pro').checked = true; });
    await submit(p);
    const d = await D(p);
    check('CA pro du mois 1 000 € → 246 € de cotisations mises de côté', d.proIncome === 100000 && d.provision === 24600, { ca: d.proIncome, prov: d.provision });
    check('reste à vivre : +1 000 € de revenu − 246 € de cotisations', d.free === free0 + 100000 - 24600, { free: d.free, free0 });
    await act(p, () => window.BudgetFold.setTab('report'));
    const card = await act(p, () => ({ shown: !document.getElementById('r-pro').hidden, text: document.getElementById('r-pro').textContent }));
    check('bilan : carte micro-entreprise (CA, cotisations, seuils)', card.shown && /Chiffre d'affaires du mois/.test(card.text) && /Franchise de TVA/.test(card.text), card.text.slice(0, 120));
    await act(p, () => window.BudgetFold.actions.addTransaction({ type: 'income', amount: 3300000, date: '2026-06-10', note: 'Missions', pro: true }));
    await act(p, () => window.BudgetFold.setTab('home'));
    const ins = await act(p, () => document.getElementById('insights').textContent);
    check('alerte : franchise de TVA bientôt atteinte (34 000 € sur 37 500 €)', /Franchise de TVA bientôt atteint/.test(ins), ins.slice(0, 200));
    await act(p, () => window.BudgetFold.setTab('journal'));
    check('journal : étiquette « Pro »', await act(p, () => /Pro/.test(document.querySelector('#j-list .tag-pro') ? document.querySelector('#j-list .tag-pro').textContent : '')));
    await p.close();
  }

  // 5. Règles de classement : apprises, visibles, modifiables.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense' }));
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('tx-amount').value = '4,20'; $('tx-amount').dispatchEvent(new Event('input'));
      $('tx-label').value = 'Picard surgelés'; $('tx-label').dispatchEvent(new Event('input'));
      document.querySelector('#tx-chips [data-env="e1"]').click();
    });
    await submit(p);
    let rules = (await S(p)).rules;
    check('règle apprise automatiquement (« picard surgeles » → Courses)', rules.some((r) => r.key === 'picard surgeles' && r.envId === 'e1' && r.source === 'auto'), rules);
    await act(p, () => window.BudgetFold.actions.openRules());
    check('règles visibles, marquées « Apprise »', await act(p, () => /picard surgeles/.test([...document.querySelectorAll('.rule-edit-key')].map((i) => i.value).join(' ')) && /Apprise/.test(document.getElementById('rule-list').textContent)));
    await act(p, () => { document.getElementById('rule-key').value = 'Boulangerie'; document.getElementById('rule-env').value = 'e1'; document.getElementById('rule-form').requestSubmit(); });
    await wait(400);
    check('règle ajoutée à la main', await act(p, () => window.BudgetFold.guessEnvelope('BOULANGERIE DU COIN') === 'e1'));
    const dup = await act(p, () => window.BudgetFold.actions.saveCatRule({ key: 'boulangerie', envId: 'e2' }));
    check('doublon de règle refusé', !dup.ok, dup);
    await act(p, () => {
      const row = document.querySelector('.rule-row[data-key="boulangerie"]');
      row.querySelector('.rule-edit-env').value = 'e3';
      row.querySelector('.rule-edit-env').dispatchEvent(new Event('change', { bubbles: true }));
    });
    check('changer l\'enveloppe d\'une règle', await act(p, () => window.BudgetFold.guessEnvelope('boulangerie') === 'e3'));
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense' }));
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('tx-amount').value = '2'; $('tx-amount').dispatchEvent(new Event('input'));
      $('tx-label').value = 'Boulangerie'; $('tx-label').dispatchEvent(new Event('input'));
      document.querySelector('#tx-chips [data-env="e1"]').click();
    });
    await submit(p);
    check('une règle écrite à la main n\'est pas écrasée par l\'apprentissage', (await S(p)).rules.find((r) => r.key === 'boulangerie').envId === 'e3');
    await act(p, () => window.BudgetFold.actions.openRules());
    await act(p, () => document.querySelector('.rule-row[data-key="boulangerie"] .rule-del').click());
    rules = (await S(p)).rules;
    check('supprimer une règle (avec « Annuler »)', !rules.some((r) => r.key === 'boulangerie') && await act(p, () => /Règle « boulangerie » supprimée/.test(document.getElementById('toasts').textContent)));
    await p.close();
  }

  // 6. Ticket réparti à la main.
  {
    const p = await H.open({ storage: clone(demo) });
    const before = await D(p);
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '50'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Carrefour'; document.getElementById('tx-split-btn').click(); });
    const setRow = (i, amount, env) => act(p, (o) => {
      const row = document.querySelectorAll('#tx-split-rows .split-row')[o.i];
      const a = row.querySelector('.split-amount');
      a.value = o.amount; a.dispatchEvent(new Event('input', { bubbles: true }));
      const s = row.querySelector('.split-env');
      s.value = o.env; s.dispatchEvent(new Event('change', { bubbles: true }));
    }, { i, amount, env });
    await setRow(0, '30', 'e1');
    await setRow(1, '15', 'e3');
    await submit(p);
    check('répartition incomplète : refusée avec le détail', await act(p, () => /Les lignes font 45 € pour un total de 50 €/.test(document.getElementById('tx-error').textContent.replace(/[  ]/g, ' '))));
    await setRow(1, '20', 'e3');
    await submit(p);
    const s = await S(p);
    const parts = s.transactions.filter((t) => t.group);
    check('ticket réparti : 2 dépenses liées', parts.length === 2 && parts[0].group === parts[1].group && parts.every((t) => t.note === 'Carrefour'), parts);
    const after = await D(p);
    const row = (d, id) => d.spend.find((r) => r.id === id);
    check('30 € dans Courses, 20 € dans Sorties', row(after, 'e1').spent - row(before, 'e1').spent === 3000 && row(after, 'e3').spent - row(before, 'e3').spent === 2000);
    await act(p, () => document.querySelector('.toast-action').click());
    await wait(200);
    check('« Annuler » retire toute la répartition', !(await S(p)).transactions.some((t) => t.group));
    await p.close();
  }

  // 7. Facture PDF : texte lu sur l'appareil (pdf.js), PDF gardé comme justificatif.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd());
    await (await p.$('#scan-file')).uploadFile(path.join(OUT, 'facture.pdf'));
    await p.waitForFunction(() => document.getElementById('scan-status').hidden && (window.BudgetFold.ui.lastScan || !document.getElementById('tx-error').hidden), { timeout: 60000 });
    const got = await act(p, () => ({ amount: document.getElementById('tx-amount').value, label: document.getElementById('tx-label').value, date: document.getElementById('tx-date').value, hint: document.getElementById('tx-hint').textContent, err: document.getElementById('tx-error').textContent }));
    check('facture PDF : total 89,90 €', got.amount === '89,90', got);
    check('facture PDF : enseigne Fnac et date du 12/10/2026', got.label === 'Fnac' && got.date === '2026-10-12', got);
    check('facture PDF : « Facture lue »', /Facture lue/.test(got.hint), got.hint);
    const pdf = await act(p, async () => {
      const id = document.querySelector('#tx-photos [data-photo]').dataset.photo;
      const r = await window.BudgetFold.Photos.get(id);
      return r.type;
    });
    check('le PDF est gardé comme justificatif', pdf === 'application/pdf', pdf);
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
