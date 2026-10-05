# Sweetin · Send a flip

Tu prends une photo, tu la retournes pour écrire un petit secret derrière, tu l'envoies. Ton ami gratte la photo avec son doigt pour découvrir le message. Une fois tout gratté, la photo et le message sont supprimés du serveur : il ne reste que la trace (combien gratté, en combien de temps, la réaction).

- **App** : Expo SDK 57 (React Native 0.86), Expo Router, Skia pour le grattage, Reanimated pour la carte qui se retourne. Une seule base de code pour iOS et Android.
- **Back-end** : Supabase (Postgres + sécurité ligne par ligne, Auth email/Apple/Google, Storage privé, Edge Functions, Realtime) et notifications push via le service Expo (APNs + FCM).
- **Langues** : français et anglais, choisis selon la langue du téléphone (`src/i18n`).

## Ce qu'il y a dans le projet

```
src/app/                 écrans (Expo Router)
  welcome.tsx            accueil : démo de grattage animée, « créer un compte » / « j'ai déjà un compte »
  try.tsx                caméra du premier secret, avant d'avoir un compte
  auth.tsx               Apple, Google, ou email + mot de passe
  profile-setup.tsx      pseudo + date de naissance (16 ans minimum)
  auth-callback.tsx      retour du lien email
  google-auth.tsx        retour de la connexion Google
  u/[username].tsx       lien d'invitation sweetin.app/u/<pseudo>
  (tabs)/camera.tsx      accueil caméra « Envoyer un flip » + galerie + bandeau Sweet Hour
  (tabs)/inbox.tsx       notifications (à gratter) + suivi des envois (dont « capture tentée »)
  (tabs)/contacts.tsx    amis, ajout par pseudo, lien d'invitation à partager, SMS
  create.tsx             carte polaroid : ✓ puis la carte se retourne, on écrit le secret
  sendto.tsx             « Envoyer à » avec cases à cocher, option « un seul passage », progression et réessai
  read/[id].tsx          lecture : on gratte, « Répondre », réactions, signaler
  settings.tsx           compte, liens légaux, déconnexion, suppression du compte
src/components/          Cone, en-tête, barres, toast, carte à gratter (Skia)
src/lib/                 client Supabase, appels serveur, push, session, widget, suivi
src/i18n/                textes français et anglais
src/widget/              widget Android
src/widgets/             Live Activity iOS du Sweet Hour (expo-widgets)
targets/widget/          widget iOS (SwiftUI / WidgetKit)
supabase/migrations/     schéma, sécurité (RLS), bucket privé, âge, Sweet Hour
supabase/functions/      send-flip, open-flip, scratched, screenshot, report, delete-account, cleanup, sweet-hour
web/                     fichiers à héberger sur sweetin.app pour les liens d'invitation
__tests__/, .maestro/    tests unitaires (Jest) et parcours de bout en bout (Maestro)
```

## Croissance (viralité)

