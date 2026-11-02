# Réglages Firebase à faire (5 minutes)

Le site utilise le projet Firebase **cazbabs-a52be** pour les comptes, le classement, le parrainage et le Défi
de la semaine. Pour que tout fonctionne **et** pour bloquer la triche, colle les règles de sécurité :

## 1. Règles de sécurité Firestore (obligatoire)

1. Va sur <https://console.firebase.google.com/> et ouvre le projet **cazbabs-a52be**.
2. Menu de gauche : **Build → Firestore Database**, puis l'onglet **Règles** (*Rules*).
3. Efface tout ce qu'il y a dans l'éditeur.
4. Copie **tout** le contenu du fichier [`firebase/firestore.rules`](firebase/firestore.rules) et colle-le.
5. Clique sur **Publier** (*Publish*).

Ce que ça change :

- chaque joueur ne peut lire et modifier **que son propre profil** ;
- le classement refuse les valeurs impossibles (solde ou gains délirants, niveau > 50) ;
- le parrainage ne peut être déclaré qu'une fois, par le nouveau compte, et jamais soi-même ;
- le score du Défi de la semaine ne peut que monter et reste plafonné ;
- chaque code cadeau (page Recharger) ne peut être utilisé qu’une seule fois, par un seul compte ;
- le chat et les envois de KE entre joueurs sont protégés (voir 1 bis) ;
- tout le reste de la base est fermé.

## 1 bis. Chat général et envoi de KE entre joueurs

Rien à créer à la main pour que ça marche : il suffit d'avoir collé les règles ci-dessus (étape 1), elles
contiennent déjà le chat (`chat`, `chatmeta`), les muets (`mutes`), les admins (`admins`) et les envois de KE
(`gifts`, `sends`). Les collections se créent toutes seules au premier message et au premier envoi.

**Te nommer modérateur (admin du chat)** : un admin peut supprimer n'importe quel message et rendre un joueur muet.

1. Connecte-toi une fois sur le site avec ton compte.
2. Console Firebase → **Build → Authentication** → onglet **Users** : copie l'**UID** de ton compte (colonne *User UID*).
3. **Build → Firestore Database** → **Données** (*Data*) → **+ Commencer une collection** (*Start collection*) :
   - ID de la collection : `admins`
   - ID du document : colle ton **UID**
   - ajoute un champ : nom `name`, type *string*, valeur ton pseudo → **Enregistrer**.
4. Recharge le site : en touchant le pseudo d'un joueur dans le chat, tu vois « Supprimer ce message » et
   « Rendre muet ». Fais pareil pour chaque modérateur que tu veux ajouter (un document par UID dans `admins`).

Pour enlever un muet à la main : collection `mutes`, supprime le document du joueur.

Ce que les règles imposent :

- chat : lisible par tous, écrit seulement par un compte connecté, à son nom, 200 caractères max,
  1 message toutes les 3 secondes, refusé si le joueur est muet ;
- envoi de KE : 1 à 5 000 KE par envoi, autant d’envois qu’on veut (pas de plafond par jour), vers un compte existant, jamais à soi-même ;
  l'envoi n'est accepté que si le solde de l'expéditeur baisse du montant dans la même opération ;
  le destinataire ne peut récupérer un envoi qu'une seule fois.



**Build → Authentication → Settings → Authorized domains** : vérifie que
`estebanlarose11-source.github.io` est dans la liste. Sinon, **Add domain** et ajoute-le.

## 3. E-mails en français (facultatif)

**Authentication → Templates** : choisis la langue **Français** pour l'e-mail de réinitialisation de mot de passe.

## Bon à savoir

Le site est une démo en argent fictif : tout le jeu tourne dans le navigateur. Ces règles bloquent les triches
grossières (valeurs impossibles, modifier le profil d'un autre), mais un joueur très motivé peut toujours
tricher sur son propre solde dans les limites autorisées. Pour l'empêcher complètement, il faudrait faire
tourner les tirages sur un serveur (Cloud Functions), ce qui demande le forfait payant Blaze de Firebase.
