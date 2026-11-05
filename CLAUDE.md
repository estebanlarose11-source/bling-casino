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
- **Anubis, bonus Jugement** (`games/anubis.js`, voulu par le propriétaire) : une colonne pleine ne fusionne plus toute
  seule (seul un cube de lave la fait redescendre ; une colonne pleine ne reçoit que lave ou crâne doré), moins d'objets
  qui tombent (`JPC` 0,12) mais beaucoup plus de crânes (`JW` cube 40 / crâne 20 / doré 3 / lave 4, crânes ×`SKX` = +8 à
  +2 000). Simulation 600 000 bonus : valeur moyenne ≈ ×127 (comme avant), ≈ 12 relances au lieu de 27, médiane ×8.
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
- **Le Pilote** (`games/pilote.js`, id `pilote`, jeu rapide, idée du propriétaire) : l'avion décolle d'un porte-avions
  avec ×1 et vole **sans fin fixe** au-dessus d'une mer semée de porte-avions (voulu par le propriétaire : pas
  d'arrivée prévue, jusqu'à ≈ 30 s). Objets : ×2 / ×3 / ×5 / ×10 et +5 / +20 / +100 (l'avion monte de `UP`), bombes
  ÷2 / ÷3 / ÷5 / ÷10 (descend de `DOWN`, le gain ne tombe jamais sous ×1). Altitude 0 ou 30 objets (réservoir vide) :
  il se pose là où il est, tiré dans `SHIPS` : la mer (perdu) ou un porte-avions ×1, ×2, ×5 doré qui multiplie le
  gain (plafond ×1 000). Pas de petits ±1 (le propriétaire les trouvait inutiles). Tout le vol est tiré au décollage
  (`flight()`, bloc `===ENGINE`), puis animé (canvas 2D, porte-avions croisés en route, « raté de peu » après une
  chute en mer). Sensations (voulu par le propriétaire) : entre deux objets, des leurres frôlés (`decoys`, pour le
  spectacle seulement, le vol est déjà tiré) : bombe « ESQUIVÉ ! », gros multi « RATÉ ! » ; l'avion rebondit quand il
  touche un objet (ressort `jy` / `ja`). Sur ordinateur le jeu prend toute la largeur et la hauteur libre
  (`.game-host:has(> .g-pilote)`) ; en plein écran le ciel couvre tout l'écran et les boutons de mise flottent
  par-dessus (sur téléphone le ciel s'arrête au-dessus des boutons).
  Quitter en plein vol paie quand même un vol qui allait se poser. Simulation `node tools/sim/pilote.js` (lit le
  moteur, 20 M vols) : retour ≈ 95,1 %, posé 34 %, ≥ ×10 un vol sur 205, ≥ ×100 un sur 1 370, ×1 000 un sur 10 300,
  9 objets en médiane (9 vols sur 10 ≤ 22), ×20 à bord au moins une fois dans 17 % des vols.
- **Fluidité sur ordinateur** (fin de la couche `finition`) : le fond de nuit est sur sa propre couche fixe (`body::after`),
  jamais `background: … fixed` sur `body` (repeint toute la page à chaque défilement : 4 → 60 images/s mesuré) ; pas de
  `backdrop-filter` (flou en direct) sur la barre du haut, les menus, la barre du bas et les messages. Ne pas les remettre.
- **Tous les `<style>` sont dans le `<head>`** (avant `<body>`), sinon le navigateur affiche d'abord l'ancien style
  (rouge, icônes géantes) pendant la lecture du code. Ne jamais ajouter de `<style>` plus bas dans la page.
- **Finition** (`<style id="finition">`, dernière couche de style de `index.html`) : fond de nuit à deux lumières,
  panneaux en dégradé avec bord lumineux et coins arrondis (12 px), boutons en dégradé bleu, menus et barre du bas
  en verre, cartes de jeu qui se soulèvent au survol. Elle passe après toutes les autres couches : la modifier en
  priorité pour retoucher l'allure générale. Le mode clair a ses propres lignes en bas de cette couche.
- **Vérification complète** (`tools/verif/robot.js`) : un robot Playwright parcourt les 26 pages et les 47 jeux sur
  ordinateur et téléphone, lance une partie dans chaque jeu et relève erreurs, débordements et textes « undefined ».
  `python3 -m http.server 8123` puis `node tools/verif/robot.js`. À relancer après une grosse modification.
- **Couvertures** (`covers.js`, `poster()`) : un seul gabarit pour tous les jeux (plaque de titre, Bebas Neue, marque).
  Une image avec un titre peint dedans se déclare dans `CROP` (partie gardée, au-dessus du titre).
- **Dessins par code en 3D** (`tools/render3d/`, Three.js) : couvertures des jeux sans image peinte et pièces des
  jeux rapides (`SPRITES`). `cd tools/render3d && npm i three@0.160.0 && node render.js` (couvertures) ou
  `node render.js --pieces` → `assets/games/<id>/…webp` (puis changer `CACHE` dans `sw.js`).

## Immersion

- **Écran d'ouverture des jeux** (`showIntro` dans `pages/game.js`) : affiche du jeu en fond flou, titre, 3 points forts
  (ou les nouveautés de sa dernière entrée `UPDATES`), retour / volatilité / gain max, boutons « JOUER » et « Plein
  écran » (débloquent le son et lancent la musique). À la 1re ouverture de chaque jeu et après chaque mise à jour du jeu
  (localStorage `spinbet_intro` = { id: jour vu }). `?nointro` le saute (captures d'écran). Le chargement d'un jeu
  montre aussi son affiche (`loadingHTML`).
- **Son** (`audio.js`) : tout passe par un compresseur doux + une petite réverbération ; la musique a son propre bus,
  baissé un instant pendant les gros gains, bonus et jackpots (`duck`). Pendant un bonus (`sb:feature` →
  `sb:featureend`), la musique du jeu s'emballe (`hype` dans `core/music.js` : plus rapide, +2 demi-tons, charleston
  et grosse caisse).
- **Ambiance** (`ambiance.js`) : musique lounge sur les pages du site (jamais dans les jeux), allumée par défaut dans
  l'appli installée, éteinte dans un navigateur, interrupteur « 🎵 Musique d'ambiance » du menu (`spinbet_lounge`) ;
  neige sur les pages du site du 1er décembre au 6 janvier (`?neige` pour la voir à toute date).
- **Gros gains en direct** (`live.js`, `BIG_X` = 50) : un gain ≥ ×50 de n'importe quel joueur en ligne passe en
  bandeau chez tout le monde (données de présence déjà lues : aucune lecture Firestore en plus).

## Événements (tournois, jackpot, duels, cashback)

- `events.js` (page `#tournois`) : tournoi du soir (21 h → minuit, heure de Paris, machine qui change chaque jour,
  liste `ROT`) et du week-end (samedi 0 h → dimanche minuit), score = plus gros gain d'un tour en × la mise (bonus
  achetés exclus), prix `KINDS` payés automatiquement à la visite suivante. Happy Hour 22 h → 23 h : gains ×2 sur la
  machine du tournoi (`HH`, plafond par joueur). Encarts de l'accueil (`[data-ev-home]`) et sous les jeux
  (`[data-ev-game]`) : les autres modules s'y ajoutent avec `addHome` / `addGamePill`.
- **Tournois, aide aux joueurs** : sous une autre machine à sous pendant un tournoi en direct, une pastille dit « ce jeu-ci
  ne compte pas » avec un lien vers la bonne machine ; un message prévient que les bonus achetés ne comptent pas et qu'en
  invité le score n'entre pas au classement. Outil GitHub **Actions → « Tournoi »** (`tools/admin/tournoi.mjs`, `verifier` /
  `reparer`) : compare les records des profils (`users/{uid}.tour`) au classement et remet les scores manquants.
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

