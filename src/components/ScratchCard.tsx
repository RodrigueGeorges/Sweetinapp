import { BlurMask, Canvas, createPicture, Group, Image as SkiaImage, Path, Picture, Skia, useClock, type SkImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { t } from '../i18n';
import type { Mode } from '../lib/api';
import { signature, tick as scratchTick } from '../lib/haptics';
import { useScratchTexture } from '../lib/texture';
import { colors, fonts, motion } from '../theme';
import { HoloFill } from './Holo';
import { play, scratchLoop } from '../lib/sounds';

const COLS = 24;
const ROWS = 32;
const REVEAL_AT = 62;
/** En plein écran, la surface est 2,5 fois plus grande : on révèle plus tôt, avec un doigt plus large. */
const REVEAL_AT_FULL = 46;
const SPARK_COLORS = ['#FFFFFF', '#FFFFFF', '#FFE6EB', '#E8FF5A', '#FFF7F9']; // miettes de sucre givré

type Spark = { x: number; y: number; vx: number; vy: number; t0: number; life: number; r: number; c: number; g: number };
type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

type Props = {
  /** Photo décodée en mémoire (jamais écrite sur le disque, voir lib/image). */
  photo: SkImage;
  message: string;
  mode: Mode;
  width: number;
  height: number;
  /** coins arrondis (0 en plein écran) */
  radius?: number;
  showHint: boolean;
  tilt: Tilt;
  onFirstTouch?: () => void;
  onProgress?: (percent: number) => void;
  onReveal: (percent: number, durationMs: number) => void;
  /** « lire sans gratter » : passe à vrai pour révéler d'un coup (accessibilité, appui long). */
  forceReveal?: boolean;
  /** Le mot fond : chaque lettre coule et s'efface, en cascade (1,2 s). */
  melting?: boolean;
  /** Place prise en haut (en-tête) et en bas (réactions, compte à rebours, bouton) : le mot se centre entre les deux, sans jamais passer dessous. */
  safeTop?: number;
  safeBottom?: number;
  /** Placement choisi par l'expéditeur (décalage relatif au centre + échelle), sinon le mot se centre tout seul. */
  wordStyle?: { x: number; y: number; scale: number } | null;
};

/**
 * La photo est dessinée sur le GPU (Skia) au-dessus du dos de la carte, avec un reflet holographique qui suit l'inclinaison.
 * Le doigt efface la photo avec un pinceau doux et laisse des paillettes ; au moment où le message apparaît, la carte éclate en confettis.
 */
export function ScratchCard({ photo, message, mode, width, height, radius = 16, showHint, tilt, onFirstTouch, onProgress, onReveal, forceReveal, melting, safeTop = 0, safeBottom = 0, wordStyle }: Props) {
  const reduce = useReducedMotion();
  const texture = useScratchTexture();
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const grid = useRef(new Uint8Array(COLS * ROWS));
  const covered = useRef(0);
  const step = useRef(0);
  const startedAt = useRef(0);
  const revealed = useRef(false);
  const frame = useRef<number | null>(null);
  const moves = useRef(0);
  const [tick, setTick] = useState(0);
  const [touched, setTouched] = useState(false);
  const full = width >= 360;
  const brush = width * (full ? 0.24 : 0.2);
  const revealAt = full ? REVEAL_AT_FULL : REVEAL_AT;

  // recto qui s'efface, message qui arrive avec un ressort
  const front = useSharedValue(1);
  const msg = useSharedValue(0.9);
  const frontStyle = useAnimatedStyle(() => ({ opacity: front.value }));
  const wx = wordStyle?.x ?? 0;
  const wy = wordStyle?.y ?? 0;
  const ws = wordStyle?.scale ?? 1;
  const msgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: wx * width }, { translateY: wy * height }, { scale: msg.value * ws }] }));
  // fonte du mot, de 0 à 1
  const meltP = useSharedValue(0);
  useEffect(() => {
    if (melting) meltP.value = withTiming(1, { duration: reduce ? 400 : 1200, easing: Easing.in(Easing.quad) });
  }, [melting, meltP, reduce]);

  // paillettes et confettis, animés sur le thread UI
  const clock = useClock();
  const sparks = useSharedValue<Spark[]>([]);
  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const now = clock.value;
      const paint = Skia.Paint();
      for (const p of sparks.value) {
        const age = (now - p.t0) / p.life;
        if (age < 0 || age > 1) continue;
        const t = (now - p.t0) / 16;
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * p.g * t * t;
        paint.setColor(Skia.Color(SPARK_COLORS[p.c]));
        paint.setAlphaf(1 - age);
        canvas.drawCircle(x, y, p.r * (1 - age * 0.5), paint);
      }
    }),
  );

  const spawn = (list: Omit<Spark, 't0'>[]) => {
    if (reduce) return;
    const now = clock.value;
    const alive = sparks.value.filter((p) => now - p.t0 < p.life);
    sparks.value = [...alive, ...list.map((p) => ({ ...p, t0: now }))].slice(-160);
  };

  const path = useMemo(() => {
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

  const percent = () => Math.round((covered.current / (COLS * ROWS)) * 100);

  const mark = (x: number, y: number) => {
    const r = brush / 2;
    const cw = width / COLS;
    const ch = height / ROWS;
    const c0 = Math.max(0, Math.floor((x - r) / cw));
    const c1 = Math.min(COLS - 1, Math.floor((x + r) / cw));
    const r0 = Math.max(0, Math.floor((y - r) / ch));
    const r1 = Math.min(ROWS - 1, Math.floor((y + r) / ch));
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const cx = (col + 0.5) * cw;
        const cy = (row + 0.5) * ch;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) {
          const i = row * COLS + col;
          if (!grid.current[i]) {
            grid.current[i] = 1;
            covered.current++;
          }
        }
      }
    const pct = percent();
    const s = Math.floor(pct / 10);
    if (s > step.current) {
      step.current = s;
      if (!texture) scratchTick(); // avec le grain continu, pas de tic en plus

      onProgress?.(pct);
    }
  };

  const redraw = () => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setTick((t) => t + 1);
    });
  };

  const trail = (x: number, y: number) => {
    if (++moves.current % 2) return;
    spawn(
      Array.from({ length: 2 }, () => ({
        x,
        y,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -0.6 - Math.random() * 1.6,
        g: 0.04,
        life: 500 + Math.random() * 400,
        r: 1.2 + Math.random() * 2.2,
        c: Math.floor(Math.random() * SPARK_COLORS.length),
      })),
    );
  };

  const reveal = (forcedPct?: number) => {
    if (revealed.current) return;
    revealed.current = true;
    setTouched(true); // le doigt d'aide disparaît, y compris après « lire sans gratter »
    scratchLoop.stop();
    texture?.end();
    play('reveal');
    if (!startedAt.current) startedAt.current = Date.now();
    const pct = forcedPct ?? percent();
    signature();
    front.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    msg.value = withDelay(120, withSpring(1, motion.pop));
    spawn(
      Array.from({ length: 70 }, () => {
        const a = Math.random() * Math.PI * 2;
        const v = 2 + Math.random() * 5;
        return {
          x: width / 2,
          y: height / 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 2,
          g: 0.12,
          life: 900 + Math.random() * 600,
          r: 2 + Math.random() * 3,
          c: Math.floor(Math.random() * SPARK_COLORS.length),
        };
      }),
    );
    onReveal(pct, Date.now() - startedAt.current);
  };

  // « lire sans gratter »
  useEffect(() => {
    if (forceReveal) reveal(100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceReveal]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (revealed.current) return;
      if (!startedAt.current) {
        startedAt.current = Date.now();
        setTouched(true);
        onFirstTouch?.();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scratchLoop.start();
      strokes.current.push([{ x: e.x, y: e.y }]);
      mark(e.x, e.y);
      redraw();
    })
    .onUpdate((e) => {
      if (revealed.current) return;
      const s = strokes.current[strokes.current.length - 1];
      const last = s[s.length - 1];
      const dist = Math.hypot(e.x - last.x, e.y - last.y);
      const n = Math.max(1, Math.ceil(dist / (brush / 4)));
      for (let i = 1; i <= n; i++) mark(last.x + ((e.x - last.x) * i) / n, last.y + ((e.y - last.y) * i) / n);
      s.push({ x: e.x, y: e.y });
      texture?.move(Math.hypot(e.velocityX, e.velocityY) / 1000);
      trail(e.x, e.y);
      redraw();
      if (mode === 'free' && percent() >= revealAt) reveal();
    })
    .onFinalize(() => {
      scratchLoop.stop();
      texture?.end();
      if (revealed.current || !startedAt.current) return;
      if (mode === 'once' || percent() >= revealAt) reveal();
    });

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      scratchLoop.stop();
    },
    [],
  );

  return (
    <View style={{ width, height, overflow: 'hidden', borderRadius: radius, backgroundColor: colors.coeur }}>
      {/* dos de la carte : le cœur (DA Fondant), nuit, le message en display blanc */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.coeur }]}>
        <Animated.View style={[s.msgWrap, { paddingTop: safeTop, paddingBottom: safeBottom }, msgStyle]} accessibilityElementsHidden={!revealed.current} importantForAccessibility={revealed.current ? 'auto' : 'no-hide-descendants'}>
          <MeltingWord text={message} style={[s.msg, msgSize(message, width, height - safeTop - safeBottom)]} melt={meltP} reduce={reduce} />
        </Animated.View>
      </View>

      {/* recto : la photo à effacer, avec son reflet */}
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <GestureDetector gesture={pan}>
          <View
            style={StyleSheet.absoluteFill}
            collapsable={false}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('read.cardA11y')}
            accessibilityHint={t('read.revealA11y')}
            accessibilityActions={[{ name: 'activate', label: t('read.revealA11y') }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && reveal(100)}
          >
            <Canvas style={StyleSheet.absoluteFill}>
              <Group layer>
                <SkiaImage image={photo} x={0} y={0} width={width} height={height} fit="cover" />
                {!reduce ? <HoloFill width={width} height={height} tilt={tilt} strength={0.5} /> : null}
                <Path path={path} style="stroke" strokeWidth={brush} strokeCap="round" strokeJoin="round" color="black" blendMode="clear">
                  <BlurMask blur={brush * 0.12} style="normal" />
                </Path>
              </Group>
            </Canvas>
          </View>
        </GestureDetector>
      </Animated.View>

      {/* paillettes au-dessus de tout, sans capter les touches */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </View>

      {showHint && !touched && <GhostFinger width={width} height={height} />}
    </View>
  );
}

