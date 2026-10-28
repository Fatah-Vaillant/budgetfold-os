# BudgetFold OS — instructions pour Claude

App de budget par **enveloppes virtuelles** pour étudiants, familles et jeunes actifs. PWA en français, **100 % locale** : aucun serveur, aucune donnée envoyée (RGPD). Utilisée surtout sur **iPad/iPhone (Safari)** via GitHub Pages.

La feuille de route et les bugs connus sont dans `BACKLOG.md`. Lis-le avant de proposer un plan.

## Stack
- HTML, CSS et JavaScript **vanilla**, sans framework ni étape de build. Fichiers : `index.html`, `style.css`, `script.js`, `sw.js`, `manifest.json`.
- Icônes Lucide (unpkg, **version figée** 0.460.0), police Inter (Google Fonts).
- Scan de tickets : Tesseract.js 5.1.1, chargé à la demande depuis jsdelivr (versions figées dans `TESS`, `script.js`).
- Stockage : `localStorage`, clé `budgetfold-os:v3`.

## Commandes
- `npm install` : installe les dépendances de test (Chrome pour Puppeteer, Lucide, Tesseract).
- `npm start` : sert l'app sur http://localhost:5173.
- `npm test` : vérifie la syntaxe, puis lance les tests de l'app (`tests/app.test.js`, environ 95 vérifications dans un vrai navigateur) et le test du scan (`tests/ocr.test.js`).
- Une tâche n'est **terminée** que si `npm test` passe entièrement. Ajoute un test pour chaque bug corrigé et chaque nouvelle règle de calcul.

## Architecture de `script.js` (un seul IIFE, dans cet ordre)
1. **Utilitaires et constantes** : dates ISO, `money()`, `FREQS`, `PERIODS`, `KEYWORD_HINTS`, `TEMPLATES`.
2. **Données** : `emptyState`, `sanitize`, migrations `migrateV1` / `migrateV2`, `fromAnyVersion`, `load`.
3. **Moteur** :
   - récurrences : `occurrences`, `postRecurring` ;
   - enveloppes : `periodWindow`, `envRow`, `envMonthAlloc` ;
   - calculs : `derive(mois)`, `cashflow`, `forecast`, `upcomingEvents`, `projectPlan`, `computeInsights`, `runRollover` ;
   - mutations : `createEnvelope`, `addRule`, `addTransaction`, etc.
4. **Import CSV et scan de ticket** : `parseStatement`, `parseReceipt`, `scanReceipt`.
5. **Rendu** : `render`, `renderHome`, `renderJournal`, `renderAgenda`, `renderReport`. Le helper `h()` crée le DOM, et `fill()` remplace des enfants en ignorant `null`.
6. **Feuilles et événements** :
   - feuille d'ajout unique : `openAdd`, `openTx`, `openRule` ;
   - enveloppes et projets : `openEnv` ;
   - démarrage : `openWelcome` ;
   - boot : `tick()`.
7. **Crochets de test** : `window.BudgetFold`. Ne pas les retirer, les tests en dépendent.

## Règles métier (ne pas casser)
- **Montants en centimes entiers**, jamais de flottants. **Dates en chaînes `AAAA-MM-JJ`** en heure locale. Passer par `clock.today()`.
- **Reste à vivre du mois** = revenus − (prélèvements + enveloppes + projets actifs + hors enveloppe + versements).
- Une enveloppe réserve `max(budget, dépensé + prévu)` pour une période d'un mois ou moins. Pour une période plus longue, elle réserve l'équivalent mensuel, plus le dépassement.
- Un dépassement d'enveloppe est autorisé : il est pris sur le reste à vivre. Une enveloppe est un **plafond**, pas un objectif à atteindre.
- Récurrences : chaque échéance passée devient une transaction (`recId`), y compris le rattrapage quand l'app était fermée. Les échéances futures restent « prévues ». `postedUntil` évite les doublons.
- Projet `active` : la mise est réservée chaque mois et versée à la clôture (`runRollover`). Projet `plan` : simulation, rien n'est réservé.
- **Compatibilité des sauvegardes (obligatoire)** :
  - Tout changement de format incrémente `v` et ajoute une migration dans `fromAnyVersion`.
  - Les anciennes clés `localStorage` et les anciens fichiers .json (v1, v2, v3…) doivent toujours être lus.
  - Chaque version a son test de migration.
- Pas de suppression silencieuse : historique conservé ; « Annuler » proposé après chaque ajout ou suppression.

## Style et UX
- Textes en **français**, ton direct, tutoiement (« Ton reste à vivre »). Pas de jargon.
- Direction artistique : cartes arrondies (16 à 28 px), palette slate, bleu nuit (#1e3a8a → #0f172a), émeraude #10b981, ambre #f59e0b, rose pour les alertes. Couleurs en variables CSS (`:root`) : prépare les thèmes sombre et rose pastel.
- Mobile d'abord : barre d'onglets en bas, bouton + central, feuilles en bas d'écran, cibles tactiles ≥ 44 px, aucun défilement horizontal à 390 px.
- Accessibilité : `aria-label` sur les boutons-icônes, focus visible, `prefers-reduced-motion` respecté.

## À ne jamais faire
- Envoyer des données vers un serveur, ou ajouter un traceur ou des analytics.
- Ajouter un framework ou une étape de build sans accord explicite.
- Utiliser une dépendance CDN sans version figée.
- Utiliser des flottants pour l'argent.
- Changer le format des données sans migration et sans test.
- Laisser `null`, `undefined` ou `NaN` s'afficher dans l'interface (le test le vérifie).

## Façon de travailler
- Pour toute tâche de plus d'un fichier ou d'une règle de calcul, commence par un **plan** à faire valider (mode plan).
- Petites étapes : une fonctionnalité, puis ses tests, puis `npm test`, puis un commit. Mets `BACKLOG.md` à jour (coche ce qui est fait).
- Après une modification visible, vérifie l'écran sur 390 px et sur 1280 px.