- **Cartes à collectionner (JCC)** (`jcc.js`, page `#jcc`, menu « Jouer ») : chaque mise de n'importe quel jeu
  (événement `wager` du portefeuille) remplit une barre de √mise points ; `BAR` (500) = un paquet de 5 cartes : bleu
  (classique), violet (rare, ≥ 1 rare), doré (très rare, ≥ 1 épique), chances `PACKS` / `PACK_ODDS`, garantis `PITY`
  (violet tous les 10, doré tous les 40). Raretés `RAR` (Commune, Rare, Épique, Légendaire, avec leur cote en KE),
  3 % de cartes brillantes (cote ×3). Album d'une série complet = `ALBUM` (100 000 KE), une fois par série
  (`profile.jcc.done`). Une carte s'obtient **seulement** dans les paquets ou en l'achetant à un autre joueur (voulu par le propriétaire :
  pas de boutique de cartes), **toujours à sa valeur** (`cote()` : cote de sa rareté, ×3 si brillante ; le Marché ignore
  une offre à un autre prix). Doubles : vendus aux autres joueurs au Marché (comptes seulement, Firestore `market/{id}`,
  la carte quitte la collection pendant la vente ; open → sold par l'acheteur, puis le navigateur du vendeur se paie
  et passe l'offre en paid) ou recyclés dans la Forge (100 points = un paquet violet). Données : `profile.jcc`.
  **Achat de paquets** (demande du propriétaire) : `SHOP_DAY` = 2 paquets par jour (jour de Paris) au maximum, au choix,
  `SHOP` bleu 6 000 / violet 15 000 / doré 40 000 KE (un peu au-dessus de la valeur moyenne des 5 cartes ≈ 5 800 /
  12 300 / 31 000), payés par `wallet.spend` (ne remplit pas la barre), compteur `profile.jcc.shop = { d, n }`.
  Simulation (seul, avec la Forge, 78 cartes) : l'album demande ≈ 140 paquets (médiane), 85 à 250 selon la chance.
  **Nouvelle série (le propriétaire envoie des images tous les 1 à 3 mois)** : ajouter une entrée à la fin de `SERIES`
  (id court, nom, saison, éléments `els`, **75 à 80 cartes** (voulu par le propriétaire) `[id, élément, rareté, nom, emoji ou { img }, texte]`), images
  découpées dans `assets/games/jcc/` (`{ img: 'dossier/fichier' }` sans `.webp`, ≈ 480 px de large), puis changer
  `CACHE` dans `sw.js`. Les paquets s'ouvrent dans la série choisie (la plus récente par défaut) et chaque série a son
  album et ses 100 000 KE. La 1re série « Les Origines » (78 cartes : par élément 14 communes, 7 rares, 4 épiques,
  1 légendaire) : les 3 légendaires sont les 3 cartes du propriétaire (phénix, golem, danseuse), les 75 autres viennent de ses 3 planches
  de 25 dessins (Feu, Terre, Éther), découpées dans `assets/games/jcc/o/` (`f01`…`e25` = place sur la planche, ligne par
  ligne ; suffixe `c` = dessin sans fond rendu transparent, `cut: 1` → affiché entier) ; chaque carte porte le nom de son
  dessin. Le site sait encore afficher une carte « emoji » (art en texte) pour une série pas encore dessinée.
  Liste des cartes pour le propriétaire : `notes/jcc-les-origines-cartes.txt` (dossier `notes/` = ses notes) ; en faire
  une pareille pour chaque nouvelle série.

- **Machine mystère** (`mystere.js`, demande du propriétaire) : une fois par jour, 1 h (`MYST`, entre 12 h et 21 h, heure et
  machine tirées de la date de Paris, `mysteryOf`), une machine à sous cachée apparaît (carte « ? » en tête des machines à
  sous et encart de l'accueil `[data-mystery]`, on la découvre en l'ouvrant). Bonus ≈ 3× plus fréquent : après chaque tour
  payé sans bonus, `MYST.extra` (1/160) de chances d'un BONUS MYSTÈRE offert à la mise du tour, au plus `MYST.cap` (4) par
  joueur et par heure (`profile.myst`). Taux de base des bonus ≈ 1/250 à 1/400 selon la machine : 1/160 en plus ≈ ×3.
- **Bonus offert** : `freeBonus()` des deux moteurs (`core/base.js`, `slot/machine.js`) lance le 1er bonus de la liste
  d'achat sans payer ; compté comme un bonus acheté (tournois, duels, Défi spécial ne le comptent pas).
  `currentGame()` (`pages/game.js`) donne le jeu ouvert.
- **Pubs récompensées en plus** (`ads.js`, toujours au choix du joueur) : `bonus_replay` (après un bonus gagné en jouant,
  bien payé ou pas : rejouer ce bonus gratuitement, 1 par jour, à la même mise au plus, carte `.rp-offer` de `mystere.js`),
  `tour_x2` (doubler un prix de tournoi, bouton dans la fenêtre du prix, 2 par jour), `jcc_pack` (un paquet bleu en plus,
  bouton dans « Acheter un paquet », 1 par jour).
- **Gros gains dans le chat** (`chat.js`) : après un tour ≥ ×50 la mise ou ≥ 100 000 KE (bonus achetés exclus), le compte
  poste tout seul « 🎰 GROS GAIN ! +… KE (×…) sur <jeu> » (message normal, mêmes règles Firestore, 1 par minute au plus),
  affiché en carte dorée avec le lien du jeu.

- **Calendrier de l'Avent** (`avent.js`, page `#avent`, menu Événements de novembre au 6 janvier) : du 1er au 24 décembre
  (Paris), une case par jour, cadeau `DAYS` le même pour tous (KE, tours offerts, paquets, XP ×2 ; le 24 : 50 000 KE +
  paquet doré, ≈ 190 000 KE en tout). Case ratée = pub récompensée `avent_catchup` (3 par jour, jusqu'au 6 janvier).
  Annonce + compte à rebours en novembre. `profile.avent = { y, o }`. En décembre, la notification de 13 h 35
  (`send.mjs`) annonce la case du jour. `?avent=JJ` simule le JJ décembre.
- **« Aujourd'hui sur SpinBet »** (`retour.js`, 1er encart de l'accueil : `addHome(fn, { top: true })`) : le programme du
  jour à l'heure de Paris (machine mystère, événements flash, Battle Royale, tournoi du soir, Loto, Happy Hour,
  calendrier de l'Avent), en cours / dans combien de temps, lien « 🔔 Me prévenir » vers `#appli`.
- **Cadeau « Bon retour »** (`retour.js`, `BACK`) : absent ≥ 3 jours → 5 000 KE, ≥ 7 jours → 10 000 KE + paquet bleu,
  ≥ 14 jours → 20 000 KE + paquet violet (invités : KE seulement), une fois par semaine au plus, avec « Quoi de neuf
  depuis ta dernière visite » (`UPDATES`) et le programme du jour. Dernière visite : `profile.back = { last, paid }`
  (localStorage `spinbet_back` pour les invités, dont le profil est neuf à chaque visite), mise à jour toutes les 5 min.

## Arrivée des visiteurs et partage

- **Cadeau du jour = série de connexion** (`daily.js`, carte en haut de l'accueil `dailyHomeHTML` dans `pages/lobby.js`,
  et page Profil) : 1re semaine 1 000 → 10 000 KE (coffre du 7e jour, `DAILY.amounts`), puis chaque semaine suivante
  3 000 → 10 000 KE (`DAILY.week2`), +10 % par rang ; une journée ratée (plus de 48 h) = retour au jour 1.
  Voulu par le propriétaire : « de l'argent tous les jours pour jouer, mais raisonnable ».
- **Vitesse d'arrivée** (mesurée sur téléphone simulé, 4G lente) : les couvertures des cartes de jeux se dessinent
  quand elles arrivent à l'écran (`lazyThumb` / `scanCovers` dans `pages/lobby.js` : l'accueil en avait 240 d'un coup,
  ≈ 7 400 éléments) ; `route()` ne force plus de mise en page (`offsetWidth`, `scrollTo` quand la page est déjà en
  haut) ; pas de `will-change` sur les cartes ; polices Google chargées sans bloquer l'affichage ; les 3 fichiers
  Firebase se téléchargent ensemble. Ne pas remettre de dessin SVG complet dans `gameCard`.

