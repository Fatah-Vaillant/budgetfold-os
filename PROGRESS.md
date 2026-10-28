# BudgetFold OS — Avancement vers la 1.0

Suivi de `ROADMAP-1.0.md`. Mis à jour à chaque étape. Si la session s'interrompt, reprendre à la **phase en cours** ci-dessous, à la première case non cochée.

## Phase en cours
**Phase 8 — Données, sécurité et plusieurs appareils**

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
Plan :
1. Données v4 : `favorites[]`, `accounts[]` (solde de départ daté), `tx.accountId`, `tx.toAccountId` (virement), `tx.tags`, `tx.adjust`, `prefs.lastAccountId`, `prefs.lastReminder`.
2. Saisie rapide : montants fréquents, dernière enveloppe, favoris (créés depuis la saisie ou suggérés), en un toucher depuis l'accueil.
3. Journal : recherche (texte, montant, #étiquette) sur une période ; étiquettes ; notes (champ « Détail »).
4. Comptes multiples, virements, rapprochement « l'app dit X, ta banque dit Y » avec ajustement guidé.
5. Import CSV : préréglages de 11 banques, doublons à ±2 jours, abonnements repérés proposés à l'échéancier.
6. Rappels sans serveur : rappel « demain » à l'ouverture, export .ics (RRULE + alarme la veille), liens #add et #add-income.

- [x] Saisie en 3 touches (montants fréquents, dernière enveloppe)
- [x] Favoris / modèles en un toucher (+ suggestions)
- [x] Opération répartie (faite en phase 4 : ticket réparti)
- [x] Recherche dans le journal (texte, montant, période), étiquettes, notes
- [x] Comptes multiples, virements, rapprochement guidé
- [x] Import CSV : préréglages bancaires, doublons, abonnements repérés
- [x] Rappels : à l'ouverture, export .ics, lien #add
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 5 :
- Le budget reste global : peu importe le compte qui paie, une dépense compte dans son enveloppe. Les comptes servent à suivre les soldes réels et à rapprocher avec la banque.
- Un virement entre comptes et un versement sur projet ne changent pas le solde du compte (un projet est une enveloppe virtuelle) ; pour suivre un livret, on fait un virement.
- Le salaire (qui n'est pas une opération du journal) est crédité au compte courant principal chaque jour de paie.
- L'écart de rapprochement devient une opération « Ajustement » hors enveloppe : elle touche le reste à vivre (c'est presque toujours une dépense oubliée), avec « Annuler ».
- Le solde des réglages (« au début du mois ») devient le solde de départ du compte courant ; la trésorerie de l'agenda part du solde réel des comptes courants quand il est connu.
- Abonnement repéré : au moins 3 paiements, même libellé, montant à ±10 %, rythme régulier (2 écarts sur 3 dans la plage). Ajouté sans repasser les paiements déjà au journal.
- Préréglages bancaires construits d'après les formats publics connus (pas de vrais relevés disponibles) ; la détection automatique reste le choix par défaut.

## Phase 6 — Analyses et optimisation
Plan :
1. Moteur : `healthScore` (6 facteurs, sur 100), `envelopeSuggestions` (3 mois clôturés), `subscriptionsCost`, `noSpendStreak`, `splitNeeds` (50/30/20 indicatif), `monthlyReport`, `spendingHours`.
2. Bilan : cartes « Santé du budget » (facteurs expliqués + évolution), « Suggestions » (boutons « Passer à X € », « Arrêter »), « Rapports » (par enveloppe, revenus et dépenses, épargne cumulée, patrimoine), heures de dépense.
3. Agenda : prévisions sur 6 mois découpées par type, légende, détail au toucher.

- [x] Moteur de suggestions (enveloppe sous-utilisée ou dépassée 3 mois de suite, abonnements, 50/30/20, série sans dépense)
- [x] Rapports (par enveloppe et par mois, revenus contre dépenses, épargne cumulée, patrimoine, jours et heures)
- [x] Prévisions sur 6 mois par type, légende, détail au toucher
- [x] Score de santé sur 100, expliqué, avec son évolution
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 6 :
- Score : reste à vivre (25), enveloppes tenues (20), épargne du mois (20, plein à 20 % des revenus), matelas (15, plein à 3 mois de dépenses), mois à venir (10), suivi et sauvegarde (10). Ce sont des repères pédagogiques, pas des taux financiers ; le score figé est gardé dans l'instantané de clôture.
- Besoins / envies (50/30/20) : classement d'après le nom de l'enveloppe (courses, transport, santé… = besoins) ; affiché « à titre indicatif ».
- Abonnement « peut-être plus utilisé » : abonnement de plus de 6 mois à l'échéancier ; l'app pose la question, sans rien supprimer seule.
- Patrimoine = soldes des comptes ; les projets sont affichés comme la part mise de côté, sans être ajoutés (ce serait les compter deux fois).
- Heures de dépense : heure de saisie des dépenses notées le jour même (l'app ne connaît pas l'heure réelle d'achat).

## Phase 7 — Interface, personnalisation et prise en main
Plan :
1. Couleurs : toutes les teintes claires écrites en dur passent en variables ; `--accent` pour textes et bordures ; palettes clair, sombre, rose pastel, rose bonbon ; « auto » suit le système ; texte agrandi.
2. Enveloppes : couleur et icône (devinées d'après le nom), reprises sur les cartes, les puces de saisie, le journal, le calendrier, le bilan.
3. Pastilles à la place des listes (répétition, période), raccourcis de date, mois écrit en clair.
4. Premier lancement : départ vierge, questionnaire en 7 étapes (relançable), visite guidée en 7 bulles (relançable), « ? » contextuels et glossaire.
5. Accessibilité vérifiée par les tests : noms des boutons, étiquettes des champs, cibles de 44 px, contrastes WCAG des 4 thèmes, aucun débordement à 390 px.

- [x] Couleur et icône pour chaque enveloppe et projet, reprises partout
- [x] Thèmes clair, sombre, rose pastel, rose bonbon, automatique ; variables CSS ; contrastes vérifiés
- [x] Pastilles et boutons à la place des listes (répétition, période) ; dates et mois plus lisibles
- [x] Départ vierge, questionnaire d'installation relançable
- [x] Visite guidée relançable, aide contextuelle « ? », glossaire
- [x] États vides, animations sobres, accessibilité (VoiceOver, focus, taille du texte)
- [x] npm test vert, vérification 390 / 1280 px, commit

Décisions de la phase 7 :
- Les profils prédéfinis (étudiant, jeune actif, famille) sont retirés, comme demandé dans le BACKLOG : le questionnaire part de la situation réelle.
- Les projets saisis dans le questionnaire sont créés en mode Plan (rien n'est réservé) ; on les active depuis leur fiche.
- Relancer le questionnaire ajoute ce qui manque, sans dupliquer ce qui porte déjà le même nom.
- Les listes déroulantes de répétition et de période restent dans le code, masquées, sous les pastilles : le clavier et les tests existants continuent de fonctionner.
- Le gris secondaire du thème clair passe de #94a3b8 à #718096 : l'ancien n'atteignait pas un contraste de 3 sur blanc.

## Phase 8 — Données, sécurité et plusieurs appareils
_À planifier._

## Phase 9 — Qualité et finition
_À planifier._

---

## Points reportés
_(aucun pour l'instant)_
