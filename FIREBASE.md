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
- tout le reste de la base est fermé.

## 2. Domaine autorisé (si la connexion échoue sur le site)

**Build → Authentication → Settings → Authorized domains** : vérifie que
`estebanlarose11-source.github.io` est dans la liste. Sinon, **Add domain** et ajoute-le.

## 3. E-mails en français (facultatif)

**Authentication → Templates** : choisis la langue **Français** pour l'e-mail de réinitialisation de mot de passe.

## Bon à savoir

Le site est une démo en argent fictif : tout le jeu tourne dans le navigateur. Ces règles bloquent les triches
grossières (valeurs impossibles, modifier le profil d'un autre), mais un joueur très motivé peut toujours
tricher sur son propre solde dans les limites autorisées. Pour l'empêcher complètement, il faudrait faire
tourner les tirages sur un serveur (Cloud Functions), ce qui demande le forfait payant Blaze de Firebase.
