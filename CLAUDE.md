# SpinBet Casino

Le site entier est dans `index.html` (modules `__mods['…']`), publié avec GitHub Pages depuis `main`.

## Affiche « Mise à jour » (à faire à chaque mise à jour d'un jeu)

Chaque fois qu'un jeu est modifié ou ajouté à la demande du propriétaire, ajouter une entrée **en tête** de
`UPDATES` dans le module `updates.js` :

```js
{ game: '<id du jeu>', date: 'AAAA-MM-JJ', title: '<titre court>', items: ['nouveauté 1', 'nouveauté 2'] },
// nouveau jeu : ajouter isNew: true
```

La page de la catégorie du jeu (Machines à sous, Roues & tables, Jeux rapides) affiche alors cette mise à jour en
grande affiche, et la vignette du jeu porte l'étiquette « MISE À JOUR » ou « NOUVEAU » pendant 14 jours.
Textes en français, pour les joueurs.

## Gains

Les RTP visés : machines à sous ≈ 92 %, achats de bonus ≈ 88 %, jeux de table et jeux rapides 94–96 %.
Toute modification qui touche aux gains doit être vérifiée par simulation avant d'être poussée.

## Monnaie

La monnaie du site est le KE (pas d'euro).
