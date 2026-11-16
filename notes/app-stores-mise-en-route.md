# SpinBet sur l'App Store et le Play Store : ce qu'il te reste à faire

Tout le code est prêt dans le dépôt :
- `android/` : l'appli Android (fabriquée par GitHub, onglet **Actions → « Appli Android »**). Elle donne maintenant aussi le
  fichier pour Google Play : **spinbet-play** (un `.aab`) dans les « Artifacts » de chaque lancement.
- `ios/` : l'appli iPhone (fabriquée sur un Mac de GitHub, onglet **Actions → « Appli iPhone »** : pas besoin d'avoir un Mac).
  Elle a ses notifications, le partage des images de gros gain, les vibrations et le vrai plein écran.
- `store/` : les 6 captures d'écran (1320 × 2868, bonnes pour Apple et Google), l'icône 512 × 512 et la bannière Google 1024 × 500.
- Sur le site : bouton **« Supprimer mon compte »** sur la page Profil (obligatoire chez Apple et Google).

Les 2 applis affichent le site : chaque mise à jour du site arrive dans les applis toute seule, sans repasser par les stores.

---

## 1. Google Play (25 $ une seule fois)

1. Va sur **play.google.com/console** et crée un compte développeur **personnel**. Paye les 25 $, envoie ta pièce d'identité
   (vérification : quelques jours).
2. **Toutes les applis** → **Créer une application** : nom `SpinBet Casino`, langue Français, **Jeu**, **Gratuit**.
3. Récupère le fichier : sur GitHub, **Actions → Appli Android → le dernier lancement vert → Artifacts → spinbet-play**
   (un `.zip` qui contient `app-release.aab`).
4. ⚠️ **Règle des nouveaux comptes personnels** : avant de pouvoir publier pour tout le monde, Google demande un **test fermé
   avec au moins 12 testeurs pendant 14 jours d'affilée**. Dans **Tester → Test fermé** : crée une liste avec les adresses Gmail
   de 12 personnes (amis, famille), envoie le `.aab`, et demande-leur d'installer l'appli avec le lien et de la garder 14 jours.
   Ensuite seulement, le bouton « Demander l'accès à la production » s'ouvre.
5. Signature : laisse **Google gérer la clé de signature** (choix proposé par défaut). Note : l'appli du Play Store et l'APK du
   site ne pourront pas se mettre à jour l'une l'autre ; une fois l'appli sur le Play Store, dis-le moi et j'enlève le bouton APK.
6. Remplis les rubriques de **« Configurer votre application »** :
   - **Politique de confidentialité** : `https://www.spinbetcaz.com/confidentialite.html`
   - **Accès à l'application** : « Tout est accessible sans identifiants » (on joue en invité).
   - **Annonces** : **Oui**, l'appli contient des annonces.
   - **Classification du contenu** : catégorie Jeu ; à « Jeux d'argent simulés » réponds **Oui** (c'est de l'argent fictif). Ça donnera 18+ dans beaucoup de pays, c'est normal.
   - **Public cible** : **18 ans et plus uniquement**.
   - **Sécurité des données** : données collectées = adresse e-mail et pseudo (pour les comptes), activité dans l'appli (parties) ; chiffrées en transit : oui ; le joueur peut demander leur suppression : oui.
   - **Suppression du compte** (URL demandée) : `https://www.spinbetcaz.com/#profil` (bouton « Supprimer mon compte », compte connecté).
   - **Application d'actualités / santé / finances** : Non.
7. **Fiche du Play Store** : copie les textes de la partie 3, l'icône `store/icone-512.png`, la bannière `store/play-banniere-1024x500.png`
   et les captures `store/captures/*.png`.

## 2. App Store (99 $ par an)

1. Inscris-toi à l'**Apple Developer Program** (developer.apple.com/programs, 99 $/an, avec ton identifiant Apple et la double
   authentification). Compte « Individuel ». Attends le mail de confirmation (de quelques heures à 2 jours).