- **Flip par lien privé** : on envoie un flip sur WhatsApp, Insta ou SMS à quelqu'un qui n'a pas l'app. Il le gratte dans son navigateur (`web/f/`), une seule fois, puis « Répondre » l'amène à installer Sweetin et l'ajoute comme ami.
- **Story « gratte mon secret »** : l'app fabrique l'image de story (photo floutée dans le polaroid, DA Sweetin), l'envoie vers Instagram et copie le lien à coller dans le sticker « Lien ». Tout le monde peut gratter pendant 24 h ; l'expéditeur est prévenu à 1, 10, 25, 50, 100… ouvertures. Pas de réponses anonymes, volontairement (c'est ce qui a valu à NGL des poursuites pour harcèlement).
- **Démarrage à 3 amis** : juste après l'inscription, écran « Ajoute tes amis » avec barre de progression. Recherche dans le carnet d'adresses (empreintes SHA-256 des numéros, rien n'est conservé, numéros vérifiés par SMS uniquement), lien, QR code à montrer, scanner de QR code, et bouton « Coller le lien d'invitation » pour retrouver l'ami qui a invité avant l'installation.
- **Vignettes floues** : une miniature de 24 px de la photo sert de vignette ronde floutée dans la boîte (comme dans la DA d'origine) et de fond aux widgets. Effacée avec la photo.
- **Séries 🔥** : jours consécutifs d'échange avec chaque ami, affichés dans Contacts et « Envoyer à », célébrés à l'envoi. Rappel à 19 h quand une série de 2 jours ou plus va s'éteindre.
- **Mesure** : chaque nouvel inscrit invité est rattaché à son parrain et à la source (lien, flip, story, QR, contacts). Tableau quotidien dans le SQL editor : `select * from admin_growth;` (inscrits, inscrits parrainés, expéditeurs actifs, flips, liens ouverts, ouvertures de stories, facteur K). Événements PostHog : `link_shared`, `story_shared`, `contacts_matched`, `qr_scanned`, `invite_pasted`, `friends_step_done`…
- **Correctif de sécurité** : un utilisateur pouvait modifier lui-même son profil (et donc se déclarer « profil complet » sans vérification d'âge). Les profils ne sont plus modifiables que par les fonctions serveur.

## Version 10 : identité resserrée, inspirée des apps de référence

Constat : le logo à coulures, la police condensée, la glace dessinée en code, les ombres dures et les cartes penchées faisaient « fait maison ». Les apps sociales de référence (BeReal, Locket, Snapchat, Threads) font l'inverse : un nom simple avec un seul détail signature, une icône d'un seul glyphe sur une couleur, une interface neutre où la photo apporte la couleur.

- **Logo** `sweetin.` en Gabarito Black (OFL, `assets/fonts/OFL-Gabarito.txt`) : le point final est une goutte, seul rappel de la glace qui fond. Tracés vectoriels dans `components/logoPath.ts` (`LOGO_WORD`, `LOGO_DROP`, `MARK_S`, `MARK_DROP`, `DROP`).
- **Icône** : monogramme « s. » blanc sur cerise ; version sombre (cerise sur nuit), teintée, Android adaptative et monochrome, notification, favicon, splash. Générées par `scratchpad/lg/gen5.py` (Chromium).
- **Cerise plus fraise** : `#FF2D5F` (`#FF4572` en sombre) au lieu de `#FF1E3C`, moins « alerte », plus gourmand.
- **Titres** en Gabarito Black (remplace la Bricolage condensée), texte courant en police système.
- **Sobriété** : plus d'ombre dure, de contour noir ni de carte penchée ; listes d'amis neutres (la couleur reste sur l'avatar) ; réactions en emoji du système ; écrans vides et célébration avec la goutte de la marque. Le splash : le « s. » rebondit, sa goutte tombe.
- **Accueil** : plein cerise, la photo à gratter en carte nette, bouton blanc.
- Pages web (lien, invitation, pages légales), aperçu des liens, widget et 24 captures stores refaits dans cette identité.

## Version 9 : refonte native

- **Composants du système plutôt que faits main** : barre d'onglets native (`expo-router/unstable-native-tabs` : Liquid Glass sur iOS 26, Material 3 sur Android, badge de la boîte, se réduit au défilement), menus contextuels natifs (`@expo/ui`, composant `NativeMenu`) pour « … » sur un ami et « signaler » en lecture, icônes SF Symbols sur iPhone et Material Symbols sur Android (`expo-symbols`, repli SVG sur le web).
- **Police du système** pour le texte courant (SF Pro, Roboto) via `tx` dans `theme.ts` ; Bricolage reste pour les titres et le logo.
- **Verre** (`components/Glass.tsx`) sur les boutons posés sur une photo (lecture, caméra) : Liquid Glass sur iOS 26, flou sur Android.
- **Blanc par défaut, nuit si le téléphone est en sombre**. Chaque ami a sa couleur (`flavorTint`) dans Amis et « Envoyer à » ; les moments photo (lecture, caméra) restent sur fond nuit.
- **Photo d'abord** : la boîte affiche de grandes vignettes floutées, la lecture est plein écran. Le flou de chargement est un ThumbHash calculé depuis la miniature 24 px (`lib/thumb.ts`), `open-flip` renvoie la miniature.
- **Photo de profil** : selfie à l'inscription ou dans les réglages, modérée par la fonction `set-avatar` (migration `20261007000000_v5_avatars.sql`, bucket public `avatars`, effacé avec le compte).
- **Fondue**, la mascotte (`components/Fondue.tsx`) : 6 humeurs (happy, wait, party, melt, shock, sad) dans les écrans vides, la célébration d'envoi et les erreurs. Depuis la V10, c'est la goutte du logo dans une pastille, sans visage dessiné en code ; la version animée Rive est à commander (brief et fichiers dans `store/brief-fondue/`). Son interface (`mood`, `size`, `bg`) ne changera pas quand le `.riv` arrivera.
- **Pas encore activé** : transitions d'éléments partagés de Reanimated (encore expérimentales ; iOS garde le zoom natif de `Link`) et Rive (module natif pré-1.0, à brancher avec un build de dev quand le fichier sera livré).
- **Photos réelles** : l'accueil et les captures stores utilisent encore des photos de démo générées. À remplacer par de vraies photos (droits cédés, visages consentants) avant la soumission.

## Version 8 : DA 2026, nuit par défaut

- **Nuit par défaut** (`theme.ts`) : fond #0E0A0B, cartes #1A1416, texte #FFF7F2 ; les photos, le holo et la cerise ressortent. **Blanc pur** si le téléphone est réglé en clair (`userInterfaceStyle: automatic`). Le mode est lu au lancement : un changement de réglage s'applique à la prochaine ouverture.
- **Couleurs par rôle** : `paper`, `card`, `card2`, `ink`, `muted`, `line` changent avec le mode ; `cerise`, `cacao`, `vanille` restent fixes (marque, texte sur cerise ou sur photo, polaroid, glace qui fond). La vanille n'est plus un fond.
- **Boutons 2026** : pleins, sans contour ni ombre dure ; le principal (cerise) a un léger reflet et s'enfonce à l'appui ; les secondaires sont translucides. L'ombre dure ne reste que sur le polaroid.
- **Réactions maison** (`components/Reactions.tsx`) : je fonds 🫠, mort de rire 😂, choqué 😳, cœur ❤️, encore ! 🍦 — dessinées dans la DA, identiques sur iPhone et Android, animées quand on les choisit. Le serveur n'accepte que ces cinq.
- Captures stores, aperçu des liens et pages web passés en nuit / blanc.

## Version 7 : conformité et lancement

- **Sécurité des enfants** (obligatoire sur Google Play pour les apps sociales) : pages `web/securite-enfants` et `web/en/child-safety`, lien dans Réglages (« Sécurité et signalement »). **À compléter : nom du responsable** (surligné en jaune sur les deux pages) et adresses `securite@` / `safety@`.
- **Photos de profil modérées** : la fonction `set-avatar` passe chaque selfie à la modération avant de le rattacher au profil ; une photo refusée est effacée. Signaler un profil depuis Amis → « … » → Signaler.
- **Classification d'âge 16+** et déclarations stores mises à jour (`store/fiches-stores.md`).
- **Aperçu des liens partagés** (`web/og.png`) et pages légales dans la DA « ça fond ».
- **Demande de note** au bon moment (`lib/review.ts`) ; **son de fonte** `melt.wav` ; **splash animé** (`components/LaunchSplash.tsx`) qui prend le relais du splash natif.

## Version 6 : expérience photo

- **Lecture plein écran** : la photo occupe tout l'écran, bord à bord, et se gratte du doigt (seuil de révélation adapté à la grande surface) ; l'expéditeur (photo + pseudo) et les actions flottent sur des voiles ; après 10 s le secret fond sur tout l'écran.
- **Boîte photo d'abord** : chaque carte montre la vraie photo, floutée (vignette de 24 px), sous un reflet holo léger, avec le visage de l'expéditeur.
- **Visages** : selfie à l'inscription (facultatif, caméra avant ou galerie, carré 320 px) et changement depuis Réglages. Migration `20261007000000_v5_avatars.sql` (colonne `avatar_path`, bucket public `avatars` à chemins aléatoires, fonction `set_avatar`). Effacé avec le compte.
- **Listes sans cadres** (amis, envoyer à, envois) : grand avatar, nom, rien d'autre ; la sélection se voit par un fond doux et une coche cerise.
- **Widgets** : logo qui fond (SVG sur Android, image sur iOS). Code mort retiré (stickers).
- **Captures stores** prêtes dans `store/captures/` (FR/EN, App Store et Google Play).

## Identité « ça fond » (v5)

- **Icône** : une glace qui coule (boule vanille, 3 coulures et une goutte sur un cornet gaufré cacao), fond cerise ; variante sombre sur cacao, teintée et monochrome Android générées depuis le même dessin. Le dessin est partagé avec l'app (`IceMark`, chemins dans `components/logoPath.ts`).
- **Logo** : le nom « sweetin » vectorisé dans la police de l'app, avec 3 coulures sous les lettres (`Logo`). Shrikhand est retiré partout (app, widgets, image de story, pages web).
- **Couleurs, un rôle chacune** : cerise = marque et action principale ; cacao = encre et action secondaire ; vanille/blanc = papier ; pistache = en direct ou réussi ; les parfums = les avatars ; holo = uniquement ce qui se gratte.
- **La fonte, seulement aux moments forts** : l'accueil (le haut cerise coule), la lecture (le secret reste 10 s puis la vanille coule dessus : « fondu. »), les séries en danger (« ça fond à minuit »).
- **Titres** : grands titres en minuscules avec un point ; titres d'en-tête sans point.

## Version 4 : activation, Android, écran verrouillé

- **Premier secret sans compte** : l'accueil propose de « créer mon premier secret ». On prend la photo (`/try`), on écrit, et le compte n'est demandé qu'au moment d'envoyer (« dernière étape. »). Le brouillon est gardé (`lib/draft.ts`, y compris si l'email de confirmation fait quitter l'app) et part juste après l'inscription.
- **Accueil qu'on gratte soi-même** : la démo se gratte au doigt, avec son et vibrations ; sans toucher, un doigt fantôme montre le geste.
- **Notifications demandées au bon moment** : plus au lancement, mais après l'ajout d'amis et après le premier envoi (« sois prévenu quand il le gratte »).
- **Contacts iOS 18+ en accès limité** : l'app le détecte et propose « choisir d'autres contacts » (`lib/contacts.ts`).
- **Séries** : paliers fêtés à 7, 30, 100 et 365 jours (l'ami est prévenu) ; une série perdue hier peut être rallumée, une fois par mois et par personne (migration v4).
- **Sweet Hour sur l'écran verrouillé et dans la Dynamic Island** (iOS 16.1+, `src/widgets/SweetHourActivity.ios.tsx`, expo-widgets). Le serveur le démarre à distance (iOS 17.2+, `_shared/apns.ts`) ; ces iPhone ne reçoivent alors pas la notification classique en double. Sur Android, notification prioritaire qui expire avec le Sweet Hour.
- **Âge déclaré au store** (Texas depuis juin 2026, puis d'autres États) : Apple Declared Age Range et Google Play Age Signals (`lib/age.ts`, expo-age-range). Ailleurs, rien ne change.
- **Vibrations comme un langage** (`lib/haptics.ts`) : une touche par dixième gratté, et la signature « swee-ti-n » (3 touches qui montent) à la révélation et à l'envoi ; retours système natifs sur Android.
- **Icône iOS 18+** sombre et teintée ; **icône de notification Android** (silhouette du cornet, au lieu d'un carré blanc).
- **Android** : canaux de notification traduits, pas de sauvegarde Google Drive de la session (`allowBackup: false`), permission « superposition » retirée, mode clair forcé (expo-system-ui), ombres identiques sur les deux plateformes (`boxShadow`), titres sans marge de police parasite.
- **Fondu sous la barre d'onglets** : les listes ne disparaissent plus d'un coup derrière elle.
- **Fiches stores** : nom et sous-titre indexés, mots-clés sans doublon, légendes de captures porteuses de mots-clés, fiches personnalisées par source (`store/fiches-stores.md`).

## Fonctionnalités ajoutées dans cette version

- **Accueil qui montre au lieu d'expliquer** : un polaroid se gratte tout seul sous un doigt fantôme et révèle le secret, en boucle (`components/ScratchDemo.tsx`). Plus de tutoriel : accueil → compte → pseudo → amis → caméra.
- **Connexion Apple et Google** en plus de l'email. Le pseudo et la date de naissance sont demandés juste après, quel que soit le mode de connexion.
- **Âge minimum 16 ans**, vérifié par le serveur. Un refus est définitif : changer de date ensuite ne débloque pas le compte. La date de naissance n'est lisible par personne.
- **Modération automatique** de chaque flip (photo + message) avant l'envoi, avec le modèle de modération gratuit d'OpenAI. Sans clé, l'envoi fonctionne sans filtre.
- **Anti-spam** : 150 flips maximum par 24 h.
- **Lien d'invitation** `sweetin.app/u/<pseudo>` à partager depuis Contacts. Il ouvre l'app et ajoute l'ami ; si la personne n'a pas encore de compte, l'ajout se fait à la fin de son inscription.
- **Sweet Hour** : chaque jour à une heure tirée au hasard (10 h–21 h, heure de Paris), tout le monde reçoit une notification et a 2 minutes pour envoyer un flip. Bandeau avec compte à rebours sur l'écran caméra.
- **Widget** iOS et Android : nombre de flips à gratter et bouton « Envoyer un flip ». Jamais de photo ni de message dans le widget.
- **Captures d'écran** bloquées sur la lecture (Android) et signalées à l'expéditeur (iOS ne permet pas de les bloquer) ; l'app est floutée dans le sélecteur d'apps ; la photo n'est jamais écrite sur le disque.
- **Lecteur d'écran** : VoiceOver et TalkBack peuvent révéler le message sans gratter.
- **Envoi fiable** : barre de progression, détection hors ligne, nouvelles tentatives automatiques et bouton « Réessayer ».
- **Suivi** : plantages (Sentry) et statistiques anonymes (PostHog), désactivés sans clés. Aucun contenu n'est envoyé : ni photo, ni message, ni pseudo. Les statistiques ne sont jamais reliées au compte et se désactivent dans Réglages.
- **Durées de conservation** appliquées automatiquement par la fonction `cleanup` : traces des flips 90 jours, signalements 12 mois.
- **Pages légales** (FR/EN) dans `web/` : confidentialité, conditions d'utilisation, suppression de compte. **Fiches App Store et Google Play** prêtes à coller dans `store/fiches-stores.md`.

## Polish (design et animations)

- **Zoom natif iOS** : la carte d'un flip dans la boîte s'agrandit jusqu'à la carte de lecture (`Link.AppleZoom`).
- **Reflet holographique GPU** (shader Skia) qui glisse quand on incline le téléphone, sur la photo à valider et sur la photo à gratter (`components/Holo.tsx`, `lib/useTilt.ts`).
- **Carte qui suit le gyroscope**, avec l'ombre qui glisse dans le sens opposé (`components/TiltCard.tsx`).
- **Polaroid qui se développe** : voile laiteux puis couleurs, à chaque nouvelle photo. Flash blanc au déclenchement.
- **Grattage** : paillettes sous le doigt et explosion de confettis au moment où le message apparaît, le tout dessiné sur le thread graphique.
- **Célébration d'envoi** : le cornet tombe, confettis, « envoyé. ».
- **Ressorts partout** (`components/Bounce.tsx`, `theme.motion`) : chaque bouton s'enfonce et rebondit, avec retour haptique.
- **Apparitions en cascade** des listes et **squelettes animés** pendant les chargements.
- **Accessibilité** : tout le mouvement se coupe si « Réduire les animations » est activé ; tailles de texte système respectées.

## Direction artistique 2027

Tout part de `src/theme.ts` (couleurs, polices, trait et ombre dure) et de `src/components/ui.tsx` (écran, boutons sticker, pastilles, champs, lignes, interrupteur).

- **Parfums** : cerise `#FF2D5F` (la marque), cacao `#1A0A0E` (l'encre), vanille `#FFF4E6` (le papier), bubblegum, pistache, et le dégradé **holo** réservé à ce qui se gratte.
- **Trois ambiances** (`<Screen tone>`) : vanille pour les écrans de liste et de saisie, cerise pour les moments de marque (bienvenue, envoi, grattage), cacao pour la caméra et le secret révélé. Sur cerise, le petit texte est en cacao (le vanille n'atteint pas le contraste minimal).
- **Polices** (`assets/fonts/`) : Shrikhand pour le logo seulement ; Bricolage Grotesque figée en 4 fichiers depuis la police variable (titre 800 condensé, texte 500, 700, 800). Pour les régénérer : instancier `@fontsource-variable/bricolage-grotesque` avec `fontTools.varLib.instancer` (opsz, wght, wdth).
- **Retenue** : l'ombre dure n'existe que sur le bouton principal (`lg`) et les cartes héros (polaroid, série la plus longue, QR code). Tout le reste est à plat : blanc, filet 1 px `colors.line`. Une seule couleur d'accent par écran (cerise), les pastels ne servent qu'aux avatars. Pas de sticker dans les états vides (`IconBadge` à la place).
- **Logo, glace et coulures** : `components/Logo.tsx` (`Logo`, `IceMark`, `Drip`). **Icônes** au trait : `components/Icon.tsx` (plus aucun emoji en guise d'icône).
- Icône de l'app, icône adaptative Android, splash et favicon refaits dans la DA ; widgets iOS et Android, image de story et pages web `/f` et `/u` aussi.

## Langues (FR et EN)

- `src/i18n/fr.ts` et `src/i18n/en.ts` sont écrits séparément dans chaque langue, pas traduits mot à mot : on tutoie, titres courts en minuscules avec un point, ton sobre et direct : pas d'argot forcé, pas d'emoji dans les textes ni dans les notifications. L'app suit la langue du téléphone (anglais par défaut hors français).
- Détails qui changent selon la langue : ordre de la date de naissance (JJ/MM ou MM/DD), virgule ou point dans les secondes, exemples dans les champs.
- **Notifications** : chaque appareil enregistre sa langue (`push_tokens.lang`, migration `20261005000000_lang.sql`) et les fonctions serveur écrivent dans cette langue (`supabase/functions/_shared/copy.ts`).
- Pages web `/f` et `/u` : textes dans les deux langues, selon le navigateur.

## Identité sonore

Motif signature « swee-ti-n » : trois notes de verre qui montent (mi, sol, do aigus). Tous les sons en dérivent (`assets/sounds/`, lecture dans `src/lib/sounds.ts`).

| Son | Quand |
|---|---|
| `sweet` | flip reçu (notification, et dans l'app) |
| `scratch` | en boucle tant que le doigt gratte |
| `reveal` | le message apparaît (« pouf ! ») |
| `sent` | flip envoyé |
| `streak` | envoi qui fait grimper une série, rappel de série |
| `sweethour` | début du Sweet Hour |
| `tap` | la photo se retourne pour écrire au dos |
| `melt` | le secret fond, 10 s après la lecture (« plic… plic… plic ») |

- Muets en mode silencieux, se mélangent à la musique sans la couper, interrupteur « Sons » dans Réglages.
- Notifications : son personnalisé iOS et un canal Android par son (`flips`, `sweethour`, `streaks`). Le son d'un canal Android est figé à sa création : pour le changer, renomme le canal.
- Régénérer les fichiers : `pip install numpy scipy && python3 scripts/generate_sounds.py`.

## Comment la confidentialité est garantie

- Le message caché est dans une table que **personne** ne peut lire depuis l'app. Seule la fonction `open-flip` le renvoie, et uniquement au destinataire.
- La photo est dans un bucket privé. On ne peut que déposer dans son propre dossier. La lecture passe par une URL signée valable 2 minutes, donnée au seul destinataire. Sur le téléphone, elle est décodée en mémoire et jamais écrite dans un cache.
- Quand tous les destinataires ont gratté, `scratched` supprime la photo et le message. Les flips non ouverts expirent au bout de 7 jours (fonction `cleanup`).
- Un signalement conserve le message pour la modération et bloque l'expéditeur.

## 1. Comptes à créer

| Compte | Prix | Pourquoi |
| --- | --- | --- |
| [Supabase](https://supabase.com) | gratuit pour démarrer, Pro 25 $/mois en prod | base, auth, stockage, fonctions |
| [Expo / EAS](https://expo.dev) | gratuit pour démarrer | builds iOS et Android dans le cloud, envoi aux stores, push |
| Apple Developer Program | 99 $/an | publier sur l'App Store |
| Google Play Console | 25 $ une fois | publier sur le Play Store |

## 2. Back-end Supabase

```bash
npm i -g supabase                       # ou: npx supabase@latest …
supabase login
supabase link --project-ref <ref-du-projet>
supabase db push                        # applique supabase/migrations
supabase functions deploy send-flip open-flip scratched screenshot report delete-account cleanup sweet-hour open-link link-scratched streak-reminder
supabase secrets set PUBLIC_SITE_URL=https://sweetin.app   # domaine des pages /f/ et /u/
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
# modération automatique (gratuite) : clé sur platform.openai.com
supabase secrets set OPENAI_API_KEY=sk-...
# optionnel, si tu actives la sécurité des push dans Expo :
supabase secrets set EXPO_ACCESS_TOKEN=<token Expo>
# Sweet Hour sur l'écran verrouillé (Live Activity iOS) : clé APNs .p8 (developer.apple.com > Keys)
supabase secrets set APNS_KEY="$(cat AuthKey_XXXX.p8)" APNS_KEY_ID=XXXX APNS_TEAM_ID=<team id> APNS_TOPIC=<bundle id iOS>
# APNS_ENV=sandbox pour les builds de développement ; sans ces variables, tout le monde reçoit la notification classique
```

Dans le tableau de bord Supabase :

1. **Authentication → URL Configuration** : Site URL `sweetin://`, Redirect URLs `sweetin://auth-callback` et `sweetin://google-auth`.
2. **Authentication → Providers → Apple** : active-le et mets l'identifiant de l'app (`APP_BUNDLE_ID`) dans « Client IDs ». La connexion se fait en natif, aucune clé secrète n'est nécessaire pour l'app.
3. **Authentication → Providers → Google** : crée un identifiant OAuth « Application Web » dans Google Cloud Console, avec l'URL de retour `https://<ref-du-projet>.supabase.co/auth/v1/callback`, et colle l'ID et le secret dans Supabase.
4. **Authentication → Providers → Phone** : active-le avec un fournisseur SMS (Twilio, MessageBird ou Vonage ; compter quelques centimes par SMS) et coche « Enable phone confirmations ». Il ne sert qu'à vérifier le numéro pour « retrouver ses contacts », pas à se connecter.
5. **Authentication → Emails** : branche un vrai SMTP (Resend, Postmark…). Le SMTP par défaut est limité à quelques emails par heure, insuffisant en prod. Traduis le modèle d'email de confirmation en français.
6. **Database → Extensions** : active `pg_cron` et `pg_net`, puis dans l'éditeur SQL :

```sql
select cron.schedule(
  'sweetin-cleanup', '5 * * * *',
  $$ select net.http_post(
       url := 'https://<ref-du-projet>.supabase.co/functions/v1/cleanup',
       headers := jsonb_build_object('x-cron-secret', '<la valeur de CRON_SECRET>')
     ) $$
);
-- rappel des séries en danger, tous les jours à 17 h UTC (19 h à Paris l'été, 18 h l'hiver)
select cron.schedule(
  'sweetin-streaks', '0 17 * * *',
  $$ select net.http_post(
       url := 'https://<ref-du-projet>.supabase.co/functions/v1/streak-reminder',
       headers := jsonb_build_object('x-cron-secret', '<la valeur de CRON_SECRET>')
     ) $$
);
-- Sweet Hour : vérifié chaque minute, ne notifie qu'une fois par jour
select cron.schedule(
  'sweetin-sweet-hour', '* * * * *',
  $$ select net.http_post(
       url := 'https://<ref-du-projet>.supabase.co/functions/v1/sweet-hour',
       headers := jsonb_build_object('x-cron-secret', '<la valeur de CRON_SECRET>')
     ) $$
);
```

## 3. L'app

```bash
cp .env.example .env                    # renseigne l'URL et la clé publishable Supabase
npm install
npx eas-cli@latest login
npx eas-cli@latest init                 # crée le projet EAS ; copie son id dans EAS_PROJECT_ID
```

Mets les mêmes variables dans EAS pour les builds (environnement `production`, et `development` pour tester) :

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_xxx --visibility plaintext
npx eas-cli@latest env:create --environment production --name EAS_PROJECT_ID --value <id> --visibility plaintext
```

Ajoute de la même façon, si tu les utilises : `APPLE_TEAM_ID`, `APP_LINK_DOMAIN`, `EXPO_PUBLIC_INVITE_BASE`, `EXPO_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`, `SENTRY_PROJECT` et le secret `SENTRY_AUTH_TOKEN` pour les symboles de débogage), `EXPO_PUBLIC_POSTHOG_KEY`.

**Liens d'invitation** : héberge le dossier `web/` sur ton domaine (instructions dans `web/README.md`).

**Widget iOS** : il utilise le groupe d'apps `group.<APP_BUNDLE_ID>`. EAS crée les identifiants au premier build ; renseigne `APPLE_TEAM_ID` avant.

Change `APP_BUNDLE_ID` et `APP_PACKAGE` si `app.sweetin.*` ne t'appartient pas (ces identifiants sont définitifs après la première publication).

**Tester sur ton téléphone.** L'app utilise Skia et la caméra, donc pas Expo Go : il faut un build de développement.

```bash
npx eas-cli@latest build --profile development --platform ios      # ou android
npx expo start --dev-client
```

## 4. Notifications push

- **iOS** : `npx eas-cli@latest credentials` → iOS → Push Notifications → laisse EAS créer la clé APNs. La même clé .p8 sert aux Live Activities (variables `APNS_*` ci-dessus).
- **iOS, capacités à cocher** sur l'identifiant de l'app (developer.apple.com) si EAS ne le fait pas : Push Notifications, App Groups, Sign in with Apple, Associated Domains, **Declared Age Range**. L'extension `ExpoWidgetsTarget` (Live Activity) a son propre identifiant `<bundle id>.live`.
- **`patch-package`** : un correctif de `@bacons/apple-targets` (dans `patches/`) l'empêche de reprendre la cible d'expo-widgets. Il s'applique tout seul à l'installation.
- **Android** : crée un projet Firebase, ajoute l'app Android (même package), télécharge la clé de compte de service FCM V1 et charge-la avec `npx eas-cli@latest credentials` → Android → FCM V1.

## 5. Build et envoi aux stores

```bash
npm run build:ios && npm run submit:ios
npm run build:android && npm run submit:android
```

Remplace `ascAppId` dans `eas.json` par l'identifiant de l'app créée dans App Store Connect. Pour Android, la première version doit être envoyée une fois à la main dans la Play Console, ensuite `submit` fonctionne. Les mises à jour JavaScript sans nouvelle revue passent par `npx eas-cli@latest update --channel production`.

## 5 bis. Tester sur de vrais téléphones (avant toute soumission)

L'aperçu web ne montre ni la caméra, ni les vibrations, ni l'écran verrouillé, ni les widgets, ni les notifications. Deux tours de test suffisent.

**1. Version de test interne (une heure)**
1. `npx eas-cli@latest login`, puis `npx eas-cli@latest build --profile preview --platform all`.
2. iPhone : enregistrer les appareils avant (`npx eas-cli@latest device:create`, lien à ouvrir sur chaque iPhone). Android : installer l'APK depuis le lien du build.
3. Pointer l'app sur un projet Supabase de test avec toutes les migrations et les fonctions déployées.

**2. Ce qu'il faut vérifier, sur 1 iPhone récent, 1 iPhone ancien (iOS 17) et 1 Android d'entrée de gamme**
- Lancement : splash natif puis splash animé sans saut ; icône claire, sombre et teintée sur l'écran d'accueil (iOS 18+).
- Caméra : prise de vue, flash, double tap pour retourner, galerie ; effet de développement du polaroid.
- Lecture : grattage plein écran fluide (60 i/s), vibrations à chaque dixième, son et vibration « swee-ti-n » à la révélation, fonte après 10 s avec le « plic ».
- Selfie : prise, recadrage, refus d'une photo inacceptable (modération), affichage chez un ami.
- Notifications : flip reçu, Sweet Hour (Live Activity sur l'écran verrouillé et la Dynamic Island en iOS 17.2+, notification prioritaire sur Android), série en danger.
- Widgets iOS et Android : logo, compteur, ouverture de la boîte.
- Liens : `sweetin.app/f/…` et `/u/…` ouvrent l'app installée ; sinon la page web et son aperçu (WhatsApp, iMessage).
- Accessibilité : VoiceOver/TalkBack révèlent le message sans gratter ; texte très grand lisible ; « Réduire les animations » coupe le splash animé et la fonte.
- Demande de note : elle n'apparaît qu'après une réaction, à partir du 3e secret (TestFlight ne l'affiche pas : vérifier seulement que rien ne casse).

**3. Bêta fermée (une à deux semaines)** : TestFlight externe + test fermé Google Play avec 20 à 50 amis, en mesurant la part de nouveaux inscrits qui envoient un premier secret et la part de secrets grattés.

## 6. Ce que les stores vont exiger

- [ ] **Politique de confidentialité**, **conditions d'utilisation** et **page de suppression de compte** : rédigées dans `web/` (FR/EN). À compléter (passages surlignés), faire valider par un juriste (liste dans `web/README.md`) et mettre en ligne.
- [ ] **Textes des fiches**, questionnaires d'âge, étiquettes de confidentialité Apple, formulaire « Sécurité des données » Google et notes pour la revue Apple : prêts dans `store/fiches-stores.md`.
- [ ] **Suppression du compte dans l'app** : fait (Réglages → Supprimer mon compte). La page web demandée par Google est dans `web/suppression-compte/`.
- [ ] **Contenu créé par les utilisateurs** (Apple 1.2, Google UGC) : signalement et blocage faits ; il faut en plus des conditions d'utilisation qui interdisent les contenus abusifs, et quelqu'un qui traite la table `reports` sous 24 h.
- [ ] **Âge** : l'app demande la date de naissance et refuse les moins de 16 ans (`min_age()` dans la migration v2). Là où une loi l'exige (Texas depuis le 4 juin 2026), la tranche d'âge déclarée au store est aussi lue (`lib/age.ts`). L'App Store ne permet pas d'exclure un seul État : soit cette vérification suffit (à faire valider par un juriste), soit ne pas sortir aux États-Unis au début. Déclare un classement 12+ (Apple) / Teen (Google) et fais valider (RGPD, DSA).
- [ ] **Android 16 sur tablettes et pliables** : l'orientation portrait n'y est plus imposée ; les écrans s'adaptent, à vérifier sur un pliable.
- [ ] **Connexion Apple** obligatoire sur iOS dès qu'il y a Google : faite.
- [ ] Captures d'écran (ordre et accroches proposés dans `store/fiches-stores.md`) ; l'icône est déjà dans `assets/`.

## Tests

```bash
npm run typecheck        # types TypeScript
npm test                 # tests unitaires : traductions FR/EN complètes, dates de naissance, lien d'invitation, widget
maestro test .maestro    # parcours sur simulateur ou téléphone (voir les variables en tête de chaque fichier)
```

## Ce qui a été vérifié, ce qui reste à faire

Vérifié avant livraison :
- Types TypeScript de l'app : aucun problème.
- 21 tests unitaires passent (Jest).
- Bundles iOS et Android complets compilés avec `expo export`.
- Page web de grattage testée dans un navigateur (Chromium, taille iPhone) contre un faux serveur : aperçu, ouverture, grattage au doigt, révélation, trace envoyée, seconde ouverture refusée, texte du message jamais interprété comme du HTML, version anglaise.
- Image de story rendue avec le moteur Skia (CanvasKit) pour vérifier la mise en page.
- Génération native (`expo prebuild`) : les deux extensions iOS (widget et Live Activity) coexistent, icônes iOS sombre et teintée, droit Declared Age Range, manifeste Android sans sauvegarde ni superposition ; la cible widget iOS, son groupe d'apps, Sign in with Apple, les domaines associés, le widget Android et les liens https Android sont bien créés.
- Types des 11 fonctions serveur vérifiés avec Deno, 5 tests de la modération passent. Signature du jeton APNs (ES256) vérifiée avec une clé de test.
- Parcours vérifiés dans l'aperçu web avec le vrai moteur Skia, en FR et en EN : démo grattée au doigt sur l'accueil, caméra sans compte, « dernière étape. » à l'envoi, demande de notifications après l'envoi, série à rallumer.
- Les cinq migrations appliquées sur un vrai Postgres, puis 68 vérifications, dont pour la v4 : série perdue visible et rallumable, un seul sauvetage par mois et par personne, trop tard au-delà d'un jour, sauvetages et jetons Live Activity privés ; pour la v3 : séries (début, continuité, danger, rupture), contacts (numéro non vérifié introuvable, « non trouvable » respecté, limite de 20 recherches par jour), parrainage, contenu d'un flip gardé tant qu'un lien n'est pas consommé, jetons de lien invisibles pour les destinataires, fonctions serveur inaccessibles depuis l'app, et le correctif du profil. Pour la v2 : refus des moins de 16 ans (définitif), pseudo pris ou invalide, ajout d'ami réservé aux profils complets, dates de naissance illisibles, Sweet Hour secret avant son heure et ouvert 2 minutes ; plus les tests de sécurité de la v1 (flips et traces invisibles aux tiers, message illisible en direct, dépôt de photo limité à son dossier, blocage).

À faire de ton côté (impossible sans tes comptes et un téléphone) :
- Tester sur un iPhone et un Android avec un build de développement : grattage, caméra, notifications, widget, connexion Apple et Google, blocage des captures, Live Activity du Sweet Hour (iPhone verrouillé), contacts en accès limité, feuille d'âge Apple (compte de test au Texas, iOS 26.2+).
- Héberger `web/` sur le domaine des invitations, mettre en ligne les pages légales, brancher le SMTP.
- Remplir les fiches App Store et Play Store.
- Appliquer les migrations lang, v4 et v5 (avatars), déployer `set-avatar`, renseigner `OPENAI_API_KEY` et la clé APNs, et le nom du contact sécurité des mineurs dans `web/securite-enfants/`.
- Commander l'animation Rive de Fondue (brief dans `store/brief-fondue/`) et fournir de vraies photos pour l'accueil et les captures.
