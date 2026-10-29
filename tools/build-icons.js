// Génère js/icons.mjs : uniquement les icônes Lucide 0.460.0 utilisées par l'app (au lieu des ~1 500 icônes du CDN).
// À relancer après avoir utilisé une nouvelle icône : node tools/build-icons.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'node_modules', 'lucide', 'dist', 'esm', 'icons');
const version = require(path.join(root, 'node_modules', 'lucide', 'package.json')).version;
const sources = [fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  ...fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.mjs') && f !== 'icons.mjs').map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf8'))].join('\n');

// Toute chaîne qui est le nom d'une icône Lucide existante (data-lucide="…", icon('…'), listes d'icônes).
const candidates = new Set([...sources.matchAll(/["'`]([a-z][a-z0-9-]*)["'`]/g)].map((m) => m[1]));
const names = [...candidates].filter((n) => fs.existsSync(path.join(dir, `${n}.js`))).sort();

const icons = {};
for (const name of names) {
  const src = fs.readFileSync(path.join(dir, `${name}.js`), 'utf8');
  const body = src.slice(src.indexOf('defaultAttributes,') + 'defaultAttributes,'.length, src.lastIndexOf(']'));
  // Le corps est un tableau JS littéral ([tag, {attributs}] …) : on l'évalue sans rien d'autre.
  icons[name] = Function(`"use strict"; return (${body.trim()});`)();
}
const out = `// Icônes Lucide ${version} (licence ISC, © Lucide Contributors et Cole Bemis pour Feather) — fichier généré par tools/build-icons.js.
// Seules les icônes utilisées par l'app sont incluses.
export const ICONS = ${JSON.stringify(icons)};
`;
fs.writeFileSync(path.join(root, 'js', 'icons.mjs'), out);
console.log(`js/icons.mjs : ${names.length} icônes, ${Math.round(out.length / 1024)} Ko`);
