# Fondue — brief design Rive

**Livrable attendu** : `assets/fondue.riv` — machine à états interactive, exportée pour `@rive-app/react-native` (runtime Nitro).
**Interface déjà câblée dans l'app** : `src/components/Fondue.tsx` expose `{ mood, size, bg }` — le `.riv` doit s'y brancher sans changer l'API.

## Personnage

Fondue = la goutte du logo `sweet'in.` devenue un petit personnage. Une goutte de sorbet persimmon qui tient debout, avec un visage minimal. Références : Duolingo (expressivité + humour), le fantôme Snapchat (forme simple, mémorable), les blobs Locket (ronds, chauds).

### Direction de forme

- Silhouette = la goutte exacte de `logoPath.ts` (`DROP`) : ronde en bas, pointe douce en haut. La pointe EST sa « mèche » — elle exprime l'émotion (dresse = alerte, penche = triste, remue = content).
- Pas de bras. Pas de jambes fixes — la goutte rebondit sur sa base (squash & stretch) ou se déplace en glissant/sautillant.
- Visage : 2 yeux noirs ronds (`#1F110B`) + bouche simple. Pas de nez, pas de détails. Expressif par les paupières et la bouche uniquement.
- Volume : la goutte est légèrement « bombée » — un reflet clair en haut à gauche (`#FF9E64` à ~40 %) et une petite zone saturée en bas à droite (`#E03F0E`) suggèrent le sorbet glossy. Pas de dégradé complexe, un à deux plans de couleur suffisent.
- Taille de lecture : le visage doit rester lisible à 28 px (pastille notifications) comme à 160 px (empty state).

### Palette (tokens `src/theme.ts`)

| Rôle | Valeur |
|---|---|
| Corps | `#FF5A26` (persimmon, héros) |
| Ombre de corps | `#E03F0E` |
| Reflet | `#FF9E64` |
| Visage | `#1F110B` (encre) |
| Joues | `#FF9EC4` (bubblegum, ~60 % alpha, uniquement happy/party/love) |
| Accessoire optionnel | petit trait wasabi `#C5EE6A` (ex. : un sprout, une écharpe d'hiver… à proposer) |

### Moods à dessiner (6 états de la state machine)

L'app appelle `mood` — le `.riv` doit exposer des inputs/états nommés **exactement** :

| État | Moment dans l'app | Animation |
|---|---|---|
| `happy` | défaut, empty states positifs | respiration douce : squash vertical lent ~1.5 s, sourcil en l'air, sourire. Idle sans fin, subtil |
| `melt` | le message fond (signature !) | la base s'étale progressivement, la pointe s'affaisse, les yeux restent sereins — la fonte est le concept central : c'est lui, dévoré avec joie |
| `shock` | surprise, erreur, alerte screenshot | tremblement rapide ~90 ms ×6, yeux agrandis, bouche « o », pointe dressée |
| `wait` | chargement, attente | balancier lent gauche/droite, paupières mi-closes, la pointe pendouille |
| `party` | révélation, streak, succès | petits bonds répétés (~520 ms), squash vertical exagéré, yeux en `^ ^`, joues roses, confettis optionnels dessinés dans le .riv |
| `sad` | flip expiré, état vide négatif | penche ~-14°, pointe tombante, yeux tombants, pas de bouche |

### Règles d'animation

- **Squash & stretch partout** — la goutte est de la glace molle, jamais rigide.
- Transitions entre états : ~150–250 ms, jamais de coupe nette. `party` et `shock` peuvent entrer brusquement (impact).
- Blinking des yeux : un clin d'œil toutes les 3–6 s sur `happy`/`wait`, aléatoire dans le .riv.
- Boucles seamless pour tous les états idle. `party` peut boucler ; `shock` joue puis revient.
- 60 fps sur device moyen — pas de meshes lourds, pas de blur coûteux en boucle. Les bones simples suffisent.
- Canvas de référence : square, ~1024, personnage occupant ~80 % de la hauteur, ancré bas.

### Variante accessibilité

L'app respecte « réduire les animations » : elle coupe les shared values côté RN. Dans le .riv, privilégier des états qui restent beaux **gelés sur la frame 1** (la pose seule doit exprimer le mood).

### Usage produit (contexte)

- Empty state inbox → `wait` ou `sad`
- Révélation d'un flip → `party`
- Le message « fond » après lecture → `melt` (le moment le plus iconique de l'app)
- Alerte capture d'écran → `shock`
- Streak/celebration → `party`
- Erreurs → `sad`/`shock`

Fichier de test joint à produire : `fondue-preview.riv` avec les 6 états navigables via un input enum `mood`.
