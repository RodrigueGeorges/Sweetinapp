# Publier la série Sweetin « ça fond » (v7)

Trois vidéos de 12 à 14 s, une histoire par vidéo, et un splash de 6 s qui montre l'ADN de l'app. Chaque vidéo se termine par le **splash de lancement de l'app** (`LaunchSplash`), prolongé pour la pub :

1. le coulis framboise de l'app (`Drip`) descend sur l'écran ;
2. sur le fond framboise, la glace (boule blanche, cornet nuit) se pose avec un petit rebond ;
3. elle glisse dans le « i » pendant que « sweetin » apparaît en blanc ;
4. arrivent « le mot qui fond. », le bouton « télécharge sweetin » et les badges App Store et Google Play.

## Les fichiers

| Fichier | Histoire | Où |
| --- | --- | --- |
| `sweetin-crush-{A,B}-…` | **le crush** (14,3 s) : la notif sur l'écran verrouillé, on gratte la photo du cœur, « tu me plais. voilà, c'est dit. », 10 s, le mot fond, puis la réaction « je fonds » | |
| `sweetin-aveu-{A,B}-…` | **l'aveu** (14,3 s) : max avoue « c'est moi qui ai mangé ton tupperware. bisous 🤫 », le mot fond, « plus de photo, plus de mot. », « zéro preuve. 🤫 » | |
| `sweetin-plan-{A,B}-…` | **le plan** (12 s), côté envoi : photo de la soirée pizza, « samedi chez moi. ramène juste toi 🍕 », envoyé à tom, puis les notifs « tom a lu ton mot en 2,1 s. il a fondu. » et « tom a réagi « je fonds » à ton sweet » | |
| `sweetin-adn-…` | **le splash** seul (6,1 s, en boucle parfaite) | Stories, bumper YouTube de 6 s, pré-roll |
| `…-9x16.mp4` | | TikTok, Reels, Stories, Shorts |
| `…-4x5.mp4` | | fil Instagram et Facebook |
| `…-9x16-sans-musique.mp4` | | pour poser un son de la bibliothèque commerciale TikTok ou Meta |
| `couverture-*.png` | une vignette par vidéo | |

Les sources de génération (page `source/index.html`, musique `source/music8.py`) doivent être commitées dans `docs/marketing/source/` pour que la série reste rejouable.

Le lexique est celui de l'app : « il fond 10 s après lecture », « fond dans N s », « fondu. », « tout fond », « ça fond à minuit », « le mot qui fond. ». Les textes des notifications sont ceux que l'app envoie vraiment.

## Fidèle à l'app (design system Fondant)

Les animations reprennent le code de l'app, pas une interprétation :

- **Grattage** (`ScratchCard`, `Holo`) : la photo porte le reflet holographique qui glisse et ses paillettes. Le pinceau est doux, et les miettes de sucre (blanc, sucre, citron) volent. La photo s'efface en 420 ms, puis le mot passe de 0,9 à 1 en ressort et des confettis partent.
- **La fonte** (`MeltingWord`) : chaque lettre coule, s'étire et s'efface, en cascade, en 1,2 s. 0,9 s après, le coulis blanc de l'app descend en 1,4 s, puis vient « fondu. » en fondu de 500 ms.
- **Réactions** (`Reactions`) : les vraies formes, avec « je fonds » et « encore » en pilule, « mdrr » en carré et « jpp » et « omg » en rond. Elles gardent leurs inclinaisons, et celle qu'on choisit passe en framboise.
- **« envoyé. »** (`SentCelebration`) : en Climate Crisis la plus grasse, avec la pastille Fondue qui sautille et les confettis de l'app (blanc, sucre, citron, nuit).
- **« fondu. »** (`Flaque`) : le cornet tombe en 420 ms, la flaque s'étale à 380 ms et les vermicelles sautent à 620 ms. La feuille de réactions monte en fondu, et les autocollants apparaissent un par un.
- **Le reste** :
  - le toast nuit de l'app sous la barre d'état ;
  - la taille du mot calculée comme dans l'app ;
  - le doigt fantôme de l'app ;
  - l'icône de l'app dans les notifs ;
  - les couleurs, les polices (Sweetin Display et Sweetin Text — dérivées de Climate Crisis et Funnel Sans, fichiers dans `assets/fonts/` et `web/fonts/`) et les textes, tous ceux de l'app.

Pour le réalisme, la barre d'état iPhone (heure, Dynamic Island, réseau, batterie) et la barre d'accueil sont là. Il y a aussi un vrai écran verrouillé avec la notif Sweetin, la marque visible dès la première image, l'ouverture de l'app depuis la notif et les notifs iOS qui s'empilent. Il n'y a que 2 ou 3 sous-titres par vidéo, et ils sont posés hors des éléments de l'app.

Deux libertés de montage : le compte à rebours passe en accéléré après 8 s, et le splash de fin dure 2 s au lieu de 0,9 s pour qu'on ait le temps de le voir.

## Les accroches (A/B)

Seules les 3 premières secondes changent :

| Vidéo | A | B |
| --- | --- | --- |
| crush | « il m'a caché un mot sous cette photo 😳 » | « pov : ton crush t'écrit un mot qui fond en 10 s » |
| aveu | « mon collègue m'avoue un truc… et la preuve fond 😭 » | « les aveux, c'est mieux quand ça fond 🤫 » |
| plan | « comment j'invite mes potes maintenant 🍕 » | « pov : tu sais pile quand il a lu ton mot 👀 » |

