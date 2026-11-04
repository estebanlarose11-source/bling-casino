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
- **Pas d'effets 3D dans les machines à sous** (choix du propriétaire, `inSlot()` dans la couche d'animations) : ni
  pluie de pièces et gemmes 3D sur les gains, ni médaillon 3D sur les bonus. Les roues et tables gardent les leurs ;
  le grand titre « GROS GAIN ! » reste partout.
- **Tailwind (Le Totem et Le Totem Extrême)** : `games/pharaon.js` et `games/totemx.js` sont écrits avec des classes
  Tailwind préfixées `tw-` (sans remise à zéro de la page). Après une modification de leurs classes ou de
  `tools/tailwind/pharaon.css` / `totemx.css` : `cd tools/tailwind && npm i && node build.mjs` (recompile
  `<style id="tw-games">` dans `index.html`). Le préfixe `pt-` est déjà pris par Le Plateau : Le Totem est en `tm-`,
  Le Totem Extrême en `tx-`.
- **Le Totem Extrême** (`games/totemx.js`) : grille 6×5, totem ×1 ×2 ×3 ×4 ×5 puis en feu ×8 … ×100, FULL SCREEN
  (30 cases scellées) = 21 × la mise × le totem. Réglages vérifiés par simulation : RTP ≈ 92,3 %, achats 43 et 99 fois
  la mise (≈ 87,4 / 88,2 %), full screen ≈ 1 tour sur 1 700, max win ×2 000 ≈ 1 tour sur 55 000.
- **Le Volcan** (`games/volcan.js`, volatilité extrême) : grille 6×5 Pay Anywhere, cascades, pression ×1 → ×16 (chaque
  explosion = 1 point, seuils `TUNE.press` en jeu normal, `TUNE.pressFree` dans l'ÉRUPTION où elle ne redescend jamais),
  pierres de lave ×2 à ×500. Réglages vérifiés par simulation (6 M tours) : RTP ≈ 92 %, un gain 1 tour sur 5, Éruption
  1 tour sur 325 (≈ ×130), achats 150 et 500 fois la mise (≈ 88 / 87 %), max ×25 000 atteignable.
- **Jeu « en travaux »** : `"wip": true` dans sa ligne du catalogue `ORIGINALS` → vignette grisée avec cadenas
  « EN TRAVAUX », page du jeu fermée, absent de `SLOTS`, du Défi spécial (`LIST`), des duels, du jackpot et des pages
  SEO. Pour l'ouvrir : retirer `"wip": true` puis `python3 tools/build.py`. **Le Volcan est en travaux** (demande du
  propriétaire) jusqu'à ce qu'il demande de le finir.
