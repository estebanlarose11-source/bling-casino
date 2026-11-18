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
  pluie de pièces et gemmes 3D sur les gains, ni médaillon 3D sur les bonus. Les roues et tables gardent les leurs, **sauf
  Le Plateau Live et La Roue Folle** (et leurs versions Online / retirées : `NO3D`, demande du propriétaire du 18 novembre 2026 :
  rien en 3D par-dessus la vidéo de la présentatrice ; l'écouteur `sb:bonus` passe aussi par `inSlot()`) ;
  le grand titre « GROS GAIN ! » reste partout.
- **Tailwind (Le Totem et Le Totem Extrême)** : `games/pharaon.js` et `games/totemx.js` sont écrits avec des classes
  Tailwind préfixées `tw-` (sans remise à zéro de la page). Après une modification de leurs classes ou de
  `tools/tailwind/pharaon.css` / `totemx.css` : `cd tools/tailwind && npm i && node build.mjs` (recompile
  `<style id="tw-games">` dans `index.html`). Le préfixe `pt-` est déjà pris par Le Plateau : Le Totem est en `tm-`,
  Le Totem Extrême en `tx-`.
- **Le Totem Extrême** (`games/totemx.js`) : grille 6×5, totem ×1 ×2 ×3 ×4 ×5 puis en feu ×8 … ×100, FULL SCREEN
  (30 cases scellées) = 21 × la mise × le totem. Réglages vérifiés par simulation : RTP ≈ 92,3 %, achats 43 et 99 fois
  la mise (≈ 87,4 / 88,2 %), full screen ≈ 1 tour sur 1 700, max win ×2 000 ≈ 1 tour sur 55 000.
- **Le Valhalla** (`games/viking.js`, id `viking`, demande du propriétaire du 11 novembre 2026, **à la place du Volcan**, supprimé) :
  d'après sa capture d'une machine viking (disposition reprise, **cadre, crête, pilier et boutons dessinés par nous** :
  `CREST`, `PILLAR`, `SKY`) avec **ses symboles** (planche `tools/art/viking-planche.jpg`, découpée et détourée par
  `tools/art/viking.py`, `pip install "rembg[cpu]"` → `assets/games/viking/` : `s0`…`s3` J Q K A, `s4` corne, `s5` marteau,
  `s6` casque, `s7` chope, `s8` guerrière, `s9` corbeaux, `s10` berserker, `wild` / `scat` = cadres entiers, `wild-c` /
  `scat-c` = portraits des cases et des jauges, `cover`). **La valkyrie = WILD** (rouleaux 2 à 5), **le vieux viking (« le
  Jarl ») = SCATTER**. 5×4, 25 lignes. 4 Jarls = BONUS VALHALLA : 15 tours gratuits, 5 WILD posés qui restent collés et
  chaque nouveau WILD reste aussi (calque `.vk-sticky` au-dessus des rouleaux).
  **Jauges des héros à gauche** (voulu par le propriétaire, gardées par mise : localStorage `spinbet_viking_m`) : 1 point par
  Jarl (1 à 3) et par WILD qui tombent, le portrait s'anime ; Jarl à 250 = le bonus sans les 4 Jarls ; valkyrie à 500 (ou
  5 Jarls) = **LA VALKYRIE GÉANTE** (voulu par le propriétaire : « un cube qui se déplace partout à chaque spin et plus il
  connecte plus il devient gros ») : 10 tours gratuits, WILD géant 2×2 placé ailleurs à chaque tour (`giantRun`,
  `.vk-giant`), chaque ligne gagnante qui passe par lui = 1 connexion, `GIANT.need` 18 / 45 / 100 connexions → 3×3, 4×4,
  puis toute la grille ; gains de ce bonus ×`KG` 0,5. Barre du bas en pierre comme sa capture (`vk-ctl` : lignes, mise,
  MISE MAX, tourner, auto, gain, solde), téléphone en hauteur (héros au-dessus, barre sur 2 rangées) et en largeur.
  Achats ×77 / ×315. Simulation `node tools/sim/viking.js` (6 M tours, jauges comprises) : RTP ≈ 92 % (lignes 54, bonus 38),
  un gain 1 tour sur 3,8, un bonus 1 tour sur 246 (4 Jarls 1/905, jauge Jarl 1/403, Valkyrie géante 1/2 090), achats ≈ 88 %,
  max ×1 000 (≈ 1 Valkyrie géante sur 120 ; grille entière dans ≈ 27 % d'entre elles).
- **L'Anubis, décors animés** (`games/anubis.js`, demande du propriétaire du 15 novembre 2026, comme L'Hydre) : **ses 4 vidéos**
  `tools/art/anubis/` : le temple du jeu de base `fond-large.mp4` (672 × 448, `.an-l`) / `fond-haut.mp4` (448 × 672, `.an-p`) et la salle
  des bonus `bonus-large.mp4` / `bonus-haut.mp4` (9 s, `.an-b` : 5 cases en haut, grille, 3 barres violettes « LIVES »).
  `tools/art/anubis/clean.py` efface MINI / MAJOR / GRAND JACKPOT (pas de jackpot : nos plaques SOLDE / MULTIPLICATEUR / GAIN,
  `.an-plate`, le multiplicateur = `.gm-meter`), « $1.00 » et « LIVES » (on écrit RELANCES) → `assets/games/anubis/fond-*.mp4`,
  `bonus-*.mp4` + `scene-*.webp`. Les classes `judge` / `under` sur la machine passent à la salle des bonus (`orient()`, `clsObs` ;
  boucles différentes : `LOOP.fond` / `LOOP.bonus`, `VideoBg.loop` se change). Jugement : multiplicateurs des colonnes (`jrow`) dans
  ses 5 cases du haut, relances = ses 3 barres (`.jbars i`, `bars()` : **figées** : sa vidéo les allume et les éteint toute seule en boucle, elles sont couvertes par une image fixe `bars-large.webp` / `bars-haut.webp` (`tools/art/anubis/bars.py` : en haut allumées, en bas éteintes) ; **une barre s'éteint après chaque relance où rien ne tombe** (classe `lose`, éclair puis éteinte), **les 3 se rallument dès qu'un objet tombe** (`gain`), voulu par le propriétaire le 17 novembre 2026) ; Monde souterrain : `mrow`
  dans les cases du haut, tours restants sur les barres (`.an-left`) ; plaque du bonus `.an-bhud` (`hud()`). Barre cliquable `.an-hot`
  (base seulement). **Cubes du Jugement = son image** (`tools/art/anubis/cubes.jpg`, `cubes.py`) : glace `jc-ice` (tombe), pierre
  `jc-stone` (posé, multiplicateur écrit dessus `.sg-lab.jv`), crâne de pierre `jc-skull` (+), crâne doré `jc-gold` (×), lave `jc-lava`.
  Piège : le cube qui tombe (`.jfly`) a son image en `position: absolute` (sinon elle devient carrée dans une case large). Gains inchangés.
- **Anubis, bonus Jugement** (`games/anubis.js`, voulu par le propriétaire) : une colonne pleine ne fusionne plus toute
  seule (seul un cube de lave la fait redescendre ; une colonne pleine ne reçoit que lave ou crâne doré), moins d'objets
  qui tombent (`JPC` 0,12) mais beaucoup plus de crânes (`JW` cube 40 / crâne 20 / doré 3 / lave 4, crânes ×`SKX` = +8 à
  +2 000). Simulation 600 000 bonus : valeur moyenne ≈ ×127 (comme avant), ≈ 12 relances au lieu de 27, médiane ×8.
- **Jeu « en travaux »** : `"wip": true` dans sa ligne du catalogue `ORIGINALS` → vignette grisée avec cadenas
  « EN TRAVAUX », page du jeu fermée, absent de `SLOTS`, du Défi spécial (`LIST`), des duels, du jackpot et des pages
  SEO. Pour l'ouvrir : retirer `"wip": true` puis `python3 tools/build.py`. Le propriétaire essaie un jeu en travaux
  avec `?essai` dans l'adresse (`renderGame` dans `pages/game.js`).
