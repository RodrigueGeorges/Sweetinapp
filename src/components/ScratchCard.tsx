import { Blur, BlurMask, Canvas, createPicture, Group, Image as SkiaImage, Path, Picture, Rect, Skia, useClock, type SkImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { colors, fonts, motion } from '../theme';
import { HoloFill } from './Holo';
import { play, scratchLoop } from '../lib/sounds';

const COLS = 24;
const ROWS = 32;
const REVEAL_AT = 62;
/** En plein écran, la surface est 2,5 fois plus grande : on révèle plus tôt, avec un doigt plus large. */
const REVEAL_AT_FULL = 46;
const SPARK_COLORS = ['#FFFFFF', '#FF8FB8', '#C6F36B', '#FFF1A8', '#BDEBFF'];

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
};

/**
 * La photo est dessinée sur le GPU (Skia) au-dessus du dos de la carte, avec un reflet holographique qui suit l'inclinaison.
 * Le doigt efface la photo avec un pinceau doux et laisse des paillettes ; au moment où le message apparaît, la carte éclate en confettis.
 */
export function ScratchCard({ photo, message, mode, width, height, radius = 16, showHint, tilt, onFirstTouch, onProgress, onReveal }: Props) {
  const reduce = useReducedMotion();
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
  const msgStyle = useAnimatedStyle(() => ({ transform: [{ scale: msg.value }] }));

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
    const p = Skia.Path.Make();
    for (const s of strokes.current) {
      if (!s.length) continue;
      p.moveTo(s[0].x, s[0].y);
      p.lineTo(s[0].x + 0.1, s[0].y);
      for (let i = 1; i < s.length; i++) p.lineTo(s[i].x, s[i].y);
    }
    return p;
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
      scratchTick();
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
    scratchLoop.stop();
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
      trail(e.x, e.y);
      redraw();
      if (mode === 'free' && percent() >= revealAt) reveal();
    })
    .onFinalize(() => {
      scratchLoop.stop();
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
    <View style={{ width, height, overflow: 'hidden', borderRadius: radius, backgroundColor: colors.vanille }}>
      {/* dos de la carte : la photo givrée (floutée sur le GPU, sans fichier) + le message */}
      <View style={StyleSheet.absoluteFill}>
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage image={photo} x={0} y={0} width={width} height={height} fit="cover">
            <Blur blur={22} mode="clamp" />
          </SkiaImage>
          <Rect x={0} y={0} width={width} height={height} color="rgba(255,244,230,0.82)" />
        </Canvas>
        <Animated.View style={[s.msgWrap, msgStyle]} accessibilityElementsHidden={!revealed.current} importantForAccessibility={revealed.current ? 'auto' : 'no-hide-descendants'}>
          <Text style={[s.msg, msgSize(message, width)]} maxFontSizeMultiplier={1.3}>
            {message}
          </Text>
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
                {!reduce ? <HoloFill width={width} height={height} tilt={tilt} strength={0.9} /> : null}
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

/** Taille du message : grande sur une petite phrase, proportionnelle à la largeur de la carte. */
function msgSize(message: string, width: number) {
  const k = message.length > 60 ? 0.072 : message.length > 30 ? 0.088 : 0.108;
  const size = Math.round(width * k);
  return { fontSize: size, lineHeight: Math.round(size * 1.06), maxWidth: width * 0.84 };
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
  msgWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 32, lineHeight: 34, letterSpacing: -0.6, color: colors.cacao, textAlign: 'center' },
  ghost: { position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 8, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 12 },
});
