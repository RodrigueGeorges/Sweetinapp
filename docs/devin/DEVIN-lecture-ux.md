# Sweetin : améliorations UX de l'écran de lecture (pour Devin)

**À Devin** : applique les 4 changements ci-dessous dans le projet Sweetin (Expo, Expo Router, Reanimated, Skia).

Les fichiers concernés :
- `src/app/read/[id].tsx` : l'écran de lecture plein écran ;
- `src/components/ScratchCard.tsx` : la carte à gratter, avec le mot qui fond.

Le code a pu évoluer depuis ce diff. Si le patch de la fin ne s'applique pas tel quel, reproduis chaque changement à la main à partir de la description, puis vérifie les critères d'acceptation.

**Ne change pas** :
- la direction artistique Fondant : les couleurs de `theme.ts`, Climate Crisis et Funnel Sans, les textes en minuscules ;
- les textes i18n : aucune nouvelle clé, on réutilise `read.meltsIn`, `read.meltRule`, `read.noScratch` et `read.onceHint` ;
- la durée de fonte `MELT_S = 10`, la séquence de fonte (mot lettre par lettre, puis coulis `Drip`, puis « fondu. ») et l'écran « fondu. ».

---

## 1. Bug : le mot passe sous les réactions sur les petits écrans

**Constat.** Dans `ScratchCard`, le mot est centré sur toute la hauteur de l'écran. Sur un petit écran (360×640 pt, iPhone SE ou Android compact), le bloc du bas le recouvre. Ce bloc contient les réactions, « fond dans N s », la jauge et le bouton « répondre ».

**À faire.**
- Ajoute deux props optionnelles à `ScratchCard` : `safeTop?: number` et `safeBottom?: number` (0 par défaut). Applique-les en `paddingTop` et `paddingBottom` sur le conteneur du mot (`s.msgWrap`). Le mot se centre ainsi dans la zone libre.
- `msgSize(message, width, availH)` : plafonne la taille par la hauteur libre (`availH = height - safeTop - safeBottom`) avec `sqrt(availH × 0,9 × largeurMax / (nbCaractères × 0,8 × 1,08))`. La taille par la largeur reste la même (0,094, 0,078 ou 0,064 × largeur), et le minimum est de 14.
- Dans `read/[id].tsx`, passe :
  - `safeTop = insets.top + 60` ;
  - `safeBottom = hauteur mesurée du bloc du bas + 12`. Mesure-la avec `onLayout` sur `s.bottom`, seulement quand `done && !melted`. Avant la mesure, utilise l'estimation `STICKERS_H + 160`.

**Critère.** À 360×640 et à 393×852, aucun chevauchement entre le mot et les réactions, pour un mot de 30 caractères comme de 90.

## 2. Les 10 secondes doivent faire monter la tension

**À faire** dans `read/[id].tsx` :
- **Jauge** : pleine largeur (`alignSelf: 'stretch'`), 8 pt de haut. Elle se vide de façon continue avec une shared value Reanimated, `withTiming(1, { duration: MELT_S * 1000, easing: Easing.linear })`, et non plus par paliers d'une seconde.
- **Texte « fond dans N s »** : Funnel Sans 800 (`tx.black`) en 15 pt, couleur `colors.vanille`. Ajoute `accessibilityLiveRegion="polite"`.
- **Un tic chaque seconde** : un `useEffect` sur `left` appelle `tick()` (de `lib/haptics`, importé sous le nom `tickHaptic`). Pendant les 3 dernières secondes, il joue aussi `play('tap', 0.35)`. Place les effets de bord dans l'effet, pas dans le `setState`.
- **Les 3 dernières secondes chauffent** (`HOT_S = 3`) :
  - la jauge passe en `colors.cerise` ;
  - le texte passe en `#FF8FA6` (framboise lisible sur nuit) ;
  - un voile `LinearGradient`, de `rgba(255,46,91,0)` à `rgba(255,46,91,0.32)`, monte du bas de l'écran. Il est animé de 0 à 1 avec `withDelay((MELT_S - HOT_S) * 1000, withTiming(1, { duration: HOT_S * 1000, easing: Easing.in(Easing.quad) }))` et affiché seulement quand `done && !melted`, avec `pointerEvents="none"`.

