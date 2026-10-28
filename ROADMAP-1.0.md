# BudgetFold OS — Feuille de route vers la version 1.0

Ce document décrit le produit fini visé. Il complète `BACKLOG.md` (retours sur la v3) et `CLAUDE.md` (règles du projet).
Chaque phase se termine par `npm test` au vert, une vérification visuelle (390 px et 1280 px) et un commit.
L'avancement est suivi dans `PROGRESS.md` : cases cochées, décisions prises, points restants.

---

## 0. Positionnement : ce qui doit rendre BudgetFold différent

| Solution existante | Ce qu'elle fait bien | Sa limite | Ce que BudgetFold en retient |
|---|---|---|---|
| **YNAB** | Enveloppes, objectifs par catégorie, report du reste d'un mois à l'autre, dépassement retiré du mois suivant | Payant (environ 109 $/an), en anglais, méthode exigeante | Clôture de mois et report, types d'objectifs (« mettre X par mois », « remplir jusqu'à X »), couvrir un dépassement en déplaçant de l'argent |
| **Actual Budget** | Libre, local d'abord, règles de catégorisation, opérations planifiées, rapports | Pensé pour l'ordinateur, appli mobile faible, synchronisation avec serveur à installer | Éditeur de règles, comptes multiples et rapprochement, chiffrement côté appareil |
| **Bankin', Linxo, Finary** | Connexion bancaire, catégorisation automatique, prévisions (Linxo), alertes | Données confiées à un tiers, peu de vraie méthode budgétaire | Prévisions, détection des abonnements, alertes. **Sans** connexion bancaire. |
| **Goodbudget, Fudget** | Enveloppes simples, partage en couple | Saisie 100 % manuelle, analyses pauvres | Simplicité de saisie, foyer partagé (plus tard) |
| **Tricount** | Dépenses partagées entre amis | Pas un outil de budget | Plus tard : dépenses partagées |

**Promesse de BudgetFold** : « Ton budget par enveloppes, qui prévoit tes mois à venir, gratuit, en français, et tes données ne quittent jamais ton téléphone. »
Les quatre piliers : **confidentialité**, **simplicité sur mobile**, **anticipation** (prévisions, projets, simulations), **justificatifs** (tickets photo).

---

## Phase 1 — Fiabilité (bugs P0 de `BACKLOG.md`)
- [ ] 1.1 Marge faussée pendant la saisie d'un projet Actif. Test de non-régression.
- [ ] 1.2 Lecture des vrais tickets :
  - format en colonnes « Qté · Désignation · P.U. · TTC · Tx » ;
  - prix sur la ligne suivante ;
  - bloc TVA ignoré ;
  - dates anciennes conservées avec un avertissement ;
  - dictionnaire d'enseignes élargi (Relay, Lagardère…).
  - Un test par photo réelle (`tests/tickets/*.jpg` avec le résultat attendu à côté, en `.json`).
- [ ] 1.3 Versement sur un projet Actif :
  - proposer « C'est la mise de ce mois » : le versement remplace la mise automatique au lieu de s'y ajouter ;
  - avertir si le reste à vivre passe sous 0 ;
  - détecter un doublon probable (même montant, même cible, moins de 2 min) et demander confirmation.
- [ ] Projet créé en cours de mois : choisir si la première mise compte dès ce mois-ci ou à la prochaine paie.
- [ ] Persistance : appeler `navigator.storage.persist()` ; avertir si le stockage est presque plein ; rappel de sauvegarde si aucun export depuis 30 jours.

## Phase 2 — Cycle du mois, clôture et historique (inspiré de YNAB)
- [ ] **Début du mois budgétaire** réglable : au **jour de paie** (par défaut si renseigné) ou le 1er. Toutes les périodes, enveloppes et bilans suivent ce cycle.
- [ ] **Ordre d'un mois**, affiché dans l'agenda : paie → épargne des projets (au jour de paie) → prélèvements → dépenses des enveloppes au fil du mois → reste.
- [ ] **Remise à zéro** de toutes les enveloppes d'un coup : manuelle, ou automatique au début du mois budgétaire.
- [ ] **Assistant de clôture** au début d'un nouveau mois. Pour chaque enveloppe, et avec un choix global :
  - reporter le reste dans l'enveloppe (« le reste reste là », comme YNAB) ;
  - le remettre dans le budget du mois suivant ;
  - le verser sur un projet ou sur le **matelas de sécurité** (projet spécial, créé par défaut).
  - Un dépassement d'enveloppe est retiré du reste à vivre du mois suivant (comme YNAB).
  - Préférence mémorisée, l'assistant peut s'appliquer automatiquement.