## Le son : une identité par vidéo

Chaque vidéo a sa propre musique originale. Elles partagent le même tempo (128 bpm) et toutes calent leurs coups sur l'image : la révélation, la fonte, le drop au moment où la glace se pose dans le « i ».

| Vidéo | Notre musique | Sur TikTok, cherche dans la Commercial Music Library |
| --- | --- | --- |
| **crush** | R&B lo-fi en demi-temps : piano Rhodes, sub-basse, craquement de vinyle. À la fonte, la mélodie descend comme le mot. | les mots-clés `romantic`, `lofi`, `r&b`, `soft`, triés par « populaire », un son à 70-90 bpm |
| **aveu** | comique « sneaky » : pizzicato sur la pointe des pieds, claquements de doigts, marimba, coup de cuivre à la révélation, « womp womp » quand ça fond | `funny`, `sneaky`, `comedy`, `pizzicato` |
| **plan** | piano house : kick 4 temps, accords syncopés, drop sur le logo | `party`, `house`, `upbeat`, `dance`, dans le top 50 de la semaine |
| **splash** | jingle piano house court | le même son que la vidéo qu'il suit, pour la cohérence |

**La règle** :
- **TikTok** : publie la version `sans-musique`, qui garde tous les bruitages de l'app, et pose dessus un son tendance de la bibliothèque commerciale (les sons « perso » sont interdits en pub). Garde-le à environ 30 % du volume pour qu'on entende encore le grattage et la fonte.
- **Instagram, Facebook, Shorts** : publie la version avec notre musique.
- Un son tendance s'use en 2 à 3 semaines : change-le en même temps que tu renouvelles les créas.

## La campagne

**Étape 0, gratuite (7 jours).** Publie en organique sur le compte Sweetin (TikTok et Reels), 1 vidéo par jour, en commençant par les versions A, entre 18 h et 21 h. Au bout de 48 h, regarde la rétention à 3 s, le taux de vision complète et les commentaires. Ce test gratuit te dit quelle histoire mérite de l'argent.

**Étape 1, test payant (3 à 5 jours).**
- Mets les 6 créas (3 histoires × 2 accroches) dans un seul groupe d'annonces, avec le même budget et la même audience (18-30 ans, France).
- Objectif : installations de l'app, avec le suivi d'installation branché (TikTok SDK ou un MMP, sinon l'optimisation ne marche pas).
- Coupe toute pub sous 40 % de rétention à 3 s, ou dont le coût par installation dépasse 2× la meilleure.

**Étape 2, on concentre (semaines 2 et 3).**
- Mets 80 % du budget sur les 2 gagnantes et 20 % sur 2 nouvelles histoires faites avec le même moteur : une nouvelle photo et un nouveau mot. Idées : l'anniversaire, la famille, « devine qui c'est », la coloc.
- Le splash `adn` sert de rappel en Stories, pour ceux qui ont vu 50 % d'une vidéo sans installer.

**Étape 3, créateurs (Spark Ads).** Fais reposter les gagnantes par 3 à 5 micro-créateurs (10 à 100 k abonnés, lifestyle, couple, humour), puis booste leurs posts. Une vidéo publiée par une vraie personne convertit nettement mieux qu'une pub de marque.

**Les commentaires** :
- Épingle « écris ton mot 👇 on le cache sous une photo » et réponds en vidéo aux meilleurs.
- Chaque réponse fait une vidéo de plus, gratuite.

**Les repères** :
- La répétition ne doit pas dépasser 4.
- Renouvelle les créas toutes les 2 semaines.
- Ne change qu'une variable à la fois : le son, l'accroche ou l'histoire.

## Textes d'accompagnement

**TikTok** (100 caractères maximum)
- crush : `10 secondes pour le lire. après, ça fond. tu lui écrirais quoi ? #sweetin #crush`
- aveu : `aucune preuve. juste un mot qui fond 🤫 #sweetin #collègues`
- plan : `il l'a lu en 2,1 s. et le mot a fondu. #sweetin #potes`

**Instagram et Facebook**
> cache un mot sous une photo. il gratte, il a 10 secondes pour le lire, puis tout fond.
> sweetin, le mot qui fond. gratuit sur iPhone et Android.

Bouton : « Installer ». Épingle en commentaire une question qui appelle des réponses : « tu lui écrirais quoi, toi ? » (crush), « ton pire aveu au taff ? » (aveu).

## Droits

| Élément | Source | Licence |
| --- | --- | --- |
| Cœur au coucher de soleil (crush) | Unsplash `photo-1663615887751-f1e97dd788a5` | Licence Unsplash (gratuite, usage commercial autorisé) |
| Femme qui rit au bureau (aveu) | Unsplash `photo-1779896412431-3160ade4ca01` | Licence Unsplash. Personne reconnaissable : Unsplash ne fournit pas d'accord écrit de la personne photographiée. |
| Soirée pizza (plan) | Unsplash `premium_photo-1671580678432-a36c8410e319` | **Unsplash+** : à utiliser seulement avec un abonnement actif |
| Pictogrammes Apple et Google Play des badges | simple-icons (CC0) | Ce sont des marques. Avant de diffuser, Apple et Google demandent leurs badges officiels : télécharge-les sur leurs pages marketing et remplace les miens (`.badge` dans `source/index.html`). |
| Musiques (3 identités) et bruitages | synthétisés ici (`source/music8.py`) et sons de l'app | à toi : utilisables partout, y compris en pub |
