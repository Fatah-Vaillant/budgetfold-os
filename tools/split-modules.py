"""Découpe l'ancien script.js (un seul IIFE) en modules ES natifs dans js/.

Outil de migration utilisé une fois (phase 9). Les imports ne vont que vers des modules plus haut dans la
liste : l'ordre d'évaluation reste celui de l'ancien fichier. Les rares appels vers un module plus bas
passent par `hooks` (registre rempli par ui.mjs) ; les variables réaffectées ailleurs ont un setter.
"""
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
lines = Path(sys.argv[2] if len(sys.argv) > 2 else root / 'script.js').read_text(encoding='utf-8').split('\n')
assert lines[0].startswith('(() => {') and "'use strict'" in lines[1]
end = max(i for i, l in enumerate(lines) if l.startswith('})();'))

def find(prefix):
    return next(i for i, l in enumerate(lines) if l.startswith(prefix))

cuts = [2, find('  const emptyState = () => ({') - 1, find('  function occurrences(rule, from, to) {'),
        find('  function parseDelimited(text, delim) {'), find('  const byId = (id) => document.getElementById(id);'),
        find('  window.BudgetFold = {'), end]
# Un commentaire placé juste avant une coupure reste avec ce qu'il décrit.
names = ['util', 'data', 'engine', 'io', 'ui', 'main']
chunks = [lines[cuts[k]:cuts[k + 1]] for k in range(len(names))]

DECL = re.compile(r'^  (export )?(async )?(function\*?|const|let|class) ([A-Za-z_$][\w$]*)')

def declared(chunk):
    return [m.group(4) for l in chunk if (m := DECL.match(l))]

def code_only(text):
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", text)
    text = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', text)
    return text

decls = {n: declared(c) for n, c in zip(names, chunks)}
out = {}
for k, (name, chunk) in enumerate(zip(names, chunks)):
    text = '\n'.join(chunk)
    if name == 'data':
        text = re.sub(r'(?<![\w$.])render\(\)', 'hooks.render()', text)
        text = re.sub(r'(?<![\w$.])toast\(', 'hooks.toast(', text)
        text += ('\n\n  // Réaffectations depuis les autres modules (un import est en lecture seule).\n'
                 '  function replaceState(next) { state = next; }\n'
                 '  function setLastAddedId(id) { lastAddedId = id; }\n')
    if name == 'engine':
        text = re.sub(r'(?<![\w$.])proThresholds\(', 'hooks.proThresholds(', text)
        text = text.replace('Object.assign(ui, {', 'Object.assign(hooks.ui, {')
    if name == 'io':
        text += '\n\n  function resetPhotoDb() { photoDb = null; }\n'
    if name not in ('data',):
        text = re.sub(r'(?<![\w$.])(?<!const )(?<!let )state = ([^;\n]+);', r'replaceState(\1);', text)
        text = re.sub(r'(?<![\w$.])lastAddedId = ([^;\n]+);', r'setLastAddedId(\1);', text)
    if name != 'io':
        text = re.sub(r'(?<![\w$.])photoDb = null;', 'resetPhotoDb();', text)
    body = text.split('\n')
    if name != 'main':
        body = [('  export ' + l[2:]) if DECL.match(l) and not l.startswith('  export ') else l for l in body]
    body = [l[2:] if l.startswith('  ') else l for l in body]
    own = set(declared(['  ' + l for l in body]))
    if name == 'util':
        body = ['// Registre des fonctions de l\'interface appelées par les modules du dessous (rempli par ui.mjs).',
                'export const hooks = {};', ''] + body
    if name == 'ui':
        body = ['// Fonctions de l\'interface appelées par les modules data et engine.', 'Object.assign(hooks, { render, toast, proThresholds });', ''] + body
    # Sans filtrer chaînes ni commentaires : importer un nom en trop est sans risque, en oublier un casse l'app.
    used = set(re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)', '\n'.join(body).replace('...', ' ')))
    if name == 'ui':
        body += ['', "// Après sa déclaration : l'état de l'interface, remis à zéro par engine (setSettings).", 'Object.assign(hooks, { ui });']
    imports = []
    for prev in names[:k]:
        exported = set(re.findall(r'^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)', out[prev], re.M))
        need = sorted((exported & used) - own)
        if need:
            imports.append(f"import {{ {', '.join(need)} }} from './{prev}.mjs';")
    header = [f'// BudgetFold OS · module {name} (voir CLAUDE.md, « Architecture »).']
    out[name] = '\n'.join(header + imports + [''] + body).rstrip() + '\n'

(root / 'js').mkdir(exist_ok=True)
for name, text in out.items():
    (root / 'js' / f'{name}.mjs').write_text(text, encoding='utf-8', newline='\n')
    print(f'js/{name}.mjs : {text.count(chr(10))} lignes')