- **Pas d'écran de connexion à l'arrivée** (`hud.js`) : un nouveau visiteur joue tout de suite en invité. La création
  de compte est proposée au bon moment (carte « Garde tes gains » après un gain ≥ ×25 ou après 20, 60, 150, 300
  parties, `NUDGE`), par la puce du joueur en haut (« 💾 Sauvegarder ») et par tout bouton `[data-signup]`. Un compte
  créé depuis le mode invité garde le solde et la progression de l'invité (`openAccount` dans `profile.js`).
  Un visiteur venu d'un lien de parrainage voit directement l'écran « Créer un compte ».
- **Parrainage** (`social.js`, page `#parrainage`) : l'ami reçoit `REF_KE` = **10 000 KE** à l'inscription (c'est
  l'accroche de chaque lien partagé), le parrain `REF_PARRAIN` 50 000 KE + 50 tours quand l'ami atteint le niveau 2
  (50 filleuls au plus). Encart « 🤝 Invite tes amis » sur l'accueil (`retour.js`).
- **Image de gros gain** (`bigwin.js`) : après un gain ≥ ×50 la mise (bonus achetés exclus), et par les boutons 📸 de
  « Mes gains récents » sous chaque jeu (dès ×10) : image 1080×1920 (couverture du jeu, ×, montant, pseudo, logo,
  adresse du site et lien de parrainage des comptes) à partager ou télécharger.

## Shorts : vidéos de chaque jour (Snap, TikTok, YouTube)

- **Fabrication** (`tools/shorts/make.js`, GitHub Actions **« Shorts »** `.github/workflows/shorts.yml`, chaque jour
  vers 4 h 17 UTC, ou à la main avec un champ « jeux ») : un robot Playwright ouvre 2 machines à sous du jour (tirées
  de la date parmi les machines du catalogue), en plein écran au format téléphone (fenêtre 1080 × 1920 à l'échelle 2 =
  écran 540 × 960 filmé en HD par le « screencast » du navigateur), lance le bonus avec `freeBonus()` et filme ; il
  garde le meilleur de 3 essais (arrêt dès ×40). Bandeau « 🔥 BONUS · <jeu> » en haut, adresse + « jeu gratuit ·
  argent fictif · 18+ » en bas, image de fin (logo, ×, « Joue gratuitement », adresse). Musique : le thème du jeu
  rendu hors ligne dans la page (`OfflineAudioContext`). ffmpeg : 1080 × 1920, 30 images/s, H.264 + AAC,
  58 s au plus (accéléré si le bonus est plus long), ≈ 1 à 3 Mbit/s. Sortie `tools/shorts/out/` (ignoré par git).
- **Rangement** (`tools/shorts/store.mjs`) : branche **`shorts`** du dépôt (pas déployée par Vercel :
  `git.deploymentEnabled`), réécrite en un seul commit chaque jour (pas d'historique qui grossit), 7 derniers jours,
  `index.json` (titre, légende, ×, gain, durée, image d'aperçu).
- **Page `#shorts`** (`shorts.js`, pas dans les menus : adresse à donner au propriétaire,
  www.spinbetcaz.com/#shorts) : lit `index.json` sur raw.githubusercontent.com ; aperçu, « 📤 Partager » (feuille de
  partage du téléphone avec le fichier vidéo : Snap, TikTok…), « ⬇️ Enregistrer », « 📋 Copier le texte ».
  `?shortsbase=<adresse>` pour lire un autre dossier (essais en local).
- **YouTube** (`tools/shorts/youtube.mjs`, dernière étape de la tâche) : envoi par l'API YouTube Data v3 quand les
  secrets `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` existent ; en privé tant que la variable du dépôt
  `YT_PRIVACY` n'est pas `public` (YouTube met de toute façon en privé les vidéos d'une appli pas encore vérifiée
  par Google). Marche à suivre pour le propriétaire : `notes/youtube-mise-en-route.md`. Politique de confidentialité
  demandée par Google : `confidentialite.html` (lien dans les pieds de page).

## Faire venir des joueurs (visibilité)

- **Liens de partage avec grande image** : `j/<id>.html` (fabriqué par `tools/seo.py`, `noindex`) = balises d'aperçu
  du jeu (WhatsApp, Snap, Discord, Messenger, X…) puis envoi immédiat vers `/#game-<id>` en gardant `?ref=` et `?src=`.
  Images 1200 × 630 `assets/share/<id>.jpg` (`node tools/seo/share-images.js [id]`, police `tools/seo/bebas.woff2` ;
  nouveau jeu : la refaire, puis changer `CACHE` dans `sw.js`). Les boutons « Partager ce jeu » (`shareSite`) et le
  texte de l'image de gros gain (`bigwin.js`) utilisent ces liens.
- **D'où viennent les joueurs** (`monitor.js`) : une fois par visite, dans le même document `stats/AAAA-MM-JJ` (pas de
  nouvelle règle Firestore) : `opens._visit`, `opens._new` (1re visite sur l'appareil), `opens._compte` (compte créé),
  `opens._src_<source>` (le `?src=` d'un lien, sinon le site d'origine, sinon parrainage / appli / direct ; sources
  connues seulement : `SOURCES`, le reste = « autre » ; jamais les appareils `?nopub` du propriétaire ni les robots :
  `?nostats` = rien n'est compté, utilisé par le robot des Shorts). Bilan : GitHub Actions **« Stats »** (`tools/admin/stats.mjs`,
  chaque matin ou à la main, nombre de jours au choix) → résumé de la tâche (secret `FIREBASE_SERVICE_ACCOUNT`).
- **Kit de lancement** pour le propriétaire : `lancement.html` (page privée, `noindex`, dans aucun menu) : routine du
  jour / de la semaine (cases cochées gardées sur son téléphone), liens suivis `?src=`, textes prêts à copier
  (WhatsApp, story Snap, TikTok, Facebook, Discord, forums, créateurs, Reddit), marche à suivre itch.io, règles.
- **itch.io / Game Jolt** : `node tools/itch/make.js` (après `python3 tools/bundle.py`, serveur local lancé) →
  `dist/itch/spinbet-itch.zip` (le site en un fichier, sans pub grâce à `window.__SB_ITCH`, pastille « Joue sur
  www.spinbetcaz.com » `?src=itch`),
  `cover.png` 630 × 500 et 5 captures, à envoyer au propriétaire.

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
  images de gros gain par `window.SpinBetApp.share(dataUrl, texte)`.
- **Notifications de l'APK** (`android/…/Notifs.java`, gratuites, sans serveur) : le téléphone se réveille lui-même
  (AlarmManager) aux heures des notifications du site (roue 13 h 35, tournoi 20 h 35, week-end samedi 11 h 35, les 3
  événements flash : même tirage que `flashesOf`, **garder les 3 copies identiques** : `extras.js`, `send.mjs`,
  `Notifs.java`), plus le cadeau du jour (prêt 24 h après le dernier, « ta série va se perdre » 4 h avant 48 h ; la page
  le dit à l'appli par `SpinBetApp.daily`). Message libre (Actions → « Notifications » → Run workflow) : aussi écrit dans
  `push/annonce.json` sur la branche `data`, lu par l'appli à chaque réveil (au moins toutes les 3 h, jamais la nuit).
  Android 13+ demande l'autorisation une fois ; la page `#appli` les allume / coupe (`notifStatus`, `notifOn`, `notifOff`).

## Mot de passe oublié

- Écran « 🔑 Mot de passe oublié » (`forgotPassword` dans `hud.js`) : e-mail Firebase avec lien de retour vers
  `#connexion` (écran de connexion), conseils (spams, expéditeur noreply@cazbabs-a52be.firebaseapp.com), renvoi après
  60 s. « J'ai oublié mon e-mail / rien reçu » → demande d'aide dans Firestore `support/` (même sans compte), visible
  dans la console Firebase.
- Pour donner un nouveau mot de passe : GitHub → Actions → « Mot de passe » (`.github/workflows/mot-de-passe.yml`,
  `tools/admin/password.mjs`) avec le pseudo et le nouveau mot de passe (masqué dans le journal ; l'e-mail du compte
  s'affiche masqué). Secret `FIREBASE_SERVICE_ACCOUNT` nécessaire.

## Publicités

- **Régie : Adsterra** (bannière 300×250, clé `afa82242bb42a0ea2f0431433f3c7947`, site en mainstream, pubs pour adultes
  désactivées), code dans `ads/banner.html` et `ads/index.html`. HilltopAds supprimé du code (il était bloqué en Non-Mainstream 18+).
- **Plus aucune bannière dans les pages du site** (demande du propriétaire : pas de pubs pour adultes sur le site) : `BANNERS = false` dans `hta.js`, les emplacements `[data-hta]` restent cachés. Les pubs ne s'affichent
  que quand le joueur en demande une (pubs récompensées de `ads.js` : +500 KE, recharge, roue ×5/×15, 50 tours…), dans
  une fenêtre avec croix ; chaque pub se charge dans `ads/banner.html` (sa propre petite page, dans une iframe).
  **Pub après 30 secondes** (demande du propriétaire, pas à l'arrivée) : une fois par visite (`sessionStorage spinbet_arrival_ad`),
  `DELAY` = 30 s après l'ouverture, petite fenêtre avec la bannière 300×250 et sa croix tout de suite (+ « Fermer et jouer ») ;
  jamais par-dessus une autre fenêtre ni pendant un tour de jeu (elle attend), ni onglet caché ; fermée toute seule si la
  régie n'envoie rien en 6 s (code juste après `mountHta()`).
  La page `ads/` (« Nos partenaires », lien du pied de page) garde sa bannière. Le propriétaire et les appareils
  `?nopub` ne voient aucune pub (`adpolicy.js`).
- **Règle du propriétaire : une pub = un échange** (jamais forcée, toujours contre une récompense, « Non merci »
  toujours là). Le but est d'en faire voir le plus possible de cette façon :
  - **Coin des récompenses** (`recompenses.js`, page `#recompenses`, menu « 📺 Récompenses vidéo », lien sur
    `#recharger`) : toutes les pubs disponibles tout de suite (`NOW` : +500, recharge, cadeau du jour ×2, roue ×5/×15,
    50 tours, XP ×2, paquet de cartes) et celles qui viennent au bon moment (`LATER`). Pastille rouge sur le
    porte-monnaie du haut = nombre de pubs disponibles tout de suite.
  - **Coffre des pubs** (`ads.js`, `CHEST`) : tous les 5 pubs vues dans la journée (toutes confondues, la fenêtre des
    30 s comprise), un coffre de 2 500 KE, 3 par jour (`profile.ads.views` / `chests`, remis à zéro chaque jour).
  - **Au bon moment** (une carte en bas d'écran, une seule à la fois, 2 min au moins entre deux) : niveau supérieur →
    récompense ×2 (`lvl_x2`, 3/jour) ; gain ≥ ×25 la mise, achats exclus → +50 % jusqu'à 5 000 KE (`win_boost`,
    5/jour) ; bonus rejoué (`bonus_replay`) ; prix de tournoi ×2 (`tour_x2`) ; solde bas (`rescue`). Boutons
    « offert avec une pub » : ticket de Loto (`loto_ticket`) et entrée de la Battle Royale (`br_entry`), 1 par jour.
  - **La fenêtre des 30 secondes** est devenue un cadeau : +200 KE si la pub reste 10 s (« Non merci » et ✕ tout de
    suite, sans cadeau) ; elle compte pour le coffre.
  - Ne jamais récompenser un clic sur une pub (interdit par les régies) : on récompense le temps d'affichage.

## Suivi et administration

- `monitor.js` : erreurs JavaScript des joueurs (`errors/`) et compteurs d'ouvertures / de tours par jeu
  (`stats/AAAA-MM-JJ`, envoyés chaque minute).
- **Plus de page Admin** (supprimée à la demande du propriétaire : il gère tout en passant par Claude). Les données
  restent dans Firestore (`support/`, `reports/`, `errors/`, `stats/`), lisibles dans la console Firebase. Les comptes
  de `admins/` gardent seulement, dans le chat, « supprimer un message » et « rendre muet ».
- Défi spécial : le million est inscrit une seule fois par compte dans `special/{uid}` (règles Firestore) ; un bonus
  ne compte que juste après une vraie mise sur ce jeu.
- Limite connue : les soldes restent écrits par le navigateur du joueur ; une vraie protection demanderait des
  Cloud Functions (forfait Blaze de Firebase).

## Référencement (SEO)

`python3 tools/seo.py` (lancé aussi par `tools/build.py`) fabrique, à partir du catalogue, une page par jeu
(`jeux/<id>.html`), la liste `jeux/index.html`, `sitemap.xml` et `robots.txt` : Google ne lit pas les `#game-…`.
À relancer après un nouveau jeu ou un changement de description, puis commit des fichiers générés.
Chaque page de jeu a ses astuces (`tips()`, écrites à partir du catalogue), ses questions fréquentes (`faq()`, aussi en
données Google `FAQPage`) et 2 captures d'écran `assets/shots/<id>.webp` + `<id>-tel.webp` (nouveau jeu :
`python3 -m http.server 8123` puis `node tools/seo/shots.js <id>`, puis changer `CACHE` dans `sw.js`). Guides dans
`articles/` (liste `ARTICLES` de `seo.py` : « Les meilleures machines à sous gratuites en 2026 », jeux de table, jeux
rapides, RTP et volatilité ; lien « Guides et astuces » en pied de page). Nouvelle machine à sous : l'ajouter à `ORDER`.
- **Titres Google** : `KW` dans `seo.py` = ce que les gens tapent pour chaque jeu (« machine à sous gratuite des dieux
  grecs », « jeu des mines gratuit »…), utilisé dans le titre, le H1, la description et le texte des images. Mots
  génériques seulement (jamais le nom d'un jeu ou d'une marque d'un autre éditeur). Nouveau jeu : lui ajouter son `KW`.
- **8 guides** (`ARTICLES`, `art_for()` : un guide peut viser des jeux précis avec `games`) : meilleures machines à
  sous 2026, jeux de table, jeux rapides, RTP et volatilité, comment gagner aux machines à sous, stratégie de base au
  blackjack (tableau calculé pour les règles du 21 : 6 jeux, croupier reste à 17, doubler après séparation), martingale
  (chiffres calculés : roulette à un zéro), casino gratuit sur téléphone.
- **Liens pour Google sur l'accueil** : `seo.py` écrit entre `<!-- seo-links … -->` et `<!-- /seo-links -->` du pied de
  page d'`index.html` un court texte et les liens réels vers toutes les fiches `jeux/` et les guides (Google ne suit pas
  les `#game-…`). Ne pas modifier ce bloc à la main.
- **Sitemap** : avec les images (couverture + captures) de chaque jeu ; `<lastmod>` ne change que si la page change
  vraiment (`tools/seo/lastmod.json` = chemin → empreinte, date ; à garder dans le dépôt).
- **IndexNow** (Bing, et donc Ecosia, Qwant, DuckDuckGo, Yahoo ; aussi Yandex, Seznam…) : clé = fichier
  `5fba72ec40e4b90febc9cac4f38ce8b3.txt` à la racine (à garder en ligne), `tools/seo/indexnow.py`, lancé par GitHub
  Actions **« IndexNow »** (`.github/workflows/indexnow.yml`) après chaque mise en ligne qui change `sitemap.xml` (il
  attend que Vercel ait publié). À la main : Actions → IndexNow → Run workflow (« tout » = tout le site). Google ne lit
  pas IndexNow : pour lui, le sitemap dans Search Console.

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

Snapchat du site : **spinbetcazino** (`.snap-box` sur Recharger et l'accueil, menu « Notre Snap · code du jour » et
« Service client (Snap) », lien sur l'écran d'aide du mot de passe) : le propriétaire y met un code par jour en story.

Quand le propriétaire demande un code : `python3 tools/code.py` (5 000 KE ; `python3 tools/code.py 3 2500` = 3 codes
à 2 500 KE). Le script ajoute le SHA-256 du code dans `CODES` (`pages/account.js`) et affiche le code : le donner au
propriétaire, puis commit + push sur `main`. Ne jamais écrire un code en clair dans le dépôt. Chaque code ne sert
qu'une fois, par un compte connecté (collection Firestore `codes`).

## Version en un seul fichier

`python3 tools/bundle.py` → `dist/spinbet-casino.html` (non versionné) : tout le site en un fichier (jeux intégrés,
icônes en data:, sans service worker ni manifest), pour un Artifact ou un hébergement d'un seul fichier.
