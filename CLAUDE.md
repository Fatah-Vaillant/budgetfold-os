# BudgetFold OS — instructions pour Claude

App de budget par **enveloppes virtuelles** pour étudiants, familles et jeunes actifs. PWA en français, **100 % locale** : aucun serveur, aucune donnée envoyée (RGPD). Utilisée surtout sur **iPad/iPhone (Safari)** via GitHub Pages. Version **1.0.0**.

`ROADMAP-1.0.md` décrit le produit 1.0, `PROGRESS.md` les décisions prises phase par phase, `BACKLOG.md` les retours des testeurs. Lis-les avant de proposer un plan.

## Stack
- HTML, CSS et JavaScript **vanilla**, sans framework ni étape de build : `index.html`, `style.css`, modules ES natifs dans `js/` (`.mjs`), `sw.js`, `manifest.json`.
- Icônes Lucide 0.460.0 **embarquées** : seules celles utilisées, dans `js/icons.mjs` (généré par `npm run build:icons`). Police Inter (Google Fonts, chargée sans bloquer).
- Chargés à la demande depuis jsdelivr, **versions figées** : Tesseract.js 5.1.1 (scan, `TESS`), pdf.js 4.10.38 (factures PDF, `PDFJS`), qrcode-generator 1.4.4 (QR, `QRLIB`). Installés aussi en `devDependencies` pour les tests hors ligne.
- Stockage : `localStorage`, clé `budgetfold-os:v4` (les clés v3, v2, v1 sont lues, jamais effacées) ; photos et PDF des justificatifs dans IndexedDB `budgetfold-photos`.