**Critère** : on sent la fin arriver. Il y a une vibration par seconde, puis à 3 s la jauge, le texte et le bas de l'écran passent en framboise.

## 3. Les réactions arrivent après la lecture

**Constat** : les 5 autocollants apparaissent en même temps que le mot et lui volent l'attention.

**À faire** :
- Ajoute `REACT_DELAY_MS = 2500` et un état `showReacts`, passé à `true` par un `setTimeout` après `done`.
- Pour que le mot ne bouge pas à l'arrivée des autocollants, réserve leur place : un conteneur `minHeight: STICKERS_H` (146 pt) dans lequel `<Stickers />` ne se monte que quand `showReacts` est vrai. L'animation d'entrée `ZoomIn` existante joue alors au bon moment.
- Annule le timeout au démontage.

**Critère** : le mot est seul pendant 2,5 s, puis les réactions arrivent une par une, sans que le mot bouge.

## 4. « lire sans gratter » devient discret

**Constat** : la pastille en verre « lire sans gratter » est aussi visible que le geste principal, alors que l'intérêt de l'app est de gratter.

**À faire** (avant le grattage, quand `progress === 0`) :
- **Mode normal** :
  1. la règle « il fond 10 s après lecture » ;
  2. en dessous, un simple lien texte « lire sans gratter », en Funnel Sans 700 13 pt, couleur `colors.mutedOnDark`, souligné. Il garde `Bounce`, `accessibilityRole="button"`, son label, et `onPress={() => setForce(true)}`.