2. **developer.apple.com → Certificates, IDs & Profiles → Identifiers → +** → App IDs → App → Description `SpinBet`,
   Bundle ID **explicite** : `com.spinbetcaz.app`. Enregistre (ne coche rien d'autre).
3. **appstoreconnect.apple.com → Apps → + → Nouvelle app** : iOS, nom `SpinBet Casino` (s'il est pris : `SpinBet Casino Jeux`),
   langue Français, Bundle ID `com.spinbetcaz.app`, SKU `spinbet`.
4. **Une clé pour que GitHub envoie l'appli à ta place** : App Store Connect → **Utilisateurs et accès → Intégrations → App Store
   Connect API → +** → nom `GitHub`, accès **Admin** → Générer. Télécharge le fichier `AuthKey_XXXXXXXX.p8` (une seule fois possible !).
5. Sur GitHub, dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**, crée ces 4 secrets :
   - `APPSTORE_KEY_ID` = l'ID de la clé (10 caractères, colonne « ID de la clé »)
   - `APPSTORE_ISSUER_ID` = l'« ID de l'émetteur » (au-dessus de la liste des clés)
   - `APPSTORE_KEY_P8` = tout le contenu du fichier `.p8` (ouvre-le avec Bloc-notes, copie tout, y compris les lignes BEGIN / END)
   - `APPLE_TEAM_ID` = ton Team ID (developer.apple.com → Account → Membership details, 10 caractères)
6. GitHub → **Actions → Appli iPhone → Run workflow**. Après ~15 min c'est vert, et l'appli arrive dans **TestFlight**
   (App Store Connect) 10 à 30 min plus tard. Installe l'appli **TestFlight** sur ton iPhone pour l'essayer.
7. Dans la fiche App Store Connect de l'appli :
   - **Captures iPhone 6,9 pouces** : `store/captures/*.png`.
   - Textes de la partie 3 ; catégorie **Jeux → Casino** ; URL d'assistance `https://www.spinbetcaz.com/` ;
     politique de confidentialité `https://www.spinbetcaz.com/confidentialite.html`.
   - **Classification par âge** : « Jeux d'argent simulés » = **Fréquent/intense** → 18+. « Jeux d'argent réels » = Non.
   - **Confidentialité de l'app** : mêmes réponses que Google (e-mail, pseudo, activité de jeu ; pas de pistage).
   - **Informations pour la vérification** : crée un compte de test sur le site et donne son e-mail et son mot de passe, avec cette note :
     « Jeu gratuit en monnaie fictive (KE). Aucun argent réel ne peut être déposé, misé ni retiré, aucun achat intégré.
     Les KE s'obtiennent gratuitement (cadeau du jour, vidéos publicitaires facultatives). »
   - Choisis le build reçu par TestFlight, puis **Soumettre pour vérification** (réponse en 1 à 3 jours en général).

---

## 3. Textes des fiches (à copier)

**Nom** : SpinBet Casino

**Sous-titre (Apple, 30 caractères max)** : Machines à sous gratuites

**Description courte (Google, 80 caractères max)** :
50 jeux de casino gratuits en argent fictif : machines à sous, roulette, 21…

**Mots-clés (Apple, 100 caractères max)** :
machine à sous,casino,gratuit,slot,roulette,blackjack,jackpot,bonus,tournoi,poker,jeu,argent fictif

**Description** :
SpinBet Casino, c'est plus de 50 jeux de casino gratuits, joués avec une monnaie fictive : les KE.
Aucun dépôt d'argent réel, aucun vrai pari, rien à gagner en argent : juste le plaisir du jeu.

🎰 Des machines à sous originales avec décors animés, bonus, tours gratuits et jackpots
🎡 Roulettes, 21 (blackjack), Texas Hold'em, échecs et jeux rapides
🏆 Tournois tous les soirs et le week-end, classement des joueurs, Battle Royale
🎁 Cadeau du jour, roue du jour, calendrier et événements flash pour recharger tes KE gratuitement
🃏 Cartes à collectionner, succès et niveaux à débloquer
👥 Joue avec tes amis : chat, duels, matchs en ligne

Joue en invité tout de suite, ou crée un compte pour garder ta partie sur tous tes appareils.

Jeu réservé aux plus de 18 ans. SpinBet Casino ne propose pas de jeux d'argent réel ni la possibilité de gagner de l'argent
ou des prix réels. Réussir à un jeu de casino gratuit ne garantit pas de réussir à un jeu d'argent réel.

---

## 4. Ce qui peut bloquer chez Apple (à savoir avant)

Apple refuse souvent une appli qui « n'est qu'un site internet dans une appli » (règle 4.2). Pour ça, l'appli iPhone a ses vraies
fonctions à elle (notifications, partage, vibrations, plein écran). Si Apple refuse quand même, envoie-moi leur message :
on corrige et on renvoie, c'est fréquent au premier essai.

Autres points que les vérificateurs regardent sur une appli de casino gratuit :
- **Le mot « Déposer » et la caisse** (n° de transaction, « moyen de paiement ») peuvent faire croire à de l'argent réel.
- **Récompense contre l'ajout du Snap** (parrainage) : Apple peut refuser qu'on récompense une action faite ailleurs (règle 3.2.2).
- **Images et vidéos reprises d'autres jeux** : si une machine utilise des décors d'un autre éditeur, Apple ou Google peuvent
  la refuser ou retirer l'appli. N'utilise que des images que tu as le droit d'utiliser.
- **Joueurs de la maison** affichés comme de vrais joueurs : peut être vu comme trompeur.

Je peux adapter ces points **seulement dans les applis** (le site ne change pas) : dis-le moi.
