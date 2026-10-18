# Mandate: Central Bank Tycoon

## Règles non négociables
- 100 % statique. Aucun serveur, aucune base de données, aucune
  fonction serverless, aucun compte utilisateur, aucun classement
  en ligne.
- Aucun appel réseau pendant le jeu, une fois les fichiers statiques
  chargés.
- Aucun appel à un LLM ou à une API d'IA. Les textes de communication
  sont générés localement par des gabarits déterministes.
- Interface et contenu en anglais uniquement.
- TypeScript strict. Le moteur de simulation (src/simulation/)
  n'importe jamais React et ne fait aucun appel réseau.
- Aléatoire toujours seedé : une même seed rejoue exactement la
  même partie.
- La mascotte est un personnage original. Aucun asset sous copyright.

## Avant de dire qu'une tâche est finie
- `npm run build` passe
- `npm test` est vert
- `npm run check:offline` est vert — aucune requête ne sort de l'origine, et
  une partie entière se joue réseau coupé. Après un déploiement, le relancer
  contre le site : `MANDATE_URL=<adresse> npm run check:offline`
- aucune erreur dans la console du navigateur
