# BudgetFold OS — Backlog après les retours sur la v3

Retours du 28/10/2026. Rien n'est encore corrigé : ce fichier sert de feuille de route pour la v4.
Priorités : **P0** = bug, **P1** = important, **P2** = amélioration, **P3** = plus tard.

---

## 1. Bugs constatés (P0)

### 1.1 Projet : la marge est faussée pendant la saisie (mode Actif) — ✅ corrigé
- **Symptôme** : marge réelle 1 500 €. En tapant une mise de 300 €, l'app affiche « Ta marge actuelle : 1 800 € » et « il te resterait 1 500 € » au lieu de 1 200 €. Avec une date et une mise « Auto » de 1 000 €, elle affiche une marge de 2 500 €.
- **Cause** : dans `updateEnvHint` (feuille enveloppe/projet), `projectPlan(probe, d.free)` ajoute la contribution du projet *en cours de saisie* comme s'il était déjà réservé (`own = projectContribution(probe)`). Il ne faut l'ajouter que pour un projet **existant** qu'on modifie.
- **En mode Plan c'est juste** (le projet ne réserve rien), ce qui confirme la cause.
- **Corrigé** : `projectPlan` prend un 3e paramètre `reserved` (ce que le projet bloque déjà). La feuille passe 0 pour un nouveau projet, et la mise **enregistrée** (pas celle en cours de saisie) pour un projet modifié. Tests « bug 1.1 » dans `tests/app.test.js`.

### 1.2 Scan de ticket : lecture mauvaise sur un vrai ticket (Lagardère / Relay, Avignon) — ✅ corrigé (phase 1)
- Résultat obtenu : enseigne « a. LAGAROERE TR FRANCE SNC », 1 seul article « can (5) 5.50% 2,27 0,13 — 2,40 € », date du jour. Le total (4,00 €) était juste.
- Attendu : enseigne « Lagardère Travel Retail » (ou « Relay »), 2 articles (Café expresso 1,60 € ; San Pellegrino 50 cl 2,40 €), date 26/01/2023.
- Causes identifiées dans `parseReceipt` :
  - Lignes au format « Qté · Désignation · P.U. · TTC · Tx » : `1 x CAFE EXPRESSO 1,60 1,60 10`. Le taux de TVA en fin de ligne (« 10 », « 6 ») empêche de reconnaître le montant. Il faut gérer ce format colonne (dernier montant avant un code TVA de 1 ou 2 chiffres) et le préfixe « 1 x ».
  - Article sur 2 lignes (désignation + code EAN, puis prix sur la ligne suivante) : rattacher le prix orphelin à la ligne précédente.
  - Le bloc récapitulatif TVA (« Tx TVA / HT / TVA / TTC », lignes avec `%`) est pris pour un article. Il faut l'exclure (toute ligne avec un `%`, et tout ce qui suit « Tx TVA »).
  - Date ignorée car plus vieille que 400 jours. Il faut la garder et prévenir : « Ticket daté du 26/01/2023 ».
  - Enseigne : ajouter un dictionnaire plus large (Relay, Lagardère, gares…) et corriger les confusions OCR fréquentes (O/D, rn/m).
  - Constituer un **jeu de vrais tickets** (photos) pour les tests automatiques.

### 1.3 Projet « Moto » : impression d'épargne comptée deux fois (diagnostiqué avec le .json du 28/10) — ✅ corrigé (phase 1)
- **Pas de doublon dans les données** : un seul versement de 1 000 € (daté du 16/10), et `saved` = 1 000 €.
- **Ce qui trompe** : le projet est Actif avec une mise de 1 000 €/mois. En octobre, l'app compte donc la mise du mois (1 000 €, réservée) **et** le versement exceptionnel (1 000 €). La part « Projets » affiche 2 000 €.
- **Conséquence** : revenus 2 000 € − (loyer 300 + enveloppes 500 + mise 1 000 + versement 1 000) = **−800 €** de reste à vivre. Le versement n'a pas été bloqué, car les versements ne sont pas vérifiés par rapport à la marge.
- **Autre point** : un projet créé le 28 du mois réserve la mise du mois entier tout de suite.
- **À faire** :
  1. Lors d'un versement sur un projet actif, proposer « C'est la mise de ce mois » : le versement remplace la mise automatique du mois au lieu de s'y ajouter.
  2. Avertir si un versement fait passer le reste à vivre sous 0.
  3. Choisir quand démarre la mise (ce mois-ci ou à la prochaine paie). Voir §2, moment de mise de côté.
  4. Détecter les doublons probables : même montant, même projet, saisi moins de 2 minutes avant.
- **Correction manuelle en attendant** : soit supprimer le versement du 16/10 (Journal → « Versements projets »), soit passer la mise du projet à 0 pour octobre.

---

## 2. Projets et simulation (P1)

- **Libellés plus clairs** :
  - Remplacer « C'est faisable » par « Compatible avec ta marge actuelle (après charges et enveloppes) ».
  - Ne jamais laisser croire que le projet est validé financièrement.
