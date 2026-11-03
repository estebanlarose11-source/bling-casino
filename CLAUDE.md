# SpinBet Casino

**Méthode de travail voulue par le propriétaire :** chaque demande est mise en ligne directement (commit + push sur
`main`, sans branche ni pull request), puis le fichier unique `python3 tools/bundle.py` → `dist/spinbet-casino.html`
lui est envoyé pour qu'il le garde.

Le site est publié depuis `main` ; adresse officielle : https://www.spinbetcaz.com/ (liens de parrainage et de partage, `SITE` dans `social.js`).

- `index.html` : tout le site (modules `__mods['…']`, CSS, art SVG, catalogue `games/index.js`, lobby, pages).
- `games/<fichier>.js` : le code de chaque jeu, chargé à la première ouverture du jeu (`games/impl/index.js`
  dans `index.html` liste `[fichier, module, classe, version]`). **Après toute modification d'un fichier de
  `games/`, lancer `python3 tools/build.py`** : il met à jour les versions (`?v=`), sinon les joueurs gardent
  l'ancienne version en cache.
- Nouveau jeu : son module dans `games/<id>.js`, une entrée dans `FILES` (puis `tools/build.py`), le catalogue
  `ORIGINALS`, la couverture (`covers.js` : `SPECS` et `CARD`), la musique (`EXTRA_THEMES`), le CSS dans
  `index.html` et l'affiche `UPDATES`.
- **Défi spécial** (`special.js`, page `#special`) : débloquer tous les bonus de toutes les machines à sous et roues,
  en jouant (achats exclus) → 1 000 000 KE, +100 000 KE par machine ajoutée après le lancement (payés tout seuls à
  ceux qui ont fini). **Chaque nouvelle machine à sous ou roue doit avoir sa ligne dans `LIST`** (ses bonus, avec le
  titre de `featureIntro` ; une roue envoie `sb:bonus`), sinon elle ne compte pas et les 100 000 ne sont pas versés.
- `sw.js` + `manifest.webmanifest` + `assets/` : application installable. Changer `CACHE` dans `sw.js` si
  `assets/` change.
- `firebase/firestore.rules` : règles Firestore (à recoller dans la console Firebase si elles changent, voir
  `FIREBASE.md`). Toute nouvelle collection Firestore doit y être ajoutée, sinon elle est refusée.

## Graphismes

- **Rouleaux en WebGL** (`core/pixi.js`, PixiJS 7.4.2 hébergé dans `vendor/pixi.min.js`, chargé par `window.__loadPixi`) :
  pendant la rotation, `core/reels.js`, `slot/machine.js` et `core/grid.js` dessinent les symboles dans un canvas Pixi
  (flou de mouvement, suspense, éclat à l'arrêt, étincelles des gains) puis rendent la main aux cases HTML à l'arrêt.
  Repli HTML automatique (pas de WebGL, animations coupées, image pas encore prête).
- **Contextes WebGL** : un téléphone n'en garde que quelques-uns ouverts (au-delà, il coupe les plus anciens, souvent
  les rouleaux). Ne jamais créer un `WebGLRenderer` / une `PIXI.Application` par gain ou par bonus : réutiliser une
  seule toile (pluie de pièces `#tl-win`, effets de bonus `#tl-fx`, cachées entre deux usages) et, pour une toile
  jetée, appeler `forceContextLoss()`. Les rouleaux Pixi repassent en HTML tout seuls si leur contexte est perdu.
- **Couvertures** (`covers.js`, `poster()`) : un seul gabarit pour tous les jeux (plaque de titre, Bebas Neue, marque).
  Une image avec un titre peint dedans se déclare dans `CROP` (partie gardée, au-dessus du titre).
- **Dessins par code en 3D** (`tools/render3d/`, Three.js) : couvertures des jeux sans image peinte et pièces des
  jeux rapides (`SPRITES`). `cd tools/render3d && npm i three@0.160.0 && node render.js` (couvertures) ou
  `node render.js --pieces` → `assets/games/<id>/…webp` (puis changer `CACHE` dans `sw.js`).

## Événements (tournois, jackpot, duels, cashback)

- `events.js` (page `#tournois`) : tournoi du soir (21 h → minuit, heure de Paris, machine qui change chaque jour,
  liste `ROT`) et du week-end (samedi 0 h → dimanche minuit), score = plus gros gain d'un tour en × la mise (bonus
  achetés exclus), prix `KINDS` payés automatiquement à la visite suivante. Happy Hour 22 h → 23 h : gains ×2 sur la
  machine du tournoi (`HH`, plafond par joueur). Encarts de l'accueil (`[data-ev-home]`) et sous les jeux
  (`[data-ev-game]`) : les autres modules s'y ajoutent avec `addHome` / `addGamePill`.
- **Max win** : chaque machine à sous a un gain maximum par tour, bonus compris (`max` du catalogue → `maxX`),
  appliqué par `core/base.js` (`win()`) et `slot/machine.js` (`payOut()`). Fin de chaque tour payé : événement
  `sb:roundend` ; max win atteint : `sb:maxwin`. **Nouvelle machine à sous : lui donner un `max` atteignable**
  (vérifié par simulation), sinon le jackpot ne peut pas tomber dessus.
