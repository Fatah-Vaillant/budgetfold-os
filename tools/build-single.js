// Génère BudgetFold.html : toute l'app dans un seul fichier, utilisable hors ligne (même ouvert en file://).
// Ce n'est pas une étape de build : l'app normale (index.html + js/*.mjs) s'utilise telle quelle.
// Usage : node tools/build-single.js [fichier de sortie]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'BudgetFold.html'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ORDER = ['icons', 'util', 'data', 'engine', 'io', 'ui', 'main'];

// Les modules sont concaténés dans l'ordre, sans import ni export : leurs noms de premier niveau sont tous distincts.
const js = ORDER.map((m) => read(`js/${m}.mjs`)
  .split('\n')
  .filter((l) => !/^import \{[^}]*\} from '\.\/[a-z]+\.mjs';$/.test(l))
  .map((l) => l.replace(/^export /, ''))
  .join('\n')).join('\n');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const icon = `data:image/svg+xml;base64,${Buffer.from(read('icon.svg')).toString('base64')}`;

let html = read('index.html');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`Introuvable dans index.html : ${from}`);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`);
swap('<script type="module" src="js/main.mjs"></script>', '');
html = html.replace(/ {2}<link rel="modulepreload" href="js\/[a-z]+\.mjs">\r?\n/g, '');
swap('<link rel="icon" href="icon.svg" type="image/svg+xml">', `<link rel="icon" href="${icon}" type="image/svg+xml">`);
swap('<link rel="manifest" href="manifest.json">', '');
// Le script de l'app va en fin de page : le DOM existe déjà quand il s'exécute (comme un module).
swap('</body>', `<script>\n// Version un seul fichier : pas de service worker (aucun sw.js à côté).\nwindow.BUDGETFOLD_SINGLE_FILE = true;\n(() => {\n'use strict';\n${safe(js)}\n})();\n</script>\n</body>`);
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out)} : ${Math.round(html.length / 1024)} Ko`);
