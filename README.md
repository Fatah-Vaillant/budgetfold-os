# BudgetFold OS

Application de budget par **enveloppes virtuelles** : salaire, prélèvements récurrents, enveloppes par période, projets d'épargne, agenda, prévisions sur 6 mois, import de relevé CSV et **scan de tickets de caisse** (lecture sur l'appareil).

**100 % locale** : aucune donnée ne quitte l'appareil. PWA installable sur iPhone, iPad, Android et ordinateur.

## Lancer
- En ligne : GitHub Pages (Settings → Pages → branche `main`).
- En local : `npm install`, puis `npm start` et ouvrir http://localhost:5173.

## Tester
`npm test` lance les tests automatiques dans un vrai navigateur : calculs, récurrences, migrations, interface mobile, et scan de ticket.

## Stack
HTML, CSS et JavaScript vanilla, Lucide, Tesseract.js. Aucun framework, aucun serveur.
