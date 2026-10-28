# BudgetFold OS — Avancement vers la 1.0

Suivi de `ROADMAP-1.0.md`. Mis à jour à chaque étape. Si la session s'interrompt, reprendre à la **phase en cours** ci-dessous, à la première case non cochée.

## Phase en cours
**Phase 5 — Saisie rapide et usage quotidien**

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
Plan :
1. Données v4 des projets : `goalType` (monthly / date / fill), `timing`, `priority`, `color`, `icon`, `category` (project / wish), `notes`, `checklist`, `sim`, `boughtAt` ; opération `withdraw` (dépense payée par une réserve).
2. Moteur : `monthlyOf` (mise recalculée pour une date), `projectResults` (résultats complets), `simulate` / `runScenarios` (centimes entiers, taux en points de base saisis), `projectAdvice`.
3. Interface : onglet Projets (groupes, tri, conseils, liste d'envies), fiche projet (résultats, simulateur avec courbes et comparaison, notes, étapes avec liens, historique, verser / retirer / acheté), formulaire projet enrichi.

- [x] Onglet dédié : groupes (en cours, plans, atteints), tri (date, priorité, avancement)
- [x] Fiche projet : objectif, épargné, date, mise, moment du versement, priorité, couleur, icône, notes, étapes, historique des versements
- [x] Types d'objectifs : X €/mois, pour une date (mise calculée chaque mois), réserve à remplir (retraits)
- [x] Simulateur : 3 scénarios, rendement, inflation et hausse saisis par l'utilisateur, courbes, comparaison de deux projets
- [x] Résultats toujours complets, « Compatible avec ta marge actuelle (après charges et enveloppes) », jamais « faisable »
- [x] Conseils calculés (enveloppes sous-utilisées, réduction d'une enveloppe, toute la marge)
- [x] Projets de toutes tailles + liste d'envies
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 3 :
- Scénarios par défaut tirés des chiffres de l'utilisateur : prudent = min(mise, marge), réaliste = mise, ambitieux = toute la marge. Rendement, inflation et hausse valent 0 tant que l'utilisateur ne les saisit pas.
- Taux stockés en points de base entiers (2,5 % = 250) et intérêts arrondis au centime à chaque mois : aucun flottant pour l'argent.
- « Pour une date » : la mise est recalculée chaque mois (et tout de suite après un versement exceptionnel). La clôture verse la mise recalculée.
- Une envie est un projet Plan (rien n'est réservé) de catégorie « wish » ; « C'est acheté » note la date et propose d'ajouter la dépense.
- Le retrait d'une réserve ne touche pas le reste à vivre (l'argent était déjà mis de côté) ; la mise reprend jusqu'à remplir la réserve.
- Sur l'accueil, toucher un projet ouvre sa fiche (avant : la feuille de modification, toujours accessible via « Modifier »).

## Phase 4 — Justificatifs, tickets et règles
Plan :
1. Données v4 : `tx.photos` (identifiants), `tx.pro`, `tx.group` (ticket réparti), `rules[].source` (auto / user), `prefs.pro` (taux et seuils saisis).
2. Justificatifs dans IndexedDB (`budgetfold-photos`) : photo compressée (JPEG ≤ 1 200 px, ≤ 150 Ko), PDF gardé tel quel ; miniatures, visionneuse (précédent / suivant, remplacer, retirer).
3. ZIP maison (méthode « stockée », CRC32) : sauvegarde complète avec photos, import .zip, export « justificatifs » (CSV ; + photos) par période.
4. Micro-entreprise : case « pro », CA du mois et de l'année, cotisations provisionnées dans le reste à vivre, seuils et alertes.
5. Règles de classement : éditeur (ajout, modification, suppression avec « Annuler »), règles écrites à la main jamais écrasées.
6. Scan : recadrage avant lecture, ticket réparti entre enveloppes (une ligne par article), facture PDF lue par pdf.js 4.10.38 (version figée, chargé à la demande).

- [x] Photo du ticket conservée (IndexedDB, compressée, miniature, plein écran, remplacer, retirer, plusieurs photos)
- [x] Exports : sauvegarde complète (zip) ; justificatifs par période (CSV + photos)
- [x] Mode micro-entreprise (pro/perso, CA mois et année, cotisations au taux saisi, alertes de seuils saisis)
- [x] Règles de classement modifiables, apprises automatiquement
- [x] Scan amélioré : recadrage, ticket réparti entre enveloppes, facture PDF
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 4 :
- Les photos et PDF vivent dans IndexedDB, jamais dans localStorage ; l'état ne garde que leurs identifiants. Une photo qui n'est plus citée par aucune opération est effacée au démarrage suivant, plus d'un jour après (le temps de pouvoir « Annuler »).
- Ticket réparti = plusieurs dépenses liées par `group` (chacune compte dans son enveloppe) ; c'est aussi l'« opération répartie » de la phase 5.
- Micro-entreprise : aucun taux, plafond ou seuil n'est proposé par défaut. Les cotisations sont provisionnées dans le reste à vivre du mois (comme une charge). L'alerte « bientôt atteint » se déclenche à 90 % du seuil saisi.
- pdf.js est la seule nouvelle dépendance (CDN jsdelivr, version figée 4.10.38, chargée seulement à l'import d'un PDF) ; elle est installée en `devDependencies` pour les tests hors ligne.
- Le zip est écrit sans bibliothèque ; l'import lit aussi les zip compressés (DecompressionStream).

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