- **Jeux retirés** (demande du propriétaire du 16 novembre 2026 : La Pizza Yo-Yo `taco`, Le Totem `pharaon`, Le Labo `labo`, Le
  Le Filon `filon`, Le Plateau `plateau`, puis Le Plateau Online `plateau-online` ; Le Coffre aux Pirates `pirates`, retiré
  le même jour, **remis en ligne** avec son nouveau décor, sans revenir dans les listes des tournois et événements) : `"wip": true, "retired": true` dans
  leur ligne d'`ORIGINALS`. Ils sortent de `ALL_GAMES` (accueil, catégories, `SLOTS`, Défi spécial, pages SEO, affiches `UPDATES` : `LIVE`),
  mais `getGame()` les trouve encore (`RETIRED` du catalogue) : records, historique, profils. Page du jeu = « 🚫 Machine retirée » (sauf
  `?essai`). **Succès gardés** : `mySlots()` d'`achievements.js` ajoute une machine retirée si le joueur y a quelque chose, avec
  l'étiquette « Machine supprimée » (`RET_TAG`), récompenses déjà gagnées encore récupérables, plus de prestige ni de bouton Jouer ;
  trophées de prestige gardés. Retirés aussi des listes écrites à la main : `ROT` (tournois), les 2 `POOL` (flash, Battle Royale) **et
  leurs copies** `tools/push/send.mjs` / `Notifs.java`, défis de la semaine `CATS`, missions `GAMES`, jeux préférés des joueurs de la
  maison. **Pour en remettre un** : enlever `"wip": true, "retired": true` de sa ligne, le remettre dans ces listes (mêmes copies),
  puis `python3 tools/build.py`.
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
  **Décor animé du 15 novembre 2026** (demande du propriétaire, comme L'Hydre ; remplace planches, plaques et barillet à côté) :
  **ses 2 vidéos** `tools/art/barillet/fond-large.mp4` (672 × 448, `.rr-l`) et `fond-haut.mp4` (448 × 672, `.rr-p`) : le saloon, le
  cow-boy au bar, la lanterne, 3 plaques, cadre en bois à cases peintes, barre BET / BONUS MENU / SPIN / MAX BET et un revolver.
  `tools/art/barillet/clean.py` efface « $1.00 », les mots et montants MINI / MAJOR / GRAND (le jeu n'a pas de jackpot) et « HOLD FOR
  AUTO » → `assets/games/barillet/fond-*.mp4` + `scene-*.webp`. Rouleaux sur ses cases (`.rr-win`) ; **la vidéo haute peint 3-5-5-5-3
  cases** : les cases du jeu y portent la case peinte (`cell.webp`, `--rr-cell`) et couvrent sa grille (4 cases au milieu). Nos plaques
  sur les siennes (`plates()`) : SOLDE · BARILLET (6 balles, `.rr-pips`) · GAIN, et pendant le Duel TOURS · EN FEU · gain du duel
  (`duelInfo` ; bandeau habituel caché). Les tirs partent de son revolver (`.rr-barrel`, invisible). Barre cliquable (`.rr-hot` ;
  la vidéo large n'a pas de − / + : boutons ajoutés de chaque côté de la mise), SPIN maintenu = « Bonus & menu » (tours auto,
  « MAINTENIR POUR AUTO » écrit à la place de son texte). Plein écran `layout()` comme L'Hydre. Gains inchangés.
- **Le Filon** (`games/filon.js`, id `filon`, ouvert le 9 novembre 2026 avec les images du propriétaire : symboles
  découpés de sa planche (cases en bois gardées, numéros effacés), son fond de galerie `fond.webp`, `fond-bonus.webp` =
  le même, plus doré ; couverture = centre du fond). Machine à sous faite d'après son cahier des charges
  (mécanique d'un jeu existant, mais thème, noms et dessins originaux : une mine d'or). Grille 7×7 Pay Anywhere
  (10 symboles ou plus, jokers compris), cascades, un multiplicateur par case (×2 au 1er gain sur la case, puis doublé ;
  gain = table × moyenne des multiplicateurs de ses cases ; jeu de base : remis à zéro à chaque tour, plafond ×128),
  minerai mystère (devient un symbole, ×2 / ×4 / ×8 sur sa case), minerai contagieux (sur toutes les cases de ce
  symbole), dynamite (quand il n'y a plus de gain : 3×3, enlève les symboles qui paient, double les multiplicateurs),
  joker doré. 3 / 4 / 5 BONUS → LA VEINE D'OR (7 tours, 1 bonus de la roue), LA GRANDE GALERIE (8 tours, 2 bonus),
  LA RUÉE VERS L'OR (10 tours, les 3) ; roue des bonus (`wheel()`) : minerai contagieux, grosse dynamite 5×5, lampes
  doubles (+2) ; lampes +1 tour ; multiplicateurs gardés pendant tout le bonus (un gain les monte jusqu'à ×128,
  minerais et dynamite jusqu'à ×8 192), table ÷ 8 pendant le bonus (`payFree`). Mise boostée ×2 (`ante` : BONUS
  ×1,61 ; bouton au-dessus de la grille et « Bonus & menu » ; max win sur la mise de base : `capC`, `maxCheck`),
  achats ×95 / ×225 / ×765, Tirage chance ×200 (60 / 30 / 10 %), Tour doré ×5 (10 cases de ×8 à ×1 024, `GOLD`).
  Simulation `node tools/sim/filon.js` (6 M tours) : RTP ≈ 92 %, mise boostée ≈ 92 %, un bonus 1 tour sur 275,
  achats ≈ 88 %, max ×30 000 atteint (≈ 1 Ruée vers l'or sur 15 000 à 60 000). **Mise en page** (demande du propriétaire, comme L'Anubis / L'Olympe) : `fond.webp` derrière toute la machine
  (`.slot-bg`, `fond-bonus.webp` pendant le bonus), sans titre ni cadre, grandes cases (grille = largeur libre ou hauteur
  `100vh - --chrome`, +90 px sur ordinateur `--fl-x`), plein écran sans bandes noires (bloc à la fin du CSS du Filon). **Images du propriétaire** :
  `assets/games/filon/<nom>.webp`, toutes listées dans `PICS` (quartz cuivre emeraude saphir rubis lanterne
  pioche wagonnet lingots joker bonus dynamite mystere contagieux lampe fond fond-bonus) (changer `CACHE` dans
  `sw.js` si elles changent).
- **Diamants REDK** (`games/redk.js`, id `redk`, demande du propriétaire du 11 novembre 2026, ouverte à tous le même jour ;
  cahier des charges `notes/diamants-redk-cahier-des-charges.txt`). Images du propriétaire dans `assets/games/redk/` :
  symboles découpés de ses 2 planches (`s0`…`s4` = 10 J Q K A de la planche 2, K passé en orange ; `s5` scarabée, `s6`
  œil, `s7` Anubis, `s8` pharaon, `wild` couronne, `scat` pyramide, `ruby` diamant rouge, `ruby-gold` = le même passé en
  or, boosters `b-spin` / `b-reels` / `b-mult` / `b-value`), **son décor animé du 15 novembre 2026** (comme L'Olympe et Le Loup
  2.0 : `tools/art/redk/fond-large.mp4` 672 × 448 `.rk-l` et `fond-haut.mp4` 448 × 672 `.rk-p`, la mine de diamants avec plaques
  MINI / MAJOR / GRAND JACKPOT, cadre de pierres à 5 × 3 cases peintes, wagons de gemmes ; `tools/art/redk/clean.py` efface
  « $1.00 » → `assets/games/redk/fond-*.mp4` + `scene-*.webp`, l'ancien `bg.mp4` est supprimé) : rouleaux posés sur ses cases
  (`.rk-reels`, sans cadre), montants des jackpots sous les plaques (`.rk-jpv`, MINOR reste sur son rubis), SOLDE · GAIN de
  chaque côté du cadre (large) ou au-dessus de la barre (haut) (`.rk-info`), barre cliquable (BET − / +, BONUS MENU, SPIN,
  MAX BET) ; le RUBY LINK 5 × 6 couvre le cadre (`.rk-link`), boosters à droite du cadre (large) ou sous les plaques (haut),
  compteur du bonus à la place de SOLDE · GAIN ; plein écran `layout()` comme L'Olympe. **Piège** : le booster REELS+ porte
  aussi la classe `.reels` du site (grille 5/3) : `.rk-art .rk-bst` remet `display: flex; aspect-ratio: auto`. Sa vidéo BONUS `intro.mp4` (`bonusIntro` : fondu au noir → vidéo plein écran, sur téléphone en largeur
  ×1,65 sur la même vidéo floutée pour que le mot BONUS soit entier → fondu au noir → le bonus ; `blackout()`).
  **Rangées verrouillées du Ruby Link** (vidéos du propriétaire du 15 novembre 2026) : planches de bois, ferrures et cadenas doré en CSS (`LOCK_HTML`, `.rk-plank` / `.rk-strap` / `.rk-padl`) ; chaque rangée qui s'ouvre (rubis comptés ou REELS+) passe par `blast()` : bois doré + cadenas qui tremble, éclair blanc, planches coupées en deux et échardes qui volent (calque `.rk-blast`, animations `fill: 'forwards'`), fumée, puis les cases de la rangée s'allument.
  5×3, 20 lignes ; rubis avec leur valeur **en KE** (`kfmt`). **Voulu par le propriétaire** : le **RUBY LINK** (6 rubis ;
  grille 5×6, 3 rangées verrouillées ouvertes à 11 / 16 / 21 rubis ou par REELS+, boosters SPIN+ / REELS+ / MULTI+ /
  VALUE+, MINI / MINOR / MAJOR, GRAND ×1 000 ; **SPIN+ = un re-spin de plus à chaque remise à zéro jusqu'à la fin
  du bonus** : 3 → 4 → 5 → 6, `base`, voulu par le propriétaire) tombe **souvent** (≈ 1 tour sur 76, ≈ ×28 en moyenne) et c'est **le seul
  achat** (×28, `buyReveal` : les rouleaux tournent et posent les 6 rubis comme un vrai bonus) ; **4 pyramides** = **LA
  PYRAMIDE D'OR**, bonus spécial **qu'on ne peut pas acheter**, rare (≈ 1 tour sur 3 000, ≈ ×475) : 30 cases ouvertes,
  que des rubis dorés affichés en ×N (`gval` ×2 à ×250), MULTI+ jusqu'à ×20 (`gmultUp`), SPIN+, MAJOR. Plus de tours
  gratuits. **Suspense** (1 rubis ou 1 pyramide manquant, `tense()`) : rouleau ralenti qui brille, tremblement
  (`.rk-shake`), battements de cœur (`Heart`), vibration — **sans zoom** (le propriétaire n'en veut pas). Simulation
  `node tools/sim/redk.js` (6 M tours) : RTP ≈ 92,5 % (lignes 40, Ruby Link 36,5, Pyramide d'or ≈ 15,5), un gain 1 tour
  sur 4, achat ≈ 88,5 %, max ×10 000 (atteint dans la Pyramide d'or, ≈ 1 sur 100 000). Défi spécial : Ruby Link et
  La Pyramide d'or.
- **Le Coffre aux Pirates** (`games/pirates.js`, id `pirates`, **ouvert à tous le 12 novembre 2026**). Cahier des
  charges du propriétaire du 12 novembre 2026 (« Apex Predators », très volatile, max ×50 000), puis **thème pirates** avec
  **sa vidéo** (`assets/games/pirates/bg.mp4`, bateau pirate ; `bg.webp` = image fixe et couverture) **derrière toute la
  machine** (plein écran téléphone : la vidéo couvre tout l'écran, `.ap-video`). Voulu par le propriétaire : **vidéo en boucle
  sans coupure, comme un gif** (fichier refait par ffmpeg : sa fin se fond dans son début, `xfade` 1,2 s ; et retour au début
  0,3 s avant la fin, `timeupdate`), **muette** ; la musique est **un air de pirates original** (gigue en ré mineur, 6/8,
  `EXTRA_THEMES.pirates`) au lieu du bruit des vagues. Bruits de pirates doux (`Sounds`).
  **Ses 25 symboles, tous utilisés** (voulu par le propriétaire) : planche `tools/art/pirates/planche.webp` (noms écrits
  dessous pour nous seulement) découpée par `tools/art/pirates/cut.py` (`pip install "rembg[cpu]"` : cadre en bois entier +
  ce qui dépasse au-dessus, sans le texte) → `assets/games/pirates/<nom>.webp` (`SYM`, `PICS`). 5×4, **1 024 façons** (`ways`) :
  4 faibles (cœur, pique, trèfle, carreau), 5 moyens (collier, bouteille, carte, boussole, boulets), 6 forts (masque, ara, tiki,
  requin, exploratrice, pirate), WILD noix de coco ; pièces d'or avec valeur en KE (`CASH`) ou **étoile de mer JP** (MINI /
  MINOR) ; **le Crabe** (rouleau 5) ramasse toutes les pièces. **Jackpots** en haut (`.ap-jps`, plaques animées, `jackpot()`
  quand on en gagne un) : MINI ×10, MINOR ×25, MAJOR ×100, GRAND ×1 000 (`JPX`). 3 **tourbillons** = **LA CHASSE AU TRÉSOR**
  (Hold & Win 5×6, 2 rangées verrouillées, 3 vies, `heistRun`) : pièces, Tonneau (×2 à ×50 sur les pièces voisines), Crabe,
  Ancre (ouvre une rangée), étoile (MINI / MINOR / MAJOR), couronne (GRAND) ; 30 cases = le coffre englouti s'ouvre ×500
  (`FULL_X`, plafonné à ×50 000). 3 **coffres FREE SPINS** = **LES TOURS GRATUITS** (`fsRun` : 10 tours, plus de pièces, le
  Crabe sur tous les rouleaux, multiplicateur ×1, ×2, ×3… à chaque crabe, +5 tours avec 3 coffres). Achats ×100 / ×110.
  Simulation `node tools/sim/pirates.js` (8 M tours) : RTP ≈ 92 % (façons 40, Crabe 8, Chasse 24, Tours gratuits 20), un gain
  1 tour sur 4, Chasse 1 tour sur 369 (≈ ×88), Tours gratuits 1 sur 481 (≈ ×97), GRAND ≈ 1 tour sur 135 000, achats ≈ 88 / 89 %,
  ×50 000 ≈ 1 tour sur 6 millions. **Chasse au trésor rapide** (voulu par le propriétaire) : les symboles tombent dès que leur
  colonne s'arrête, puis Tonneaux, Crabes et Ancres agissent (`respin`) ; un bonus dure ≈ 2 fois moins longtemps qu'avant.
  **Rouleaux Pixi et images larges** (bug « ça saute » du 12 novembre 2026) : `warm()` de `core/pixi.js` mesure la partie
  vraiment peinte d'une `<img>` en `object-fit: contain` (5e valeur de `BOX`) et `sideOf()` dessine la texture à cette taille ;
  avant, une image plus large que haute tournait à la hauteur de la case (bien plus petite) puis grossissait d'un coup à l'arrêt.
- **La Fortune, nouveau décor** (`games/fortune.js`, demande du propriétaire du 15 novembre 2026) : **son image** (temple,
  dragons d'or, plaques MAJOR / JACKPOT / MINI, barre peinte) = `tools/art/fortune/decor.jpg`, nettoyée par
  `tools/art/fortune/clean.py` (montants peints effacés) → `assets/games/fortune/scene.webp` (1024 × 1024, toute la machine),
  `spin.webp` (le bouton rouge, tourne pendant les tours), `back.webp` (fond flou autour). Rouleaux dans le cadre noir
  (`.ft-win`), **sa barre rendue cliquable** (la barre habituelle et la ligne de message sont cachées) : MISE − / +,
  NIVEAU − / + = vitesse (1 normal, 2 Turbo, 3 Super turbo, `setLevel`), PIÈCES = le tas de pièces de la mise (les pièces
  y volent), SOLDE, i = règles, ☰ = « Bonus & menu », plaque BONNE CHANCE ! = gain du tour (`paintSay`). Jackpots en haut
  **selon la mise**, progressifs : MINI ×10 (pièce verte `mini.webp`, ajoutée), MAJOR ×50 (pièce passée en violet,
  `tools/art/fortune/coins.py`), JACKPOT ×500. Simulation `node tools/sim/fortune.js` (8 M tours) : RTP ≈ 92,3 %, MINI
  1 tour sur 2 600, achats ≈ 88,4 / 87,6 %.
  **Bonus dans le décor** (voulu par le propriétaire : « pour toute la machine ») : annonce et bilan du Hold & Spin / MÉGA BONUS
  dans le cadre des rouleaux (`featureIntro` et `celebrate` avec `summary` redéfinis : `panel()`, `.ft-ov`, laque rouge, or
  pour le Méga ; le grand titre « GROS GAIN ! » du site suit dès ×10), plaque du bonus sur le haut du cadre avec les respins en
  pièces (`hud()`, `.ft-bhud`, le bandeau habituel est caché), TOTAL dans la plaque du bas, temple assombri (`.ft-hold`).
  **Plein écran = tout l'écran** (voulu par le propriétaire, « comme un vrai jeu », téléphone et PC ; 1re version avec la barre
  éclatée sur les côtés refusée : « la barre bien rapprochée ») : l'image est découpée en morceaux `PCS` (T jackpots + temple,
  M rouleaux, L i / MISE / NIVEAU, R PIÈCES / SOLDE / menu, S bouton + plaque), chacun avec son bout d'image (`pbg()`) ;
  `layout()` (ResizeObserver, zones sûres lues sur `.ft-safe`) : **en hauteur** (téléphone) T et M sur toute la largeur, collés,
  puis L + R côte à côte juste dessous, puis le bouton ; **en largeur** (PC, téléphone couché) T, M et la barre entière comme
  sur l'image (`bar()`), empilés au centre, rouleaux aussi hauts que possible (T et barre à ×0,91) ; écran presque carré :
  l'image carrée. Fond du plein écran : mur laqué rouge avec motif doré et lumières de lanternes (`.ft-scene.ft-fs`).
  En plein écran `.slot-frame` / `.slot-stage` couvrent toute la machine (`position: absolute; inset: 0`, `align-self: stretch` :
  la machine est en flex) ; **bug du 15 novembre 2026 « au spin ça efface la slot »** : avec `position: static`, le flash de
  chaque tour (`ml-busy` → `mlCharge`, un `filter` sur `.slot-frame`) faisait de `.slot-frame` le bloc de la scène (hauteur 0)
  pendant 0,5 s. Le flash est aussi coupé pour La Fortune.
- **L'Olympe, décor animé** (`games/zeus.js`, demande du propriétaire du 15 novembre 2026 : il refait le fond de chaque machine) :
  **ses 2 vidéos** `tools/art/zeus/fond-large.mp4` (736 × 400 : ordinateur, page et écrans larges, `.zo-l`) et `fond-haut.mp4`
  (400 × 736 : téléphone tenu droit, `.zo-p`, aussi sur la page d'un téléphone) : éclairs, flamme bleue, nuages. Nettoyées image
  par image par `tools/art/zeus/clean.py` (`pip install opencv-python-headless`, ffmpeg) : grille peinte effacée (5 colonnes, le jeu
  a 6 × 5), « x1 » du médaillon et « 10,00 € » de la mise effacés, « + » de gauche du téléphone changé en « − » ; ×2 (lanczos),
  muettes, **boucle sans coupure** (la fin se fond dans le début, puis les 12 premières images répétées : le jeu recule d'une
  boucle `LOOP` = 121/24 s pendant qu'elles passent) → `assets/games/zeus/fond-large.mp4` / `fond-haut.mp4` + 1re image
  `scene-large.webp` / `scene-haut.webp` (affiche de la vidéo, couleurs des bords pour `fullFit`). Vidéo en pause page cachée, jamais
  avec « animations réduites », décodeur libéré en quittant (`destroy`). Grille 6×5 dans le cadre (`.zo-win`, cases larges sur
  la vidéo large : symbole entier au centre), multiplicateur dans le médaillon (`.zo-med`, « GLOBAL » pendant les tours gratuits),
  plaque SOLDE · GAIN (· TOURS) sous le médaillon (large) ou sous la grille (haut) (`.zo-info`, chiffres réduits selon leur
  longueur `--n`), barre de chaque vidéo cliquable (☰, BONUS = plaque d'achat `askBuy`, MISE − / +, SPIN qui brille pendant le
  tour), éclairs depuis `.zo-gem`, annonce et bilan des tours gratuits dans le cadre (`panel`). Plein écran (`layout()`, comme
  La Sweety) : la vidéo qui va avec la forme de l'écran le couvre, rognée sans couper médaillon, grille ni barre (zone gardée
  `[kx0, ky0, kx1, ky1]`) ; écran d'une autre forme : `fullFit` (étirée un peu, puis ses bords continuent). Positions en % de chaque vidéo dans le bloc CSS « L'Olympe ». Gains inchangés.
- **Le Loup 2.0, décor animé** (`games/huff.js`, demande du propriétaire du 15 novembre 2026, comme L'Olympe) : **ses 2 vidéos**
  `tools/art/huff/fond-large.mp4` (672 × 448, `.hf-l`) et `fond-haut.mp4` (448 × 672, `.hf-p`) : la maison en briques des cochons,
  plaques MINI / MAJOR / GRAND JACKPOT, fenêtre étoilée, le loup. Nettoyées par `tools/art/huff/clean.py` (« $1.00 » effacé, quadrillage
  peint de la fenêtre effacé sur le téléphone) → `assets/games/huff/fond-*.mp4` + `scene-*.webp`. Rouleaux 5×3 dans la fenêtre
  (`.hf-win`, sans les bandes blanches), montants des jackpots sous les plaques (`.hf-art > .jp`, suivent la mise ; MINOR n'a pas de
  plaque : il reste sur sa pièce), plaques SOLDE · GAIN sur le mur (large) ou l'herbe (haut) (`.hf-info`), compteur du bonus à leur
  place (`.feature-banner` déplacé dans `.hf-art`), plateau du bonus dans la fenêtre (`.stage-layer` déplacé dans `.hf-win`), barre
  cliquable (BET − / +, BONUS MENU, SPIN, MAX BET = `maxBet()` ; la vidéo haute n'a pas de BONUS MENU : plaque à nous sur l'herbe).
  Plein écran comme L'Olympe (`layout()`, zone gardée). Gains inchangés.
- **Le Loup, décor animé** (`big-bad-wolf`, moteur `slot/machine.js`, demande du propriétaire du 16 novembre 2026, comme Le Loup 2.0) :
  **ses 2 vidéos** `tools/art/wolf/fond-large.mp4` (672 × 448, `.wl-l`) et `fond-haut.mp4` (448 × 672, `.wl-p`) : forêt sous la pleine lune,
  cadre de branches à 5 × 3 cases peintes, le loup, barre BET / SPIN / BONUS. `tools/art/wolf/clean.py` efface « $2.00 » / « 10.00 »,
  et sur la vidéo haute le titre peint (nom d'un autre jeu) et « 2,450.00 TOTAL BALANCE » → `assets/games/wolf/fond-*.mp4` + `scene-*.webp`.
  Dans `slot/machine.js` : `this.scene` (seulement Le Loup), `sceneHTML()` / `sceneInit()` / `layout()` : rouleaux sur ses cases (`.wl-win`),
  jackpots dans le ciel (large) ou à la place du titre (haut) (`.wl-jps`, mêmes `.jp` que `updateMeters`), SOLDE · GAIN à gauche du cadre
  (large) ou sur sa plaque de solde (haut) (`.wl-info`), compteur du bonus au-dessus du cadre (`.feature-banner` déplacé), barre cliquable
  (BONUS = « Bonus & menu » ; pas de MAX BET peint : dans le menu). `VideoBg` est lu au lancement (`core/videobg.js` est plus bas dans la
  page que `slot/machine.js`). Plein écran comme L'Olympe. Gains inchangés.
- **L'Hydre, décor animé** (`games/dragons.js`, id `dragons`, demande du propriétaire du 15 novembre 2026, comme L'Olympe) :
  **ses 2 vidéos** `tools/art/dragons/fond-large.mp4` (672 × 448, `.dg-l`) et `fond-haut.mp4` (448 × 672, `.dg-p`) : l'antre des
  dragons, plaques MINI / MAJOR / GRAND JACKPOT (= MINI, MAJEUR, JACKPOT du jeu), cadre en écailles à 3 × 3 cases peintes, grand
  dragon rouge, feu et lave. `tools/art/dragons/clean.py` efface « $1.00 » → `assets/games/dragons/fond-*.mp4` + `scene-*.webp`.
  **Une case peinte = une paire** (demi-tête gauche | demi-tête droite) : grille `.dg-win .sg` à 8 colonnes `1fr 1fr 2.2% 1fr
  1fr 2.2% 1fr 1fr` calée sur les cases ; chaque demi-tête garde la forme de la carte (5 : 4, largeur `57cqh`) et les deux
  moitiés se rejoignent au milieu de la case ; tête fusionnée en `contain`. Montants des jackpots sous les plaques (`.dg-jpv`,
  `jpEl(k)` pour les faire clignoter), SOLDE · GAIN à gauche du cadre (large) ou de chaque côté du SPIN (haut) (`.dg-info`),
  compteur des tours gratuits à leur place (large) ou sur la rangée BET / BONUS MENU / MAX BET (haut), barre cliquable ; plus
  de `frameCls: 'dg-frame'` (ses anciennes règles gênaient le plein écran). Plein écran comme L'Olympe. Gains inchangés.
- **Décors des 5 machines du 16 novembre 2026** (demande du propriétaire : Le Coffre-Fort `billets`, Le Coffre aux Pirates `pirates`, La
  Tournée du Père Noël `noel`, Le Totem Extrême `totemx`, La Tour Bling `bling`) : **un seul cadre commun**, `Scene` / `sceneHTML` de
  `core/videobg.js` : image ou vidéo « large » (ordinateur) et « haute » (téléphone tenu droit), rouleaux sur la fenêtre peinte (`.sx-win`),
  barre peinte rendue cliquable (`.sx-bm` / `.sx-bet` / `.sx-bp` / `.sx-menu` / `.sx-menu2` / `.sx-spin` / `.sx-max`), plaques `.sx-pl`
  (`.sx-bal`, `.sx-gain`, `.sx-tbet`), jackpots `.sx-jp-*`, compteur du bonus à la place des plaques, plein écran qui couvre l'écran
  (`fullFit`, zone gardée `key`, scène en absolu : voir « Écran noir au spin »). Chaque jeu : `stage: sceneHTML(id, { host, inWin, inArt, plates })`,
  puis `this.sx = new Scene(this, SCENE)` ; `onMeters()` → `this.sx.meters()`. Positions en % (bloc CSS « Décors des 5 machines », fabriqué
  par un petit script à partir des boîtes en pixels de chaque image : `.sx-<id>.sx-l` / `.sx-p`). **Piège** : la classe de plaque est
  `.sx-pl` (`.sx-p` = image haute) ; un texte dimensionné en `cqh` doit être dans un enfant de la boîte `container-type: size`.
  Fichiers : `tools/art/<jeu>/clean.py` → `assets/games/<jeu>/scene-*.webp` (+ `fond-*.mp4`). Coffre-Fort : 2 images (fenêtre vidée, mise
  et BALANCE / TOTAL BET / WIN effacés). Pirates : image large (5 colonnes au lieu de 3 rangées, roue SPIN et ancre gardées devant) + vidéo
  haute ; « x1 » effacé (`.sx-mult` = ×1, puis le multiplicateur du Crabe pendant les tours gratuits), jackpots sur la poutre (`.ap-jps`).
  Noël : 2 vidéos (5 rangées peintes effacées, le jeu a 7 rangées ; montants des jackpots effacés ; MINI / MAXI / GRAND `data-jx`).
  La Tour Bling : 2 vidéos (sa grille 6 × 7 est celle du jeu ; seule la mise est effacée). **Le Totem Extrême** : sa vidéo **n'est pas une
  boucle, c'est la barre de chargement** (`BarVideo` dans `games/totemx.js`, fichier chargé entier en mémoire, une image-clé toutes les
  4 images) : `setLevel` la fait avancer jusqu'à la hauteur du totem (lv / 11 de `BAR.full` : image 100 sur la haute, 132 sur la large),
  elle revient au début à chaque nouveau tour, et au **FULL SCREEN elle prend feu** (`fire()` : images 136 → fin, flammes en boucle),
  voulu par le propriétaire ; plaques du temple = SOLDE · TOTEM ×N · GAIN, « FULL SCREEN n / 30 » sous la grille. Gains inchangés.
- **Décors animés, outils communs** : `tools/art/videobg.py` (lecture, effaçage, boucle sans coupure, ×2, affiche) pour les
  `tools/art/<jeu>/clean.py`, et module `core/videobg.js` d'`index.html` : `VideoBg` (lecture muette, retour d'une boucle `loop`,
  pause page cachée, rien avec « animations réduites », décodeur libéré à `destroy()`), `screenBox` (écran moins les zones sûres),
  `coverFit` (plein écran couvert sans couper la zone gardée). L'Olympe, Le Loup 2.0, Diamants REDK et L'Hydre s'en servent :
  prochaine machine pareil.
- **Plein écran des décors = tout l'écran** (demande du propriétaire du 16 novembre 2026 : « une barre floue en haut… sur le téléphone,
  il faut que ça prenne tout l'écran ») : **une seule fonction pour toutes les machines à décor**, `fullFit(sc, art, safe, { size, key,
  poster, bottom })` de `core/videobg.js` (L'Olympe, Le Loup 2.0, REDK, L'Hydre, Le Loup, L'Anubis, La Roulette Russe, Le Cosmique, La
  Sweety, The Hunt et les 5 de `Scene`). Le décor couvre **tout** l'écran, sous l'encoche et la barre du téléphone aussi (seule la zone
  gardée `key` reste dans les zones sûres) ; si la forme de l'écran l'exige, il est **étiré un peu** (`STRETCH` = 1,32 au plus, dans un
  seul sens : vidéos en `object-fit: fill`, images en `100% 100%`, tout est placé en %) ; au-delà (rare), ses bords continuent en dégradé
  (`.vf`, `edgesOf` : couleurs des 4 bords de l'affiche). **Plus jamais de fond flou, de `mask-image` ni de `filter` sur le décor**
  (ils repeignaient vidéo + rouleaux à chaque image). Nouvelle machine à décor : appeler `fullFit` dans son `layout()`.
- **« Écran noir au spin » (16 novembre 2026, les 5 décors de `Scene`)** : `.sx.sx-fullsc` était en `position: fixed` ; l'éclair du
  lancement (`filter` sur `.slot-frame`) et les secousses (`transform` / `translate`) font d'un parent le bloc d'une boîte fixe, et la
  scène sortait de l'écran 0,5 s. Maintenant : `.slot-frame` / `.slot-stage` en `position: absolute; inset: 0` et la scène en absolu
  (comme L'Olympe). L'éclair du lancement n'est plus un `filter` : calque `.ml-charge` (machines sans décor seulement, `DECOR`), et
  `.ml-flash` / `.ml-rays` sans `mix-blend-mode`. **Ne jamais remettre de `position: fixed` dans une machine, ni de `filter` animé sur
  `.slot-frame` / `.reels`.**
- **Rouleaux Pixi, fluidité** (16 novembre 2026) : le flou de mouvement ne travaille que sur le rectangle du rouleau (`filterArea`) et,
  sur téléphone, sans le 2e filtre (luminosité) ; la boîte d'une image `contain` est recalculée pour la forme de la case où elle est
  dessinée (`painted()`, `BOX` remesuré si la case change de forme) : sinon le symbole « sautait » à l'arrêt après un passage en plein
  écran étiré. La toile Pixi d'une zone de rouleaux est créée dans un moment calme après l'ouverture du jeu (`preStage`, shaders
  compilés à ce moment-là) et plus au premier tour (petit arrêt au 1er spin sur téléphone).
- **Le Cosmique, nouveau décor** (`games/cosmic.js`, demande du propriétaire du 15 novembre 2026) : **ses 2 images**
  `tools/art/cosmic/decor-large.jpg` (1248 × 832 : page et écrans larges, `.cz-l`) et `decor-haut.jpg` (720 × 1280 : téléphone tenu
  droit, `.cz-p`, aussi sur la page d'un téléphone), nettoyées par `tools/art/cosmic/clean.py` (quadrillage peint effacé : le jeu
  dessine sa grille 6×5 ; le « 2.50 » peint effacé) → `assets/games/cosmic/scene-large.webp` / `scene-haut.webp`. Grille dans la
  lune (`.cz-win`, positions en % de chaque image dans le bloc CSS « Le Cosmique »), barre cliquable : BET − / +, BONUS MENU
  (« Bonus & menu » : achats, radar, auto), SPEED (1 / 2 / 3 = normal / Turbo / Super turbo, points `.cz-lvl`), SPIN ; plaque
  SOLDE · GAIN · ÉNERGIE (· TOURS en bonus) dans le ciel (`.cz-info`) ; annonce et bilan des bonus dans la lune (`panel`). Plus
  de robot à côté de la grille (`robot.webp` et `bg.webp` supprimés). Plein écran : `layout()` prend l'image qui va avec la forme
  de l'écran et **couvre tout l'écran** (voulu par le propriétaire : « pas de rebords violets »), rognée sur les bords sans jamais
  sortir la grille, la barre ni la plaque (zone gardée `[kx0, ky0, kx1, ky1]` dans `layout()`). Gains inchangés.
- **La Sweety, nouveau décor** (`games/candy.js`, demande du propriétaire du 15 novembre 2026, comme Le Cosmique) : **ses 2 images**
  « Sweet Kingdom » `tools/art/candy/decor-large.jpg` (1280 × 720, `.sk-l`) et `decor-haut.jpg` (720 × 1280, `.sk-p`), nettoyées par
  `tools/art/candy/clean.py` (quadrillage rose et « $1.00 » effacés) → `assets/games/candy/scene-large.webp` / `scene-haut.webp`
  (`bg.webp` supprimé). Grille 6×5 dans le cadre (`.sk-win`), barre cliquable : BET − / +, BONUS MENU, SPIN, MAX BET ; plaque SOLDE ·
  GAIN (· TOURS) (`.sk-info`) ; Bal de la Reine annoncé et fini dans le cadre (`panel`). Plein écran : l'image couvre l'écran
  (`layout()` → `fullFit`, zone gardée). Gains inchangés.
- **La Pêche, la présentatrice et sa roue de glace** (`games/peche.js`, id `peche` et `peche-online`, demande du propriétaire du
  18 novembre 2026 : « tu remplaces la roue par la roue de la vidéo… comme le style du Plateau et de La Roue Folle », à la place de la
  roue en verre et du lac gelé) : **sa vidéo** `tools/art/peche/presentatrice.mp4` (copie muette de son .mov : le son est enlevé,
  voulu par le propriétaire ; 1280 × 720, 30 images/s, 15,6 s) : une présentatrice en robe rouge à côté d'une roue de glace (12 parts
  à poissons, anneau de verre fixe à boulons, cristal-pointeur en haut) ; 2 plans : plan large où la caméra avance (images 0 → 238),
  coupe, plan rapproché presque fixe (239 → 468). `python3 tools/art/peche/presentatrice.py` (`--fast` = sans réencoder ; opencv,
  rembg) : **suivi image par image** de l'anneau fixe (points SIFT de proche en proche dans chaque plan, lissés) → homographie disque
  unité (bord de ses parts) → % de la vidéo, présentatrice détourée (sa main passe devant la roue vers 9 s : planche
  `show-mask.png`, une case par image), écrits dans `SHOW` de `games/peche.js` ; `show.mp4` (muette, boucle `loop` : la fin → le
  début = une coupe de caméra) + `show.webp` ; `disc.webp` = **notre disque de 54 cases** dans le style de sa roue (verre givré ×2
  glace `w`, bleu roi ×2 nuit `s`, turquoise / ambre / rubis à liseré d'or pour les 3 poissons, rayons de verre, boulons ; dessiné
  par le script dans l'ordre de `SEGS` : **si `SEGS` change, relancer le script**) ; `hub.webp` (son moyeu de verre, fixe au-dessus
  du disque) ; `ptr.webp` (son cristal-pointeur redressé, recentré ; en CSS un peu tassé et remonté pour que sa pointe s'arrête au
  bord des cases : on lit la case gagnante). Dans le jeu (comme Le Plateau Live) : `.pex` (`.pex-l` = toute la vidéo ; téléphone
  tenu droit `.pex-p` = sa partie droite), `.pex-wb` (boîte de 1000 px pour [-1,08 ; 1,08]² du disque, `matrix3d` par image,
  `frame()` / `follow()` avec `requestVideoFrameCallback`), `.pex-mk` (masque de sa main, seulement une fois la planche chargée),
  `.pe-rot` tourne (`spin()`), éclairs et case gagnante dans le SVG (`wheelSVG`) ; vidéo en pause pendant la pêche et page cachée.
  Miniature : elle, la main sur la roue (`tools/covers/games.js`, serveur qui gère « Range » pour que la vidéo avance). Pêches,
  gains et achats inchangés. Ses vidéos d'avant (`roue.mp4`, `fond-*.mp4`) restent dans `tools/art/peche/` ; `fond.py` et
  `roue*.webp`, `fond-*.mp4`, `scene-*.webp` des assets sont supprimés.
  **Les pêches** (vidéos du 15 novembre 2026) : 9 pêches sur un lac gelé `tools/art/peche/<bleu|orange|rouge>-<canne|grue|helico>.mp4`
  → `python3 tools/art/peche/clean.py` → `assets/games/peche/<fb|fo|fr>-<1|2|3>.mp4` (+ affiche `.webp`, taille d'origine, ≈ 0,4 à 1 Mo). **Bonus** : la taille
  du poisson est tirée au hasard (`fishDraw`, 62 / 30 / 8 %) : 1 canne = petit multiplicateur, 2 grue = moyen, 3 hélicoptère =
  le plus gros, avec le **MAX WIN** (×25 000, `CAPX`) dans les gros poissons (`FISH` : [poids de la taille, [[×, poids]…]]) ;
  multiplicateur qui défile pendant la vidéo puis s'arrête (`fishing`). **Achats** (voulu par le propriétaire) : pêche bleue /
  orange / rouge à 8,75 / 17,4 / 52 × le jeton choisi (`PRICE`, `get bet()` = jeton ; bouton « 🎣 Acheter une pêche » et
  « Bonus & menu », pas dans le salon en ligne), taille au hasard, sans éclair. Simulation `node tools/sim/peche.js` (lit le
  moteur, 20 M lancers) : ≈ 95 % sur chaque case (comme avant), achats ≈ 88 %, hélicoptère 1 poisson sur 12,5.
  **Téléphone** (demande du 16 novembre 2026 : « on peut pas bouger pour miser ») : 5 cases de mise sur une ligne, jetons et
  outils sur une ligne chacun (« Acheter une pêche » en tête), note des éclairs cachée ; bouton « ⛶ Grand écran » sur l'émission
  (`.pe-big`, `data-act="full"`) : en plein écran, téléphone tenu droit = l'émission en haut, mises et LANCER dessous (seules les
  mises défilent s'il manque de la place), téléphone couché et ordinateur = l'émission à gauche, mises à droite. Les outils
  (Annuler … Tours auto) sont sur 2 lignes de 4 (grille), jamais en rangée qui défile (« en grand écran on n'a pas accès à tout »).
- **The Hunt, nouveau décor** (`games/chasse.js`, id `chasse`, demande du propriétaire du 16 novembre 2026, comme La Sweety) : **ses 2
  images** `tools/art/chasse/decor-large.jpg` (1168 × 784, `.hu-l`) et `decor-haut.jpg` (784 × 1168, `.hu-p`) : cadre en bois dans la
  forêt (cerf, sanglier, faisans, lièvre, loup), plaques MINI / MAJOR / GRAND JACKPOT, barre BET / SPIN / MAX BET / BONUS MENU.
  `tools/art/chasse/clean.py` efface la grille peinte 5 × 5 (le jeu reste en 5 × 3, 243 façons), les mots des 3 plaques (pas de
  jackpot : SOLDE · GAIN · GAIN MAX, `.hu-plq`) et « $1.00 » → `assets/games/chasse/scene-large.webp` / `scene-haut.webp`. Rouleaux
  dans le cadre (`.hu-win`), barre cliquable (`.hu-hot`), plus de canards ni de cerfs autour. Plein écran `sceneFit()` (zone gardée ;
  **pas `layout()`** : ce nom est déjà la mise en place des arbres de la chasse). **La chasse (bonus) n'a pas changé** : `.ht-field`
  prend la place de l'image (`.hu-scene` caché). Gains inchangés.
- **Le Pilote** (`games/pilote.js`, id `pilote`, jeu rapide, idée du propriétaire) : l'avion décolle d'un porte-avions
  avec ×1 et vole **sans fin fixe** au-dessus d'une mer semée de porte-avions (voulu par le propriétaire, jusqu'à
  ≈ 30 s). Objets (`ITEMS`) : ×2 / ×3 / ×5 / ×10 et +5 / +20 / +100 (l'avion monte de `UP`), bombes ÷2 / ÷3 / ÷5 / ÷10
  (descend de `DOWN`, le gain ne tombe jamais sous ×1), **boost** (grand bond, `BOOST` ; à l'écran, voulu par le propriétaire : l'avion file tout là-haut sur un long arc
  `HUMP`, la caméra dézoome (`zoom`, jusqu'à ×0,28) et l'avion **reste là-haut ≈ 4 s** (plateau de l'arc) : porte-avions
  minuscules, 2 bombes géantes à esquiver, pour le spectacle seulement). **Peu d'objets à l'écran** (voulu par le
  propriétaire, « trop de monde ») : objets très espacés (`SP` 260 à 380 px), leurres rares (22 % des intervalles), **trou d'air** (chute d'un
  coup, `POCKET`) et le **BONUS** (rare) : tous les porte-avions ×10 jusqu'à l'atterrissage (`BONUS_X`, bandeau doré,
  ciel doré, porte-avions ×10 / ×20 / ×50, musique emballée par `sb:feature` avec `quiet: true` = sans le médaillon 3D
  qui cacherait l'avion). Altitude 0 ou 30 objets (réservoir vide) : il se pose là où il est, tiré dans `SHIPS` : la
  mer (perdu) ou un porte-avions ×1, ×2, ×5 doré (plafond ×1 000). Tout le vol est tiré au décollage (`flight()`,
  bloc `===ENGINE`), puis animé sur une **trajectoire lisse** (spline monotone par les objets, vitesse qui ralentit
  après une bombe, au ralenti quand une bombe de plus serait fatale, accélère au boost) avec rebonds (ressort
  `jy` / `ja`) et secousses (turbulences, fortes dans les trous d'air). Leurres frôlés sans texte (`decoys`, pour le
  spectacle seulement, voulu par le propriétaire : « faut pas que ça marque que ça esquive »). Tableau de bord en
  haut à gauche (`.pi-hud`) : gain en vol, altitude en mètres (rouge et alarme quand la prochaine bombe serait
  fatale), vitesse, distance ; jauge de carburant. Sur ordinateur le jeu prend toute la largeur et la hauteur libre ;
  en plein écran le ciel couvre tout l'écran et les boutons de mise flottent par-dessus (sur téléphone le ciel
  s'arrête au-dessus des boutons). Quitter en plein vol paie quand même un vol qui allait se poser. **Super turbo** (« Bonus & menu », `opts` →
  `optOn` / `onOpt`, localStorage `spinbet_pilote_super`) : vol ≈ 3 fois plus rapide que normal (Turbo : 1,7), presque
  sans ralenti ; ne change pas les gains. Simulation
  `node tools/sim/pilote.js` (lit le moteur, 20 M vols) : **retour ≈ 97 %** (voulu par le propriétaire : « un jeu qui
  gagne un peu plus que tous les autres », au-dessus des 94–96 % des autres jeux rapides), dont ≈ 8,5 points par le
  bonus ; environ moitié moins de bombes qu'avant (3,5 par vol, `DOWN` = 5, plus de trous d'air), posé 32 %, bonus
  1 vol sur 126, ≥ ×10 un vol sur 73, ≥ ×100 un sur 1 520, ×1 000 un sur 63 000, 5 objets en médiane (9 vols sur
  10 ≤ 12).
- **Le Gratte-Ciel** (`games/gratteciel.js`, demande du propriétaire) : **plus de coup de vent**. La tour tient comme une vraie
  pile : pour chaque cube, le centre de gravité des cubes au-dessus doit rester sur lui (`lean()`) ; un cube trop raté
  ou une tour qui penche trop, et tout s'écroule. Le cube se balance un peu au bout du câble (`SWAY` = 0,18 cube) et
  la grue accélère (`SPEED_A` + `SPEED_B` × n cubes/s). Jeu d'adresse : les multiplicateurs `MULT` viennent de
  `node tools/sim/gratteciel.js` (0,96 ÷ survie d'un très bon joueur, 20 ms d'erreur) : ≈ 96 % pour lui où qu'il
  encaisse, ≈ 86 % à 10 cubes pour un joueur moyen ; ×22,14 à 30 cubes.
- **La Tour Bling** : les mots `.bt-word` / `.bt-combo` doivent rester en position absolue (la règle
  `.g-bling .slot-stage > :not(...)` les en exclut ; avant, ils tombaient sous la grille, coupés). Reflets des cases
  animés en `transform` et coupés pendant les tours (fluidité sur téléphone).
- **Les 3 blackjacks ont la même table** (demande du propriétaire, d'après des captures d'un autre jeu : même principe,
  pas ses couleurs) : `games/bjtable.js` (`BjTableGame`, chargé avant eux grâce à `DEPS` du chargeur
  `games/impl/index.js` ; entrée `bjtable` dans `FILES`, `hasImpl` l'ignore). Le 21 (`blackjack.js`), Le 21 Électrique
  (`lightningbj.js`) et Le 21 Online (`bj-online.js`) n'ont plus que leurs règles et étendent `BjTableGame`.
  Vue `.bjv` (classe `bjv-game` sur le jeu ; CSS à la fin de la couche `finition`) : plan en 3D CSS (`.bjv-table`,
  `rotateX(74deg)`, perspective 1100 px, coordonnées du plan `W` × `H`) vu depuis la place du joueur ; tapis vert, rail
  noir à liseré doré, rail de jetons, sabot et bac à cartes. Croupière en SVG (`DEALER_BODY` derrière la table,
  `DEALER_ARMS` devant : avant-bras et mains qui distribuent, classes `dealP` / `dealD` / `flip` / `happy`), reculée
  (petite, coupée à la taille par le bord de la table), tête hors du cadre. Cartes posées sur le tapis et un peu
  redressées (`.bjv-lean`), bulles de score et plaques de résultat face au joueur (`.bjv-up`). Mises : `this.bets`
  (`main` + une entrée par mise annexe), 5 jetons choisis selon le solde (`picks()`) posés sur le tapis ; toucher un
  jeton = le poser sur le cercle principal, toucher un cercle = y poser le jeton choisi ; `costOf()` = ce que coûtent
  les mises (Le 21 Électrique y ajoute ses frais éclair). Barre du bas : 4 grands boutons (`buttons()` / `can()` /
  `onButton()` de chaque jeu) avec l'avatar et le solde au milieu. Caméra (`camera()`, mesurée une fois par
  `measure()`) : proche du cercle pendant les mises, reculée pour la partie, jamais au-dessus du cou de la croupière ;
  hors plein écran la hauteur de la table s'adapte (2:1 sur ordinateur). Tapis clair avec projecteur (`bjvSpot`),
  lumières et tables floues au fond (`.bjv-glow`), messages qui s'effacent après 4,5 s.
  **Pièges** : les boîtes 3D (`.bjv-persp`, `.bjv-table`…) sont en `pointer-events: none` (sinon elles prennent tous
  les touchers et les jetons ne répondent plus, bug de novembre 2026) ; ne jamais donner à un élément de la table une
  classe déjà utilisée par le site (`side` = le menu latéral, décalé hors de l'écran sur téléphone).
  Le 21 Électrique : mises annexes en cercles (`SIDES` : Paires et 21+3 de part et d'autre du cercle, Bust It près de
  la croupière), résultats sur leurs cercles (`sideResult`), panneau des multiplicateurs en haut (`.lbv-board`).
  Le 21 Online : les autres joueurs assis aux places `SEATS` (4 au plus : nom, mise, cartes, résultat ; tout le salon
  et le chat restent sous la table hors plein écran), chronomètre du salon en haut (`.bjo-timer`).
  Les règles et les gains des 3 jeux n'ont pas changé.
- **Les 4 roulettes ont la même table en 3D** (demande du propriétaire, d'après des captures d'un autre jeu : même
  principe, dessins à nous) : `games/rltable.js` (`RlTableGame`, chargé avant elles par `DEPS` ; il utilise les jetons de
  `bjtable`, entrée `rltable` dans `FILES`, `hasImpl` l'ignore). La Roulette (`roulette.js`, plein 35, retour 97,3 %),
  L'Éclair (`storm.js`, éclairs sur 1 à 5 numéros du tapis, `markLucky`), La Double Bille (`doublespin.js`, 2 billes,
  `balls: 2`, multiplicateur de la jaune dans le panneau `.rl-feat`) et L'Éclair Online (`storm-online.js`, salon :
  PRÊT, chronomètre `.bjo-timer`, joueurs et chat sous la table) n'ont plus que leurs règles (cotes d'origine
  inchangées) et passent par les crochets `beforeSpin()`, `draw()`, `payOf()`, `winnerText()`, `resultText()`.
  Plan `W` × `H` incliné, caméra `bet` (presque vu de dessus pour miser) et `spin` (penchée sur la roue en bois).
  Tapis bleu : cylindre (Tiers, Orphelins, Voisins, Jeu zéro = `ANNOUNCED` ; un numéro du cylindre = lui + 2 voisins),
  grille avec le 0 à droite et les « 2 pour 1 » à gauche (miroir des cases de `buildDefs` de `core/roulette.js` :
  `hotXY`), douzaines, chances simples ; tableau lumineux des derniers numéros (statistiques au toucher,
  `spinbet_<id>_hist`), panneau « NUMÉRO GAGNANT », marqueur. Barre du bas : Vider, Répéter, Annuler, 5 jetons, ×2,
  Lancer (table vide = rejoue les mises d'avant). Limites 5 000 KE par case, 10 000 KE en tout.
  **Fluidité** (bug « ça rame » du 10 novembre 2026, 22 → 47 images/s sur téléphone ralenti ×4) : la caméra ne bouge que par
  2 transformations animées par le navigateur (`transition` sur `.rl-table` et `.rl-world`, origine fixe au centre du plan,
  `frame()` calcule le cadrage) ; le plateau de la roue (`.rl-rotor`) et les billes (`.rl-bw` / `.rl-ballv`) sont des calques
  à part tournés par `transform` ; jetons, éclairs et cases gagnantes dans leurs propres SVG (`.rl-chipsvg`, `.rl-lksvg`,
  `.rl-hlsvg`) ; aucun filtre SVG ni `filter` CSS sur le tapis ou la roue. Ne pas les remettre.
- **Le 21, Le 21 Électrique et La Bataille : la table filmée « Platinum VIP »** (vidéos du propriétaire du 17 novembre 2026, remplacent
  celle du 16) : **ses 2 vidéos** d'une croupière (`tools/art/blackjack/table-large.mp4` 672 × 448 : ordinateur et écrans larges ;
  `table-haut.mp4` 720 × 1280 : téléphone tenu droit ; 8 s, **avec le son**) qui prend une carte au sabot et la pousse vers sa droite
  (images 10 → 61), puis une autre devant elle (100 → 161). `python3 tools/art/blackjack/table.py` (opencv) : **toutes les cartes de la
  vidéo effacées** sur le tapis (le tapis propre de la 1re image, ses doigts restent), « BLACK JACK PAYS 3 TO 2 / Dealer must stand on 17 »
  effacé (nos jeux ne paient pas tous 3 pour 2) sauf sous sa main, **la carte qu'elle pousse suivie image par image** et **le masque de
  ses mains** sur le tapis par image (`hand-<l|p>.png`, planche) → `assets/games/blackjack/table-<l|p>.mp4` (+ `.webp`), et il écrit
  `BJTRACK` dans `games/bjtable.js` (`--inject` = seulement réécrire `BJTRACK` depuis `table.json`). `BjVideoGame` : `CLIPS.p` (cartes du
  joueur) et `CLIPS.d` (ses cartes, la carte cachée aussi) rejoués pour chaque carte ; **notre carte (sa vraie valeur, ou son dos)
  suit sa main** sous ses doigts (`.bjx-occ` masqué par `hand-*.png`, `onFrame`), puis va à sa place (joueur à sa droite, croupière
  devant elle). Places en pixels de chaque vidéo : `BGEO` (`l` : vidéo + bande de tapis pour les 5 jetons et la phrase des règles ;
  `p` : jetons sur le rail ; cercle MISE sur la place du milieu « S'ASSEOIR ICI », Paires / 21+3 / Égalité sur les places voisines,
  Bust It à côté d'elle ; les `vx` / `vy` des jeux ne servent plus). Tailles du CSS `.bjx` en `calc(… * var(--u))`. Mode choisi par la
  forme de l'écran (`bmode`, changé entre deux mains). Son : bouton 🔊 (`spinbet_bj_snd`, aussi coupé par « Effets sonores »),
  `Donne.unlock()` dans le 1er toucher (iPhone). Gains inchangés.
- **La Roulette : la croupière filmée** (`games/roulette.js` → `RlVideoGame` de `games/rltable.js`, vidéos du propriétaire du 17 novembre
  2026, remplacent celle du 16 ; L'Éclair, La Double Bille et L'Éclair Online gardent la table 3D) : **ses 2 vidéos** (`tools/art/roulette/
  show-large.mp4` 672 × 448 ; `show-haut.mp4` 448 × 672 ; 12 s, **avec sa voix**) : la croupière à côté de la roue parle, lance la roue et
  la bille, la roue tourne jusqu'au bout, **caméra fixe avec le tapis dans l'image**. `python3 tools/art/roulette/show.py` : ordinateur =
  les mots de la rangée « 2 to 1 » en trop effacés (les douzaines prennent la rangée, les colonnes sont à droite) ; téléphone = la rangée
  « 2 to 1 » devient « 1re / 2e / 3e colonne », le losange « 0 » devient le losange noir, le rouge perd ses mots → `assets/games/roulette/
  show-<l|p>.mp4` (+ `.webp`). Cases cliquables sur le tapis de chaque vidéo (`XGEO`, `xFelt()`), la vidéo entière toujours visible.
  Sa voix (`INTRO`, images 0 → 48) à la 1re mise de la partie (puis après 90 s), le lancer de `SPIN` à la fin au LANCER ; on ne voit pas
  où la bille tombe : le numéro tiré au hasard est annoncé par-dessus (`.rlx-ann`). Bouton 🔊 (`spinbet_roulette_snd`). Gains inchangés.
  **Notre bille sur sa roue** (voulu par le propriétaire : ses vidéos n'en ont pas, exprès) : `.rlx-ball`, lancée quand sa main quitte la
  roue (`B0`), elle tourne sur la piste extérieure à l'envers de la roue, ralentit, tombe (`BD`), rebondit entre les cases et se fait prendre
  (`BS`), puis tourne avec la roue (`ROTOR`, vitesse mesurée sur la case verte) ; ellipses de chaque vidéo dans `BALL` (piste, cases,
  tourelle qui la cache derrière). Sons faits maison (`ballNoise` : roulement sur le bois, `ballClack` : clics des rebonds, « toc » final).
- **Le Valhalla, décor animé** (`games/viking.js`, demande du propriétaire du 16 novembre 2026) : **sa vidéo** `tools/art/viking/fond-haut.mp4`
  (448 × 672 seulement : cadre de pierre dans les flammes bleues, médaillon du Jarl et sa barre en haut à gauche, médaillon de la valkyrie
  et sa barre à droite) → `tools/art/viking/clean.py` : grille peinte remplacée par une pierre propre fixe, remplissage bleu des 2 barres
  effacé → `assets/games/viking/fond.mp4` (boucle 169/24 s) + `fond.webp` + `valk.webp` (médaillon et barre de la valkyrie découpés, posés
  **au-dessus** des rouleaux car ils chevauchent le cadre ; à moitié transparents pendant un tour et quand il y a un gain). Scène `.vkx`
  (`.vkx-scene` 2 : 3, positions en % de la vidéo) : rouleaux dans le cadre, les jauges existantes (`.vk-meter` / `.vk-por` / `.vk-bar`)
  posées sur ses médaillons et ses barres (Jarl = Jarls tombés, valkyrie = WILD tombés, mêmes règles) ; barre de mise en pierre dessous.
  Plus de crête, pilier ni ciel dessinés (`CREST`, `PILLAR`, `SKY` ne sont plus utilisés). **Plein écran** : la scène prend la largeur
  (avant, téléphone couché = on ne voyait que le ciel) ; téléphone couché : la scène sur toute la hauteur, la barre de pierre en colonne
  à droite (bloc CSS après `.vkx`). Gains inchangés.
- **La Roue Folle = la même émission que Le Plateau Live** (`games/madwheel.js`, ids `madwheel` et `madwheel-online`, demande du
  propriétaire du 18 novembre 2026 : « la même vidéo et la même animatrice pour la roue folle et le plateau », à la place de l'animateur
  du 16 novembre) : **les vidéos du Plateau Live** (`assets/games/plateaulive/roue.mp4` + `attente.mp4`, la présentatrice en robe rouge)
  et leur suivi (`TRACK`, `IDLE`, `GO`, moyeu `HUB` « SPIN BET », `POINTER`, `mul`, `css3d` : exportés par `games/plateaulive.js` dans
  `SHOW`, chargé avant La Roue Folle par `DEPS` de `games/impl/index.js` ; lus au lancement, `PLX()`). **Notre roue de 54 cases**
  (`discSVG()` : tranches arc-en-ciel `PAL`, valeurs dans des carrés noirs, bonus en carré de couleur `GLYPH`, jusqu'au bord comme celle
  du Plateau Live) posée sur sa roue par homographie (`.plx-wb`, mêmes classes `.plx` et même CSS que Le Plateau Live, `.mw-live`) ;
  attente, LANCER, son coupé à l'arrivée, téléphone tenu droit = partie droite : tout comme Le Plateau Live (`frame`, `toIdle`,
  `fromIdle`, `startShow`) ; elle lance à 2,75 s, la roue s'arrête à 8,1 s ; le Boost tourne pendant qu'elle se prépare (plaque `.mw-top`,
  en bas à gauche sur téléphone). Plein écran : règles du Plateau Live étendues à `.slot.mwlive`. Les anciennes vidéos de l'animateur
  (`show-*`, `attente-*`, `mask-*`, `rim.webp`) et `tools/art/madwheel/build.py` / `attente.py` sont supprimés (ses vidéos d'origine restent
  dans `tools/art/madwheel/`). **Bonus à acheter** (« Bonus & menu », solo seulement, au jeton choisi : `get bet()` = `board.chip`) :
  Pile ou Face ×18, Pachinko ×17, Tir aux Cibles ×34, Méga Folie ×38 (valeur moyenne par simulation ×15 / ×13,9 / ×28,8 / ×32,1 + la
  mise → ≈ 88 %) ; la roue s'arrête sur le bonus acheté, sans Boost, pas compté au Défi spécial. Gains de la roue inchangés.
  Miniature : la présentatrice devant le mur de canards (`tools/covers/games.js`).
- **La Roue Folle, les bonus sur ses vidéos** (`games/madwheel.js`, demande du propriétaire du 16 novembre 2026 ; **depuis le 18 novembre
  2026 avec la présentatrice du Plateau Live à la place de l'animateur, et SA voix**) : **ses 3 vidéos** (672 × 448, 6 s)
  `tools/art/madwheel/bonus-pachinko.mp4` (plateau de Plinko), `bonus-canards.mp4` (mur de 12 × 11 canards qui se mélangent puis tombent),
  `bonus-roue.mp4` (grande roue à 3 flèches). Fabrication en 3 temps (`MW_WORK` = dossier de travail) :
  1. `python3 tools/art/madwheel/sansanimateur.py` : vidéos recalées (`bonus.py` : `stabilize`, bille dorée et panneau effacés), **l'animateur
     effacé** (rembg `u2net_human_seg` élargi + ce qui diffère du décor près de lui ; chaque pixel pris dans l'image la plus proche où il ne le
     cache pas ; canards : sa main repérée par la couleur de peau, jamais de mélange entre avant / pendant / après le mélange des canards,
     canards jamais vus recopiés 5 colonnes plus à gauche, cellule entière) → `WORK/<k>-clean.npy` ;
  2. la présentatrice détourée dans `tools/art/plateaulive/attente.mp4` (rembg `isnet-general-use` : net autour du micro), RGBA dans `MW_FEMME` ;
  3. `python3 tools/art/madwheel/femme.py` : elle est posée à la place de l'animateur (`PLACE` : haut de la tête, centre ; coupée par le bas de
     l'image comme dans sa vidéo), en 1344 × 896, sa voix du même passage (lèvres synchrones) ; Pachinko et roue : boucle sans coupure
     (`seam` sur le décor, et un passage d'elle qui revient à la même pose, `her_loop`) ; sa planche de masques `bmask-*.png` et `BTRACK`.
  Écran du bonus `openShow()` (élément vidéo de l'émission déplacé), nos éléments en % de la vidéo dans `.mwb-full` ; téléphone tenu droit :
  seule la partie `BCROP` (élargie pour qu'on voie son visage). **Pachinko** : nos 16 cases sur ses cases peintes, notre bille. **Tir aux
  Cibles** : 132 canards, multiplicateur tiré au hasard à chaque bonus (`chBoard`, moyenne ×28,8) ; la vidéo s'arrête après le mélange (3,4 s),
  le joueur touche un canard, puis ils tombent. **Méga Folie** : notre roue de 32 cases (`CTC`) sur la sienne, ses 3 flèches (`CTTIP`, `CTARR`).
- **La Roue Folle, Pile ou Face** (`b-pf-r.mp4` rouge / `b-pf-b.mp4` bleu, 720 × 1280 ; refait le 18 novembre 2026 avec la présentatrice :
  `python3 tools/art/madwheel/pileface-femme.py`, d'abord `--masks`) : sa vidéo `bonus-pileface.mp4` est un gros plan où la caméra bouge et où
  l'animateur lance le palet : l'effacer laissait des traces. C'est donc **un montage** : 2,5 s de plan fixe du décor (images 0 à 57 sans
  lui ni le palet, `plate()`), **elle derrière la table** qui annonce (cachée sous le bord de la table `EDGE`, léger reflet), puis coupe sur
  la caméra qui suit le palet (images 96 → fin, cadre `CAM` sur la partie droite, sa main au bord effacée), le palet tombe dans le bocal,
  gros plan. Sa voix tout du long. Le palet est vu dans le bocal à `PF_AT` = 8,8 s (`bonusCF`). Version bleue : le rouge du palet passé en
  bleu (`pileface.py` `blue()`), jamais sur elle (sa robe reste rouge). Plaques ROUGE ×a / BLEU ×b en haut (`.mwb-pf-v`), bouton du son en
  bas. Gains inchangés.
- **Le Plateau Live** (`games/plateaulive.js`, id `plateaulive`, Roues & tables, demande du propriétaire du 17 novembre 2026 : « reprends
  Le Plateau » avec ses vidéos ; il l'appelait « MNOP » : nom gardé à nous, pas de nom ni de dessin d'un jeu existant). **La roue** = celle
  de l'ancien Plateau (78 cases : 1 ×33, 2 ×22, 5 ×11, 10 ×6, 2 LANCERS ×4, 4 LANCERS ×1, CHANCE ×1 = la roue repart, ce tour paie ×10 ;
  sans CHANCE, 1 / 2 / 5 / 10 ne peuvent pas rendre tous ≈ 95 %). **Sa vidéo de l'émission** `tools/art/plateaulive/roue.mp4` (une
  présentatrice lance une roue à ampoules ; sa version « téléphone » est la même image avec des bandes noires : non utilisée) →
  `python3 tools/art/plateaulive/roue.py` (`--fast` = sans réencoder) : bandes noires enlevées, `assets/games/plateaulive/roue.mp4`
  (1280 × 694, avec le son, bouton SON coupé à chaque arrivée), **suivi image par image** du bord doré et du moyeu (le moyeu ne tourne
  pas) → homographie disque unité → image (`TRACK`, 8 nombres par image, posée en `matrix3d` sur `.plx-wb`), présentatrice détourée
  (rembg) dans le repère du disque (`roue-mask.png`). NOTRE roue (`discSVG`) et NOTRE moyeu (`HUB` : « SPIN BET » en doré, voulu par le propriétaire) couvrent les cases et le moyeu de sa
  vidéo (écrits d'un autre jeu). Elle lance à 2,75 s (`TH`), notre roue s'arrête à 8,1 s (`ST`). Téléphone tenu droit : la partie droite
  de la vidéo (`.plx-p`). **Les bonus sur sa vidéo du plateau** `tools/art/plateaulive/plateau.mp4` (3 dés lancés dans un bocal) →
  `python3 tools/art/plateaulive/plateau.py` : stabilisée, rognée sur le plateau, 4 textes du centre effacés, points des dés effacés
  une fois posés (image 112) → `plateau.mp4` + géométrie `BOARD_GEO` (bord du plateau, faces des dés). Nos 40 cases (`cellHTML`, carré de
  1000 px en `matrix3d` sur le bord du plateau, bandes `RING`) recouvrent ses cases (noms d'un jeu existant), nos plaques LANCERS / TOTAL
  / PLATEAU / DÉS au centre, notre pion (`PAWN`), nos points sur ses dés (`.plb-face`). Règles du plateau (`VAL`, `KIND`, `CARDS`) :
  3 dés, chaque case ajoute son multiplicateur ; DÉPART repassé = tout le plateau ×2 ; coin ×2 = total ×2 ; +1 LANCER ; SUPER CASE
  ×50 ; 3 CHANCE (+×5 … +×50, total ×2, +1 lancer) ; 3 dés pareils = +1 lancer. Achats ×19 / ×75 le jeton. Simulation
  `node tools/sim/plateaulive.js` : chaque case ≈ 95,5 %, 2 LANCERS 1 tour sur 19 (≈ ×15,5), 4 LANCERS 1 sur 77 (≈ ×64,7), achats
  ≈ 87 %, max ×10 000. Plein écran : téléphone droit = tout tient (titre caché, mises qui défilent si besoin), couché / ordinateur =
  l'émission à gauche, mises et barre sur 2 rangées à droite. **Le Plateau** et **Le Plateau Online** restent retirés.
- **L'attente du Plateau Live et de La Roue Folle** (demande du propriétaire du 17 novembre 2026 : « dès qu'on arrive on voit la vidéo
  tourner déjà, elle tourne en boucle, et quand on veut jouer on active la roue avec nos mises », et le son OFF en arrivant) : une 2e
  `<video>` au-dessus de l'émission (`.plx-idle` / `.mwx-idle`), muette, qui tourne en boucle dès l'arrivée (retour d'une boucle `IDLE.loop`
  comme `VideoBg`), notre roue posée dessus (`frame(k, 'idle')` / `idleSrc`). **Son de l'émission coupé à chaque arrivée** (`sndOn = false`,
  plus de `spinbet_*_snd`) : bouton « 🔇 SON OFF » / « 🔊 SON ON » (`paintSnd`, à gauche sur le téléphone), musique baissée tant que l'attente parle (`duckIdle`), et tout toucher redonne le son à l'attente (iPhone). LANCER
  (`startShow`, dans le toucher) : l'émission part et, dès sa 1re image (`fromIdle`, `requestVideoFrameCallback`), elle remplace l'attente ;
  quand elle finit (`ended`) : `toIdle()`. Attente en pause pendant les bonus, reprise après.
  **Plateau Live** : **sa vidéo** `tools/art/plateaulive/attente.mp4` (la présentatrice parle à côté de la roue, caméra fixe ; son montage
  continuait par `roue.mp4`, coupé à l'image 538) → `python3 tools/art/plateaulive/attente.py` (`--fast`) : boucle images 41 → 532 (deux
  silences de sa voix), fin fondue dans le début (1 s, image et son) → `assets/games/plateaulive/attente.mp4` (1280 × 694, avec sa voix) +
  `attente.webp`, présentatrice détourée `attente-mask.png`, `IDLE` dans `games/plateaulive.js` (une seule homographie `h` : la roue ne bouge
  pas, case du masque par image `m`). LANCER part de `GO` = 1,6 s de `roue.mp4` (elle lance à 2,75 s) avec un fondu de 0,35 s (même caméra).
  **La Roue Folle** : depuis le 18 novembre 2026, exactement la même attente que Le Plateau Live (ses vidéos, voir « La Roue Folle = la
  même émission que Le Plateau Live »).
  **Essais en local** : `python3 -m http.server` ne répond pas aux requêtes « Range » : une vidéo ne peut pas y avancer (`currentTime`
  revient à 0, l'émission repart du début) ; Vercel les gère.
- **Le Speedball** (`games/speedball.js`, id `speedball`, catégorie **Roues & tables** (`cat: 'table'`, voulu par le propriétaire), demande
  du 18 novembre 2026 : **remplace le Super Keno**, supprimé avec ses fichiers) : **sa vidéo** `tools/art/speedball/speedball.mp4` (832 × 480,
  15,1 s : présentatrice, sphère de boules blanches et dorées, tube en spirale, tableau en arc ; plan large images 0 → 188, caméra fixe, puis
  gros plan sur le tube) → `python3 tools/art/speedball/build.py` : `assets/games/speedball/attente.mp4` (plan large en boucle sans coupure,
  muette, `LOOP` = 165/24 s) et `tirage.mp4` (de 3 s à la fin, avec le son ; `CUT` = 4,875 s = gros plan) + affiches. Rien n'est effacé :
  notre tableau en arc (20 boules), le compteur BOULE n / 20 et la plaque SPEEDBALL couvrent les siens (SVG `HUD` en pixels de sa vidéo,
  cercle `CX` / `CY`), la boule qui sort en grand `.sbx-now`. Téléphone tenu droit : le milieu de la vidéo (`.sbx-p`, x 140 → 740). Attente
  comme Le Plateau Live (son OFF à l'arrivée, LANCER = le tirage). **Jeu** (bloc `===ENGINE`) : grilles 5 × 5 (colonne c = 5 numéros parmi
  10c+1 … 10c+10), boutons **+1 / +5 / +10 / +50** (cumulables, `MAXG` = 200, gardées pour le tirage suivant : `spinbet_speedball_grids`,
  🔄 Changer, 🗑), mise par grille ; **pas de liste des grilles sous le jeu** (voulu par le propriétaire) : elles tombent en pile les unes
  sur les autres (`dealAnim`, 14 au plus à l'écran), la **grille la plus avancée** est toujours en haut de la pile (`cardState().score` :
  lignes, puis meilleure ligne k / 5, le numéro qui manque clignote `.ms`) ; à la fin, la fenêtre « Mes grilles » (`showAll`, `modal`,
  meilleures d'abord, croix = on rejoue ; pas en tours auto). 20 boules (1 à 50, `BT`), puis la boule dorée SPEEDBALL (`GOLD_T`) avec son
  multiplicateur annoncé au départ (`MULT` ×2 … ×200). Gains `PAY` par nombre de lignes complètes (12 par grille : ×2, ×12, ×80, ×300,
  ×1 000…), × le multiplicateur si le SPEEDBALL est dans une ligne complète, plafond ×50 000 la mise d'une grille. Simulation
  `node tools/sim/speedball.js` : retour ≈ 95,5 %, une grille gagne 1 fois sur 9. Plein écran : couché / ordinateur = l'émission à gauche,
  la pile et les boutons à droite (bloc CSS « Le Speedball »).
- **Le Texas, nouvelle table** (`games/poker.js`, id `poker`, demande du propriétaire du 16 novembre 2026, d'après ses 2 maquettes :
  téléphone = 1re, ordinateur = 2e) : table de **9 places** (`SLOTS`, 1 à 8 adversaires, 3 nouveaux bots Le Prof, Mimi, Rocky), places
  libres affichées. Un seul HTML `.pkx`, `data-m` = `phone` (table ovale, sièges ronds sur le bord, bandeau blindes / table / tapis,
  panneau COUCHER · PAROLE-SUIVRE · RELANCER, − mise +, ½ POT ⅔ POT POT TAPIS), `pc` (table aux coins arrondis, sièges numérotés,
  boutons rouge / bleu / or, curseur à crans Min ½ ⅔ Pot 2× Tapis `makeAnchors`, +25 % / +50 % du pot, ×2 ×3 ×4 la mise, touches F C R
  ↑ ↓ A) ou `land` (téléphone couché : table à gauche, panneau à droite). `layout()` (ResizeObserver) calcule tout : taille de la
  table, rail, sièges sur le bord (ellipse ou super-ellipse), mises, tailles `--d` `--pw` `--ph` `--cw` `--hw`. Recave (☰ ou bouton du
  haut) entre deux mains ou une fois couché. Plein écran = `100dvh`. CSS « Le Texas : la table d'après les 2 maquettes » à la fin
  de la couche `finition` (les anciennes règles `.pk-*` sont supprimées). **Pièges** : les classes `.ph` / `.pc` sont déjà prises par le
  site (`.pkx-qph` / `.pkx-qpc`) ; la barre `.controls.pro-ctl` des machines est forcée en `display: grid !important`, d'où la règle
  plus forte qui la cache. Règles du jeu et bots inchangés.
- **La Bataille** (`games/bataille.js`, id `bataille`, demande du propriétaire) : la table du 21 (`BjTableGame`, `DEPS`)
  avec les règles de la bataille : une carte chacun, la plus haute gagne (As le plus fort) 1 pour 1, égalité = la banque
  gagne ; **série** : 5 victoires d'affilée avec la même mise = la 5e main paie ×5 la mise (changer de mise remet la série
  à zéro, gardée dans `spinbet_bataille_serie`) ; mise annexe ÉGALITÉ 12 pour 1. Simulation `node tools/sim/bataille.js` :
  mise principale ≈ 96 % (dont 3,5 points de série, bonus 1 main sur 86), Égalité ≈ 96 %.
  **Table filmée** (demande du propriétaire) : `BjVideoGame` comme Le 21 (même croupière « Platinum VIP » depuis le 17 novembre 2026) ;
  à chaque main, ta carte puis la sienne. Cercle ÉGALITÉ sur la place à droite du cercle de mise (`BGEO.sides.tie`). Règles et gains inchangés.
- **Paliers de prestige** (`achievements.js`, `PR_TIERS`) : Bronze 1, Argent 5, Or 10, Platine 25, Diamant 50, Légende 100
  prestiges en tout, en médailles sur le profil (`tiersHTML`) ; le total `pres` est publié dans `leaderboard` et le
  profil public (`#@pseudo`) montre le palier. **Règles Firestore à recoller** (champ `pres` ajouté) : en attendant, le
  champ est retiré tout seul (`noPres`).
- **Fluidité sur ordinateur** (fin de la couche `finition`) : le fond de nuit est sur sa propre couche fixe (`body::after`),
  jamais `background: … fixed` sur `body` (repeint toute la page à chaque défilement : 4 → 60 images/s mesuré) ; pas de
  `backdrop-filter` (flou en direct) sur la barre du haut, les menus, la barre du bas et les messages. Ne pas les remettre.
- **Tous les `<style>` sont dans le `<head>`** (avant `<body>`), sinon le navigateur affiche d'abord l'ancien style
  (rouge, icônes géantes) pendant la lecture du code. Ne jamais ajouter de `<style>` plus bas dans la page.
- **Finition** (`<style id="finition">`, dernière couche de style de `index.html`) : fond de nuit à deux lumières,
  panneaux en dégradé avec bord lumineux et coins arrondis (12 px), boutons en dégradé bleu, menus et barre du bas
  en verre, cartes de jeu qui se soulèvent au survol. Elle passe après toutes les autres couches : la modifier en
  priorité pour retoucher l'allure générale. Le mode clair a ses propres lignes en bas de cette couche.
- **Style néon violet et rose + vitrine de l'accueil** (demande du propriétaire du 11 novembre 2026, d'après une bannière
  de casino : nuit violette, lumières roses, boutons en pilule rose) : bloc « Néon violet et rose » à la fin de la couche
  `finition` (il passe après tout ; `--green` = rose `#f472d0`, `--fin-blue` = dégradé rose des boutons). **Accueil** :
  vitrine `vitrineHTML()` dans `pages/lobby.js` (dessin SVG maison `NX_ART` : podium lumineux, machine 777, roulette,
  4 as, jetons ; titre SPINBET CASINO, cadeau du jour, JOUER MAINTENANT / CRÉER UN COMPTE), rangée des catégories
  `.nx-cats`, puis cadeau du jour, Nouveautés, Populaires, Machines à sous, événements, encarts. Sur téléphone : dessin
  en haut, texte centré dessous. **Ordinateur (≥ 1180 px)** : menu horizontal dans la barre du haut (`.nx-nav`,
  menus déroulants Événements / Récompenses), le menu de gauche devient un tiroir ouvert par ☰ (`--side: 0`).
- **Style des maquettes du 16 novembre 2026** (demande du propriétaire : 3 images faites par une IA, « tout pareil, presque, en
  adaptant le site ») : **dernier bloc de la couche `finition`** (« Style des maquettes du propriétaire », il passe après le néon) :
  nuit presque noire, cases sombres `--mq-card` à bord fin, rose vif `--mq-pink` (#ff3d9a) pour ce qui est actif, **icônes fines au
  trait** (jeu `ui-*` refait en entier : home, slots, tables, quick, online, cards, trophy, coins, swords, cashback, shield, ball,
  loto, gift, tv, ghost, support, music, vibe, moon, bell, wallet, user, dots, cal, heart, eye…, plus d'emoji dans le menu).
  **Menu de gauche** : titres de rubrique roses espacés, page active = fond rose pâle + liseré rose, NEW en petites étiquettes
  (bleue, violette `.v`), Défi spécial en carte avec anneau de progression (`data-sp-ring`, `--p`), **toujours ouvert sur
  ordinateur** (≥ 1180 px : plus de menu en haut `.nx-nav`, caché). **Barre du haut** : ordinateur = SOLDE + portefeuille (Recharger)
  collé au NIVEAU (barre d'XP, `.me-chip` rempli par `renderChip` : `.lv-shield`, `.me-lv`, `.me-bar`), cadeau `.top-gift` (point rose =
  cadeau du jour prêt, lien Récompenses), cloche `.top-bell` (`#appli`), avatar rond `.top-av` ; **téléphone** (demande du propriétaire
  du 16 novembre 2026) = ☰ **à gauche** (`.burger-r`, `order: -1` ; plus d'avatar) · solde **toujours en entier** (`fitBalance()` réduit
  un peu les chiffres s'ils ne tiennent pas ; avant : « 500… » pour 500 000) + « + » · « NIV 25 » (`.lv-s`, « Niveau » `.lv-w` sur
  ordinateur) · cloche (cachée ≤ 430 px) · **logo S à droite** (`.logo.mobile`). **Menu de côté** : ne défile que de haut en bas
  (`overflow-x: hidden`, `touch-action: pan-y`, `overscroll-behavior: contain`, page derrière bloquée `body.side-open`) : avant, il
  glissait parfois sur le côté et la page derrière bougeait en bout de liste. **Barre du bas** : Accueil · Promotions (`#recompenses`) · Classement
  (`#classement`, ajouté le 16 novembre 2026 à la demande du propriétaire) · Tournois · Caisse (`#recharger`) · Plus (ouvre le menu,
  `[data-toggle-side]` peut être sur plusieurs boutons) ; 6 onglets : textes en 11 px (10 px sous 370 px de large). **Accueil** : vitrine `vitrineHTML()`
  (texte à gauche « BIENVENUE CHEZ / SPINBET CASINO », cadeau du jour, JOUER MAINTENANT / CRÉER UN COMPTE ou RECHARGER, roulette et
  2 cartes `NX_WHEEL` à droite ; téléphone : roue derrière le texte, à droite), « Catégories de jeux » en tuiles à icône rose (4 sur
  téléphone), rangées de jeux dans des cartes `.nx-row` (titre en capitales, « VOIR TOUT › » rose). Jeux, tables et règles inchangés.
- **Thème lavande = thème par défaut** (maquette du propriétaire du 16 novembre 2026, « exactement 100 % pareil ») : fond lavande clair,
  encre violet nuit `--lv-ink`, violet profond `--lv-p` pour ce qui est actif, cartes blanches givrées à grands coins, boutons en pilule
  violette (`--fin-blue` redéfini). C'est `html.light` (allumé par défaut : localStorage `spinbet_theme_v2` = `dark` seulement si le joueur
  choisit « Mode sombre » dans le menu) ; **dernier bloc de la couche `finition`** (« Thème lavande »), il passe après tout. Logo = couronne
  + SPINBET en Cinzel (`.lv-brand` dans les logos, montré seulement en lavande). Téléphone : logo à gauche, solde dans un rectangle blanc net (« SOLDE » + montant en gros, voulu par le propriétaire) + « + », 👤 profil, ☰ à
  droite (niveau et cloche cachés). Accueil : vitrine `NX_LAV` (« LE FRISSON SANS RISQUE », SPINBET, « 100% JEUX VIRTUELS & GRATUITS -
  AUCUN DÉPÔT REQUIS », JOUER MAINTENANT →, dé, 3 as et perles = `assets/home/hero-art.webp`, découpés dans la maquette même du propriétaire,
  fondus dans la page par un masque fixe), carte « Catégories de jeux » `.nx-catbox` (téléphone 3 × 2 :
  Slots, Roulette, Blackjack, Poker, Jeux rapides, Promotions ; ordinateur + En ligne, Tournois ; icônes `ui-roulette`, `ui-bj`,
  `ui-poker`, `ui-promo`), rang « Jeux en vedette » (`bestHTML`, vignettes nettes) avec « TOUT VOIR → ». **Barre du bas = Accueil ·
  Promotions · Classement · VIP (`#profil`, `ui-star`) · Menu** (Classement à la place de Tournois, voulu par le propriétaire le 17 novembre
  2026 ; Tournois et Caisse restent dans le menu et le « + » du solde). Caisse et
  offre de parrainage en violet profond. Les écrans des jeux gardent leurs couleurs.
- **Lisibilité du thème lavande** (demande du propriétaire du 17 novembre 2026 : « on voit mal s'ils jouent… pas les bonnes couleurs ») :
  2 blocs à la fin de la couche `finition` (après « Thème lavande ») : **le chat, les joueurs en ligne et la fiche d'un joueur** (`.ct-panel`
  en carte blanche givrée, onglet actif violet, bulles claires, pastilles `.ln-p` blanches avec le pseudo en encre, `.pc-mz` violet) et
  **« Lisibilité en thème lavande »** : textes faits pour la nuit (blanc, jaune pâle, bleu pâle) repassés en encre, montants dorés en ambre
  foncé `--lv-gold` (Tendances, Défi, Paris, Jackpot, Loto, Missions, Cashback, Battle, Parrainage, Succès, Boutique, rangs du profil, JCC,
  pastille des affiches) ; **« Bonus & menu » des jeux** (`html.light .modal.gm` : cases des bonus, de la mise et des réglages en blanc, texte encre, prix en pilule violette ; avant, cases sombres et texte encre, 18 novembre 2026) et **joueurs + chat des salons en ligne** (`.on-players` / `.on-chat` : panneau violet nuit plein, pseudo blanc, gains vert vif). Trouvés par un contrôle automatique du contraste de toutes les pages (texte / fond < 2,6) : à refaire après un
  gros changement de couleurs.
- **Joueurs en ligne et amis, nouvelles cartes** (demande du propriétaire du 17 novembre 2026 : « il faut améliorer ça ») : une carte par joueur
  (`pRow` de `live.js` : avatar + point vert `.ln-on`, pseudo, AMI / TOI, niveau aux couleurs du rang `lvChip`, « Joue à <jeu> » avec ses couleurs,
  dernier gain `.ln-win`, **Rejoindre** `.ln-go` = ouvre le même jeu ; seuls les amis montrent leur jeu). Onglet « En ligne » du chat
  (`nowHTML(true)`) : sections « Tes amis » puis « Dans le casino », carte « Joue avec tes amis » (`data-goto-tab="friends"`) sans ami ;
  accueil : rangée de cartes (Rejoindre en ▶). Onglet Amis (`panelHTML` de `friends.js`) : recherche, demandes reçues (Accepter / ✕), En ligne,
  Hors ligne (initiale colorée `fr-ini`), demandes envoyées. Toucher la carte = la fiche du joueur (`data-player` sur `.ln-who` / `.fr-who`, le
  lien Rejoindre reste dehors). Couleurs en variables `--ol-*` (nuit, puis lavande dans `html.light`). Onglets du chat sur une ligne. **Piège** :
  `.fr-badge` = la pastille des tours offerts du bouton tourner des machines ; la pastille des demandes d'ami du chat est `.ct-frb`.
- **Les plus belles machines en tête de l'accueil** (demande du propriétaire du 16 novembre 2026 : « quand t'arrives, c'est directement les
  plus belles ») : rang « ⭐ Les plus belles machines » juste sous la vitrine (`bestHTML()` de `pages/lobby.js`, liste `BEST` : les machines à
  décor animé, L'Olympe, La Fortune, L'Hydre, REDK… ; machines en travaux ou retirées sautées), grandes affiches (`.nx-best`, fin de la
  couche `finition`). **Partout, les plus beaux jeux d'abord** (« tout le temps en avant ») : `pretty()` trie chaque rangée de l'accueil et
  chaque page de catégorie selon `PRETTY` (les machines de `BEST`, puis les jeux filmés : La Roue Folle, Le Speedball, La Roulette, Le 21,
  La Pêche…), les autres gardent leur ordre ; seul le rang « Nouveautés » garde l'ordre des mises à jour. Nouvelle belle machine : l'ajouter à `BEST`.
- **Catégorie « En ligne »** (demande du propriétaire du 16 novembre 2026 : « rassembler tous les jeux online, pour que ce soit plus
  simple ») : filtre `online` de `FILTERS` (`pages/lobby.js`, page `#lobby-online`) = `isOnline(g)` : les tables multijoueurs (`tag:
  'En ligne'`) + les duels en direct `ONLINE_DUELS` (Le Derby, Le Ring). Ils ne sont plus dans Roues & tables ni Jeux rapides (leur `cat`
  ne change pas). Liens : menu de gauche, menu du haut (`.nx-nav`), tuile de l'accueil (`.nx-cats` : 7 tuiles, sur téléphone 4 puis 3),
  rangée « 🟢 En ligne » de l'accueil avec « Tout voir ». Nouveau jeu en ligne : `tag: 'En ligne'` suffit.
- **Barre de mise « pierre gravée » partout** (demande du propriétaire du 11 novembre 2026 : la barre du Valhalla dans toutes
  les machines et tous les jeux, dans leurs couleurs) : classe `pro-ctl` sur `.controls` des deux moteurs (`core/base.js`
  et `slot/machine.js`, qui reçoit aussi `--accent` / `--accent2`), boutons `pb-max` (MISE MAX, `maxBet()`, si la mise
  se règle) et `pb-auto` (tours auto → « Bonus & menu »). Bloc « Barre de mise » à la fin de la couche `finition` :
  couleurs tirées de `--accent` / `--accent2`, disposition « mise · MISE MAX · tourner · auto · gain · solde · menu »,
  téléphone en hauteur sur 2 rangées, en largeur plein écran : 3 rangées dans la colonne de droite des machines, 2 rangées
  pour les jeux rapides (`.table-game`). Le Valhalla garde sa pierre grise (`.vk-ctl`) ; les tables (21 `.bjv-game`,
  roulettes `.rl-game`) et les salons en ligne (`.online-game`) gardent leur barre.
- **Passe « améliore tout » du 12 novembre 2026** (demande du propriétaire), 3 blocs à la fin de la couche `finition` :
  **pages du site** (bloc « panneaux et cases néon » : variables `--panel` / `--panel-2` / `--panel-3` / `--line` / `--muted`
  en violet, cases des pages arrondies 12 px en dégradé, onglets `.lb-tabs` en pilule, barres de progression rose → or,
  champs arrondis) ; **écran des gros gains** (bloc « Écran des gros gains » : titre Bebas en métal, rayons sur 2 couches,
  anneau, montant dans une plaque à cadre lumineux, « × la mise » en pastille, une couleur par palier `--bw1…3` ;
  paliers en français dans `TIERS` / `WIN_TIERS` : GROS GAIN, MÉGA GAIN, GAIN ÉPIQUE, GAIN LÉGENDAIRE) ; écran
  d'annonce des bonus (`.slot-overlay.intro`) dans la même famille. Les tables (21, roulettes) n'ont pas été touchées.
- **Gain max et guide des symboles** (demande du propriétaire du 12 novembre 2026) : en haut de chaque machine à sous, plaque
  `.mx-info` « ⓘ GAIN MAX ×N » (rangée `.mx-row`, dans les deux moteurs, `data-act="info"`) qui ouvre les règles ; en tête
  des règles, le guide `guideHTML()` (`core/base.js`) : gain maximum, **le symbole qui paie le plus** et les 2 suivants
  (lus dans la table des gains du jeu : lignes `.pay-item`, ou `.pay-sym` seul pour les Totems ; `slot/machine.js` les
  calcule lui-même), et un conseil « pour un défi ×50, ×200 » avec les bonus du jeu (`SPECIAL_LIST`). Nouvelle machine :
  garder une table des gains en `.pay-item` avec les « ×N » pour que le guide la lise.
- **Vérification complète** (`tools/verif/robot.js`) : un robot Playwright parcourt les 26 pages et les 48 jeux sur
  ordinateur et téléphone, lance une partie dans chaque jeu et relève erreurs, débordements et textes « undefined ».
  `python3 -m http.server 8123` puis `node tools/verif/robot.js`. À relancer après une grosse modification.
- **Couvertures** (`covers.js`, `poster()`) : un seul gabarit pour tous les jeux (plaque de titre, Bebas Neue, marque).
  Une image avec un titre peint dedans se déclare dans `CROP` (partie gardée, au-dessus du titre).
- **Miniatures = une image du vrai jeu** (demande du propriétaire du 17 novembre 2026 : « le blackjack, une photo avec la croupière et le
  tapis, comme Le Plateau Live… avec tous les jeux, hormis les machines à sous ») : tables et jeux rapides ont pour `cover.webp` une capture
  du jeu en pleine partie, faite par `tools/covers/shots.js` (réglages par jeu dans `tools/covers/games.js` : téléphone ou ordinateur, étapes
  jouées (mise, cartes posées au bout du sabot, `Math.random` poussé pour un long vol…), cadre `fit` / `col` / `box`), 600 × 800 sans
  titre peint (le haut carré = la vignette). Jeux filmés : la croupière, l'animateur, la roue ; les autres : l'écran du jeu. Refaire une
  miniature : `python3 -m http.server 8123` puis `node tools/covers/shots.js <id>`, puis `node tools/seo/share-images.js <id>` et changer
  `CACHE` dans `sw.js`. Les machines à sous gardent leurs affiches.
- **Dessins par code en 3D** (`tools/render3d/`, Three.js) : couvertures des jeux sans image peinte et pièces des
  jeux rapides (`SPRITES`). `cd tools/render3d && npm i three@0.160.0 && node render.js` (couvertures) ou
  `node render.js --pieces` → `assets/games/<id>/…webp` (puis changer `CACHE` dans `sw.js`).

## Le Derby : match de foot entre amis (demande du propriétaire)

- **Le jeu** (`games/foot.js`, id `foot`, catégorie Jeux rapides) : un vrai match de foot **11 contre 11 en direct**
  entre deux amis, avec une mise. Chacun mise la même somme (mise libre, 0 = « pour l'honneur ») : **le gagnant prend
  les deux mises**, **match nul = chacun récupère la sienne**, abandon = défaite. Durée 4, 6 ou 8 min (2 mi-temps).
  Entraînement contre l'ordinateur (Facile / Normal / Difficile, sans mise) pour apprendre.
- **Commandes** : téléphone = stick flottant à gauche (pouce n'importe où dans la moitié gauche) + boutons PASSE
  (tenir = passe en l'air / centre), TIR (tenir = puissance, le stick vise un côté du but), TACLE (près du ballon :
  tacle debout, de loin : glissé ; avec le ballon : DRIBBLE = crochet), SPRINT. En défense PASSE = CHANGER (joueur le
  plus proche du ballon), TIR = PRESSING (un coéquipier presse aussi). PC : flèches ou ZQSD (`e.code`, marche en
  AZERTY), K passe, L ou Espace tir, J tacle/dribble, Maj sprint ; manette (Gamepad API : A passe, B tir, X tacle,
  gâchette sprint). Paysage = caméra TV de bord de terrain, portrait = caméra derrière l'action. Plein écran pendant
  le match (`setFull`), les messages du site sont cachés (`body.derby-on`).
- **Moteur** (bloc `===ENGINE` de `games/foot.js`) : 60 images/s, **entièrement déterministe** (tout l'état dans un
  `Float64Array`, hasard `rnd` dans l'état, seulement + − × ÷ et `Math.sqrt` ; `dexp` maison ; **jamais** `Math.random`,
  `sin`, `cos`, `exp`, `pow`, `hypot`, `**` dans ce bloc : les deux téléphones doivent calculer exactement le même
  match). IA d'équipe en 4-4-2 (bloc qui suit le ballon, pressing, couverture, marquage, appels en profondeur),
  gardiens (placement, plongeons, arrêts / parades / corners), fautes, penaltys, touches, corners, 6 m, coups francs
  (mur), mi-temps, ralenti des buts (`History`). Niveaux de l'ordinateur : `LVL_*` (vitesse, frappes, gestes
  techniques, arrêts) ; en ligne les coéquipiers des deux joueurs sont « Normal ».
  Simulations : `node tools/sim/foot.js` (ordinateur contre ordinateur, `--bots` = « humains » au hasard, vérifie le
  déterminisme) : ≈ 3,3 buts et 15 tirs par match de 6 min ; `node tools/sim/foot-net.js [ping] [pertes %]` (deux
  téléphones à travers un faux réseau : états finaux identiques). **Après toute modification du moteur : relancer les
  deux.**
- **En ligne** : WebRTC pair à pair (STUN Google + Cloudflare, pas de serveur TURN : si les deux réseaux bloquent la
  connexion directe, le vestiaire le dit et propose d'annuler, mises rendues), préparé par Firestore `foot/{id}`
  (`of` / `aw` = offre et réponse). L'hôte = celui qui a lancé le défi (équipe 0). **Rollback** (`Rollback`) : chaque
  téléphone joue tout de suite ses commandes (prévues `delay` images plus tard), devine celles de l'autre et rejoue
  quand elles arrivent ; les deux s'attendent (`adv`) ; empreinte des états confirmés chaque seconde, et si elles
  diffèrent l'invité reprend l'état de l'hôte (`need` / `st`). Les deux versions du jeu doivent être identiques
  (`NETV` = empreinte du code du moteur, sinon « rechargez la page »). Connexion coupée 25 s = le score du dernier
  moment confirmé compte. Essais : `?footdur=1500` (mi-temps de 1 500 images), `?footlag=70` (réseau lent et
  pertes), `?debug` (`window.__foot`).
- **Défis et mises** (module `foot-defis.js` d'index.html, toujours chargé) : fenêtre « X te défie au Derby ! » sur
  n'importe quelle page (Accepter et jouer / Refuser), « X a accepté ton défi ! Jouer maintenant ». La mise quitte le
  solde à l'envoi et à l'acceptation (`wallet.spend`, gardée dans `profile.footEsc`) ; chaque navigateur se paie
  lui-même une seule fois (`profile.footDone`, historique `profile.footHist`), écrit `da` / `db`, et le document est
  effacé quand les deux sont payés. Défi sans réponse 15 min = expiré (mise rendue) ; accepté mais pas commencé en
  12 min = annulé (mises rendues) ; résultat `r` écrit une seule fois (premier qui écrit). Comptes seulement.
- **Règles Firestore à recoller** (collection `foot` ajoutée dans `firebase/firestore.rules`) : sans elles, les défis
  en ligne sont refusés (l'entraînement marche quand même).

## Le Ring : combat de boxe entre amis (demande du propriétaire)

- **Le jeu** (`games/boxe.js`, id `boxe`, catégorie Jeux rapides) : même principe que Le Derby (mise identique pour les
  deux, le vainqueur prend les deux mises, nul = mises rendues, abandon = défaite), 3, 5 ou 7 rounds d'1 min
  (`d` = 4, 6, 8 → `ROUNDS`), entraînement contre l'ordinateur (Facile / Normal / Difficile). **3 caméras au choix**
  (voulu par le propriétaire) : 1re personne (ses gants devant soi, l'adversaire en face), 3e personne (derrière son
  boxeur), vue TV ; choix dans le vestiaire, bouton 🎥 pendant le combat ou touche V (`spinbet_boxe_cam`).
- **Commandes** : stick = bouger (tourner autour, avancer, reculer) ; DROITE, CROCHET, UPPERCUT ; stick en bas + coup =
  au corps ; ESQUIVE (stick ← / → = rotation, évite droite et uppercut ; stick ↓ = esquive basse, évite droite et
  crochet mais l'uppercut fait ×1,5) ; GARDE (tenir ; avec stick ↓ = garde basse pour le corps). Esquive réussie =
  CONTRE (plus rapide, ×1,5). PC : flèches / ZQSD, K droite, J crochet, I uppercut, Espace esquive, Maj garde.
- **Règles** (bloc `===ENGINE`, données `PU`) : endurance, knockdown à 0 de vie (compte de l'arbitre, taper vite pour
  se relever, compte de 8 obligatoire), 3 knockdowns dans un round = arrêt de l'arbitre, sinon 3 juges (10-9, −1 par
  knockdown) et décision à la majorité. Moteur **déterministe** comme celui du foot (mêmes interdits : pas de
  `Math.random`, `sin`, `cos`… dans le bloc). Simulations : `node tools/sim/boxe.js` (combats + déterminisme) et
  `node tools/sim/boxe-net.js [ping] [pertes %]` (deux téléphones, mêmes empreintes). **Après toute modification du
  moteur : relancer les deux.**
- **Rendu** : petite 3D maison en canvas 2D (`View`, `capsule`, `ball`, poses `poseOf` + IK des coudes et genoux),
  ring, cordes, public, arbitre qui compte. Essais : `?debug` (`window.__boxe`), `?boxdur=600` (rounds courts),
  `?boxlag=70`.
- **En ligne** : copie de `Link` / `Rollback` du Derby, et les défis passent par `foot-defis.js` dans les mêmes
  documents Firestore `foot/{id}` : **`ka` / `kb` ≥ 10 = un combat de boxe** (couleur = `ka − 10`), résultat
  `r = { a: 1, b: 0 }` pour le vainqueur, 0-0 = nul. Aucune règle Firestore à recoller. `list('boxe')` donne les
  combats, `footHist` marque les combats `g: 'b'`.

## Les Échecs (demande du propriétaire du 16 novembre 2026)

- **Le jeu** (`games/echecs.js`, id `echecs`, catégorie Roues & tables), d'après ses 2 maquettes : ordinateur = salon noir et or à
  3 colonnes (joueur, solde, mode, statistiques, liens | échiquier + colonne COUPS + ANNULER / MEILLEUR COUP / PROPOSER NULLE /
  ABANDONNER + barre d'état | adversaire, 2 pendules, ANALYSE (courbe de l'avantage), AIDES) ; téléphone = ☰, adversaire et 2 pendules
  en haut, échiquier, 4 boutons COUPS / ANNULER / ABANDON / RÉGLAGES ; téléphone couché = échiquier à gauche. `layout()` (ResizeObserver)
  choisit `data-m` (pc, classe `tab` sous 1 100 px = sans la colonne de gauche, phone, land) et `--bs` (côté de l'échiquier). CSS
  « Les Échecs » à la fin de la couche `finition`.
- **Pièces en 3D** (`tools/render3d/scenes.js`, `CH_PIECES` : tour, fou, dame, roi en tour de potier, cavalier extrudé ; ivoire / ébène)
  → `assets/games/echecs/<w|b><P|N|B|R|Q|K>.webp` (`node render.js --pieces echecs/wK …`), couverture `SCENES.echecs`. Elles glissent
  (transition `transform`), se soulèvent quand on les choisit, se posent avec un petit rebond et un « toc » de bois (`tock()`), les prises
  s'envolent. Toucher-toucher ou glisser-déposer, cases possibles, dernier coup, échec en rouge, flèche d'aide, choix de la promotion.
- **Moteur** (bloc `===ENGINE`, fonction `CHESS()`) : règles complètes (0x88, roque, en passant, promotion, mat, pat, répétition, 50 coups,
  matériel insuffisant), notation en figurines. Vérifié par perft (5 positions de référence). L'ordinateur : alpha-bêta + recherche des
  prises + tables de positions, dans un **Web Worker** fabriqué avec le texte de `CHESS()` (l'écran reste fluide). `LEVELS` : Léo Facile
  ELO 800 (profondeur 1, bruit, gaffes), Margaux Moyen 1200, Le Baron Difficile 1600, La Duchesse Expert 2000 (approfondissement jusqu'à
  1,7 s) ; petit livre d'ouvertures `BOOK`. **3 aides par partie** en solo (annuler, meilleur coup, coup d'ouverture, coup tactique).
  Classement ELO du joueur et statistiques sur l'appareil (`spinbet_echecs_elo`, `spinbet_echecs_st`). Cadences `TCS` : sans limite,
  5 + 3, 10 + 5, 15 + 10.
- **Entre amis** : les défis de `foot-defis.js` (comme Le Derby et Le Ring), **`ka` = `kb` = 20**, `d` = 4 / 6 / 8 = la cadence, mise
  **50 000 KE au plus** (`CHESS_MAX`), couleurs tirées de l'id du document (`whiteOf`). Les coups passent par le document : `mv` (coups en
  UCI), `ck` (pendules en ms après le dernier coup), `mt` (heure serveur du dernier coup), `dr` (nulle proposée par …). Résultat `r` comme
  la boxe (`{ a: 1, b: 0 }`, abandon `f`, nulle 0-0). Le joueur peut quitter la page : la partie continue (sa pendule tourne), « Reprendre la
  partie » dans Mes parties. Temps écoulé = l'un des deux téléphones écrit la défaite. **Règles Firestore à recoller** (`ka` / `kb` < 32,
  champs `mv` / `ck` / `mt` / `dr` pour `ka` ≥ 20) : sans elles, les défis d'échecs sont refusés (le solo marche).

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
- **Super turbo des machines à sous** (demande du propriétaire, « chasse au bonus ») : bouton 🚀 Super turbo dans « Bonus &
  menu » de toutes les machines à sous (les deux moteurs, `core/base.js` et `slot/machine.js`, localStorage
  `<id>_super`). Il allume aussi le Turbo et met `globalThis.__sbSuper` : `sleep` des moteurs (`core/base.js`,
  `core/grid.js`, `slot/machine.js`, `slot/holdspin.js`) ×0,3, rouleaux ×0,45, cascades ×0,5, comptage des gains et
  tours auto plus courts. Remis à zéro en quittant le jeu. Ne change pas les gains. **Dès qu'un bonus démarre** (`sb:feature`, sauf relance `re`), Turbo et Super turbo se coupent tout seuls
  et restent coupés (`onFeatCalm` dans les deux moteurs, message « Turbo coupé pour profiter du bonus ») : voulu par le
  propriétaire, le joueur les remet lui-même ; **sauf** s'il coche « 🔁 Garder le turbo pendant les bonus » (« Bonus & menu »
  des deux moteurs, un seul choix pour toutes les machines : `keepTurbo()`, localStorage `spinbet_keep_turbo`, voulu par le
  propriétaire pour ceux qui « charbonnent » les bonus). **Les tours auto continuent après un bonus** (voulu par le
  propriétaire) : l'appel `stopAuto()` d'un jeu au début de son bonus est ignoré pendant un tour de machine à sous
  (`core/base.js`) ou supprimé (`slot/machine.js`) ; seuls le bouton tourner, « Stop » du menu et un solde trop bas les
  arrêtent (`stopAuto(true)`). Mesuré : Le Loup 1,8 s → 0,57 s
  par tour, L'Olympe 2,0 → 1,15 s.
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
  **Combinés** (voulu par le propriétaire) : bouton « 🎟️ Combiné » en haut de la page, chaque cote touchée va dans le panier
  (`slip`, un choix par match, 2 à `COMBO_MAX` = 8 matchs, barre collée en bas avec la cote totale) ; cotes multipliées
  (plafond `COMBO_ODDS` ×1 000), un match perdu = combiné perdu (réglé dès qu'on le sait), match reporté = cote 1. Pari
  rangé avec `combo: [{ m, k, odds, start, label }]` et `legs` (état de chaque match) une fois réglé.

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
  **Ouvrir tous mes paquets d'un coup** (demande du propriétaire, `openAll()` / `showAll()`) : bouton sous « Mes paquets »
  dès 2 paquets, et « Ouvrir les N autres d'un coup » après un paquet ; un seul enregistrement, puis un récapitulatif
  (paquets, cartes par rareté, nouvelles, chaque carte une fois avec ×nombre, les meilleures d'abord).
  **Nouvelle série (le propriétaire envoie des images tous les 1 à 3 mois)** : ajouter une entrée à la fin de `SERIES`
  (id court, nom, saison, éléments `els`, **75 à 80 cartes** (voulu par le propriétaire) `[id, élément, rareté, nom, emoji ou { img }, texte]`), images
  découpées dans `assets/games/jcc/` (`{ img: 'dossier/fichier' }` sans `.webp`, ≈ 480 px de large), puis changer
  `CACHE` dans `sw.js`. Les paquets s'ouvrent dans la série choisie (la plus récente par défaut) et chaque série a son
  album et ses 100 000 KE. La 1re série « Les Origines » (78 cartes : par élément 14 communes, 7 rares, 4 épiques,
  1 légendaire) : les 3 légendaires sont les 3 cartes du propriétaire (phénix, golem, danseuse), les 75 autres viennent de ses 3 planches
  de 25 dessins (Feu, Terre, Éther), découpées dans `assets/games/jcc/o/` (`f01`…`e25` = place sur la planche, ligne par
  ligne ; suffixe `c` = dessin sans fond rendu transparent, `cut: 1` → affiché entier) ; chaque carte porte le nom de son
  dessin. Le site sait encore afficher une carte « emoji » (art en texte) pour une série pas encore dessinée.
  **Série 2 « Les Trois Petits Cochons »** (id `p`, demande du propriétaire du 12 novembre 2026, 88 cartes de ses 2 planches
  découpées dans `assets/games/jcc/p/` : `a1`…`j8` = case de la planche, `r1`…`r5` rares, `s1`…`s3` secrètes ; éléments
  Cochons / Loup / Maisons). **La 1re série est fermée** : les paquets (gagnés, achetés, forge) s'ouvrent seulement dans la
  plus récente (`NOW`), les anciennes restent dans l'album (🔒) et au Marché. Une série peut changer ses raretés
  (`rar`), ses chances (`odds`, sans carte garantie), son album (`album` : **500 000** KE) et finir à une date (`ends` :
  12 décembre 2026 minuit, compte à rebours sur la page et l'accueil ; après, plus de prix d'album). **5 niveaux** (`RANK`
  = `CUTRELS`, raretés `U` et `T` ajoutées à `RAR` le 12 novembre 2026 : le propriétaire avait 60 cartes différentes après
  18 paquets) : 30 Communes 500, 30 Peu communes 2 000, 20 Précieuses 8 000, 5 Rares **50 000**, 3 Secrètes **200 000** KE ;
  chances par carte bleu / violet / doré : commune 89,3 / 72 / 45 %, peu commune 9 / 20 / 35, précieuse 1,2 / 6 / 12, rare
  0,45 / 1,8 / 7,2, secrète 0,05 / 0,2 / 0,8. Après 18 paquets ≈ 40 cartes différentes ; album seul ≈ 825 paquets (médiane).
  Valeur moyenne d'un paquet ≈ 5 550 / 13 500 / 37 550 KE (sous les prix de la boutique). Liste :
  `notes/jcc-trois-petits-cochons-cartes.txt`. **Prochaine série vers le 12 décembre** : l'ajouter à la fin de `SERIES`
  avec son `ends` (un mois plus tard).
  **Demandes de cartes** (demande du propriétaire du 12 novembre 2026, `askCard` / `fillAsk` / `handleAsks`, Firestore
  `asks/{id}`, **règles à recoller**) : dans l'album, une carte manquante (toutes séries, anciennes comprises) →
  « 📣 Demander cette carte » (à sa cote, 10 au plus). Au Marché, « Demandes des joueurs » montre celles qu'on a en double
  (exemplaire normal) : « Vendre » d'un geste (open → sold, seulement si `ok`). Le navigateur du demandeur paie
  (sold → paid, carte ajoutée) ou, sans assez de solde, la rend (sold → back → open, carte rendue au vendeur) ; le vendeur
  se paie en effaçant la demande payée. `ok` = « assez de solde », écrit par le demandeur seulement quand il change
  (« Pas assez de solde » chez les autres, la demande reste). Une demande s'efface toute seule si on a trouvé la carte
  ailleurs. Prix max du Marché passé à 600 000 (secrète brillante).
  **Secrètes cachées** tant qu'on n'en a pas une (`seen` / `nm`) : ni dessin ni nom dans l'album, au Marché, dans les
  demandes et les messages (voulu par le propriétaire : on ne les voit qu'en les obtenant).
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
- **Le chat garde 48 heures** (voulu par le propriétaire : le site ne garde pas tous les messages) : les messages de plus de
  48 h ne s'affichent plus (`CHAT_TTL` / `fresh` dans `cloud.js`, chat général et chats des tables) et GitHub Actions
  **« Chat »** (`tools/admin/chat.mjs`, `.github/workflows/chat.yml`, toutes les 6 h ou à la main) les efface de Firestore
  (secret `FIREBASE_SERVICE_ACCOUNT`).
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

- **Joueurs de la maison** (`maison.js`, demande du propriétaire du 16 novembre 2026, pendant ses pubs Snapchat, « pour que le site paraisse
  vivant ») : 10 joueurs au pseudo à la française (`BOTS` : niveau de départ, niveaux par jour, heures de jeu à Paris, mise, jeux préférés), **toujours en Bronze, comme des nouveaux venus** (voulu par le propriétaire : « pas le même niveau que nous » : arrivés le
  13 novembre 2026 (`START`), niveau 1 à 3 au départ, ≈ 0,15 à 0,35 niveau par jour qui ralentit, jamais au-dessus de `LV_MAX` = 10 ; petites mises
  1 à 10 KE, soldes ≈ 1 000 à 10 000 KE, records de quelques centaines de KE),
  **calculés sur chaque appareil à partir de la date** (mêmes chiffres pour tous, **aucune écriture Firestore**) : niveau qui monte chaque jour,
  solde, plus gros gain / bonus (records qui ne font que monter), succès. Visibles dans le classement (mélangés aux vrais, `board()`), la liste
  des joueurs en ligne (`online()`, plus le soir, présents ou non par tranche de 20 min ; jamais assis aux tables multijoueurs) et les gros gains
  en direct (`bigWin()`, toutes les 7 à 18 min). **Reconnaissables sur leur carte** : « Joueur de la maison SpinBet » (`openPlayer` de `chat.js`) ; le logo 🎰 à côté
  du pseudo a été retiré le 16 novembre 2026 à la demande du propriétaire (`tag` vide). **Ne parlent jamais dans le chat** ; un joueur à moins de 200 KE qui demande de
  l'aide dans le chat (`HELP_RX`) est dépanné de 300 à 1 500 KE une fois par jour (`maisonHelp`, payé sur son appareil, il poste lui-même
  « 💸 a été dépanné de … KE par … »). **Jamais de prix** (absents des tournois, Battle Royale, défis, jackpot). Pour les retirer : `ON = false`.

## La caisse : « Déposer » (demande du propriétaire du 16 novembre 2026)

- **Le concept** : comme un dépôt dans un vrai casino en ligne, mais en argent fictif payé en regardant des pubs. Le « + » à côté du
  solde (`.top-refill`, `data-deposit` ; sur ordinateur une pilule rose « DÉPOSER », `.tr-lbl`) ouvre la caisse (`depot.js`,
  `openDeposit()`, fenêtre `.dp-modal`, en bas de l'écran sur téléphone) : moyen de paiement « Pub vidéo », montants `PRESETS`
  (20 000 · 50 000 · 100 000 · 250 000 · 500 000) ou montant libre (par 5 000), récapitulatif (dépôt, bonus, frais 0, pubs, « tu
  reçois »), bouton collé en bas (`.dp-foot`). **Prix en pubs voulus par le propriétaire** (`PACKS`) : 20 000 = 1 pub, 50 000 = 2,
  100 000 = 10, 250 000 = 30, 500 000 = 60 ; les 2 petites offres (`CHEAP`) : 2 dépôts puis **30 min de pause** pour les deux (`LOCK`,
  `profile.dep.ck = { n, until }`, cadenas et minutes sur les tuiles) ; **montant libre** à tout moment, toujours plus cher que l'offre
  à 500 000 : 1 pub par tranche de 7 500 (`CUSTOM_PER` : 100 000 = 14 pubs, 500 000 = 67). Limites : `DEP.max` 500 000 par dépôt, `DEP.day` 1 000 000 par jour. **Bonus de bienvenue** +50 % sur le
  1er dépôt, jusqu'à 25 000 (`WELCOME`). Pubs à la suite (`ads.one(id, step, of)` d'`ads.js`, « Publicité 1 / 4 »), comptées pour le
  coffre des pubs ; une pub fermée = dépôt **en attente** (`profile.dep.pend`, « Continuer · pub 3 / 4 » ou « Annuler ») ; reçu avec
  n° de transaction `DEP-…`, onglet « Mes dépôts » (`profile.dep.hist`, 12 derniers). Invités : total du jour et bonus aussi gardés
  sur l'appareil (`spinbet_depot`). Propriétaire et appareils `?nopub` : dépôt sans pub (petit moment « paiement en cours »).
- Partout : tout élément `[data-deposit]` (ou `data-deposit="50000"`) ouvre la caisse ; adresse `#depot` (aussi `#deposer`, `#caisse`)
  = page Caisse + fenêtre ouverte. Page Caisse (`#recharger`) : encart « Déposer des KE » en tête (`heroHTML()`), puis recharge, pubs et
  codes. Aussi : bouton DÉPOSER de l'accueil (comptes), carte « Solde bas ? » dans les jeux, menu « Caisse · Déposer », page Récompenses.

## Bonus offert quand le solde est bas (demande du propriétaire du 16 novembre 2026)

- `bonus-bas.js` : dès que le solde passe **sous 1 000 KE** (`LOW.below`), une fenêtre (`.lw-modal`) propose **un bonus gratuit sur une
  machine à sous tirée au hasard**, une autre à chaque fois (les `LOW.keep` = 6 dernières proposées sont évitées, jamais celle qui est
  ouverte : « ça fait découvrir une machine »), **joué à 50 KE de mise** (`LOW.bet`). « Jouer mon bonus » ouvre la machine (son écran
  d'ouverture d'abord s'il apparaît), met la mise à 50, lance `freeBonus(id)` puis remet l'ancienne mise à la fin du bonus (`setStake`,
  les deux moteurs). Le bonus lancé = le 1er **vrai** bonus de la liste d'achat (`realBonus` : coût ≥ 15 × la mise, `LOW.real` ; Le
  Cosmique, La Sweety et Le Coffre-Fort commencent leur liste par un simple tour spécial à 3–5 ×). `freeBonus(id)` des deux moteurs
  accepte maintenant l'id d'un bonus (sans id : le 1er, comme avant pour la machine mystère et « rejoue ton bonus »). Compté comme un
  bonus acheté (ni tournois, ni duels, ni Défi spécial). **3 par jour** (`LOW.day`), **30 min** entre deux fenêtres, acceptée ou
  refusée (`LOW.gap`) ; jamais pendant un tour, en tours auto, en plein écran, pendant un match ou par-dessus une autre fenêtre (elle
  attend). `profile.lowb = { day, n, last, seen }` + localStorage `spinbet_lowbonus` (invités). Gratuit, sans pub.

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
- **Parrainage = offre spéciale** (`social.js`, page `#parrainage`, demande du propriétaire du 16 novembre 2026) : l'ami reçoit
  `REF_KE` = **10 000 KE** à l'inscription (l'accroche de chaque lien partagé) ; le parrain reçoit `REF_PARRAIN` = **250 000 KE** +
  `REF_SPINS` = **100 tours offerts à `REF_BET` = 1 000 KE** sur `REF_PICK` = **3 machines à sous au choix**, quand **(1)** il a ajouté le
  Snap du site (`SNAP` = spinbetcazino : le bouton ouvre snapchat.com/add/… et valide l'étape, `profile.refSnap` ; impossible de vérifier
  vraiment un ajout Snap) et **(2)** l'ami atteint le **niveau 5** (`REF_LEVEL`, lu dans son `leaderboard`) ; 50 amis au plus. Page en
  3 étapes (`.rf-step`) + choix des 3 machines (`.rf-games`, machines du moteur `core/base.js` seulement : `refChoices`) ; tours répartis
  34 / 33 / 33 (`giveSpins`), gardés dans `profile.refPend` tant que les 3 machines ne sont pas choisies. **Tours à 1 000 KE** :
  `gifts.big` / `addBig` / `useBig` (`profile.bigRounds`) et `BIG_BET` de `core/base.js` (la machine s'ouvre à 1 000 KE de mise même
  avec un petit solde, tour gratuit si la mise = `BIG_BET`, retour à une mise possible quand ils sont finis). Grande case dorée sur
  l'accueil sous les catégories (`refPromoHTML()` de `pages/lobby.js`, `.rf-promo`), encart des événements (`retour.js`), étiquette
  « 250K » sur Parrainage dans le menu (`.side-new.rf-hot`).
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
- **Vrai plein écran dans l'APK** (16 novembre 2026) : `setFull` (`core/chrome.js`) appelle `SpinBetApp.immersive(true / false)` ; l'appli
  cache alors la barre d'état et la barre de navigation du téléphone (immersif « sticky », remis au retour dans l'appli). Les anciennes
  versions de l'appli n'ont pas la fonction : rien ne change pour elles.

- **Rappel « Mets SpinBet sur ton écran d'accueil »** (`rappel-appli.js`, demande du propriétaire du 16 novembre 2026) : **qui a l'appli**
  = ce téléphone a déjà ouvert le site depuis son icône (`display-mode: standalone`, iPhone `navigator.standalone`) ou depuis l'APK
  (« SpinBetApp » dans le user agent) → localStorage `spinbet_pwa`, et pour un compte `profile.app = { t, os }` écrit une seule fois
  (sur iPhone l'icône a sa propre mémoire, séparée de Safari). Impossible de savoir depuis le navigateur si un joueur a installé
  l'appli sans jamais l'ouvrir. **Rappel** : seulement sur téléphone (iPhone, Android), dans le navigateur, à qui n'a pas l'appli, après
  `NAG.rounds` (12) parties ou `NAG.min` (5) minutes de la visite, jamais pendant un tour / plein écran / une autre fenêtre ; puis plus
  avant `NAG.gap` (3 jours), 7 jours après 3 « Plus tard » (`spinbet_pwa_nag`). Fenêtre `.pw-modal` (téléphone dessiné avec l'icône)
  → « Voir comment faire » (iPhone) / « Installer l'appli » (Android) = `getApp()` de `pages/app.js` (tuto Partager → Sur l'écran
  d'accueil, ou Chrome / APK). **Chiffres** (`monitor.js`, `count()`) dans le tableau de bord `#tableau` : chaque visite comptée `_app`
  (icône / appli), `_mob` (navigateur d'un téléphone) ou `_pc` (ordinateur), depuis le 16 novembre 2026 ; `_nag` (rappel montré),
  `_nago` (tuto ouvert depuis le rappel).

## App Store et Google Play (demande du propriétaire du 16 novembre 2026)

- Marche à suivre et textes des fiches pour le propriétaire : `notes/app-stores-mise-en-route.md` ; captures 1320 × 2868, icône et
  bannière Google dans `store/`.
- **Android** : `targetSdk` / `compileSdk` 36 (AGP 8.9.1, Gradle 8.11.1). Android 15+ dessine l'appli sous les barres du téléphone :
  `MainActivity` met la page entre elles (marges de `root` lues dans les insets), sauf en plein écran (seulement l'encoche).
  `android.yml` fabrique aussi `spinbet-play` (`.aab` pour la Play Console, dans les Artifacts du lancement).
- **iPhone** (`ios/`, Swift, WKWebView, iOS 15+, iPhone seulement, id `com.spinbetcaz.app`) : projet Xcode fabriqué par XcodeGen
  (`ios/project.yml`) sur un Mac de GitHub (`.github/workflows/ios.yml`, « Appli iPhone ») puis envoyé à TestFlight avec la clé API
  d'App Store Connect (secrets `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8`, `APPLE_TEAM_ID` ; sans eux : simple
  essai de compilation). Même `window.SpinBetApp` que l'APK (injecté au chargement : `share`, `immersive`, `notifStatus` / `notifOn`
  / `notifOff`, `daily`), plus `navigator.vibrate` (retour haptique). User agent `SpinBetApp/1 SpinBetiOS/1`. Notifications locales
  (`Notifs.swift`, comme `Notifs.java` sans les événements flash). Liens hors du site → Safari.
- **Supprimer mon compte** (page Profil, comptes connectés, exigé par Apple et Google) : `profiles.deleteAccount(motDePasse)` →
  `cloud.reauth` puis `cloud.deleteAccount` (presence, leaderboard, users, puis le compte Firebase). Règles Firestore déjà bonnes.

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

- **Les jeux du moment, pour tous les joueurs** (page **`#stats`** / `#tendances`, menu « Tendances », encart « 🔥 Les machines les plus
  jouées cette semaine » en tête de l'accueil ; demande du propriétaire du 16 novembre 2026 : « pour donner envie de jouer là où tout
  le monde joue ») : `renderPublic` de `tableau.js`, lit `stats/public.json` de la branche **`data`** (raw.githubusercontent.com,
  aucune lecture Firestore par les joueurs), fabriqué **chaque heure** par GitHub Actions **« Tendances »**
  (`.github/workflows/tendances.yml`, `tools/admin/public-stats.mjs`, secret `FIREBASE_SERVICE_ACCOUNT`) : aujourd'hui / 7 / 30 jours,
  par jeu ouvertures, tours, temps, KE misés, bonus ; tours par jour. **Jamais les gains des joueurs ni ce que rapporte le casino**
  (seulement dans `#tableau`). Chaque jeu de la page a son lien « Jouer ».
- **Tableau de bord** (`tableau.js`, page **`#tableau`** ou `#dashboard`, dans aucun menu, demande du propriétaire du 16 novembre 2026) :
  réservé aux comptes de `admins/` (lecture de `stats/`, règle déjà en place). Période (aujourd'hui, 7 / 30 jours, depuis le début),
  catégorie (machines à sous, tables, rapides, tout) ; chiffres du site (visites, nouveaux, comptes, tours, temps, KE misés, rapporté =
  mises − gains) ; la plus visitée / jouée / où on reste le plus / la plus misée / celle qui a rapporté le plus / le plus de bonus ;
  classements en barres, visites et tours par jour, sources, tableau de tous les jeux (tri au toucher). Données de `monitor.js` :
  `stats/AAAA-MM-JJ` (ouvertures, tours, visites, sources, depuis le 5 novembre), **`stats/AAAA-MM-JJ_m`** (`opens` = secondes passées
  sur la page du jeu, `spins` = KE misés) et **`stats/AAAA-MM-JJ_w`** (`opens` = KE gagnés par les joueurs, `spins` = bonus déclenchés
  en jouant), depuis le 16 novembre : mêmes règles Firestore (rien à recoller), jusqu'à 3 écritures par joueur toutes les 5 min.

- **Changer le solde d'un joueur** (triche…) : GitHub → Actions → « Solde » (`.github/workflows/solde.yml`,
  `tools/admin/solde.mjs`) avec le pseudo, le nouveau solde en KE (vide = inchangé) et en option `record` (baisse plus gros gain et meilleur
  bonus, retire les gains plus gros de ses listes) : compte (`users/{uid}.bal`, en centimes) et
  classement, sessions du joueur coupées (un onglet resté ouvert peut réécrire l'ancien solde pendant ≤ 1 h).

- **Succès « gain d'au moins ×… » oubliés** : GitHub → Actions → « Succès » (`.github/workflows/succes.yml`,
  `tools/admin/succes.mjs`) avec le pseudo, l'id du jeu et le × prouvé : monte `users/{uid}.ach.s.<jeu>.x` (jamais
  plus bas), le joueur récupère la récompense dans Succès. Depuis le 9 novembre 2026, ces succès comptent aussi le
  total d'un tour bonus compris (`sb:roundend` dans `achievements.js`) : avant, seul le plus gros paiement comptait,
  et un bonus payé tour gratuit par tour gratuit (La Tour Bling…) n'atteignait jamais ×200.
  **Objectifs « gain d'au moins ×… »** (`TIERS` 10 / 50 / **100**, demande du propriétaire du 12 novembre 2026 : ×200 au
  1er niveau était trop dur sur Le Totem, max ×500) : montent avec les prestiges (`P_X`) mais jamais au-dessus d'une part
  du gain max de la machine (`X_CAP` : 5 / 20 / 50 %, `xGoal`) : Le Totem s'arrête à ×25 / ×100 / ×250.

- **Budget d'écritures Firebase** (forfait gratuit Spark : 20 000 écritures par jour, remis à zéro vers 9 h, heure de
  Paris) : le 9 novembre 2026 il a été épuisé vers 21 h 30 (profil enregistré toutes les 4 s + classement à chaque
  fois ≈ 30 écritures par minute et par joueur) : plus aucune sauvegarde, les soldes revenaient en arrière, amis et
  défis en ligne en panne. Depuis : profil toutes les 25 s au plus (`SAVE_DELAY`, et tout de suite quand la page est
  cachée ou quittée), classement toutes les 3 min (`BOARD_EVERY`), statistiques et jackpot toutes les 5 min.
  **Copie sur l'appareil** (`spinbet_cloud_bak`, `profile.savedAt`) : si l'écriture échoue, la visite suivante sur cet
  appareil repart de la copie (message « Sauvegarde en ligne impossible… » au 2e échec, nouvel essai de plus en plus
  espacé). Les outils admin (`solde.mjs`, `succes.mjs`) écrivent `admAt` : leur changement passe toujours avant la
  copie. **Ne jamais ajouter d'écriture fréquente** (à chaque tour, chaque seconde) ; si le site grandit encore, passer
  au forfait Blaze (payé à l'usage, quelques centimes au-delà de 20 000 écritures).
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

Les RTP visés : machines à sous ≈ 92 %, achats de bonus ≈ 88 %, jeux de table et jeux rapides 94–96 %. Exception voulue par le
propriétaire : Le Pilote ≈ 97 % (le jeu qui rend le plus).
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