/**
 * Le mot, lettre par lettre, pour pouvoir le faire fondre : chaque lettre coule vers le bas, s'étire et s'efface,
 * en cascade de la première à la dernière. Le lecteur d'écran lit le mot entier.
 */
function MeltingWord({ text, style, melt, reduce }: { text: string; style: StyleProp<TextStyle>; melt: SharedValue<number>; reduce: boolean }) {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  const total = text.length;
  let i = 0;
  return (
    <View style={s.word} accessible accessibilityLabel={text}>
      {words.map((w, wi) => {
        if (/^\s+$/.test(w)) {
          i += w.length;
          return <Text key={`s${wi}`} style={style}>{' '}</Text>;
        }
        const start = i;
        i += w.length;
        return (
          <View key={`w${wi}`} style={{ flexDirection: 'row' }}>
            {Array.from(w).map((ch, ci) => (
              <Letter key={ci} ch={ch} index={start + ci} total={total} melt={melt} reduce={reduce} style={style} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Letter({ ch, index, total, melt, reduce, style }: { ch: string; index: number; total: number; melt: SharedValue<number>; reduce: boolean; style: StyleProp<TextStyle> }) {
  const st = useAnimatedStyle(() => {
    // chaque lettre part un peu après la précédente ; les dernières finissent en même temps que la fonte
    const spread = 0.55;
    const local = Math.min(1, Math.max(0, (melt.value * (1 + spread) - (index / Math.max(1, total)) * spread)));
    if (reduce) return { opacity: 1 - melt.value };
    return {
      opacity: 1 - local * local,
      transform: [{ translateY: local * local * 70 }, { scaleY: 1 + local * 0.9 }, { scaleX: 1 - local * 0.25 }],
    };
  });
  return (
    <Animated.Text style={[style, st, { transformOrigin: 'top' }]} allowFontScaling={false} importantForAccessibility="no">
      {ch}
    </Animated.Text>
  );
}

/**
 * Taille du message : grande sur une petite phrase, proportionnelle à la largeur de la carte,
 * et plafonnée par la hauteur libre (petits écrans : le mot ne doit jamais passer sous les réactions).
 */
function msgSize(message: string, width: number, availH = Infinity) {
  // Climate Crisis est très large : tailles plus petites qu'avec une fonte normale
  const k = message.length > 60 ? 0.064 : message.length > 30 ? 0.078 : 0.094;
  const maxW = width * 0.86;
  // une lettre fait environ 0,8 em : lignes ≈ longueur × 0,8 × taille / largeur ; hauteur = lignes × 1,08 × taille
  const byHeight = availH > 0 && Number.isFinite(availH) ? Math.sqrt((availH * 0.9 * maxW) / (Math.max(1, message.length) * 0.8 * 1.08)) : Infinity;
  const size = Math.max(14, Math.round(Math.min(width * k, byHeight)));
  return { fontSize: size, lineHeight: Math.round(size * 1.08), maxWidth: maxW };
}

/** Doigt fantôme qui montre le geste à la première ouverture. */
function GhostFinger({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) })), -1);
  }, [t]);
  const style = useAnimatedStyle(() => {
    const k = t.value;
    const pts = [
      [0.25, 0.28],
      [0.72, 0.36],
      [0.3, 0.5],
      [0.7, 0.62],
      [0.4, 0.7],
    ];
    const seg = Math.min(3, Math.floor(k * 4));
    const f = k * 4 - seg;
    const x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * f;
    const y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * f;
    const o = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    return { opacity: o, transform: [{ translateX: x * width - 22 }, { translateY: y * height - 22 }] };
  });
  return <Animated.View pointerEvents="none" style={[s.ghost, style]} />;
}

const s = StyleSheet.create({
  word: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%' },
  msgWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 28 },
  // le cœur : le message en Climate Crisis blanc sur nuit, calé à gauche
  msg: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 24, lineHeight: 28, color: colors.onCoeur, textAlign: 'left' },
  ghost: { position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 8, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 12 },
});