- **Mode « un seul passage »** : la pastille en verre avec `read.onceHint` reste (c'est une consigne), puis la règle. Pas de lien « lire sans gratter », comme avant.

**Critère** : le lien reste là pour l'accessibilité, mais l'œil va d'abord sur « gratte. ».

---

## Vérifications

- `npx tsc --noEmit` passe sans erreur.
- Puis `npx expo lint`.
- Tester sur un vrai appareil :
  - un petit et un grand écran ;
  - un mot court et un mot long ;
  - « lire sans gratter » et le grattage ;
  - le mode « un seul passage » ;
  - le réglage « réduire les animations » : les animations de fonte existantes le respectent déjà, et le voile peut rester simple.
- Sons coupés dans les réglages : le tic sonore ne doit pas jouer. `play()` le gère déjà.

## Le diff de référence

Il a été produit sur le commit `b6ed1fb` de Sweetin et vérifié : le typecheck passe, et les captures à 360×640 et 393×852 sont bonnes.

```diff
commit dd9145f54e3e31f2a47e92af0b7c2a894a575932
Author: Claude <noreply@anthropic.com>
Date:   Wed Oct 14 16:02:51 2026 +0200

    lecture : le mot ne passe plus sous les réactions, compte à rebours plus tendu, réactions après la lecture, « lire sans gratter » discret
    
    - ScratchCard : props safeTop/safeBottom, le mot se centre dans la zone libre et sa taille est plafonnée par la hauteur (petits écrans).
    - Compte à rebours : jauge pleine largeur et continue, tic haptique chaque seconde, les 3 dernières en framboise (jauge, texte, voile en bas) avec un petit son.
    - Réactions : apparaissent 2,5 s après la révélation, place réservée pour que le mot ne bouge pas.
    - « lire sans gratter » : lien souligné discret sous la règle (toujours accessible).
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_015Zzehkn8iCRtp3KdvQmPs8

diff --git a/src/app/read/[id].tsx b/src/app/read/[id].tsx
index d135982..8d39736 100644
--- a/src/app/read/[id].tsx
+++ b/src/app/read/[id].tsx
@@ -28,7 +28,7 @@ import { track } from '../../lib/monitoring';
 import { draft } from '../../lib/draft';
 import { ago, agoShort, seconds } from '../../lib/format';
 import { useTilt } from '../../lib/useTilt';
-import { melt as meltHaptic } from '../../lib/haptics';
+import { melt as meltHaptic, tick as tickHaptic } from '../../lib/haptics';
 import { countRead, maybeAskReview } from '../../lib/review';
 import { play } from '../../lib/sounds';
 import { colors, fonts, tx } from '../../theme';
@@ -36,6 +36,12 @@ import { colors, fonts, tx } from '../../theme';
 const COACH_KEY = 'sweetin.coached';
 /** Le secret se savoure : lisible quelques secondes, puis il fond. */
 const MELT_S = 10;
+/** Les réactions arrivent après ce délai : on laisse d'abord le mot se lire. */
+const REACT_DELAY_MS = 2500;
+/** Les dernières secondes, ça chauffe : la jauge et le bas de l'écran passent en framboise. */
+const HOT_S = 3;
+/** Hauteur réservée aux deux rangées d'autocollants (pour que le mot ne bouge pas quand ils arrivent). */
+const STICKERS_H = 146;
 
 /** Lecture : on gratte la photo pour découvrir le message, puis « Répondre ». */
 export default function Read() {
@@ -61,8 +67,18 @@ export default function Read() {
   const [meltingWord, setMeltingWord] = useState(false);
   const melt = useSharedValue(0);
   const meltStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (melt.value - 1) * (screenH + 200) }] }));
+  // compte à rebours : jauge continue, tic à chaque seconde, ça chauffe à la fin
+  const [showReacts, setShowReacts] = useState(false);
+  const [bottomH, setBottomH] = useState(STICKERS_H + 160); // estimation avant la mesure réelle du bloc du bas
+  const count = useSharedValue(0);
+  const hot = useSharedValue(0);
+  const barStyle = useAnimatedStyle(() => ({ width: `${(1 - count.value) * 100}%` }));
+  const hotStyle = useAnimatedStyle(() => ({ opacity: hot.value }));
   useEffect(() => {
     if (!done) return;
+    count.value = withTiming(1, { duration: MELT_S * 1000, easing: Easing.linear });
+    hot.value = withDelay((MELT_S - HOT_S) * 1000, withTiming(1, { duration: HOT_S * 1000, easing: Easing.in(Easing.quad) }));
+    const rt = setTimeout(() => setShowReacts(true), REACT_DELAY_MS);
     const iv = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
     const to = setTimeout(() => {
       meltHaptic();
@@ -75,8 +91,15 @@ export default function Read() {
     return () => {
       clearInterval(iv);
       clearTimeout(to);
+      clearTimeout(rt);
     };
-  }, [done, melt, screenH]);
+  }, [done, melt, screenH, count, hot]);
+  // un tic à chaque seconde ; les dernières, un petit son en plus
+  useEffect(() => {
+    if (!done || left >= MELT_S || left <= 0) return;
+    tickHaptic();
+    if (left <= HOT_S) play('tap', 0.35);
+  }, [done, left]);
 
   // confidentialité : pas de capture, pas d'aperçu dans le sélecteur d'apps, photo jamais écrite sur le disque
   ScreenCapture.usePreventScreenCapture(`read-${id}`);
@@ -213,8 +236,15 @@ export default function Read() {
               onReveal={onReveal}
               forceReveal={force}
               melting={meltingWord}
+              safeTop={insets.top + 60}
+              safeBottom={bottomH + 12}
             />
           )}
+          {done && !melted && (
+            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, hotStyle]}>
+              <LinearGradient colors={['rgba(255,46,91,0)', 'rgba(255,46,91,0.32)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
+            </Animated.View>
+          )}
           {done && (
             <View pointerEvents="none" style={[s.meltBox, { width: screenW, height: screenH }]}>
               <Animated.View style={[s.meltLayer, meltStyle]}>
@@ -289,25 +319,34 @@ export default function Read() {
           </Animated.View>
         </>
       ) : (
-        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]} pointerEvents="box-none">
+        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]} pointerEvents="box-none" onLayout={(e) => done && !melted && setBottomH(e.nativeEvent.layout.height)}>
           {done ? (
             <>
-              <Stickers reaction={reaction} onPick={sendReaction} />
-              <Text style={s.status}>{t('read.meltsIn', { s: left })}</Text>
+              {/* la place des réactions est réservée : elles arrivent après la lecture, sans faire bouger le mot */}
+              <View style={s.stickersBox}>{showReacts ? <Stickers reaction={reaction} onPick={sendReaction} /> : null}</View>
+              <Text style={[s.status, left <= HOT_S && s.statusHot]} accessibilityLiveRegion="polite">
+                {t('read.meltsIn', { s: left })}
+              </Text>
               <View style={s.meltBar}>
-                <View style={[s.meltFill, { width: `${(left / MELT_S) * 100}%` }]} />
+                <Animated.View style={[s.meltFill, left <= HOT_S && s.meltFillHot, barStyle]} />
               </View>
               <Button label={t('read.reply')} tone="vanille" onPress={reply} style={{ alignSelf: 'stretch' }} />
             </>
           ) : flip && photo ? (
             progress === 0 ? (
               <>
-                <Bounce onPress={() => setForce(true)} accessibilityRole="button" accessibilityLabel={t('read.noScratch')}>
+                {/* le geste, c'est gratter : « lire sans gratter » reste là (accessibilité) mais en simple lien discret */}
+                {flip.mode === 'once' ? (
                   <Glass style={s.hintRow}>
-                    <Text style={s.hintT}>{flip.mode === 'once' ? t('read.onceHint') : t('read.noScratch')}</Text>
+                    <Text style={s.hintT}>{t('read.onceHint')}</Text>
                   </Glass>
-                </Bounce>
+                ) : null}
                 <Text style={s.rule}>{t('read.meltRule', { s: MELT_S })}</Text>
+                {flip.mode !== 'once' ? (
+                  <Bounce onPress={() => setForce(true)} accessibilityRole="button" accessibilityLabel={t('read.noScratch')} style={s.noScratch}>
+                    <Text style={s.noScratchT}>{t('read.noScratch')}</Text>
+                  </Bounce>
+                ) : null}
               </>
             ) : (
               <Glass style={[s.hintRow, { marginBottom: 30 }]}>
@@ -378,10 +417,15 @@ const s = StyleSheet.create({
   rule: { ...tx.bold, fontSize: 12, color: colors.mutedOnDark, marginBottom: 14 },
   progTrack: { width: 90, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
   progFill: { height: 5, borderRadius: 3, backgroundColor: colors.cerise },
-  status: { ...tx.bold, fontSize: 13, color: colors.mutedOnDark },
+  status: { ...tx.black, fontSize: 15, color: colors.vanille },
+  statusHot: { color: '#FF8FA6' },
+  stickersBox: { minHeight: STICKERS_H, justifyContent: 'center' },
+  noScratch: { paddingVertical: 6, paddingHorizontal: 12, marginTop: -8, marginBottom: 8 },
+  noScratchT: { ...tx.bold, fontSize: 13, color: colors.mutedOnDark, textDecorationLine: 'underline' },
   stickers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, rowGap: 6, paddingVertical: 4 },
-  meltBar: { width: 160, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
-  meltFill: { height: 6, borderRadius: 3, backgroundColor: colors.citron },
+  meltBar: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
+  meltFill: { height: 8, borderRadius: 4, backgroundColor: colors.citron },
+  meltFillHot: { backgroundColor: colors.cerise },
   err: { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
   errSub: { ...tx.bold, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
 });
diff --git a/src/components/ScratchCard.tsx b/src/components/ScratchCard.tsx
index 410ebc9..c732c06 100644
--- a/src/components/ScratchCard.tsx
+++ b/src/components/ScratchCard.tsx
@@ -51,13 +51,16 @@ type Props = {
   forceReveal?: boolean;
   /** Le mot fond : chaque lettre coule et s'efface, en cascade (1,2 s). */
   melting?: boolean;
+  /** Place prise en haut (en-tête) et en bas (réactions, compte à rebours, bouton) : le mot se centre entre les deux, sans jamais passer dessous. */
+  safeTop?: number;
+  safeBottom?: number;
 };
 
 /**
  * La photo est dessinée sur le GPU (Skia) au-dessus du dos de la carte, avec un reflet holographique qui suit l'inclinaison.
  * Le doigt efface la photo avec un pinceau doux et laisse des paillettes ; au moment où le message apparaît, la carte éclate en confettis.
  */
-export function ScratchCard({ photo, message, mode, width, height, radius = 16, showHint, tilt, onFirstTouch, onProgress, onReveal, forceReveal, melting }: Props) {
+export function ScratchCard({ photo, message, mode, width, height, radius = 16, showHint, tilt, onFirstTouch, onProgress, onReveal, forceReveal, melting, safeTop = 0, safeBottom = 0 }: Props) {
   const reduce = useReducedMotion();
   const strokes = useRef<{ x: number; y: number }[][]>([]);
   const grid = useRef(new Uint8Array(COLS * ROWS));
@@ -261,8 +264,8 @@ export function ScratchCard({ photo, message, mode, width, height, radius = 16,
     <View style={{ width, height, overflow: 'hidden', borderRadius: radius, backgroundColor: colors.coeur }}>
       {/* dos de la carte : le cœur (DA Fondant), nuit, le message en display blanc */}
       <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.coeur }]}>
-        <Animated.View style={[s.msgWrap, msgStyle]} accessibilityElementsHidden={!revealed.current} importantForAccessibility={revealed.current ? 'auto' : 'no-hide-descendants'}>
-          <MeltingWord text={message} style={[s.msg, msgSize(message, width)]} melt={meltP} reduce={reduce} />
+        <Animated.View style={[s.msgWrap, { paddingTop: safeTop, paddingBottom: safeBottom }, msgStyle]} accessibilityElementsHidden={!revealed.current} importantForAccessibility={revealed.current ? 'auto' : 'no-hide-descendants'}>
+          <MeltingWord text={message} style={[s.msg, msgSize(message, width, height - safeTop - safeBottom)]} melt={meltP} reduce={reduce} />
         </Animated.View>
       </View>
 
@@ -351,12 +354,18 @@ function Letter({ ch, index, total, melt, reduce, style }: { ch: string; index:
   );
 }
 
-/** Taille du message : grande sur une petite phrase, proportionnelle à la largeur de la carte. */
-function msgSize(message: string, width: number) {
+/**
+ * Taille du message : grande sur une petite phrase, proportionnelle à la largeur de la carte,
+ * et plafonnée par la hauteur libre (petits écrans : le mot ne doit jamais passer sous les réactions).
+ */
+function msgSize(message: string, width: number, availH = Infinity) {
   // Climate Crisis est très large : tailles plus petites qu'avec une fonte normale
   const k = message.length > 60 ? 0.064 : message.length > 30 ? 0.078 : 0.094;
-  const size = Math.round(width * k);
-  return { fontSize: size, lineHeight: Math.round(size * 1.08), maxWidth: width * 0.86 };
+  const maxW = width * 0.86;
+  // une lettre fait environ 0,8 em : lignes ≈ longueur × 0,8 × taille / largeur ; hauteur = lignes × 1,08 × taille
+  const byHeight = availH > 0 && Number.isFinite(availH) ? Math.sqrt((availH * 0.9 * maxW) / (Math.max(1, message.length) * 0.8 * 1.08)) : Infinity;
+  const size = Math.max(14, Math.round(Math.min(width * k, byHeight)));
+  return { fontSize: size, lineHeight: Math.round(size * 1.08), maxWidth: maxW };
 }
 
 /** Doigt fantôme qui montre le geste à la première ouverture. */
```
