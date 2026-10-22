import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Group, Image as SkImageView, makeImageFromView, Path as SPath, Rect, Skia, type SkImage } from '@shopify/react-native-skia';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { tick as scratchTick } from '../lib/haptics';
import { track } from '../lib/monitoring';
import { play, scratchLoop } from '../lib/sounds';
import { useScratchTexture } from '../lib/texture';
import { colors, tx } from '../theme';
import { Drip, ICE_RATIO, LOGO_RATIO, Mark } from './Logo';
import { ICE_VIEWBOX as IV, LOGO_I, LOGO_VIEWBOX as V, LOGO_WORD } from './logoPath';

/**
 * Même taille que la glace du splash natif : la glace ne saute pas au passage natif → animé.
 * iOS : 150 pt de large (imageWidth). Android 12+ : 161 dp de haut dans le cercle système (splash-icon-android.png), soit 104 dp de large.
 */
const MW = Platform.OS === 'android' ? 104 : 150;
const MH = MW / ICE_RATIO;
/** Le mot final, centré sur l'écran comme la glace. */
const WW = 260;
const WH = WW / LOGO_RATIO;
/** La glace une fois devenue le i du mot : taille et décalage depuis le centre. */
const IH = (IV.h / V.h) * WH;
const K = IH / MH;
const DX = ((LOGO_I.cx - V.x) / V.w) * WW - WW / 2;
const DY = ((IV.y + IV.h / 2 - V.y) / V.h) * WH - WH / 2;
/** Hauteur des coulures sous le rideau framboise quand il remonte. */
const DRIP_LONG = 1.1;

// ---------- grattage du rideau (première ouverture) ----------
const COLS = 12;
const ROWS = 16;
const REVEAL_AT = 0.35;
const BRUSH = 80;
/** L'intro est posée vers ~0,8 s : on photographie la scène un peu après, avant de laisser gratter. */
const SNAPSHOT_AT = 1050;

/**
 * Lancement (≈ 1,3 s), dans la continuité du splash natif (framboise, glace blanche au centre) :
 * 1. la glace respire (petit écrasement, comme un objet mou) ;
 * 2. elle saute en arc et se pose à la place du i, pendant que les lettres montent de la ligne de base ;
 * 3. elle atterrit (rebond doux, une touche haptique) ;
 * 4. le rideau framboise remonte en coulant (bord en coulures, DA Fondant) et découvre l'app.
 * « Réduire les animations » : le mot apparaît, puis simple fondu.
 *
 * `scratch` (toute première ouverture, pas de session) : le rideau ne remonte pas tout seul,
 * il se GRATTE au doigt comme un ticket — la scène posée est photographiée (Skia) et les traces
 * du doigt sont dessinées en « clear » par-dessus. À 35 % gratté, l'inscription apparaît dessous.
 * Repli : lecteur d'écran ou « réduire les animations » → sortie automatique ; échec du snapshot →
 * simple nappe framboise à gratter (jamais bloqué).
 * Jamais de closure locale dans runOnJS : gestes `.runOnJS(true)` + timers JS uniquement.
 */
