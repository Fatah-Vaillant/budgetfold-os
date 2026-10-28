// Outils partagés par les fichiers de test : vérifications, accès à l'état et au moteur de l'app.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

function suite(name) {
  let pass = 0;
  let fail = 0;
  const check = (label, cond, info = '') => {
    if (cond) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label} -> ${typeof info === 'string' ? info : JSON.stringify(info)}`); }
  };
  const done = (H) => {
    if (H) {
      if (H.logs.length) console.log(`LOGS:\n${H.logs.join('\n')}`);
      check(`${name}: aucune erreur console`, !H.logs.some((l) => /pageerror|error:/i.test(l)), H.logs.join(' | '));
    }
    console.log(`\n${name} : ${pass}/${pass + fail} réussis${fail ? ` — ${fail} ÉCHEC(S)` : ''}`);
    process.exitCode = fail ? 1 : 0;
  };
  return { check, done };
}

const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.BudgetFold.getState())));
const D = (p, key) => p.evaluate((k) => {
  const d = window.BudgetFold.derive(k);
  return { ...d, spend: d.spend.map((r) => ({ name: r.env.name, id: r.env.id, spent: r.spent, planned: r.planned, left: r.left, alloc: r.alloc, eq: r.eq, window: r.window })) };
}, key);
// Texte sans espaces (les montants formatés contiennent des espaces insécables).
const flat = (s) => String(s).replace(/[\s  ]/g, '');

module.exports = { wait, clone, suite, S, D, flat };
