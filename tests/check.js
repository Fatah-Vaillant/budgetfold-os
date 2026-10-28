// Vérifie la syntaxe de chaque module de l'app (node --check), avant les tests dans le navigateur.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) bad++;
}
console.log(bad ? `Syntaxe : ${bad} fichier(s) en erreur.` : `Syntaxe : ${files.length} modules valides.`);
process.exitCode = bad ? 1 : 0;
