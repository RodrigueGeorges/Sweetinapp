# Mise en ligne de Sweetin

Tout ce qui se fait sans tes comptes est prêt : l'app (V14.5), le site (`web/`), les 24 captures et les fiches des stores (`store/`), le design system et la maquette. Ce qui reste demande tes comptes, tes informations légales ou un vrai téléphone. Ce guide les prend dans l'ordre.

Pour savoir à tout moment ce qui manque encore :

```bash
node scripts/mise-en-ligne.mjs --check
```

## 1. Ce que toi seul peux fournir

| Quoi | Où le trouver | Où ça va |
| --- | --- | --- |
| Compte Apple Developer (99 $/an) et son **Team ID** (10 caractères) | developer.apple.com › Membership | `.env` : `APPLE_TEAM_ID` |
| L'app créée dans App Store Connect, son **Apple ID** (nombre) | App Store Connect › l'app › Informations sur l'app | `.env` : `APP_STORE_ID` |
| Compte Google Play Console (25 $) ; de préférence un compte **organisation** (D-U-N-S), sinon test fermé de 12 testeurs pendant 14 jours | play.google.com/console | – |
| Projet Supabase : URL et clé publique | Supabase › Project Settings › API | `.env` : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Projet EAS | `npx eas-cli@latest init` | `.env` : `EAS_PROJECT_ID` |
| Empreintes SHA-256 Android (clé EAS **et** clé Google Play) | `npx eas-cli@latest credentials` › Android ; Play Console › Intégrité de l'app › Signature d'app | `.env` : `ANDROID_SHA256` (séparées par une virgule) |
| **Clé OpenAI** pour la modération (API de modération gratuite). **Obligatoire** : sans elle, rien n'est filtré et Apple refusera l'app (règle 1.2) | platform.openai.com › API keys | `supabase secrets set OPENAI_API_KEY=…` |
| Envoi d'e-mails (Resend, Postmark…) et SMS (Twilio, MessageBird, Vonage) | leurs sites | tableau de bord Supabase (README, section 2) |
| Le domaine `sweetin.app` et un hébergement statique (Netlify, Vercel, Cloudflare Pages…) | – | on y dépose `web/` |
| Infos légales : raison sociale, forme et capital, siège, SIREN/RCS, TVA, directeur de la publication, hébergeur, médiateur, contact sécurité des enfants, prestataires e-mail et SMS | – | passages surlignés en jaune dans les pages légales (`web/`, FR et EN) ; à faire relire par un juriste |
| Deux comptes de démo adultes, amis entre eux | à créer dans l'app | notes de revue Apple et « Accès à l'application » Google (`store/fiches-stores.md`) |
| Facultatif : clé APNs (sweet hour sur l'écran verrouillé), Sentry, PostHog | developer.apple.com › Keys ; sentry.io ; posthog.com | README, section 2 ; `.env` |

## 2. Dans l'ordre

1. **Configurer.** Copie `.env.example` en `.env`, remplis-le, puis :
   ```bash
   npx eas-cli@latest init
   node scripts/mise-en-ligne.mjs
   ```
   Le script remplit le site et `eas.json` (Team ID, ID App Store, adresse Supabase, empreintes Android) et liste ce qui manque. Relance-le jusqu'à « Tout est rempli. ». Les mêmes variables vont aussi dans l'environnement « production » d'EAS (expo.dev › ton projet › Environment variables).
2. **Vérifier le projet** sur ta machine (il faut Internet) :
   ```bash
   npx expo-doctor
   ```
3. **Back-end.** Suis la section 2 du README : `supabase link`, `supabase db push`, `supabase functions deploy …` (toutes les fonctions, dont `set-avatar`), les secrets (`PUBLIC_SITE_URL`, `CRON_SECRET`, `OPENAI_API_KEY`…), puis les réglages du tableau de bord (URL de redirection, Apple, Google, téléphone, SMTP, tâches planifiées).
4. **Site.** Dépose le dossier `web/` tel quel (avec `_redirects` : toutes les adresses `/f/*` et `/u/*` servent leur `index.html`). Vérifie :
   - `https://sweetin.app/.well-known/apple-app-site-association` répond en JSON, sans redirection ;
   - `https://sweetin.app/f/test` affiche « lien introuvable. » avec la flaque ;
   - un lien `sweetin.app/f/…` collé dans WhatsApp montre la nouvelle image d'aperçu.
5. **Tester sur ton téléphone** : `TEST-V14.md`, sections 2 et 3 (build de développement EAS, puis la checklist écran par écran, widgets en premier).
6. **Builds de production et envoi :**
   ```bash
   npm run build:ios && npm run submit:ios
   npm run build:android && npm run submit:android
   ```
7. **Fiches des stores** (`store/fiches-stores.md`) : textes FR et EN (longueurs vérifiées), 6 captures par langue dans `store/captures/`, classement 16+, étiquettes de confidentialité Apple, formulaire « Sécurité des données » Google, normes de sécurité des enfants, notes de revue avec les comptes de démo. Juste avant la soumission, envoie un sweet du compte B au compte A pour que le relecteur en ait un à gratter.
8. **Le jour J** : quelqu'un traite la table `reports` sous 24 h (engagement pris dans les fiches et les conditions).

## 3. Ce qui n'a pas pu être vérifié d'ici

L'app a été vérifiée dans l'aperçu web (tous les écrans, clair et sombre, FR et EN), avec un faux serveur. Restent à voir sur un vrai téléphone et un vrai back-end :

- les **widgets** iOS (code SwiftUI jamais compilé ici, faute de Xcode) et Android ;
- le grattage au doigt, les vibrations, le verre (Liquid Glass), la fonte à 60 images par seconde ;
- les notifications, la sweet hour sur l'écran verrouillé, les liens qui ouvrent l'app ;
- le parcours complet sur Supabase (inscription, envoi, modération, lecture, suppression du compte).

`TEST-V14.md` liste chaque point à cocher.