- **Toujours afficher les deux calculs** quand il y a une date et une mise :
  - « Pour [date], il faut X €/mois. »
  - « Avec Y €/mois, tu l'atteins en [date] (Z mois de retard ou d'avance). »
  - « Il te faudrait mettre X − Y € de plus par mois pour tenir ta date. »
- **Choisir quand l'argent est mis de côté** : au jour de paie (recommandé, par défaut), au 1er du mois, ou en fin de mois.
  - Ordre logique d'un mois : paie → épargne projets → prélèvements → enveloppes remplies au fil du mois → reste.
- **Nouvel onglet « Projets / Simulations »** :
  - Simulation complète : objectif, apport, date, mise, revenus futurs, inflation ou taux d'épargne, scénarios (prudent / réaliste).
  - Bilan et conseils (« si tu réduis Sorties de 30 €, tu gagnes 2 mois »).
  - Projets enregistrés, avec **notes libres** (liste d'achats, liens, étapes).
  - Petits et grands projets : maison, moto, achats du quotidien, organisation.

## 3. Fin de mois, remises à zéro et historique (P1)

- **Remise à zéro de toutes les enveloppes d'un coup** : manuelle, ou automatique **au jour de paie** ou **le 1er du mois** (réglage).
- **Choisir quoi faire du reste** à la clôture, enveloppe par enveloppe ou globalement :
  - reporter dans l'enveloppe le mois suivant ;
  - remettre dans le budget du mois suivant ;
  - verser sur un projet, une épargne ou un matelas de sécurité.
- **Historique complet des mois passés** :
  - Rien n'est effacé : un instantané figé par mois (revenus, prévu, dépensé, reste, où est allé le reste).
  - Écran « Historique » avec comparaison mois par mois.
  - Base pour les **optimisations** : enveloppes toujours sous-utilisées ou dépassées, ajustements suggérés.
- **Esprit des enveloppes** : un plafond à ne pas dépasser, pas un objectif à atteindre. Valoriser « bien tenu » (dépensé moins que prévu) dans le Bilan.

## 4. Tickets et justificatifs (P1)

- **Conserver la photo du ticket** liée à la dépense ou au revenu (utile pour une micro-entreprise).
  - Stockage local en **IndexedDB** : localStorage est limité à environ 5 Mo, trop peu pour des photos.
  - Compresser chaque photo (JPEG, environ 1 200 px, environ 150 Ko).
  - Miniature dans le journal, plein écran au toucher, remplacer ou supprimer.
  - Export : sauvegarde complète avec photos (zip), et export « justificatifs » par période (CSV + photos) pour la comptabilité.
- Plus tard : catégories pro/perso, export pour la déclaration micro-entrepreneur.

## 5. Interface (P2)

- **Choix plus visuels** : remplacer les listes déroulantes (répétition, période d'enveloppe) par des pastilles ou boutons segmentés avec icônes. Calendriers et sélecteurs plus jolis.
- **Couleurs personnalisées** pour enveloppes et projets, reprises partout : cartes, puces du calendrier, barres du bilan, prévisions.
- **Thèmes** : clair (actuel), **sombre**, **rose pastel** (clair et « bonbon »).
- **« Les 6 prochains mois »** : barre découpée par type (charges fixes, enveloppes, projets, dépenses prévues, marge) avec légende, et détail au toucher.

## 6. Premier lancement et aide (P2)

- Les profils prédéfinis (Étudiant, Jeune actif, Famille) ne sont pas pertinents. Garder un départ **vierge** par défaut.
- **Questionnaire d'installation** (relançable depuis le menu) :
  - revenus (paie, jour de paie, aides) ;
  - charges fixes (loyer, énergie, abonnements, assurances…) ;
  - habitudes (courses, transport, sorties…) ;
  - projets en cours ;
  - solde actuel.
  - À la fin : enveloppes, échéancier et projets créés à partir des réponses.
- **Guide interactif** (visite guidée façon appli ou jeu) : bulles qui expliquent chaque zone (reste à vivre, bouton +, enveloppes, agenda, bilan). Relançable depuis le menu.

## 7. Ce qui est validé par les testeurs (à garder)

- Le nouvel **échéancier** (récurrences avec fréquences) : « top ».
- L'onglet **Bilan** : apprécié.
- Le bouton + unique et les dépenses prévues.

---

## Notes techniques pour la suite (passage sur Claude Code)

- Code source découpé en parties concaténées dans `script.js` (`a.js` → `f_boot.js`). En v4, passer à des **modules ES**, ou garder un seul fichier avec des sections claires.
- Tests : environ 95 vérifications automatiques dans un vrai navigateur (Puppeteer) et un test OCR de bout en bout. À reprendre dans le dépôt (`tests/`) avec une commande `npm test`.
- **Compatibilité des sauvegardes** : chaque format a un numéro `v`. La règle est de toujours garder la chaîne de migration (v1 → v2 → v3 → v4…) dans `fromAnyVersion`, et un test par ancienne version.
- Photos : IndexedDB et export zip (voir §4).
