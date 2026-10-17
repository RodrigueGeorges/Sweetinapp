# V14 · ce qui reste à faire de ton côté

Deux choses ne peuvent se faire que de ta machine : redéployer le serveur, et tester sur un vrai téléphone.

## 1. Redéployer le serveur (5 min)

Les textes des notifications et les messages d'erreur des fonctions ont été réécrits (`supabase/functions/_shared/copy.ts`). Tant que les fonctions ne sont pas redéployées, les notifications gardent l'ancien ton.

```bash
supabase login
supabase link --project-ref <ref-du-projet>
supabase functions deploy send-flip open-flip scratched screenshot report delete-account cleanup sweet-hour open-link link-scratched streak-reminder set-avatar
```

Pas de migration de base dans cette version : `supabase db push` n'est pas nécessaire.

Vérification : envoie-toi un sweet depuis un 2e compte, la notification doit être en minuscules (« {nom} t’a caché un mot sous une photo. gratte. »). Côté envoyeur, une fois lu : « {nom} a lu ton mot en 4,5 s. il a fondu. »

## 1 bis. Remettre en ligne le site (2 min)

Le dossier `web/` a changé (pages `/f/` et `/u/`, pages légales, `og.png`, polices dans `web/fonts/`, `sucre-givre.png`). Redéploie-le tel quel sur ton hébergement statique. Vérifie ensuite qu'un lien `sweetin.app/f/…` collé dans WhatsApp ou iMessage montre bien la nouvelle image d'aperçu (blanche, carte qui coule) ; sinon vide le cache d'aperçu (WhatsApp le garde quelques jours).

## 2. Build de test sur téléphone (20 min, dont 15 d'attente)

Le gratter, le retour haptique, le Liquid Glass, les widgets et la Live Activity ne marchent pas dans l'aperçu web : il faut un build natif.

```bash
npm i -g eas-cli
eas login
eas build --profile development --platform ios      # ou android
# installe le build via le QR code, puis :
npx expo start --dev-client
```

Après un changement de code JS, pas besoin de rebuild : le dev client recharge. Rebuild seulement si tu touches `app.config.ts`, les widgets (`targets/`) ou une dépendance native.

## 3. La checklist (iPhone et Android, clair et sombre)

**Lancement et compte**
- [ ] icône sur l'écran d'accueil : nette, framboise, glace lisible en petit
- [ ] écran de lancement blanc (nuit en sombre), sans flash
- [ ] accueil : la démo se gratte au doigt, les deux autocollants ne cachent pas le texte
- [ ] connexion Apple / Google / email : les autocollants au-dessus du titre ne débordent pas sur petit écran (iPhone SE)

**Vitrine**
- [ ] les bords qui coulent sont propres (pas de liseré clair entre la photo et le fond, surtout en sombre)
- [ ] le sucre givré ne « bouge » pas au défilement (pas de moirage)
- [ ] le déclencheur framboise est atteignable au pouce, ne cache pas la dernière carte
- [ ] sweet hour : l'anneau compte à rebours autour du déclencheur avance

**Lire un sweet** (le cœur de l'app)
- [ ] gratter : le grain suit le doigt sans retard, haptique légère pendant le gratter
- [ ] « lire sans gratter » révèle tout de suite
- [ ] le mot reste lisible 10 s, la barre citron se vide
- [ ] la fonte : les lettres tombent une à une puis la photo coule (1,2 s + 1,4 s), fluide à 60 i/s
- [ ] écran « fondu. » : la glace tombe, la flaque s'étale, les vermicelles sautent
- [ ] avec « Réduire les animations » activé : simple fondu, pas de chute
- [ ] capture d'écran pendant la lecture : un message s'affiche et l'envoyeur reçoit « … a tenté une capture de ton sweet. bloquée. »
- [ ] réagir avec un autocollant, puis « répondre à {nom} » ouvre l'appareil photo

**Créer et envoyer**
- [ ] le clavier ne recouvre pas le champ du mot caché, curseur citron visible
- [ ] « à qui ? » : séries à sauver en premier, chiffres de série bien alignés
- [ ] lien « même sans l'app » : la page web s'ouvre et se gratte dans Safari / Chrome
- [ ] partage en story : l'image s'ouvre dans Instagram, autocollants et texte non coupés

**Hors de l'app**
- [ ] widget petit et moyen (clair et sombre) : carte qui coule avec « gratte. », compteur citron ; sans sweet, la glace framboise et le bouton nuit
- [ ] onglet envoyés : vignettes qui coulent, « lu en … s » en autocollant citron
- [ ] notification reçue en minuscules, le tap ouvre le bon sweet
- [ ] Live Activity de la sweet hour sur l'écran verrouillé (iOS, si les clés APNs sont posées)

Note ce qui accroche (capture + modèle de téléphone), je corrige ensuite.

## 4. Mettre les captures sur les stores

Les 12 captures App Store (1320 × 2868, format 6,9") et 12 Play Store (1080 × 1920) sont dans `store/captures/`, les textes dans `store/fiches-stores.md`. À glisser dans App Store Connect et la Play Console, dans l'ordre 1 → 6.
