// Interface (phase 7) : thèmes et contrastes, texte agrandi, couleurs et icônes, pastilles, raccourcis de date,
// visite guidée, aide et glossaire, questionnaire relancé, accessibilité, mobile.
const { start } = require('./harness');
const demo = require('./demo');
const { wait, clone, suite, S } = require('./util');

const { check, done } = suite('interface');
const act = (p, fn, ...args) => p.evaluate(fn, ...args);

// Contrastes WCAG calculés dans la page à partir des variables CSS du thème actif.
const contrasts = (p) => p.evaluate(() => {
  const probe = document.createElement('span');
  document.body.append(probe);
  const rgb = (v) => {
    probe.style.color = '';
    probe.style.color = v;
    return getComputedStyle(probe).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  };
  const lum = (c) => {
    const [r, g, b] = c.map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cv = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pairs = {
    'ink/surface': [cv('--ink'), cv('--surface'), 4.5], 'ink/bg': [cv('--ink'), cv('--bg'), 4.5], 'ink-2/surface': [cv('--ink-2'), cv('--surface'), 4.5],
    'ink-2/fill': [cv('--ink-2'), cv('--fill'), 4.5], 'ink-3/surface': [cv('--ink-3'), cv('--surface'), 3], 'accent/surface': [cv('--accent'), cv('--surface'), 4.5],
    'emerald-ink/emerald-soft': [cv('--emerald-ink'), cv('--emerald-soft'), 4.5], 'rose-ink/rose-soft': [cv('--rose-ink'), cv('--rose-soft'), 4.5],
    'amber-ink/amber-soft': [cv('--amber-ink'), cv('--amber-soft'), 4.5], 'blanc/navy-1': ['#fff', cv('--navy-1'), 4.5],
    'indigo-ink/indigo-soft': [cv('--indigo-ink'), cv('--indigo-soft'), 4.5]
  };
  const out = Object.fromEntries(Object.entries(pairs).map(([k, [a, b, min]]) => [k, { r: Math.round(ratio(a, b) * 100) / 100, min }]));
  probe.remove();
  return out;
});

(async () => {
  const H = await start();

  // 1. Thèmes : choix dans les réglages, contrastes vérifiés, aucune surface claire restée en dur en sombre.
  {
    const p = await H.open({ storage: clone(demo) });
    check('thème « auto » par défaut (système clair → clair)', await act(p, () => document.documentElement.dataset.theme === 'light'));
    for (const theme of ['light', 'dark', 'rose', 'candy']) {
      await act(p, () => document.getElementById('menu-settings').click());
      await act(p, (t) => document.querySelector(`[data-theme-pick="${t}"]`).click(), theme);
      const applied = await act(p, () => document.documentElement.dataset.theme);
      const c = await contrasts(p);
      const bad = Object.entries(c).filter(([, v]) => v.r < v.min);
      check(`thème ${theme} : appliqué, contrastes suffisants (WCAG)`, applied === theme && !bad.length, bad);
      await act(p, () => document.getElementById('dlg-settings').close());
    }
    check('thème mémorisé', (await S(p)).prefs.theme === 'candy');
    await act(p, () => document.getElementById('menu-settings').click());
    await act(p, () => document.querySelector('[data-theme-pick="dark"]').click());
    await act(p, () => document.getElementById('dlg-settings').close());
    const leaks = await act(p, () => {
      const lum = (el) => { const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g); if (!m || (m[3] !== undefined && Number(m[3]) < 0.5)) return 0; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const out = [];
      for (const tab of ['home', 'journal', 'projects', 'agenda', 'report']) {
        window.BudgetFold.setTab(tab);
        for (const el of document.querySelectorAll('.card, .tile:not(.tile-hero), .envelope, .chip, .proj-row, .tx-row, .fc-row, .insight, .tabs, .segmented label')) {
          if (el.getClientRects().length && lum(el) > 0.5) out.push(`${tab}:${el.className}`);
        }
      }
      return out.slice(0, 5);
    });
    check('thème sombre : aucune carte ni puce restée claire', !leaks.length, leaks);
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await act(p, () => { document.getElementById('menu-settings').click(); document.querySelector('[data-theme-pick="auto"]').click(); document.getElementById('dlg-settings').close(); });
    check('« auto » suit le système (sombre)', await act(p, () => document.documentElement.dataset.theme === 'dark'));
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await wait(100);
    check('« auto » change avec le système', await act(p, () => document.documentElement.dataset.theme === 'light'));
    await act(p, () => { document.getElementById('menu-settings').click(); const c = document.getElementById('set-text-large'); c.checked = true; c.dispatchEvent(new Event('change')); });
    check('texte plus grand : 18 px au lieu de 16', await act(p, () => getComputedStyle(document.documentElement).fontSize === '18px'));
    await p.close();
  }

  // 2. Couleur et icône des enveloppes, reprises partout.
  {
    const p = await H.open({ storage: clone(demo) });
    const envs = (await S(p)).envelopes.filter((e) => e.kind === 'spend');
    check('anciennes enveloppes : icône et couleur devinées (Courses → panier émeraude)', envs.find((e) => e.id === 'e1').icon === 'shopping-cart' && envs.find((e) => e.id === 'e1').color === 'emerald' && envs.every((e) => e.color && e.icon), envs.map((e) => [e.name, e.icon, e.color]));
    await act(p, () => window.BudgetFold.actions.openEnv({ env: window.BudgetFold.getState().envelopes.find((e) => e.id === 'e3') }));
    await act(p, () => { document.getElementById('env-more').open = true; document.getElementById('env-color-orange').click(); document.getElementById('env-icon-music').click(); document.getElementById('env-form').requestSubmit(); });
    await wait(400);
    const e3 = (await S(p)).envelopes.find((e) => e.id === 'e3');
    check('modifier couleur et icône d\'une enveloppe', e3.color === 'orange' && e3.icon === 'music', e3);
    check('carte d\'accueil à la couleur choisie', await act(p, () => document.querySelector('#spend-grid .envelope[data-id="e3"]').dataset.color === 'orange'));
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense' }));
    check('saisie : pastille de couleur sur chaque enveloppe', await act(p, () => document.querySelector('#tx-chips [data-env="e3"]').dataset.color === 'orange'));
    await act(p, () => document.getElementById('dlg-tx').close());
    await act(p, () => window.BudgetFold.setTab('journal'));
    check('journal : icône aux couleurs de l\'enveloppe', await act(p, () => [...document.querySelectorAll('#j-list .tx-icon[data-color="emerald"]')].length >= 3));
    await act(p, () => window.BudgetFold.setTab('agenda'));
    check('calendrier : puce de dépense à la couleur de l\'enveloppe du jour', await act(p, () => document.querySelector('[data-date="2026-10-14"] .dot-spent').dataset.color === 'emerald'));
    await act(p, () => window.BudgetFold.setTab('report'));
    check('bilan : barres aux couleurs des enveloppes', await act(p, () => document.querySelectorAll('#r-bars .bar-row[data-color]').length === 4));
    await act(p, () => window.BudgetFold.actions.openEnv({ kind: 'spend' }));
    await act(p, () => { const n = document.getElementById('env-name'); n.value = 'Essence'; n.dispatchEvent(new Event('input')); });
    check('nouvelle enveloppe : icône devinée en tapant le nom', await act(p, () => document.getElementById('env-icon-fuel').checked && document.getElementById('env-color-orange').checked));
    check('enveloppe : pas de champs de projet (versement, priorité)', await act(p, () => document.getElementById('env-timing').closest('.field').hidden && document.getElementById('env-priority').closest('.field').hidden));
    await p.close();
  }

  // 3. Pastilles (répétition, période), raccourcis de date, mois lisible.
  {
    const p = await H.open({ storage: clone(demo) });
    await act(p, () => window.BudgetFold.actions.openAdd({ mode: 'expense' }));
    check('répétition : 8 pastilles, « Une seule fois » choisie', await act(p, () => document.querySelectorAll('#tx-repeat-pills .pill').length === 8 && document.querySelector('#tx-repeat-pills [data-value="once"]').getAttribute('aria-checked') === 'true'));
    check('liste déroulante remplacée (masquée)', await act(p, () => document.getElementById('tx-repeat').getBoundingClientRect().height <= 1));
    await act(p, () => document.querySelector('#tx-repeat-pills [data-value="month"]').click());
    check('pastille « Chaque mois » : récurrence choisie, « jusqu\'au » visible', await act(p, () => document.getElementById('tx-repeat').value === 'month' && !document.getElementById('tx-until-field').hidden && document.getElementById('tx-title').textContent === 'Dépense récurrente'));
    await act(p, () => document.querySelector('#tx-date-chips [data-date="2026-10-14"]').click());
    check('raccourci « Hier » : date du 14', await act(p, () => document.getElementById('tx-date').value === '2026-10-14'));
    await act(p, () => document.getElementById('dlg-tx').close());
    await act(p, () => window.BudgetFold.actions.openRule(window.BudgetFold.getState().recurring[0]));
    check('modifier une récurrence : « Une seule fois » désactivée', await act(p, () => document.querySelector('#tx-repeat-pills [data-value="once"]').disabled));
    await act(p, () => document.getElementById('dlg-tx').close());
    await act(p, () => window.BudgetFold.actions.openEnv({ kind: 'spend' }));
    await act(p, () => document.querySelector('#env-period-pills [data-value="quarter"]').click());
    check('période en pastilles : « Trimestre »', await act(p, () => document.getElementById('env-period').value === 'quarter'));
    await act(p, () => { document.getElementById('dlg-env').close(); window.BudgetFold.actions.openEnv({ kind: 'project' }); const d = document.getElementById('env-deadline'); d.value = '2027-06'; d.dispatchEvent(new Event('input')); });
    check('date de projet écrite en clair', await act(p, () => /juin 2027, dans 8 mois/.test(document.getElementById('env-deadline-hint').textContent)));
    await p.close();
  }

  // 4. Visite guidée, aide contextuelle, glossaire, questionnaire relancé.
  {
    const p = await H.open({ storage: clone(demo), width: 390, height: 844, mobile: true });
    await act(p, () => document.querySelector('.engine [data-help="reste"]').click());
    check('« ? » du reste à vivre : glossaire ouvert sur le bon mot', await act(p, () => document.getElementById('dlg-help').open && document.getElementById('g-reste').dataset.focus === 'true' && document.querySelectorAll('#help-list dt').length >= 10));
    await act(p, () => document.getElementById('help-tour').click());
    const steps = [];
    for (let i = 0; i < 8; i++) {
      const st = await act(p, () => ({ hidden: document.getElementById('tour').hidden, title: document.getElementById('tour-title').textContent, w: parseFloat(document.getElementById('tour-hole').style.width) }));
      if (st.hidden) break;
      steps.push(st);
      await act(p, () => document.getElementById('tour-next').click());
    }
    check('visite guidée : 7 bulles, chacune sur une zone', steps.length === 7 && steps.every((x) => x.w > 20) && steps[1].title === 'Le bouton +', steps.map((x) => x.title));
    check('visite terminée et mémorisée', (await S(p)).prefs.tourDone === true && await act(p, () => document.getElementById('tour').hidden));
    await act(p, () => window.BudgetFold.actions.startTour());
    await p.keyboard.press('Escape');
    check('Échap ferme la visite', await act(p, () => document.getElementById('tour').hidden));
    await act(p, () => window.BudgetFold.actions.openWelcome());
    check('questionnaire relancé : salaire et jour de paie déjà remplis', await act(p, () => document.getElementById('w-income').value === '1850' && document.getElementById('w-payday').value === '3'));
    for (let i = 0; i < 3; i++) await act(p, () => document.getElementById('w-next').click());
    await act(p, () => {
      const rows = document.querySelectorAll('#w-body .wiz-row[data-list="habits"]');
      rows[0].querySelector('.wiz-amount').value = '250';
      rows[3].querySelector('.wiz-amount').value = '60';
    });
    for (let i = 0; i < 4; i++) { await act(p, () => document.getElementById('w-next').click()); await wait(100); }
    await wait(300);
    const s = await S(p);
    check('relancé : Courses non dupliquée, « Shopping / vêtements » ajoutée', s.envelopes.filter((e) => /courses/i.test(e.name)).length === 1 && s.envelopes.some((e) => e.name === 'Shopping / vêtements') && s.salary === 185000);
    await p.close();
  }

  // 5. Accessibilité : chaque bouton a un nom, chaque champ une étiquette ; cibles tactiles ; mobile sans débordement.
  {
    const p = await H.open({ storage: clone(demo), width: 390, height: 844, mobile: true });
    const audit = () => act(p, () => {
      const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
      const name = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map((id) => (document.getElementById(id) || {}).textContent || '').join(' ') || el.textContent || el.title || '').trim();
      const labelled = (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
      const bad = [];
      for (const b of document.querySelectorAll('button')) if (visible(b) && !name(b)) bad.push(`button#${b.id || b.className}`);
      for (const i of document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, textarea')) if (visible(i) && !labelled(i)) bad.push(`${i.tagName.toLowerCase()}#${i.id || i.className}`);
      return bad;
    });
    const all = [];
    for (const tab of ['home', 'journal', 'projects', 'agenda', 'report']) {
      await act(p, (t) => window.BudgetFold.setTab(t), tab);
      all.push(...(await audit()));
    }
    for (const open of [() => window.BudgetFold.actions.openAdd(), () => window.BudgetFold.actions.openEnv({ kind: 'project' }), () => document.getElementById('menu-settings').click(), () => window.BudgetFold.actions.openProject('p1'), () => window.BudgetFold.actions.openAccounts()]) {
      await act(p, open);
      all.push(...(await audit()));
      await act(p, () => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    }
    check('accessibilité : tous les boutons ont un nom, tous les champs une étiquette', !all.length, [...new Set(all)].slice(0, 8));
    const small = await act(p, () => {
      window.BudgetFold.setTab('home');
      window.BudgetFold.actions.openAdd();
      return [...document.querySelectorAll('.tab, .tab-add, #tx-repeat-pills .pill, #tx-date-chips .pill, #tx-chips .chip, .icon-btn')]
        .filter((el) => el.getClientRects().length && !el.closest('[hidden]'))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((el) => el.id || el.className).slice(0, 5);
    });
    check('cibles tactiles ≥ 44 px (onglets, pastilles, puces, boutons-icônes)', !small.length, small);
    await act(p, () => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    for (const theme of ['dark', 'candy']) {
      await act(p, (t) => { window.BudgetFold.getState().prefs.theme = t; window.BudgetFold.applyTheme(); }, theme);
      let over = 0;
      for (const tab of ['home', 'journal', 'projects', 'agenda', 'report']) over = Math.max(over, await act(p, (t) => { window.BudgetFold.setTab(t); return document.documentElement.scrollWidth - window.innerWidth; }, tab));
      check(`390 px, thème ${theme} : aucun défilement horizontal`, over <= 0, over);
    }
    check('focus visible défini', await act(p, () => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /focus-visible/.test(r.selectorText || '')); } catch { return false; } })));
    await p.close();
  }

  done(H);
  await H.close();
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
