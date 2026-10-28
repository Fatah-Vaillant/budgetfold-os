# BudgetFold OS — Avancement vers la 1.0

Suivi de `ROADMAP-1.0.md`. Mis à jour à chaque étape. Si la session s'interrompt, reprendre à la **phase en cours** ci-dessous, à la première case non cochée.

## Phase en cours
**Phase 1 — Fiabilité**

## Décisions transverses
- **Format de données v4** = format de la 1.0. Il est construit au fil des phases 1 à 8 et n'est publié (push) qu'à la fin : aucun utilisateur ne verra de v4 « intermédiaire ». Chaque champ ajouté est lu par `migrateV3` (v3 → v4) et couvert par un test. Champ `v` toujours présent.
- **Clé de stockage** : `budgetfold-os:v4`. Les clés `v3`, `v2`, `v1` restent lues (jamais effacées) au premier lancement.
- **Aucun taux codé en dur** : cotisations, rendement, inflation, seuils sont saisis par l'utilisateur (valeur par défaut 0 ou vide).

---

## Phase 1 — Fiabilité
Plan :
1. 1.1 marge projet Actif (fait avant la roadmap, commit `49c3666`).
2. Format v4 : clé `v4`, `migrateV3`, test de migration.
3. 1.3 versement sur projet Actif : option « C'est la mise de ce mois » (`tx.covers = 'AAAA-MM'`), qui réduit la mise réservée du mois et le versement de clôture ; alerte si le reste à vivre passe sous 0 ; doublon probable (même montant, même cible, < 2 min) → confirmation.
4. Projet créé en cours de mois : `project.startMonth` (ce mois-ci, ou mois de la prochaine paie).
5. 1.2 scan : format colonnes avec code TVA, préfixe « 1 x », prix sur la ligne suivante, bloc TVA exclu, date ancienne gardée avec avertissement, dictionnaire d'enseignes élargi et confusions OCR (O/D, rn/m). Tickets générés + dossier `tests/tickets/` (une photo + un `.json` attendu = un test).
6. Persistance : `navigator.storage.persist()`, alerte stockage presque plein, rappel de sauvegarde après 30 jours sans export (`prefs.lastExport`).

- [x] 1.1 Marge faussée pendant la saisie d'un projet Actif (test de non-régression)
- [x] Format v4 + migration v3 → v4 (tests v1 → v4, v2 → v4, v3 → v4, relecture v4)
- [x] 1.3 Versement sur projet Actif (mise du mois, alerte, doublon)
- [x] Projet créé en cours de mois : début de la mise
- [x] 1.2 Lecture des vrais tickets + `tests/tickets/` (Relay généré lu de bout en bout par Tesseract)
- [x] Persistance et rappel de sauvegarde
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 1 :
- « C'est la mise de ce mois » est **cochée par défaut** tant que la mise du mois n'est pas couverte : c'est le cas qui a trompé les testeurs (projet Moto). Décocher = versement exceptionnel en plus.
- Doublon probable vérifié pour toute saisie unique (dépense, revenu, versement), pas seulement les versements.
- Un ticket est « ancien » au-delà de 31 jours : la date est gardée, l'app prévient. Une date dans le futur est ignorée (lecture fausse).
- Raisons sociales (Lagardère, SNCF, « gare ») retenues seulement si aucune enseigne n'est trouvée.
- Tests découpés par domaine dès maintenant (`tests/run.js` lance tous les `*.test.js`) : `data`, `projects`, `receipts`, `ocr`, plus l'ancien `app`.

## Phase 2 — Cycle du mois, clôture et historique
_À planifier._

## Phase 3 — Projets et simulations
_À planifier._

## Phase 4 — Justificatifs, tickets et règles
_À planifier._

## Phase 5 — Saisie rapide et usage quotidien
_À planifier._

## Phase 6 — Analyses et optimisation
_À planifier._

## Phase 7 — Interface, personnalisation et prise en main
_À planifier._

## Phase 8 — Données, sécurité et plusieurs appareils
_À planifier._

## Phase 9 — Qualité et finition
_À planifier._

---

## Points reportés
_(aucun pour l'instant)_
