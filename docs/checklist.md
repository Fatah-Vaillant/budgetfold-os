# Liste de contrôle avant chaque version

À suivre dans l'ordre. Une case non cochée = pas de publication.

## Code et données
- [ ] `npm test` passe entièrement (aucune erreur console).
- [ ] Si le format des données a changé : `v` incrémenté, migration ajoutée dans `fromAnyVersion` (`js/data.mjs`), un test de migration pour l'ancienne version.
- [ ] Une sauvegarde réelle de la version précédente (`.json`, `.zip`, `.bfold`) s'importe sans perte.
- [ ] Aucune nouvelle dépendance CDN sans version figée ; aucun envoi de données vers un serveur.

## Interface
- [ ] Captures de référence à jour : `npm run test:refs` seulement si le changement visuel est voulu, puis relecture des images dans `tests/reference/`.
- [ ] Vérification à 390 px et à 1280 px, thèmes clair et sombre.
- [ ] `npm run audit` : performance, accessibilité, bonnes pratiques et SEO ≥ 90.
- [ ] Nouvelle icône utilisée ? `npm run build:icons`.

## Version
- [ ] Numéro mis à jour à trois endroits : `package.json`, `VERSION` dans `js/util.mjs`, `CACHE` dans `sw.js` (sinon les téléphones gardent l'ancienne version).
- [ ] `CHANGELOG.md` complété ; `README.md` si une fonction visible change.
- [ ] `npm run build:single` : `BudgetFold.html` régénéré et testé (`tests/single.test.js`).

## Essais sur de vrais appareils (après publication sur GitHub Pages)
- [ ] iPhone (Safari) : installation sur l'écran d'accueil, ajout d'une dépense, scan d'un ticket, Face ID, mode hors ligne.
- [ ] iPad (Safari, portrait et paysage).
- [ ] Android (Chrome) : installation, ajout, scan, empreinte.
- [ ] Ordinateur (Chrome, Firefox ou Safari) : import CSV, export zip, sauvegarde chiffrée.
- [ ] Bandeau « Nouvelle version disponible » vu sur un appareil qui avait l'ancienne version.