## Commandes
- `npm install` : dépendances de test (Chrome pour Puppeteer, Lucide, Tesseract, pdf.js, qrcode-generator, Lighthouse).
- `npm start` : sert l'app sur http://localhost:5173.
- `npm test` : syntaxe des modules (`tests/check.js`), puis tous les `tests/*.test.js` dans un vrai navigateur (`tests/run.js`), OCR en dernier.
- `npm run test:fast` : sans OCR ni captures. `npm run test:refs` : régénère les captures de référence (`tests/reference/`) après un changement visuel voulu.
- `npm run audit` : Lighthouse mobile, chaque note ≥ 90. `npm run build:single` : régénère `BudgetFold.html` (toute l'app en un fichier). `npm run build:icons` : régénère `js/icons.mjs`.
- Une tâche n'est **terminée** que si `npm test` passe entièrement. Ajoute un test pour chaque bug corrigé et chaque nouvelle règle de calcul, dans le fichier du domaine concerné.

## Architecture (`js/`, dans l'ordre de chargement)
Les imports ne vont que vers les modules **au-dessus** : l'ordre d'évaluation est fixe. Les rares appels vers l'interface depuis `data` ou `engine` passent par `hooks` (rempli par `ui.mjs`). Une variable d'un module ne se réaffecte pas depuis un autre : utiliser son setter (`replaceState`, `setLastAddedId`, `resetPhotoDb`).
1. `icons.mjs` : tracés SVG des icônes (généré).
2. `util.mjs` : dates ISO, `money()`, `FREQS`, `PERIODS`, palettes, types d'objectifs, `hooks`.
3. `data.mjs` : `emptyState`, `sanitize`, migrations `migrateV1` / `migrateV2` / `migrateV3`, `fromAnyVersion`, `load`, `state`, `save` / `commit`, mois budgétaire (`cycleStart`, `cycleEnd`, `budgetKey`, `currentMonth`).
4. `engine.mjs` : récurrences, enveloppes (`envRow`, `envMonthAlloc`, reports, déplacements), `derive(mois)`, trésorerie, prévisions, projets (`projectContribution`, `monthlyOf`, `projectPlan`, `projectResults`, `simulate`), clôture (`closeMonth`, `runRollover`), comptes, favoris, recherche, abonnements, `.ics`, analyses (`healthScore`, suggestions), mutations.
5. `io.mjs` : import CSV et préréglages bancaires, lecture de ticket, justificatifs (IndexedDB, compression), ZIP, exports, PDF, OCR.
6. `ui.mjs` : rendu (`render`, onglets Accueil, Journal, Projets, Agenda, Bilan), feuilles et événements, questionnaire, visite guidée, sécurité (chiffrement, verrou, QR), thèmes. Le helper `h()` crée le DOM, `fill()` remplace des enfants en ignorant `null`, `icon(nom)` dessine une icône.
7. `main.mjs` : crochets de test `window.BudgetFold` (ne pas les retirer, les tests en dépendent) et démarrage.

## Règles métier (ne pas casser)
- **Montants en centimes entiers**, jamais de flottants (les taux sont en points de base entiers). **Dates en chaînes `AAAA-MM-JJ`** en heure locale. Passer par `clock.today()`.
- **Mois budgétaire** : au jour de paie (`prefs.cycle = 'pay'`, défaut des nouveaux utilisateurs) ou au 1er (`'calendar'`, gardé pour les sauvegardes antérieures). Un mois commencé après le 15 porte le nom du mois suivant.
- **Reste à vivre du mois** = revenus (+ report de la clôture précédente) − (prélèvements + enveloppes + projets actifs + hors enveloppe + versements + cotisations pro provisionnées).
- Une enveloppe réserve `max(budget, dépensé + prévu)` pour une période d'un mois ou moins (budget = plafond + report + déplacements). Pour une période plus longue, elle réserve l'équivalent mensuel, plus le dépassement.
- Un dépassement d'enveloppe est autorisé : il est pris sur le reste à vivre. Une enveloppe est un **plafond**, pas un objectif à atteindre.
- Récurrences : chaque échéance passée devient une transaction (`recId`), y compris le rattrapage quand l'app était fermée. Les échéances futures restent « prévues ». `postedUntil` évite les doublons.
- Projet `active` : la mise est réservée chaque mois et versée à la clôture (`runRollover`), sauf ce qu'un versement « mise de ce mois » (`covers`) a déjà couvert. Projet `plan` : simulation, rien n'est réservé.
- Clôture : l'instantané (`closings[].snapshot`) est **figé**, jamais recalculé.
- Virements entre comptes, retraits d'une réserve et versements de clôture ne changent pas le reste à vivre.
- Aucun taux financier codé en dur (cotisations, rendement, inflation, seuils) : l'utilisateur les saisit.
- **Compatibilité des sauvegardes (obligatoire)** :
  - Tout changement de format incrémente `v` et ajoute une migration dans `fromAnyVersion`.
  - Les anciennes clés `localStorage` et les anciens fichiers (.json v1 à v4, .zip, .bfold chiffré) doivent toujours être lus.
  - Chaque version a son test de migration.
- Pas de suppression silencieuse : historique conservé ; « Annuler » proposé après chaque ajout ou suppression.

## Style et UX
- Textes en **français**, ton direct, tutoiement (« Ton reste à vivre »). Pas de jargon.
- Cartes arrondies (16 à 28 px), palette slate, bleu nuit (#1e3a8a → #0f172a), émeraude #10b981, ambre #f59e0b, rose pour les alertes. **Toutes les couleurs passent par des variables CSS** (`:root` et `:root[data-theme="dark" | "rose" | "candy"]`) ; contrastes WCAG vérifiés par `tests/ui.test.js`.
- Mobile d'abord : barre d'onglets en bas, bouton + central, feuilles en bas d'écran, cibles tactiles ≥ 44 px, aucun défilement horizontal à 390 px.
- Accessibilité : nom accessible sur chaque bouton, étiquette sur chaque champ, focus visible, `prefers-reduced-motion` respecté.

## À ne jamais faire
- Envoyer des données vers un serveur, ou ajouter un traceur ou des analytics.
- Ajouter un framework ou une étape de build sans accord explicite (`BudgetFold.html` et `js/icons.mjs` sont des fichiers générés à part, l'app s'utilise sans eux).
- Utiliser une dépendance CDN sans version figée.
- Utiliser des flottants pour l'argent.
- Changer le format des données sans migration et sans test.
- Laisser `null`, `undefined` ou `NaN` s'afficher dans l'interface (les tests le vérifient).

## Façon de travailler
- Pour toute tâche de plus d'un fichier ou d'une règle de calcul, commence par un **plan** à faire valider (mode plan).
- Petites étapes : une fonctionnalité, puis ses tests, puis `npm test`, puis un commit. Mets `BACKLOG.md` et `PROGRESS.md` à jour.
- Après une modification visible, vérifie l'écran sur 390 px et sur 1280 px ; si c'est voulu, `npm run test:refs`.
- Avant une version : `docs/checklist.md`.
