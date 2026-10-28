# Tickets de test

Chaque photo de ticket placée ici devient un test automatique du scan (`npm test`, fichier `tests/ocr.test.js`).

## Ajouter une vraie photo
1. Copie la photo dans ce dossier : `tests/tickets/mon-ticket.jpg` (`.jpg`, `.jpeg` ou `.png`).
2. Crée à côté un fichier du même nom avec le résultat attendu : `tests/tickets/mon-ticket.json`.

```json
{
  "merchant": "Relay",
  "total": 400,
  "date": "2023-01-26",
  "dateOld": true,
  "items": [
    { "label": "expresso", "amount": 160 },
    { "label": "pellegrino", "amount": 240 }
  ],
  "envelope": "Courses"
}
```

- Les montants sont en **centimes** (400 = 4,00 €).
- Toutes les clés sont facultatives : seules celles présentes sont vérifiées.
- `items` : soit un nombre d'articles, soit une liste. Pour une liste, `label` est un morceau du libellé (sans tenir compte des majuscules ni des accents) et `amount` le prix exact.
- `envelope` : nom de l'enveloppe proposée, avec les enveloppes de démonstration (`tests/demo.js` : Courses, Transport, Sorties, Coiffeur).
- `dateOld` : `true` si l'app doit prévenir que le ticket est ancien (plus d'un mois avant le 15/10/2026, date simulée des tests).

Les photos restent sur l'ordinateur et dans le dépôt : rien n'est envoyé en ligne, la lecture se fait dans le navigateur de test.

## Tickets générés
`synthetic/` contient des tickets écrits en HTML (avec leur `.json` attendu). Le test les transforme en image avant de les lire, comme une photo.
