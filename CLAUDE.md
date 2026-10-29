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
- `npm test` est vert — y compris `src/lintGuards.test.ts`, qui fait échouer
  les deux règles de lint qui sont des bugs et non du style : un hook après
  un retour anticipé, et une opacité posée sur un élément qui porte du texte
- `npm run lint` n'a pas d'erreur (les avertissements sont tolérés)
- `npm run check:words` est vert — la surface rapide reste sous 75 mots de
  prose. Le plafond est un **relevé** : il était à 60, mais le compte ne
  couvrait pas la ligne d'ordre — l'outil ne mesurait que
  `[data-tempo="quick"]`, qui ne contient pas la bannière. Toute addition
  remplace, elle ne s'ajoute pas. Ce qui rend le plafond sûr est `npx tsx src/simulation/dev/orderOnly.ts`,
  qui joue un lecteur ne voyant que la ligne d'ordre et tient 40/40 mandats
  faciles — le reste des mots est donc facultatif
- `npm run check:figures` est vert — l'écran par défaut, **sur téléphone**,
  reste sous 13 chiffres. C'est le jumeau du budget de mots et il mesure ce
  que celui-ci ne peut pas voir : cinq pourcentages alignés sous une barre,
  c'est cinq chiffres et presque aucune prose. Le détail se replie derrière un
  en-tête, et **un panneau replié affiche son état en un mot** — sinon c'est
  une boîte mystère et personne ne l'ouvre
- `npm run check:classes` est vert — aucun nom de classe de `src/` n'est
  absent de la feuille de style générée. Tailwind n'émet rien pour une
  couleur inconnue : la classe ne fait alors rien du tout, le texte hérite,
  et ça peut rester invisible dans une direction visuelle et illisible dans
  l'autre
- `npm run check:offline` est vert — aucune requête ne sort de l'origine, et
  une partie entière se joue réseau coupé. Après un déploiement, le relancer
  contre le site : `MANDATE_URL=<adresse> npm run check:offline`
- aucune erreur dans la console du navigateur
