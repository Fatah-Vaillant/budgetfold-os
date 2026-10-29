# Journal des versions

Format : une entrée par version, de la plus récente à la plus ancienne. Les montants et règles de calcul sont détaillés dans `CLAUDE.md`.

## 1.0.0 — 29 octobre 2026

Première version complète, issue de `ROADMAP-1.0.md` (détail des décisions dans `PROGRESS.md`). Format de données **v4** ; les sauvegardes v1, v2 et v3 sont lues et migrées sans perte.

### Fiabilité
- Marge juste pendant la saisie d'un projet Actif (bug 1.1).
- Versement sur un projet Actif : « C'est la mise de ce mois » remplace la mise au lieu de s'y ajouter (bug 1.3) ; alerte si le reste à vivre passe sous 0 ; doublon probable signalé.
- Projet créé en cours de mois : première mise à la prochaine paie ou dès ce mois-ci.
- Scan des vrais tickets : format en colonnes, prix sur la ligne suivante, bloc TVA ignoré, dates anciennes signalées, enseignes et confusions OCR (bug 1.2).
- Stockage persistant demandé au navigateur, alerte stockage plein, rappel de sauvegarde.

### Mois budgétaire, clôture, historique
- Mois au jour de paie (ou au 1er), suivi par tous les calculs.
- Assistant de clôture : reporter, remettre au budget ou épargner (projet, matelas de sécurité) ; déficit reporté ; clôture automatique possible.
- Instantané figé de chaque mois, écran Historique (3, 6, 12 mois, tendances).
- Déplacer de l'argent entre enveloppes, couvrir un dépassement, tout remettre à zéro.

### Projets et simulations
- Onglet Projets, fiche projet (notes, étapes, versements), liste d'envies.
- Objectifs « X € par mois », « pour une date », « réserve à remplir ».
- Simulateur à trois scénarios (rendement, inflation, hausse saisis par l'utilisateur), comparaison de projets, conseils.

### Justificatifs et micro-entreprise
- Photos et PDF des tickets gardés sur l'appareil (IndexedDB), compressés.
- Exports .zip : sauvegarde complète, justificatifs d'une période (CSV + photos).
- Mode micro-entreprise : CA, cotisations au taux saisi, alertes de seuils.
- Règles de classement modifiables ; recadrage ; ticket réparti entre enveloppes ; facture PDF.

### Usage quotidien
- Montants fréquents, favoris, recherche et étiquettes.
- Comptes multiples, virements, rapprochement avec la banque.
- Préréglages bancaires CSV, abonnements repérés, export .ics des échéances, rappel à l'ouverture.

### Analyses
- Score de santé du budget (6 facteurs expliqués), suggestions, rapports, prévisions par type.

### Interface et prise en main
- Thèmes clair, sombre, rose pastel, rose bonbon, automatique ; texte agrandi.
- Couleur et icône par enveloppe et par projet ; pastilles à la place des listes.
- Questionnaire d'installation, visite guidée, aide et glossaire. Les profils prédéfinis sont retirés.

### Données et sécurité
- Sauvegarde chiffrée par mot de passe (AES-GCM), transfert par QR code.
- Verrou par code (haché) et Face ID / empreinte (WebAuthn).
- Annonce de nouvelle version, page Confidentialité, effacement complet.

### Technique
- Code découpé en modules ES natifs (`js/`), sans étape de build ; `BudgetFold.html` regroupe toute l'app en un seul fichier.
- Icônes Lucide embarquées (seules celles utilisées) : plus aucun script chargé depuis unpkg.
- 18 fichiers de tests (498 vérifications dans un vrai navigateur), dont captures de référence 390 et 1280 px et émulation iPhone, iPad, Android ; audit Lighthouse mobile : performance 92-93, accessibilité, bonnes pratiques et SEO 100.

## 3.0

Version testée par les premiers utilisateurs : enveloppes par période, échéancier, agenda, prévisions sur 6 mois, bilan, import CSV, scan de ticket. Retours dans `BACKLOG.md`.
