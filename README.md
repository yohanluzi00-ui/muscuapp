# Fiitday

Application personnelle pour noter mes performances pendant mes séances de musculation, sur le téléphone (APK Android) et sur l'ordinateur (version web).

## Ce que fait l'appli

- Des **programmes** (Push, Haut du corps…) que chacun crée, chacun avec ses **séances** et leurs propres exercices. Un nouveau compte démarre sur une page vierge.
- Pour chaque exercice : nombre de séries, reps cible (ou temps cible pour le gainage), temps de repos et **notes**.
- Modes d'enchaînement, au choix en ajoutant un exercice :
  - **Dégressif** : chaque série a 1 à 3 « baisses » (charge réduite, sans repos) ;
  - **Superset / Biset** : 2 exercices enchaînés, **Triset** : 3 exercices enchaînés. La séance se fait par tours (A puis B puis C) et le repos ne démarre qu'à la fin du tour.
- **Pendant la séance** :
  - tu notes les kg et reps de chaque série (ou le temps, avec un chrono, pour le gainage) ;
  - un encadré discret rappelle ta **dernière performance avec la même variante** ;
  - les valeurs de la dernière fois apparaissent en grisé : appuie sur ✓ pour les reprendre telles quelles ;
  - le minuteur de repos démarre seul, puis vibre et/ou sonne à la fin (au choix dans Réglages) ;
  - l'écran reste allumé pendant la séance (appli Android).
- Tu peux **renommer** un exercice à tout moment ; son historique est conservé.
- Sur ordinateur, la séance s'affiche en **tableau** (Exercice, Séries, Reps cible, Repos, Série 1, Série 2…).
- **Historique** de toutes les séances (modifiables) et **progression** par exercice.
- **Mode clair / sombre / auto**.
- Données synchronisées entre le téléphone et l'ordinateur avec un compte (Supabase). Elles restent utilisables sans réseau et sont envoyées au retour de la connexion.

## Mise en route (une seule fois)

### 1. Préparer la base de données Supabase
1. Sur supabase.com, ouvre le projet, puis **SQL Editor** › **New query**.
2. Colle tout le contenu du fichier [`supabase/schema.sql`](supabase/schema.sql), puis clique sur **Run**.
   Fais de même avec [`supabase/partage.sql`](supabase/partage.sql) pour les liens de partage courts (`https://fiitday.com/#/s/CODE`).
   Et avec [`supabase/suppression-compte.sql`](supabase/suppression-compte.sql) pour le bouton « Supprimer mon compte ».
3. **Vérification de l'e-mail par code** (à la création d'un compte, l'appli demande un code reçu par e-mail) :
   - **Authentication › Sign In / Providers › Email** : active **Confirm email** ;
   - **Authentication › Emails › Templates › Confirm signup** : sujet « Ton code Fiitday », puis remplace le contenu par celui du fichier [`supabase/email-code-inscription.html`](supabase/email-code-inscription.html) (il affiche le code `{{ .Token }}`).
   - Le serveur d'e-mails intégré à Supabase n'envoie que quelques e-mails par heure : pour plus d'inscriptions, configure un serveur SMTP (Authentication › Emails › SMTP Settings).

### 2. Installer l'appli Android (APK + Obtainium)
À chaque modification poussée sur `main`, l'action GitHub « Construire l'APK » compile l'appli, la signe et publie une **Release** (`Fiitday-1.N.apk`).

- Les secrets `KEYSTORE_B64` et `KEYSTORE_PASSWORD` doivent exister dans Settings › Secrets and variables › Actions. Garde une copie de la clé en lieu sûr : sans la même clé, une mise à jour ne peut pas s'installer par-dessus l'appli existante.
- Dans **Obtainium** : Ajouter une appli › URL `https://github.com/yohanluzi00-ui/muscuapp`.

En cas d'échec de compilation, le journal est poussé sur la branche `ci-logs`.

### 3. Version web (ordinateur)
Publiée automatiquement sur GitHub Pages à chaque modification : **https://fiitday.com**

## Développement

- `src/app.js` : toute la logique (écrans, minuteurs, synchronisation). `src/style.css` : le style.
- `android/` : la coque Android (WebView) qui affiche la même page et donne accès à la vibration et au maintien de l'écran allumé.
- `supabase/schema.sql` : la table `items` et ses règles de sécurité (chacun ne voit que ses données).
- `node build.js` construit `dist/` (version web) et copie la page dans l'appli Android.
- `src/pages/` : les pages légales publiées sur fiitday.com (confidentialité, mentions légales, suppression de compte). L'adresse de contact se règle dans `build.js` (`CONTACT`).

## Idées pour plus tard (version premium)

- **Programmes prêts à l'emploi** : une bibliothèque de programmes conçus à l'avance (par exemple Push / Pull / Legs, Full body, Haut / Bas du corps), que n'importe quel utilisateur peut ajouter à ses programmes en un clic.
- **Section cardio** : noter ses séances de cardio avec les informations affichées par la machine à la fin, par exemple pour le vélo : durée, distance (km), calories, vitesse moyenne et maximale, fréquence cardiaque moyenne et maximale, niveau de résistance, dénivelé. Prévoir aussi tapis, rameur, elliptique, avec leurs propres champs, et des stats (km et minutes par semaine, records).
