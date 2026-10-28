// Usage quotidien : saisie rapide, favoris, étiquettes et recherche, comptes et rapprochement,
// préréglages bancaires, abonnements repérés, export .ics, rappels.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S, D } = require('./util');

const { check, done } = suite('usage quotidien');
const act = (p, fn, ...args) => p.evaluate(fn, ...args);
const submit = async (p) => { await act(p, () => document.getElementById('tx-form').requestSubmit()); await wait(450); };
const sp = (s) => String(s).replace(/[  ]/g, ' ');

(async () => {
  const H = await start();

  // 1. Saisie en 3 touches : montants fréquents, dernière enveloppe proposée.
  {
    const s = clone(demo);
    s.transactions.push({ id: 'c1', type: 'expense', envId: 'e3', amount: 250, date: '2026-10-02', note: 'Café', ts: 1 }, { id: 'c2', type: 'expense', envId: 'e3', amount: 250, date: '2026-10-06', note: 'Café', ts: 2 });
    s.prefs.lastEnvId = 'e3';
    const p = await H.open({ storage: s });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense' }));
    const quick = await act(p, () => [...document.querySelectorAll('#tx-quick [data-amount]')].map((b) => b.dataset.amount));
    check('montants fréquents proposés (2,50 € saisi 2 fois)', quick.includes('250') && !quick.includes('6420'), quick);
    check('dernière enveloppe (Sorties) déjà choisie', await act(p, () => document.querySelector('#tx-chips [data-env="e3"]').getAttribute('aria-checked') === 'true'));
    await act(p, () => document.querySelector('#tx-quick [data-amount="250"]').click());
    check('toucher un montant le remplit', await act(p, () => document.getElementById('tx-amount').value === '2,50'));
    await submit(p);
    check('3 touches : + → 2,50 € → Ajouter', (await S(p)).transactions.filter((t) => t.amount === 250 && t.envId === 'e3').length === 3);
    await p.close();
  }

  // 2. Favoris : créés depuis la saisie, utilisés en un toucher, suggérés, gérés.
  {
    const s = clone(demo);
    for (const [i, d] of ['2026-10-02', '2026-10-06', '2026-10-09'].entries()) s.transactions.push({ id: `b${i}`, type: 'expense', envId: 'e1', amount: 120, date: d, note: 'Baguette', ts: i + 1 });
    const p = await H.open({ storage: s });
    const sugg = await act(p, () => [...document.querySelectorAll('#favs-list .is-suggestion')].map((b) => b.textContent));
    check('suggestion de favori : « Baguette » saisie 3 fois', sugg.some((t) => /Baguette/.test(t)), sugg);
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e3' }));
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('tx-amount').value = '3,20'; $('tx-amount').dispatchEvent(new Event('input'));
      $('tx-label').value = 'Café'; $('tx-fav').checked = true;
    });
    await submit(p);
    const favs = (await S(p)).favorites;
    check('« Enregistrer en favori » : favori créé', favs.length === 1 && favs[0].label === 'Café' && favs[0].amount === 320 && favs[0].envId === 'e3', favs);
    const n0 = (await S(p)).transactions.length;
    await act(p, () => document.querySelector('#favs-list [data-fav]').click());
    await wait(300);
    const last = (await S(p)).transactions.slice(-1)[0];
    check('toucher le favori ajoute la dépense du jour', (await S(p)).transactions.length === n0 + 1 && last.note === 'Café' && last.amount === 320 && last.envId === 'e3' && last.date === '2026-10-15', last);
    await act(p, () => document.querySelector('.toast:last-child .toast-action').click());
    await wait(200);
    check('« Annuler » retire la dépense', (await S(p)).transactions.length === n0);
    await act(p, () => document.querySelector('#favs-list .is-suggestion').click());
    check('suggestion acceptée : nouveau favori', (await S(p)).favorites.length === 2);
    await act(p, () => document.getElementById('favs-manage').click());
    await act(p, () => document.querySelector('#favs-manage-list [data-del]').click());
    check('gérer : supprimer un favori', (await S(p)).favorites.length === 1);
    await p.close();
  }

  // 3. Étiquettes et recherche.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: null }));
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('tx-amount').value = '45'; $('tx-amount').dispatchEvent(new Event('input'));
      $('tx-label').value = 'Fleurs'; $('tx-tags').value = 'Vacances, #cadeau, vacances';
    });
    await submit(p);
    const t = (await S(p)).transactions.find((x) => x.note === 'Fleurs');
    check('étiquettes nettoyées (minuscules, sans doublon)', JSON.stringify(t.tags) === '["vacances","cadeau"]', t.tags);
    await act(p, () => window.BudgetFold.setTab('journal'));
    const search = async (q, scope = 'month') => act(p, (o) => {
      const s = document.getElementById('j-search');
      s.value = o.q; s.dispatchEvent(new Event('input'));
      const sc = document.getElementById('j-scope');
      sc.value = o.scope; sc.dispatchEvent(new Event('change'));
      return { n: document.querySelectorAll('#j-list .tx-row').length, txt: document.getElementById('j-list').textContent, res: document.getElementById('j-results').textContent };
    }, { q, scope });
    let r = await search('#vac');
    check('recherche par #étiquette', r.n === 1 && /Fleurs/.test(r.txt) && /#vacances #cadeau/.test(r.txt), r);
    r = await search('64,20');
    check('recherche par montant exact', r.n === 1 && /Carrefour/.test(r.txt), r);
    r = await search('marche');
    check('recherche texte sans accents', r.n === 1 && /Marché/.test(r.txt), r);
    r = await search('billet');
    check('période « ce mois » : rien en octobre', r.n === 0 && /0 résultat/.test(r.res), r);
    r = await search('billet', 'all');
    check('période « tout » : le billet de novembre trouvé', r.n === 1 && /Billet de train/.test(r.txt), r);
    await p.close();
  }

  // 4. Comptes, virements, rapprochement.
  {
    const p = await H.open({ storage: clone(demo) });
    const main = await act(p, () => { const B = window.BudgetFold; const a = B.getState().accounts[0]; return { a, bal: B.accountBalance(a, '2026-10-15') }; });
    const expect = await act(p, () => {
      const st = window.BudgetFold.getState();
      return 40000 + 185000 + st.transactions.filter((t) => t.date >= '2026-10-01' && t.date <= '2026-10-15').reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
    });
    check('compte courant créé depuis le solde des réglages (400 € au 1er)', main.a.name === 'Compte courant' && main.a.opening === 40000 && main.a.openingDate === '2026-09-30', main.a);
    check('solde du compte = départ + salaire du 3 + revenus − dépenses', main.bal === expect, { bal: main.bal, expect });
    await act(p, () => window.BudgetFold.actions.openAccounts());
    await act(p, () => {
      const $ = (id) => document.getElementById(id);
      $('acc-new-box').open = true;
      $('acc-new-name').value = 'Livret A'; $('acc-new-kind').value = 'savings'; $('acc-new-balance').value = '1000';
      $('acc-new-form').requestSubmit();
    });
    await wait(400);
    const accs = (await S(p)).accounts;
    const livret = accs.find((a) => a.name === 'Livret A');
    check('compte « Livret A » ajouté avec son solde', livret && livret.kind === 'savings' && livret.opening === 100000);
    const free0 = (await D(p)).free;
    await act(p, (id) => {
      const $ = (x) => document.getElementById(x);
      $('acc-transfer-amount').value = '200'; $('acc-transfer-to').value = id;
      $('acc-transfer-form').requestSubmit();
    }, livret.id);
    await wait(400);
    const bals = await act(p, (id) => { const B = window.BudgetFold; const st = B.getState(); return [B.accountBalance(st.accounts[0]), B.accountBalance(st.accounts.find((a) => a.id === id))]; }, livret.id);
    check('virement 200 € : courant −200, livret +200', bals[0] === expect - 20000 && bals[1] === 120000, bals);
    check('virement : reste à vivre inchangé', (await D(p)).free === free0);
    const bank = bals[0] - 1234;
    await act(p, (b) => {
      const form = document.querySelector('.acc-reconcile[data-id="main"]');
      form.querySelector('.acc-bank').value = (b / 100).toFixed(2).replace('.', ',');
      form.requestSubmit();
    }, bank);
    await wait(200);
    const diff = await act(p, () => document.querySelector('.acc-card[data-id="main"] .acc-diff').textContent);
    check('rapprochement : « l\'app dit X, ta banque dit Y : écart de −12,34 € »', /L'app dit/.test(diff) && /ta banque dit/.test(diff) && /écart de −12,34/.test(sp(diff)), diff);
    await act(p, () => document.querySelector('.acc-adjust').click());
    await wait(300);
    const adj = (await S(p)).transactions.find((t) => t.adjust);
    check('ajustement guidé : dépense de 12,34 € hors enveloppe', adj && adj.type === 'expense' && adj.amount === 1234 && !adj.envId, adj);
    check('après ajustement : l\'app dit comme la banque', (await act(p, () => window.BudgetFold.accountBalance(window.BudgetFold.getState().accounts[0]))) === bank);
    check('l\'ajustement touche le reste à vivre (dépense oubliée)', (await D(p)).free === free0 - 1234);
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    const accChips = await act(p, () => !document.getElementById('tx-account-field').hidden && document.querySelectorAll('#tx-accounts [data-account]').length);
    check('saisie : choix du compte dès qu\'il y en a plusieurs', accChips === 2, accChips);
    await act(p, () => window.BudgetFold.setTab('journal'));
    check('journal : virement « Compte courant → Livret A »', await act(p, () => /Virement · Compte courant → Livret A/.test(document.getElementById('j-list').textContent)));
    await p.close();
  }

  // 5. Import CSV : préréglages bancaires, doublons à ±2 jours.
  {
    const p = await H.open({ storage: clone(demo) });
    const res = await act(p, () => {
      const B = window.BudgetFold;
      const ca = 'Téléchargement du 15/10/2026\nCompte de dépôt n° 123\n\nDate;Libellé;Débit euros;Crédit euros;\n09/10/2026;"PRLV NAVIGO";29,00;;\n12/10/2026;"VIR SALAIRE";;1850,00;\n';
      const bourso = 'dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n2026-10-13;2026-10-13;"CARTE 12/10 MONOP";"Alimentation";"Vie quotidienne";"monop";-12,40;;123;"Compte";1000\n';
      const lcl = '13/10/2026;-8,90;CB;;CINEMA PATHE;\n14/10/2026;-3,50;CB;;BOULANGERIE;\n';
      const revolut = 'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-10-10 12:00:00,2026-10-11 09:00:00,Uber,-14.20,0.00,EUR,COMPLETED,100.00\n';
      const n26 = '"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)"\n"2026-10-10","Lidl","","MasterCard Payment","","-23.10"\n';
      const pick = (r) => r.rows.map((x) => [x.date, x.label, x.amount]);
      return {
        ca: pick(B.parseStatement(ca, 'ca')), bourso: pick(B.parseStatement(bourso, 'bourso')), lcl: pick(B.parseStatement(lcl, 'lcl')),
        revolut: pick(B.parseStatement(revolut, 'revolut')), n26: pick(B.parseStatement(n26, 'n26')), n26auto: pick(B.parseStatement(n26))
      };
    });
    check('préréglage Crédit Agricole (en-tête après le préambule, débit/crédit)', JSON.stringify(res.ca) === JSON.stringify([['2026-10-09', 'PRLV NAVIGO', -2900], ['2026-10-12', 'VIR SALAIRE', 185000]]), res.ca);
    check('préréglage Boursorama', JSON.stringify(res.bourso) === JSON.stringify([['2026-10-13', 'CARTE 12/10 MONOP', -1240]]), res.bourso);
    check('préréglage LCL (sans en-tête)', res.lcl.length === 2 && res.lcl[0][1] === 'CINEMA PATHE' && res.lcl[0][2] === -890, res.lcl);
    check('préréglage Revolut (date de débit, point décimal)', JSON.stringify(res.revolut) === JSON.stringify([['2026-10-11', 'Uber', -1420]]), res.revolut);
    check('N26 : libellé « Payee » reconnu, aussi en détection automatique', res.n26[0][1] === 'Lidl' && res.n26auto[0][1] === 'Lidl', [res.n26, res.n26auto]);
    const csv = 'Date;Libellé;Montant\n09/10/2026;PRLV NAVIGO;-29,00\n13/10/2026;FNAC;-35,00\n';
    await act(p, (text) => window.BudgetFold.actions.startCsvImport(new File([text], 'releve.csv', { type: 'text/csv' }), 'auto'), csv);
    await wait(400);
    const rows = await act(p, () => [...document.querySelectorAll('#imp-list .import-row')].map((r) => r.textContent));
    check('doublon probable à ±2 jours (Navigo du 8 déjà saisi)', rows.some((t) => /NAVIGO/.test(t) && /doublon possible/.test(t)) && rows.some((t) => /FNAC/.test(t) && !/doublon/.test(t)), rows);
    check('import : choix de la banque proposé', await act(p, () => document.querySelectorAll('#imp-preset option').length >= 10));
    await p.close();
  }

  // 6. Abonnements repérés (historique et import).
  {
    const s = clone(demo);
    const add = (id, note, amount, date) => s.transactions.push({ id, type: 'expense', envId: null, amount, date, note, ts: 1 });
    ['2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03'].forEach((d, i) => add(`sp${i}`, 'SPOTIFY P1234', 1099, d));
    ['2026-08-11', '2026-09-10', '2026-10-12'].forEach((d, i) => add(`gym${i}`, 'BASIC FIT', 2990, d));
    ['2026-07-20', '2026-09-02', '2026-10-01'].forEach((d, i) => add(`irr${i}`, 'AMAZON', 1500, d));
    ['2026-07-22', '2026-08-22', '2026-09-22'].forEach((d, i) => add(`nf${i}`, 'NETFLIX.COM', 1349, d));
    const p = await H.open({ storage: s });
    const subs = await act(p, () => window.BudgetFold.detectSubscriptions().map((x) => [x.label, x.freq, x.amount, x.count]));
    check('abonnements repérés : Spotify et salle de sport, chaque mois', subs.length === 2 && subs.some((x) => x[0] === 'SPOTIFY P1234' && x[1] === 'month' && x[3] === 4) && subs.some((x) => x[0] === 'BASIC FIT'), subs);
    check('ni paiement irrégulier, ni abonnement déjà à l\'échéancier (Netflix)', !subs.some((x) => /AMAZON|NETFLIX/.test(x[0])), subs);
    await act(p, () => window.BudgetFold.setTab('agenda'));
    await act(p, () => document.getElementById('rec-detect').click());
    const n0 = (await S(p)).transactions.length;
    await act(p, () => document.querySelector('#subs-list .sub-add').click());
    await wait(300);
    const st = await S(p);
    const rule = st.recurring.find((r) => r.label === 'BASIC FIT' || r.label === 'SPOTIFY P1234');
    check('ajouté à l\'échéancier sans recréer les paiements déjà présents', rule && rule.freq === 'month' && rule.postedUntil === '2026-10-15' && st.transactions.length === n0, rule);
    check('liste mise à jour : 1 abonnement restant', await act(p, () => document.querySelectorAll('#subs-list .sub-row').length === 1));
    await p.close();

    const q = await H.open({ storage: clone(demo) });
    const csv = 'Date;Libellé;Montant\n05/08/2026;DEEZER;-11,99\n05/09/2026;DEEZER;-11,99\n06/10/2026;DEEZER;-11,99\n';
    await act(q, (text) => window.BudgetFold.actions.startCsvImport(new File([text], 'r.csv', { type: 'text/csv' }), 'auto'), csv);
    await wait(400);
    check('import : abonnement repéré et proposé (coché)', await act(q, () => !document.getElementById('imp-subs').hidden && /DEEZER/.test(document.getElementById('imp-subs').textContent) && document.querySelector('#imp-subs .sub-check').checked));
    await act(q, () => document.getElementById('imp-confirm').click());
    await wait(400);
    check('import validé : Deezer ajouté à l\'échéancier', (await S(q)).recurring.some((r) => r.label === 'DEEZER' && r.freq === 'month'));
    await q.close();
  }

  // 7. Export .ics, rappels à l'ouverture, raccourci #add-income.
  {
    const p = await H.open({ storage: clone(demo), today: '2026-10-21' });
    const ics = await act(p, () => window.BudgetFold.buildIcs());
    const lines = ics.text.split('\r\n');
    check('.ics : calendrier valide (VCALENDAR, CRLF, lignes ≤ 75 octets)', lines[0] === 'BEGIN:VCALENDAR' && ics.text.endsWith('END:VCALENDAR\r\n') && lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75), lines.find((l) => Buffer.byteLength(l, 'utf8') > 75));
    check('.ics : loyer mensuel avec RRULE et alarme la veille', /SUMMARY:− 620 € · Loyer/.test(sp(ics.text)) && /RRULE:FREQ=MONTHLY/.test(ics.text) && /TRIGGER:-PT15H/.test(ics.text));
    check('.ics : assurance annuelle et dépense prévue (billet du 20/11)', /RRULE:FREQ=YEARLY/.test(ics.text) && /DTSTART;VALUE=DATE:20261120/.test(ics.text));
    check('rappel à l\'ouverture : « Demain : Netflix »', await act(p, () => /Demain : Netflix \(13,49/.test(document.getElementById('toasts').textContent.replace(/[  ]/g, ' '))));
    await p.reload({ waitUntil: 'networkidle0' });
    await wait(400);
    check('un seul rappel par jour', !(await act(p, () => /Demain/.test(document.getElementById('toasts').textContent))));
    await act(p, () => { location.hash = '#add-income'; });
    await wait(300);
    check('lien #add-income : saisie d\'un revenu', await act(p, () => document.getElementById('dlg-tx').open && document.getElementById('tx-mode-income').checked));
    await act(p, () => document.getElementById('dlg-tx').close());
    await act(p, () => document.getElementById('menu-shortcut').click());
    check('raccourci : lien #add affiché', await act(p, () => /#add$/.test(document.getElementById('shortcut-url').value)));
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
