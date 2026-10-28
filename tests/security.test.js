// Données et sécurité : sauvegarde chiffrée, verrou (code et Face ID), transfert par QR code,
// effacement complet, nouvelle version, confidentialité, chaîne de migrations v1 → v4.
const path = require('path');
const fs = require('fs');
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S } = require('./util');

const { check, done } = suite('données et sécurité');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const act = (p, fn, ...args) => p.evaluate(fn, ...args);
const PASS = 'motdepasse-solide';

(async () => {
  const H = await start();

  // 1. Sauvegarde chiffrée (données + photos), restauration avec le mot de passe.
  {
    const p = await H.open({ storage: clone(demo) });
    const g = await H.browser.newPage();
    await g.setContent('<body style="margin:0;background:#10b981;width:800px;height:600px"></body>');
    await g.screenshot({ path: path.join(OUT, 'proof.png') });
    await g.close();
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense', envId: 'e1' }));
    await act(p, () => { const a = document.getElementById('tx-amount'); a.value = '42'; a.dispatchEvent(new Event('input')); document.getElementById('tx-label').value = 'Marqueur secret'; });
    await (await p.$('#photo-file')).uploadFile(path.join(OUT, 'proof.png'));
    await p.waitForFunction(() => document.querySelectorAll('#tx-photos [data-photo]').length === 1);
    await act(p, () => document.getElementById('tx-form').requestSubmit());
    await wait(500);
    const short = await act(p, async () => (await window.BudgetFold.actions.encryptedBackup('court')).error);
    check('mot de passe trop court refusé', /8 caractères/.test(short || ''), short);
    const file = await act(p, async (pw) => {
      const res = await window.BudgetFold.actions.encryptedBackup(pw);
      return res.ok ? await res.data.text() : null;
    }, PASS);
    const env = JSON.parse(file);
    check('fichier chiffré : AES-GCM, PBKDF2 310 000 itérations, sel et IV aléatoires', env.format === 'budgetfold-encrypted' && env.cipher === 'AES-GCM' && env.iterations === 310000 && env.salt && env.iv && env.content === 'zip', Object.keys(env));
    check('aucune donnée lisible en clair dans le fichier', !/Marqueur|Courses|salary/.test(file) && !/Marqueur/.test(Buffer.from(env.data, 'base64').toString('latin1')));
    fs.writeFileSync(path.join(OUT, 'sauvegarde.bfold'), file);
    await p.close();

    const q = await H.open({ storage: clone(demo), init: () => { indexedDB.deleteDatabase('budgetfold-photos'); } });
    await (await q.$('#import-file')).uploadFile(path.join(OUT, 'sauvegarde.bfold'));
    await q.waitForFunction(() => document.getElementById('dlg-password').open, { timeout: 10000 });
    await act(q, () => { document.getElementById('pw-input').value = 'mauvais-mot-de-passe'; document.getElementById('pw-form').requestSubmit(); });
    await wait(1500);
    check('mauvais mot de passe : refusé', await act(q, () => document.getElementById('dlg-password').open && /incorrect/.test(document.getElementById('pw-error').textContent)));
    await act(q, (pw) => { document.getElementById('pw-input').value = pw; document.getElementById('pw-form').requestSubmit(); }, PASS);
    await q.waitForFunction(() => document.getElementById('dlg-confirm').open, { timeout: 15000 });
    await act(q, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(800);
    const restored = await act(q, async () => {
      const t = window.BudgetFold.getState().transactions.find((x) => x.note === 'Marqueur secret');
      const rec = t && t.photos ? await window.BudgetFold.Photos.get(t.photos[0]) : null;
      return { tx: Boolean(t), photo: Boolean(rec && rec.blob.size > 0) };
    });
    check('bon mot de passe : opérations et photos restaurées', restored.tx && restored.photo, restored);
    await q.close();
  }

  // 2. Verrou par code (haché), Face ID / empreinte via WebAuthn.
  {
    const p = await H.open({ storage: clone(demo) });
    const bad = await act(p, async () => (await window.BudgetFold.actions.setPin('12a')).ok);
    check('code invalide refusé', bad === false);
    await act(p, () => window.BudgetFold.actions.openSecurity());
    await act(p, () => { document.getElementById('sec-pin').value = '2468'; document.getElementById('sec-pin2').value = '2468'; document.getElementById('sec-pin-form').requestSubmit(); });
    await wait(800);
    const lock = (await S(p)).prefs.lock;
    check('code enregistré haché (jamais en clair)', lock.enabled && lock.hash && lock.salt && !JSON.stringify(lock).includes('2468'), lock);
    await p.reload({ waitUntil: 'networkidle0' });
    await wait(600);
    check('au démarrage : app verrouillée, contenu inaccessible', await act(p, () => !document.getElementById('lock').hidden && document.querySelector('.app-shell').inert));
    await act(p, () => { document.getElementById('lock-pin').value = '1111'; document.getElementById('lock-form').requestSubmit(); });
    await wait(800);
    check('mauvais code : reste verrouillée', await act(p, () => !document.getElementById('lock').hidden && /incorrect/.test(document.getElementById('lock-error').textContent)));
    await act(p, () => { document.getElementById('lock-pin').value = '2468'; document.getElementById('lock-form').requestSubmit(); });
    await wait(800);
    check('bon code : déverrouillée', await act(p, () => document.getElementById('lock').hidden && !document.querySelector('.app-shell').inert));

    const cdp = await p.target().createCDPSession();
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } });
    const bio = await act(p, async () => (await window.BudgetFold.actions.enableBiometric()).ok);
    check('Face ID / empreinte activé (authentificateur de l\'appareil)', bio && Boolean((await S(p)).prefs.lock.credId));
    await act(p, () => window.BudgetFold.actions.lockApp());
    check('verrouillée : bouton Face ID proposé', await act(p, () => !document.getElementById('lock-bio').hidden));
    await act(p, () => document.getElementById('lock-bio').click());
    await wait(1200);
    check('Face ID : déverrouillée sans le code', await act(p, () => document.getElementById('lock').hidden));
    await act(p, () => window.BudgetFold.actions.disableLock());
    await p.reload({ waitUntil: 'networkidle0' });
    await wait(500);
    check('code retiré : plus de verrou', await act(p, () => document.getElementById('lock').hidden));
    await p.close();
  }

  // 3. Transfert vers un autre appareil par QR code (lien #import=…, chiffré).
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openSecurity());
    await act(p, (pw) => { document.getElementById('sec-password').value = pw; document.getElementById('sec-qr').click(); }, PASS);
    await p.waitForFunction(() => !document.getElementById('sec-qr-box').hidden, { timeout: 15000 });
    const qr = await act(p, () => ({ svg: !!document.querySelector('#sec-qr-img svg'), link: document.getElementById('sec-qr-link').value }));
    check('QR code affiché avec le lien de transfert', qr.svg && /#import=[A-Za-z0-9_-]+$/.test(qr.link) && qr.link.length <= 2300, qr.link.length);
    check('le lien ne contient aucune donnée lisible', !/Courses|Loyer/.test(decodeURIComponent(qr.link)));
    await p.close();

    const url = new URL(qr.link);
    const q = await H.open({ init: () => localStorage.clear(), page: `/${url.hash}` });
    await q.waitForFunction(() => document.getElementById('dlg-password').open, { timeout: 10000 });
    await act(q, (pw) => { document.getElementById('pw-input').value = pw; document.getElementById('pw-form').requestSubmit(); }, PASS);
    await q.waitForFunction(() => document.getElementById('dlg-confirm').open, { timeout: 15000 });
    await act(q, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(600);
    const s = await S(q);
    check('autre appareil : données reçues (enveloppes, échéancier, opérations)', s.envelopes.some((e) => e.name === 'Courses') && s.recurring.length === 6 && s.salary === 185000, s.envelopes.length);
    check('le lien est retiré de la barre d\'adresse', await act(q, () => !location.hash.includes('import')));
    await q.close();

    const big = clone(demo);
    for (let i = 0; i < 400; i++) big.transactions.push({ id: `x${i}`, type: 'expense', envId: 'e1', amount: 100 + i, date: '2026-09-10', note: `Achat numéro ${i} chez un commerçant`, ts: i });
    const r = await H.open({ storage: big });
    const tooBig = await act(r, async (pw) => (await window.BudgetFold.actions.transferLink(pw)).error, PASS);
    check('trop de données pour un QR : on propose la sauvegarde chiffrée', /sauvegarde chiffrée/.test(tooBig || ''), tooBig);
    await r.close();
  }

  // 4. Tout effacer (données, photos, cache), confidentialité, nouvelle version.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, async () => { await window.BudgetFold.Photos.put({ id: 'p-test', blob: new Blob(['x']), type: 'image/jpeg', createdAt: 0 }); });
    await act(p, () => document.getElementById('foot-privacy').click());
    const priv = await act(p, () => ({ open: document.getElementById('dlg-privacy').open, txt: document.getElementById('dlg-privacy').textContent }));
    check('page Confidentialité : ce qui est stocké, où, ce qui est chargé, droits', priv.open && /budgetfold-os:v4/.test(priv.txt) && /IndexedDB/.test(priv.txt) && /RGPD/.test(priv.txt) && /Aucun compte/.test(priv.txt), priv.txt.slice(0, 80));
    await act(p, () => document.getElementById('privacy-wipe').click());
    await wait(200);
    await act(p, () => document.querySelector('#dlg-confirm [value="confirm"]').click());
    await wait(800);
    const after = await act(p, async () => ({
      v3: localStorage.getItem('budgetfold-os:v3'), photos: (await window.BudgetFold.Photos.all()).length,
      env: window.BudgetFold.getState().envelopes.length, welcome: document.getElementById('dlg-welcome').open
    }));
    check('tout effacer : anciennes clés, photos et données supprimées, accueil rouvert', after.v3 === null && after.photos === 0 && after.env === 0 && after.welcome, after);
    await act(p, () => window.BudgetFold.actions.showUpdate({ postMessage: (m) => { window.__msg = m; } }));
    check('nouvelle version : bandeau « Mettre à jour »', await act(p, () => !document.getElementById('update-bar').hidden));
    await act(p, () => document.getElementById('update-go').click());
    check('« Mettre à jour » demande au nouveau service worker de prendre la main', await act(p, () => window.__msg && window.__msg.type === 'SKIP_WAITING'));
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    check('service worker : pas de prise de main forcée à l\'installation', !/install[\s\S]*?skipWaiting\(\)[\s\S]*?message/.test(sw) && /SKIP_WAITING/.test(sw));
    await p.close();
  }

  // 5. Chaîne de migrations : chaque ancienne version devient v4, champ v toujours présent.
  {
    const p = await H.open({ storage: clone(demo) });
    const res = await act(p, () => {
      const B = window.BudgetFold;
      const v1 = { salary: 120000, envelopes: [{ id: 'a', name: 'Courses', max: 25000, spent: 1000 }] };
      const v2 = { v: 2, salary: 150000, salaryDay: 5, envelopes: [{ id: 'e', kind: 'spend', name: 'Loisirs', max: 5000 }], recurring: [{ id: 'r', type: 'charge', label: 'Loyer', amount: 50000, day: 1 }], transactions: [] };
      const v3 = { v: 3, salary: 180000, salaryDay: 1, envelopes: [{ id: 'p', kind: 'project', name: 'Voyage', target: 100000, saved: 0, monthly: 10000, mode: 'active' }], recurring: [], transactions: [] };
      return [v1, v2, v3].map((raw) => {
        B.setState(JSON.parse(JSON.stringify(raw)));
        const st = B.getState();
        return { v: st.v, lock: st.prefs.lock.enabled, theme: st.prefs.theme, accounts: st.accounts.length, cycle: st.prefs.cycle };
      });
    });
    check('v1, v2, v3 → v4 : champ v = 4, valeurs par défaut sûres', res.every((r) => r.v === 4 && r.lock === false && r.theme === 'auto' && r.accounts === 1 && r.cycle === 'calendar'), res);
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