export function LaunchSplash({ onDone, scratch = false }: { onDone: () => void; scratch?: boolean }) {
  const reduce = useReducedMotion();
  const { width: pw, height: ph } = useWindowDimensions();
  const texture = useScratchTexture();
  // lecteur d'écran : pas de grattage possible → sortie automatique (web : isScreenReaderEnabled répond toujours oui)
  const [reader, setReader] = useState(false);
  useEffect(() => {
    if (!scratch || Platform.OS === 'web') return;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => setReader(!!on))
      .catch(() => {});
  }, [scratch]);
  const scratchOn = scratch && !reduce && !reader;

  const breathe = useSharedValue(0);
  const fly = useSharedValue(0);
  const word = useSharedValue(0);
  const land = useSharedValue(0);
  const lift = useSharedValue(0);
  const fade = useSharedValue(0);
  const hintOn = useSharedValue(1);
  const pulse = useSharedValue(1);
  const gone = useSharedValue(0);

  // ---------- état du grattage (refs : les gestes tournent sur le thread JS) ----------
  const content = useRef<View>(null);
  const [shot, setShot] = useState<SkImage | 'fallback' | null>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const grid = useRef(new Uint8Array(COLS * ROWS));
  const covered = useRef(0);
  const step = useRef(0);
  const done = useRef(false);
  const frame = useRef<number | null>(null);
  const snapFrame = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!scratchOn) {
      if (reduce) {
        fly.value = 1;
        word.value = 1;
        fade.value = withDelay(500, withTiming(1, { duration: 250 }, (f) => f && runOnJS(onDone)()));
        return;
      }
      breathe.value = withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 8, stiffness: 260 }));
      fly.value = withDelay(260, withTiming(1, { duration: 480, easing: Easing.inOut(Easing.cubic) }));
      word.value = withDelay(430, withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }));
      land.value = withDelay(
        740,
        withSequence(
          withTiming(1, { duration: 70 }, (f) => f && runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light)),
          withSpring(0, { damping: 9, stiffness: 300 }),
        ),
      );
      lift.value = withDelay(1020, withTiming(1, { duration: 440, easing: Easing.inOut(Easing.cubic) }, (f) => f && runOnJS(onDone)()));
      return;
    }
    // même intro, puis la scène devient une image à gratter ; le rideau ne remonte pas
    breathe.value = withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 8, stiffness: 260 }));
    fly.value = withDelay(260, withTiming(1, { duration: 480, easing: Easing.inOut(Easing.cubic) }));
    word.value = withDelay(430, withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }));
    land.value = withDelay(
      740,
      withSequence(
        withTiming(1, { duration: 70 }, (f) => f && runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light)),
        withSpring(0, { damping: 9, stiffness: 300 }),
      ),
    );
    pulse.value = withRepeat(withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
    // l'intro tourne sur le thread UI et peut être en retard (téléphone lent) : on force la pose finale
    // côté JS, on attend deux frames qu'elle s'applique, puis on photographie la scène complète
    const snap = setTimeout(() => {
      cancelAnimation(breathe);
      cancelAnimation(fly);
      cancelAnimation(word);
      cancelAnimation(land);
      breathe.value = 0;
      fly.value = 1;
      word.value = 1;
      land.value = 0;
      snapFrame.current = requestAnimationFrame(() => {
        snapFrame.current = requestAnimationFrame(() => {
          snapFrame.current = null;
          Promise.resolve(makeImageFromView(content))
            .then((img) => setShot(img ?? 'fallback'))
            .catch(() => setShot('fallback'));
        });
      });
    }, SNAPSHOT_AT);
    return () => {
      clearTimeout(snap);
      if (snapFrame.current != null) cancelAnimationFrame(snapFrame.current);
    };
  }, [scratchOn, reduce, breathe, fly, word, land, lift, fade, pulse, onDone]);

  // le rideau (fond framboise + coulures) remonte d'un écran entier, plus la longueur des coulures
  const sheet = useAnimatedStyle(() => ({
    opacity: 1 - fade.value,
    transform: [{ translateY: -lift.value * (ph + 140 * DRIP_LONG) }],
  }));

  const markStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const k = 1 + (K - 1) * f;
    // l'arc : la glace monte un peu avant de redescendre dans le mot
    const arc = -46 * Math.sin(Math.PI * f);
    const b = breathe.value * 0.06 + land.value * 0.12;
    return {
      transform: [{ translateX: DX * f }, { translateY: DY * f + arc }, { scaleX: k * (1 + b) }, { scaleY: k * (1 - b) }],
    };
  });
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: interpolate(word.value, [0, 1], [WH * 0.35, 0]) }],
  }));
  // l'invite est visible d'emblée (opacity pleine) ; la pulsation n'anime que la taille, hintOn ne sert qu'à l'effacer au premier contact
  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOn.value,
    transform: [{ scale: pulse.value }],
  }));
  const outStyle = useAnimatedStyle(() => ({ opacity: 1 - gone.value }));

  // ---------- le grattage lui-même ----------
  const strokesPath = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    for (const s of strokes.current) {
      if (!s.length) continue;
      b.moveTo(s[0].x, s[0].y);
      b.lineTo(s[0].x + 0.1, s[0].y);
      for (let i = 1; i < s.length; i++) b.lineTo(s[i].x, s[i].y);
    }
    return b.detach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const redraw = () => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setTick((n) => n + 1);
    });
  };

  const mark = (x: number, y: number) => {
    const r = BRUSH / 2;
    const cw = pw / COLS;
    const ch = ph / ROWS;
    for (let row = Math.max(0, Math.floor((y - r) / ch)); row <= Math.min(ROWS - 1, Math.floor((y + r) / ch)); row++)
      for (let col = Math.max(0, Math.floor((x - r) / cw)); col <= Math.min(COLS - 1, Math.floor((x + r) / cw)); col++) {
        const cx = (col + 0.5) * cw;
        const cy = (row + 0.5) * ch;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r && !grid.current[row * COLS + col]) {
          grid.current[row * COLS + col] = 1;
          covered.current++;
        }
      }
    const pct = covered.current / (COLS * ROWS);
    const s = Math.floor(pct * 10);
    if (s > step.current) {
      step.current = s;
      if (!texture) scratchTick();
    }
    if (!done.current && pct >= REVEAL_AT) {
      done.current = true;
      scratchLoop.stop();
      texture?.end();
      play('reveal');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('splash_scratched');
      gone.value = withTiming(1, { duration: 260 }, (f) => f && runOnJS(onDone)());
    }
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (done.current) return;
      hintOn.value = withTiming(0, { duration: 200 });
      scratchLoop.start();
      strokes.current.push([{ x: e.x, y: e.y }]);
      mark(e.x, e.y);
      redraw();
    })
    .onUpdate((e) => {
      if (done.current) return;
      strokes.current[strokes.current.length - 1]?.push({ x: e.x, y: e.y });
      texture?.move(Math.hypot(e.velocityX, e.velocityY) / 1000);
      mark(e.x, e.y);
      redraw();
    })
    .onFinalize(() => {
      scratchLoop.stop();
      texture?.end();
    });

  useEffect(() => () => scratchLoop.stop(), []);

  const hint = t('splash.scratch');

  // le rideau framboise : animé en RN tant qu'il n'est pas photographié, image Skia ensuite
  const curtain = (
    <Animated.View style={[StyleSheet.absoluteFill, sheet]}>
      <View ref={content} collapsable={false} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cerise }]} />
        {/* les coulures sous le rideau : elles pendent pendant qu'il remonte */}
        <View style={{ position: 'absolute', top: ph - 1, left: 0, right: 0 }}>
          <DripBand />
        </View>
        <View style={s.center}>
          {/* les lettres seules, qui montent de la ligne de base (masquées en dessous) */}
          <View style={{ width: WW, height: WH, overflow: 'hidden' }}>
            <Animated.View style={wordStyle}>
              <Svg width={WW} height={WH} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}>
                <Path d={LOGO_WORD} fill={colors.white} />
              </Svg>
            </Animated.View>
          </View>
        </View>
        <View style={s.center}>
          <Animated.View style={markStyle}>
            <Mark size={MH} color={colors.white} cone={colors.cacao} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View pointerEvents={scratchOn ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      {scratchOn ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[StyleSheet.absoluteFill, outStyle]} accessible accessibilityLabel={hint}>
            {shot === null ? (
              curtain
            ) : (
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <Group layer>
                  {shot === 'fallback' ? (
                    <Rect x={0} y={0} width={pw} height={ph} color={colors.cerise} />
                  ) : (
                    <SkImageView image={shot} x={0} y={0} width={pw} height={ph} fit="fill" />
                  )}
                  <SPath path={strokesPath} style="stroke" strokeWidth={BRUSH} strokeCap="round" strokeJoin="round" color="black" blendMode="clear" />
                </Group>
              </Canvas>
            )}
            {/* l'invite sous le mot, qui pulse doucement et s'efface dès le premier contact */}
            <Animated.View pointerEvents="none" style={[s.hint, hintStyle]}>
              <Text style={s.hintT}>{hint}</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      ) : (
        curtain
      )}
    </View>
  );
}

/** Bande de coulures framboise (le haut est collé au rideau). */
function DripBand() {
  const { width } = useWindowDimensions();
  return <Drip width={width} depth={2} color={colors.cerise} long={DRIP_LONG} />;
}

const s = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: '60%', left: 0, right: 0, alignItems: 'center' },
  hintT: { ...tx.bold, fontSize: 17, color: colors.white, textShadowColor: 'rgba(0,0,0,0.18)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
});