- `jackpot.js` (page `#jackpot`) : jackpot commun, 1 % des mises (comptes connectés), gagné au max win d'une machine
  à sous (100 % dès 100 KE de mise, sinon une part), repart de 100 000 KE.
- `duels.js` (page `#duels`) : duels entre amis sur une machine à sous (20/50/100 tours, mise de duel, 24 h).
- `cashback.js` (page `#cashback`) : chaque jour, 5 à 25 % des pertes de la veille selon le total misé.

## Arrivée des visiteurs et partage

- **Pas d'écran de connexion à l'arrivée** (`hud.js`) : un nouveau visiteur joue tout de suite en invité. La création
  de compte est proposée au bon moment (carte « Garde tes gains » après un gain ≥ ×25 ou après 20, 60, 150, 300
  parties, `NUDGE`), par la puce du joueur en haut (« 💾 Sauvegarder ») et par tout bouton `[data-signup]`. Un compte
  créé depuis le mode invité garde le solde et la progression de l'invité (`openAccount` dans `profile.js`).
  Un visiteur venu d'un lien de parrainage voit directement l'écran « Créer un compte ».
- **Image de gros gain** (`bigwin.js`) : après un gain ≥ ×50 la mise (bonus achetés exclus), et par les boutons 📸 de
  « Mes gains récents » sous chaque jeu (dès ×10) : image 1080×1920 (couverture du jeu, ×, montant, pseudo, logo,
  adresse du site et lien de parrainage des comptes) à partager ou télécharger.

## Suivi et administration

- `monitor.js` : erreurs JavaScript des joueurs (`errors/`) et compteurs d'ouvertures / de tours par jeu
  (`stats/AAAA-MM-JJ`, envoyés chaque minute).
- Page `#admin` (lien « 🛠️ Admin » du menu, visible des seuls comptes de la collection `admins/`) : jeux les plus
  joués sur 7 jours, signalements des joueurs (`reports/`, bouton « 🚩 Signaler » de la fiche joueur) avec
  « rendre muet », dernières erreurs.
- Défi spécial : le million est inscrit une seule fois par compte dans `special/{uid}` (règles Firestore) ; un bonus
  ne compte que juste après une vraie mise sur ce jeu.
- Limite connue : les soldes restent écrits par le navigateur du joueur ; une vraie protection demanderait des
  Cloud Functions (forfait Blaze de Firebase).

## Référencement (SEO)

`python3 tools/seo.py` (lancé aussi par `tools/build.py`) fabrique, à partir du catalogue, une page par jeu
(`jeux/<id>.html`), la liste `jeux/index.html`, `sitemap.xml` et `robots.txt` : Google ne lit pas les `#game-…`.
À relancer après un nouveau jeu ou un changement de description, puis commit des fichiers générés.

## Affiche « Mise à jour » (à faire à chaque mise à jour d'un jeu)

Chaque fois qu'un jeu est modifié ou ajouté à la demande du propriétaire, ajouter une entrée **en tête** de
`UPDATES` dans le module `updates.js` :

```js
{ game: '<id du jeu>', date: 'AAAA-MM-JJ', title: '<titre court>', items: ['nouveauté 1', 'nouveauté 2'] },
// nouveau jeu : ajouter isNew: true
```

La page de la catégorie du jeu (Machines à sous, Roues & tables, Jeux rapides) affiche alors cette mise à jour en
grande affiche, et la vignette du jeu porte l'étiquette « MISE À JOUR » ou « NOUVEAU » pendant 14 jours.
Textes en français, pour les joueurs : pas de mots techniques (WebGL, PixiJS, RTP…), dire ce que le joueur voit
(« Rouleaux plus fluides et plus spectaculaires »).

## Gains

Les RTP visés : machines à sous ≈ 92 %, achats de bonus ≈ 88 %, jeux de table et jeux rapides 94–96 %.
Toute modification qui touche aux gains doit être vérifiée par simulation avant d'être poussée.

## Monnaie

La monnaie du site est le KE (pas d'euro). Dans les montants affichés, « KE » est remplacé par son logo (une pièce
avec un K barré) : le caractère `\uE1E0`, dessiné par une mini-police intégrée dans le CSS. Écrire les montants avec
`fmt()` / `fmtC()` ou `…\u00a0\uE1E0` ; garder « KE » en toutes lettres dans les textes partagés hors du site.

Mises : KE entiers, de 1 à 10 000 KE (`BETS` dans `core/base.js`), plafonnées par le solde du joueur.

## Codes cadeaux (page Recharger)

Quand le propriétaire demande un code : `python3 tools/code.py` (5 000 KE ; `python3 tools/code.py 3 2500` = 3 codes
à 2 500 KE). Le script ajoute le SHA-256 du code dans `CODES` (`pages/account.js`) et affiche le code : le donner au
propriétaire, puis commit + push sur `main`. Ne jamais écrire un code en clair dans le dépôt. Chaque code ne sert
qu'une fois, par un compte connecté (collection Firestore `codes`).

## Version en un seul fichier

`python3 tools/bundle.py` → `dist/spinbet-casino.html` (non versionné) : tout le site en un fichier (jeux intégrés,
icônes en data:, sans service worker ni manifest), pour un Artifact ou un hébergement d'un seul fichier.
