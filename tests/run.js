// Lance tous les fichiers de test l'un après l'autre et échoue si l'un d'eux échoue.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort((a, b) => (a === 'ocr.test.js') - (b === 'ocr.test.js') || a.localeCompare(b))
  .filter((f) => !only.length || only.some((o) => f.includes(o)));

const failed = [];
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}
console.log(failed.length ? `\nÉCHEC : ${failed.join(', ')}` : `\nTous les tests passent (${files.length} fichiers).`);
process.exitCode = failed.length ? 1 : 0;