- **La Roulette Russe** (`games/barillet.js`, id `barillet`, volatilité extrême, images du propriétaire dans
  `assets/games/barillet/` : symboles découpés de sa planche, `wildtall.webp` pour le WILD étendu, fond `bg.webp`,
  couverture). Mise en page voulue par le propriétaire (d'après sa référence, couleurs changées) : rouleaux de
  3-4-4-4-3 cases = 576 façons (`ShapedReels`, cellule i = `OFF[c]` + rangée), planches de bois, rouleaux du bord à
  part, plaques « 576 FAÇONS » / titre / MAX, WILD (rouleaux 2 à 4) qui couvre tout son rouleau avec ses badges.
  Une balle d'or + une connexion → le revolver (barillet de 6 balles à côté, qui se vide et se recharge) tire 1 à 3
  balles sur les cases gagnantes : elles prennent feu (×2 à ×10, `.rr-fire` dans chaque rouleau). Gain d'un symbole
  = paiement × façons × multiplicateur moyen de ses façons (Π Σ mult / Π cases, plafond `lineCap`). LE DUEL : grosses
  balles ×2 à ×50, cases en feu gardées jusqu'à la fin (`capFree`, `lineCapFree`). Gains du bonus payés à la fin
  (`pendingC`, payés si le joueur quitte), après la roulette russe (`GAMBLE` ×1,15 … ×5,76, retour 96 %, hors RTP).
  Simulation (3,6 M tours) : RTP ≈ 92 %, un gain 1 tour sur 4 (surtout petits), Duel 1 tour sur 385 (≈ ×130),
  achats 150 / 500 (≈ 88 %).
- **Finition** (`<style id="finition">`, dernière couche de style de `index.html`) : fond de nuit à deux lumières,
  panneaux en dégradé avec bord lumineux et coins arrondis (12 px), boutons en dégradé bleu, menus et barre du bas
  en verre, cartes de jeu qui se soulèvent au survol. Elle passe après toutes les autres couches : la modifier en
  priorité pour retoucher l'allure générale. Le mode clair a ses propres lignes en bas de cette couche.
- **Vérification complète** : un robot Playwright parcourt les 20 pages et les 46 jeux sur ordinateur et téléphone,
  lance une partie dans chaque jeu et relève erreurs, images cassées, débordements et textes « undefined ».
  À relancer après une grosse modification.
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

- **Événements flash** (`extras.js`) : 3 fois par jour, 30 min, gains ×2 sur une machine à sous (bonus achetés exclus,
  plafond `FLASH.cap` par joueur), tirés de la date de Paris (`flashesOf`, entre 12 h et 21 h 30, jamais pendant la
  Happy Hour). Même tirage dans `tools/push/send.mjs` pour la notification : garder les deux identiques.
- **Vibrations** (`extras.js`) : sur les téléphones qui savent vibrer (Android), à l'arrêt des rouleaux, sur les gains
  et les bonus ; interrupteur « 📳 Vibrations » dans le menu (`spinbet_vibe`).
- **Profil public** : `www.spinbetcaz.com/#@pseudo` (`renderPlayer` dans `extras.js`), lu dans `leaderboard`.

- **Paris pour rire** (`paris.js`, page `#paris`) : paris en KE sur les vrais matchs (Ligue 1, C1, C3, Premier League,
  Liga, Serie A, NBA). `tools/matchs/fetch.mjs` (GitHub Actions `matchs.yml`, toutes les 30 min) lit le tableau des
  scores public d'ESPN, calcule les cotes une fois avant le match (Poisson, retour ≈ 95 %) et range
  `paris/matchs.json` sur la branche **`data`** (pas déployée par Vercel : `git.deploymentEnabled`), lue par le site
  sur raw.githubusercontent.com. Paris dans `profile.paris`, payés à la visite suivante ; match reporté = remboursé.

- **Battle Royale** (`battle.js`, page `#battle`) : toutes les heures de 12 h à 23 h (Paris), une machine (tirée de
  l'heure). Entrée 500 KE (inscriptions 1 h avant et pendant la manche 1), 3 manches de 15 min, 10 tours comptés par
  manche (somme des gains en × la mise, achats exclus), la moitié la plus faible éliminée après les manches 1 et 2
  (au moins 2 restent), le meilleur de la finale gagne tout le pot ; seul = remboursé. Firestore
  `battles/{br_<début>}/players/{uid}` (règles). Chaque navigateur se paie lui-même (`profile.br`).
- **Loto** (`loto.js`, page `#loto`) : un ticket par jour (500 KE), 5 numéros parmi 30. Tirage tous les soirs à 21 h 30
  (Paris), fait par GitHub (`tools/loto/draw.mjs`, `.github/workflows/loto.yml`, `crypto.randomInt`) et rangé dans
  `loto/tirages.json` sur la branche **`data`** : personne ne connaît les numéros avant. Gains `PRIZES` : 2 bons = 1 000,
  3 = 3 000, 4 = 25 000, 5 = 1 500 000 KE (retour ≈ 51 %, calculé). Tickets dans `profile.loto`, payés à la visite
  suivante ; ticket acheté après 21 h 30 = tirage du lendemain ; pas de tirage 3 jours après = remboursé.
  Liste des joueurs : chaque compte inscrit son ticket à l'achat dans Firestore `loto/{AAAA-MM-JJ}/players/{uid}`
  (pseudo + numéros, jamais modifié) ; la page montre qui a pris un ticket (jamais les numéros) puis, après le tirage,
  les gagnants et les bons numéros de chacun. Les invités n'y sont pas.
- **La Course Online** (`robots-online`, `RobotsOnlineGame` dans `games/robots.js`, `withRoom`) : forme des robots
  tirée du numéro de manche (`formOf`), arrivée tirée de la graine partagée. Salon dans `roomGame` des règles.

## Arrivée des visiteurs et partage

- **Pas d'écran de connexion à l'arrivée** (`hud.js`) : un nouveau visiteur joue tout de suite en invité. La création
  de compte est proposée au bon moment (carte « Garde tes gains » après un gain ≥ ×25 ou après 20, 60, 150, 300
  parties, `NUDGE`), par la puce du joueur en haut (« 💾 Sauvegarder ») et par tout bouton `[data-signup]`. Un compte
  créé depuis le mode invité garde le solde et la progression de l'invité (`openAccount` dans `profile.js`).
  Un visiteur venu d'un lien de parrainage voit directement l'écran « Créer un compte ».
- **Image de gros gain** (`bigwin.js`) : après un gain ≥ ×50 la mise (bonus achetés exclus), et par les boutons 📸 de
  « Mes gains récents » sous chaque jeu (dès ×10) : image 1080×1920 (couverture du jeu, ×, montant, pseudo, logo,
  adresse du site et lien de parrainage des comptes) à partager ou télécharger.

## Notifications sur le téléphone (gratuit)

- Site : `push.js` (bouton sur la page `#appli`, carte « 🔔 On te prévient ? » après 15 parties ou 30 s dans l'appli
  installée, une fois par semaine au plus) → abonnement enregistré dans Firestore `push/{sha256 de l'adresse}`.
  `sw.js` affiche les notifications et ouvre la bonne page. iPhone : seulement depuis l'icône de l'écran d'accueil.
- Envoi : `tools/push/send.mjs`, lancé par GitHub Actions (`.github/workflows/notifications.yml`) : roue du jour
  13 h 35, tournoi du soir 20 h 35 (avec la machine du jour, lue dans `ROT`), tournoi du week-end samedi 11 h 35
  (heure de Paris). Message libre : Actions → « Notifications » → Run workflow.
- Secrets GitHub nécessaires : `FIREBASE_SERVICE_ACCOUNT` (clé JSON du compte de service Firebase) et
  `VAPID_PRIVATE_KEY` (jamais dans le dépôt ; la clé publique est `VAPID_PUBLIC` dans `push.js` et `send.mjs`).

## Appli (téléchargement)

- Bouton « 📲 Télécharger l'appli » (`[data-get-app]`, `getApp()` dans `pages/app.js`, lien direct
  www.spinbetcaz.com/#telecharger) : Android → installation par Chrome (recommandé) ou fichier APK ; iPhone Safari →
  guide « Partager → Sur l'écran d'accueil » avec flèche ; iPhone hors Safari ou navigateur de TikTok / Insta / Snap →
  « ouvre dans Safari / Chrome » ; ordinateur → lien à ouvrir sur le téléphone.
- **APK Android** (`android/`, Java, WebView sur le site, sans dépendance) : fabriqué par GitHub Actions
  (`.github/workflows/android.yml`) quand `android/` change, publié dans `app/spinbet.apk` (le bouton APK n'apparaît
  que si ce fichier existe). Les mises à jour du site arrivent toutes seules dans l'appli. Secret GitHub
  `APK` (ou `ANDROID_KEYSTORE`, `SPINBET` ; clé de signature en base64, mot de passe `spinbet-app`) : toujours la même clé, sinon les
  téléphones refusent la mise à jour. L'appli se signale par « SpinBetApp » dans le user agent et partage les
  images de gros gain par `window.SpinBetApp.share(dataUrl, texte)`. Pas de notifications dans l'APK.

## Mot de passe oublié

- Écran « 🔑 Mot de passe oublié » (`forgotPassword` dans `hud.js`) : e-mail Firebase avec lien de retour vers
  `#connexion` (écran de connexion), conseils (spams, expéditeur noreply@cazbabs-a52be.firebaseapp.com), renvoi après
  60 s. « J'ai oublié mon e-mail / rien reçu » → demande d'aide dans Firestore `support/` (même sans compte), visible
  sur la page Admin.
- Pour donner un nouveau mot de passe : GitHub → Actions → « Mot de passe » (`.github/workflows/mot-de-passe.yml`,
  `tools/admin/password.mjs`) avec le pseudo et le nouveau mot de passe (masqué dans le journal ; l'e-mail du compte
  s'affiche masqué). Secret `FIREBASE_SERVICE_ACCOUNT` nécessaire.

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
