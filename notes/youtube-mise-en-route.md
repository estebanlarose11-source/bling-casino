# YouTube : brancher l'envoi automatique des Shorts

Les vidéos sont déjà fabriquées chaque matin et rangées sur www.spinbetcaz.com/#shorts (rien à faire pour ça).
Ce guide sert seulement à les faire **aussi** partir toutes seules sur la chaîne YouTube. Compte environ 20 minutes,
une seule fois. Fais-le depuis un ordinateur si possible.

## 1. La chaîne
Crée la chaîne YouTube avec le compte Google que tu veux utiliser (par exemple « SpinBet Casino »).

## 2. Le projet Google Cloud
1. Va sur https://console.cloud.google.com avec **le même compte Google**.
2. En haut : « Sélectionner un projet » → « Nouveau projet » → nom : `SpinBet Shorts` → Créer.
3. Menu ☰ → « API et services » → « Bibliothèque » → cherche **YouTube Data API v3** → **Activer**.

## 3. L'écran d'autorisation (« Google Auth Platform » ou « Écran de consentement OAuth »)
1. Menu ☰ → « API et services » → « Écran de consentement OAuth » (ou « Google Auth Platform ») → Commencer.
2. Nom de l'appli : `SpinBet Shorts` · e-mail d'assistance : ton e-mail.
3. Public / Audience : **Externe**.
4. Coordonnées du développeur : ton e-mail → Créer.
5. Branding (si demandé) : page d'accueil `https://www.spinbetcaz.com`, règles de confidentialité
   `https://www.spinbetcaz.com/confidentialite.html`, domaine autorisé `spinbetcaz.com`.
6. Accès aux données (Data access) → « Ajouter des champs d'application » → colle
   `https://www.googleapis.com/auth/youtube.upload` → Mettre à jour → Enregistrer.
7. Audience → **Publier l'application** (passer « En production »). Important : en mode « Test », l'accès
   s'arrête tout seul au bout de 7 jours.

## 4. La clé de l'appli (ID client)
1. « Clients » (ou « Identifiants ») → « Créer un client » / « ID client OAuth ».
2. Type : **Application Web** · nom : `SpinBet Shorts`.
3. « URI de redirection autorisés » → ajoute `https://developers.google.com/oauthplayground` → Créer.
4. Garde de côté l'**ID client** et le **code secret du client**.

## 5. Le jeton (refresh token)
1. Va sur https://developers.google.com/oauthplayground
2. Roue dentée ⚙️ en haut à droite → coche « Use your own OAuth credentials » → colle l'ID client et le code secret.
3. À gauche, dans « Input your own scopes », colle `https://www.googleapis.com/auth/youtube.upload` →
   **Authorize APIs** → choisis le compte de la chaîne.
4. Google dit « Google n'a pas validé cette application » : c'est normal (c'est ton appli à toi) →
   « Paramètres avancés » → « Accéder à SpinBet Shorts » → Continuer.
5. Bouton **Exchange authorization code for tokens** → copie le **Refresh token** (commence souvent par `1//`).

## 6. Les 3 secrets dans GitHub
Dépôt GitHub → Settings → Secrets and variables → Actions → **New repository secret**, trois fois :
- `YT_CLIENT_ID` = l'ID client
- `YT_CLIENT_SECRET` = le code secret du client
- `YT_REFRESH_TOKEN` = le refresh token

Ne les donne à personne (ni dans un message, ni dans le chat avec Claude) : ils permettent de publier sur ta chaîne.

## 7. Essai
Actions → « Shorts » → Run workflow. Après 10 à 20 minutes, les vidéos arrivent sur ta chaîne **en privé**
(YouTube Studio → Contenu). Tu peux les passer en public à la main, d'un geste dans l'appli YouTube Studio.

## 8. La vérification par Google (pour qu'elles partent directement en public)
Tant que Google n'a pas vérifié l'appli, YouTube met en privé toutes les vidéos envoyées par un robot.
Personne d'autre que toi ne peut faire cette demande (elle se fait avec ton compte Google), mais elle est gratuite :
1. Note le **numéro du projet** : console Google Cloud → page d'accueil du projet (« Numéro du projet »).
2. Remplis le formulaire « YouTube API Services – Audit and Quota Extension » :
   https://support.google.com/youtube/contact/yt_api_form
3. Quand il demande à quoi sert l'appli, colle ce texte (en anglais, c'est ce que Google lit) :

> SpinBet Shorts is an internal tool used only by the owner of the SpinBet Casino website
> (https://www.spinbetcaz.com), a free social casino game that uses fictitious currency only: no deposits, no
> real-money bets and no real-money prizes. Once a day, a scheduled GitHub Actions job records short vertical
> gameplay clips of our own games and uploads them to our own YouTube channel with videos.insert (scope
> youtube.upload). The tool has a single user (the channel owner), has no public interface, does not access,
> store or display any YouTube data or any data about other users, and only uploads content we created.
> Each video states that the game uses fictitious money and is for adults (18+).
> Privacy policy: https://www.spinbetcaz.com/confidentialite.html

4. Google répond par e-mail (souvent quelques semaines ; il peut poser des questions ou demander une petite vidéo
   montrant l'outil).
5. Une fois accepté : GitHub → Settings → Secrets and variables → Actions → onglet **Variables** →
   New repository variable `YT_PRIVACY` = `public`. Dès le lendemain, les Shorts partent en public tout seuls.

## Bon à savoir
- 2 vidéos par jour (le quota gratuit de YouTube en permet environ 6).
- YouTube surveille les contenus de casino : SpinBet est en argent fictif sans retrait possible, mais YouTube peut
  réserver certaines vidéos aux plus de 18 ans.
- Chaque vidéo a son texte prêt à coller sur www.spinbetcaz.com/#shorts (bouton « Copier le texte »).
