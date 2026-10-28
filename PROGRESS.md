# BudgetFold OS — Avancement vers la 1.0

Suivi de `ROADMAP-1.0.md`. Mis à jour à chaque étape. Si la session s'interrompt, reprendre à la **phase en cours** ci-dessous, à la première case non cochée.

## Phase en cours
**Phase 3 — Projets et simulations**

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
Plan :
1. Mois budgétaire : `cycleStart` / `cycleEnd` / `budgetKey` remplacent les mois calendaires dans tous les calculs (enveloppes, reste à vivre, agenda, journal, bilan, trésorerie).
2. Données v4 : `prefs.cycle`, `prefs.closing`, `lastClosed`, `closings[]` (instantané figé), `moves[]`, projet `safety`.
3. Moteur : `closeMonth`, `reopenMonth`, `moveMoney`, `resetAllEnvelopes`, reports (`carryIn`, `closingCarry`), clôture automatique dans `tick()`.
4. Interface : assistant de clôture, feuille « Déplacer de l'argent », remise à zéro globale (menu), réglages (cycle, clôture auto), ordre du mois (agenda), Bilan › Historique, badge « Bien tenu ».

- [x] Début du mois budgétaire réglable (jour de paie ou 1er)
- [x] Ordre d'un mois affiché dans l'agenda
- [x] Remise à zéro de toutes les enveloppes (manuelle ; automatique = chaque début de cycle)
- [x] Assistant de clôture (reporter / remettre au budget / projet ou matelas ; déficit reporté ; préférence mémorisée ; clôture automatique)
- [x] Déplacer de l'argent entre enveloppes, trace au journal, « couvrir » un dépassement
- [x] Historique figé (instantané par mois) + écran Historique (3/6/12 mois, tendances, détail)
- [x] Badge « Bien tenu »
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 2 :
- **Cycle par défaut** : jour de paie pour un nouvel utilisateur ; les sauvegardes v1 à v3 passent en cycle « 1er du mois » pour qu'aucun chiffre ne change. Réglable dans Réglages.
- Un mois budgétaire commencé après le 15 porte le nom du mois suivant (paie le 28 octobre → budget de novembre).
- **Remise à zéro automatique** : une enveloppe au mois repart à zéro à chaque début de cycle (c'est le fonctionnement même du cycle). La remise à zéro globale manuelle est dans le menu.
- **Dépassement** : comme le dit CLAUDE.md, un dépassement est pris sur le reste à vivre du mois même. Si le mois finit dans le rouge, le déficit est retiré du mois suivant (report automatique, non désactivable).
- Le reste à vivre non réparti d'un mois clôturé est remis au budget du mois suivant par défaut (rien ne disparaît) ; on peut le verser sur un projet ou le matelas.
- Seules les enveloppes dont la période se termine avec le mois sont proposées à la clôture (pas les enveloppes à la semaine).
- Le versement de clôture vers un projet est daté du premier jour du mois suivant et ne réduit pas son reste à vivre (il vient des réserves du mois clos).
- Changer de cycle ou de jour de paie repart du mois en cours, sans clôture ni versement rétroactif.
- Matelas de sécurité : projet Plan créé une fois (objectif de départ : 3 mois de salaire, modifiable ; il peut dépasser son objectif). S'il est supprimé, il ne revient pas.

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
