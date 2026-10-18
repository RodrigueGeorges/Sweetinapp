# Site sweetin.app

À héberger sur le domaine de Sweetin (par défaut `sweetin.app`, modifiable avec `APP_LINK_DOMAIN`, `EXPO_PUBLIC_INVITE_BASE` et les URL légales de `.env`). N'importe quel hébergement statique convient (Netlify, Vercel, Cloudflare Pages, OVH…).

## Pages

| Adresse | Fichier | Utilisée par |
| --- | --- | --- |
| `/confidentialite/` · `/en/privacy/` | politique de confidentialité | l'app (Réglages), App Store, Google Play |
| `/conditions/` · `/en/terms/` | conditions d'utilisation et mentions légales | l'app (Réglages), App Store |
| `/suppression-compte/` · `/en/delete-account/` | comment supprimer son compte | Google Play (obligatoire) |
| `/f/<jeton>` | `f/index.html` | sweets envoyés par lien privé ou en story : la personne gratte dans son navigateur, lit le mot 10 s, puis il fond ; toutes les adresses `/f/*` doivent servir ce fichier |
| `/og.png` | image d'aperçu des liens (WhatsApp, iMessage…), 1200 × 630 | |
| `/fonts/*.woff2` · `/sucre-givre.png` | polices et sucre givré de l'app (DA « net + éclats »), servis depuis le site : aucune requête vers Google Fonts | `f/`, `u/` |
| `/u/<pseudo>` | `u/index.html` | liens d'invitation ; toutes les adresses `/u/*` doivent servir ce fichier (règle de réécriture) |
| `/.well-known/apple-app-site-association` | liens universels iOS | servir en `application/json`, sans redirection |
| `/.well-known/assetlinks.json` | liens d'app Android | |

## À compléter avant la mise en ligne

Les passages surlignés en jaune dans les pages (`<span class="todo">`) sont à remplacer :
- raison sociale, forme, capital, adresse, RCS, SIREN, TVA, directeur de la publication ;
- hébergeur du site, adresse de Supabase Inc. (sur supabase.com/privacy), région Supabase et Sentry choisies ;
- prestataire d'envoi d'emails ;
- médiateur de la consommation ;
- durée de conservation des données de connexion, durée des sauvegardes (7 jours sur le plan Pro de Supabase).

Ailleurs :
- `.well-known/apple-app-site-association` : remplacer `TEAMID` par l'identifiant d'équipe Apple ;
- `.well-known/assetlinks.json` : empreinte SHA-256 du certificat de signature (`eas credentials` > Android) et celle de Google Play App Signing ;
- `u/index.html` et `f/index.html` : remplacer `APP_STORE_ID`.
- `index.html`, `f/index.html` et `u/index.html` : remplacer `REF-DU-PROJET` (balise `<meta name="sweetin-api">`) par la référence du projet Supabase, en une commande :
  `grep -rl REF-DU-PROJET . | xargs sed -i 's/REF-DU-PROJET/<ref>/'`
- pages légales (`conditions/`, `confidentialite/`, `en/terms/`, `en/privacy/`) : remplir les champs `class="todo"` (en jaune).

Exemple de règles de réécriture (Netlify, fichier `_redirects`) :

```
/f/*  /f/index.html  200
/u/*  /u/index.html  200
```

## À faire valider par un juriste

Les textes ont été rédigés au plus près du fonctionnement réel de l'app, mais ne remplacent pas un avis juridique. Points à faire vérifier en priorité :
1. **Conservation des données de connexion** (décret n° 2021-1362 pour les hébergeurs de contenus) : durée et données concernées. Les journaux de Supabase ne sont gardés que quelques jours selon le plan ; il faudra peut-être les exporter.
2. **Statistiques PostHog** : elles sont actives par défaut avec possibilité de refus (base : intérêt légitime). La CNIL peut exiger un consentement préalable si l'exemption « mesure d'audience » ne s'applique pas ; dans ce cas, passer `defaultOptIn: false` dans `src/lib/monitoring.ts` et ajouter une question au premier lancement.
3. **Règlement sur les services numériques (DSA)** : point de contact, procédure de signalement, motivation des décisions et recours sont décrits ; vérifier les obligations applicables à la taille de Sweetin.
4. **Âge minimum de 16 ans** et vérification par simple déclaration.
5. **Transferts vers les États-Unis** (Expo, OpenAI, Apple, Google) : signer les accords de traitement (DPA) de chaque prestataire.
6. **Médiateur de la consommation** : nécessaire ou non pour un service gratuit.
7. **Flips par lien et stories** : les personnes qui ouvrent un lien n'ont pas de compte et leur âge n'est pas vérifié. Le contenu est modéré avant l'envoi, mais faire valider ce choix.
8. **Carnet d'adresses** : les empreintes SHA-256 de numéros de téléphone restent des données personnelles au sens du RGPD ; vérifier la base légale (consentement via l'autorisation d'accès) et l'information des personnes.