- [ ] **Déplacer de l'argent** entre enveloppes (couvrir un dépassement), avec trace dans le journal.
- [ ] **Historique figé** : un instantané par mois (revenus, prévu, dépensé par enveloppe, reste, destination du reste), jamais modifié a posteriori. Format de données v4 avec migration et tests.
- [ ] Écran **Historique** : liste des mois, détail d'un mois, comparaison sur 3, 6 et 12 mois, tendances par enveloppe.
- [ ] L'idée d'une enveloppe = un **plafond** est rendue visible : badge « Bien tenu » quand on dépense moins que prévu, sans pousser à remplir.

## Phase 3 — Projets et simulations (nouvel onglet « Projets »)
- [ ] Onglet dédié : liste des projets et plans, avec tri (date, priorité) et regroupement (en cours, plans, atteints).
- [ ] **Fiche projet** :
  - objectif, déjà épargné, date souhaitée, mise par mois, moment du versement (paie, 1er, fin de mois), priorité, couleur, icône ;
  - **notes libres** et **checklist** (étapes, liste d'achats, liens) ;
  - historique des versements.
- [ ] **Types d'objectifs** (inspirés de YNAB) :
  - « mettre X € par mois » ;
  - « atteindre X € avant telle date » (calcule la mise) ;
  - « remplir jusqu'à X € » (pour les enveloppes de réserve : entretien voiture, cadeaux…).
- [ ] **Simulateur** :
  - scénarios prudent, réaliste et ambitieux ;
  - apport initial, revenus futurs (augmentation prévue), rendement d'épargne et inflation **saisis par l'utilisateur** (aucun taux codé en dur) ;
  - courbe de progression ; comparaison de deux projets.
- [ ] **Résultats toujours complets** quand une date et une mise sont saisies :
  - la mise nécessaire pour la date ;
  - la date atteinte avec la mise choisie ;
  - l'écart (« il manque X €/mois pour tenir ta date ») ;
  - la formulation « **Compatible avec ta marge actuelle** (après charges et enveloppes) », jamais « faisable ».
- [ ] **Conseils** calculés : « En réduisant Sorties de 30 €/mois, tu gagnes 2 mois », « Tes enveloppes sous-utilisées libèrent environ X €/mois ».
- [ ] Projets de toutes tailles : maison, moto, mais aussi petits achats du quotidien (liste d'envies).

## Phase 4 — Justificatifs, tickets et règles
- [ ] **Photo du ticket conservée** avec chaque dépense ou revenu :
  - stockage en IndexedDB, compressée (JPEG environ 1 200 px, environ 150 Ko) ;
  - miniature dans le journal, plein écran, remplacer ou supprimer ;
  - plusieurs photos possibles (facture de plusieurs pages).
- [ ] **Exports** : sauvegarde complète avec photos (zip) ; export « justificatifs » par période (CSV + photos) pour la comptabilité.
- [ ] **Mode micro-entreprise** (optionnel) :
  - étiquette pro ou perso sur chaque opération ;
  - chiffre d'affaires du mois et de l'année ;
  - provision automatique des cotisations (**taux saisi par l'utilisateur**) ;
  - alerte quand on approche d'un seuil saisi par l'utilisateur (franchise de TVA, plafond du régime).
- [ ] **Règles de catégorisation** modifiables (inspirées d'Actual) : « si le libellé contient X, alors enveloppe Y ». Elles sont apprises automatiquement, visibles et modifiables dans les réglages.
- [ ] **Scan amélioré** :
  - recadrage simple avant lecture ;
  - partager un ticket vers une enveloppe (une ligne vers une enveloppe, une autre ligne vers une autre) ;
  - import d'une facture PDF (texte).

## Phase 5 — Saisie rapide et usage quotidien
- [ ] **Saisie en 3 touches** : montant, enveloppe, valider. La dernière enveloppe et les montants fréquents sont proposés.
- [ ] **Favoris / modèles** (« Café 2 € », « Plein essence ») en un toucher.
- [ ] **Opération répartie** : un ticket réparti sur plusieurs enveloppes.
- [ ] **Recherche** dans le journal (texte, montant, période), **étiquettes**, notes.
- [ ] **Comptes multiples** (courant, livret, espèces), virements entre comptes, **rapprochement** avec le solde réel de la banque : « ton app dit X €, ta banque dit Y € », avec un ajustement guidé.
- [ ] **Import CSV** :
  - préréglages pour les grandes banques françaises ;
  - détection des doublons ;
  - **détection des abonnements récurrents** dans l'historique, avec proposition de les ajouter à l'échéancier.
- [ ] **Rappels** sans serveur :
  - alertes à l'ouverture de l'app ;
  - export des échéances vers le calendrier du téléphone (.ics) pour de vraies notifications ;
  - lien `#add` pour un raccourci iOS « Ajouter une dépense ».

## Phase 6 — Analyses et optimisation
- [ ] **Moteur de suggestions** basé sur l'historique (au moins 2 mois) :
  - enveloppe sous-utilisée ou dépassée 3 mois de suite : proposer un nouveau budget ;
  - coût annuel des abonnements, et ceux qu'on n'utilise peut-être plus ;
  - taux d'épargne et comparaison avec une répartition 50/30/20 (à titre indicatif) ;
  - série de jours sans dépense hors prélèvements.
- [ ] **Rapports** :
  - dépenses par enveloppe et par mois ;
  - revenus contre dépenses ;
  - épargne cumulée ;
  - patrimoine simple (soldes des comptes + projets) ;
  - jours et heures de dépense.
- [ ] **Prévisions sur 6 mois découpées par type** (prélèvements, enveloppes, projets, dépenses prévues, marge), avec légende et détail au toucher.
- [ ] **Score de santé du budget** sur 100, expliqué, avec son évolution mensuelle.

## Phase 7 — Interface, personnalisation et prise en main
- [ ] **Couleur et icône** au choix pour chaque enveloppe et projet (palette accessible), reprises partout : cartes, puces du calendrier, graphiques, prévisions.
- [ ] **Thèmes** : clair, sombre, rose pastel clair, rose bonbon, et automatique selon le système. Toutes les couleurs passent par des variables CSS. Contraste vérifié.
- [ ] **Choix visuels** : pastilles et boutons segmentés avec icônes à la place des listes déroulantes (répétition, période) ; sélecteurs de date et de mois plus lisibles.
- [ ] **Premier lancement** :
  - départ **vierge** par défaut ;
  - **questionnaire d'installation** relançable depuis le menu : revenus et jour de paie, aides, charges fixes, habitudes, projets, solde actuel.
  - À la fin, l'échéancier, les enveloppes et les projets sont créés et peuvent être ajustés.
- [ ] **Visite guidée** (bulles sur chaque zone), relançable. **Aide contextuelle** (« ? ») et petit **glossaire** : reste à vivre, enveloppe, plan, clôture…
- [ ] États vides utiles, animations sobres, accessibilité (VoiceOver, focus, tailles de texte).

## Phase 8 — Données, sécurité et plusieurs appareils
- [ ] **Export chiffré** par mot de passe (WebCrypto AES-GCM). Import et restauration.
- [ ] **Verrou de l'app** (code PIN local, haché ; Face ID via WebAuthn si disponible).
- [ ] **Passer d'un appareil à l'autre sans serveur** : export puis import chiffré, ou QR code pour les petites sauvegardes.
- [ ] Annonce **« Nouvelle version disponible »** (service worker) avec un bouton de mise à jour.
- [ ] Chaîne de migrations v1 → v4 testée. Champ `v` toujours présent.
- [ ] Page **Confidentialité** (RGPD) dans l'app : ce qui est stocké, où, et comment tout effacer.

## Phase 9 — Qualité et finition
- [ ] Découper `script.js` en **modules ES natifs** (sans build), plus un script qui génère la version en un seul fichier (`BudgetFold.html`) pour l'usage hors ligne.
- [ ] Tests :
  - un fichier par domaine (calculs, récurrences, clôture, projets, tickets, interface mobile) ;
  - un test de migration par ancienne version ;
  - des captures de référence 390 et 1280 px ;
  - un audit d'accessibilité et de performance (Lighthouse au-dessus de 90).
- [ ] Documentation : README avec captures, **guide utilisateur** (`docs/guide.md`), `CHANGELOG.md`, liste de contrôle avant chaque version.
- [ ] Version **1.0.0** publiée sur GitHub Pages et testée sur iPhone, iPad, Android et ordinateur.

---

## Hors périmètre de la 1.0 (à décider plus tard, car cela demande un serveur, une société ou un budget)
- **Connexion bancaire automatique** (DSP2, via un agrégateur agréé type Powens, Bridge ou GoCardless) : nécessite un serveur, un contrat et des coûts.
- **Synchronisation en temps réel** entre appareils et **budget de couple partagé** : nécessite un serveur (chiffré de bout en bout, comme Actual).
- **Notifications push** quand l'app est fermée : nécessitent un serveur d'envoi.
- **Apps natives** dans les stores (Capacitor) et **offre payante**.

## Définition de « produit fini » (1.0)
1. Toutes les cases des phases 1 à 9 sont cochées, ou explicitement reportées dans `PROGRESS.md` avec la raison.
2. `npm test` est vert, sans erreur console, à 390 px et à 1280 px.
3. Une personne qui ouvre l'app pour la première fois peut, sans aide extérieure, renseigner sa situation, ajouter une dépense, scanner un ticket, clôturer un mois et simuler un projet.
4. Aucune donnée perdue en passant de v1, v2 ou v3 à la 1.0.
