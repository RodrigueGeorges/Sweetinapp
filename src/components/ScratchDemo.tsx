import { Canvas, Circle, Group, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { play, scratchLoop } from '../lib/sounds';
import { signature, tick as scratchTick } from '../lib/haptics';
import { useScratchTexture } from '../lib/texture';
import { colors, fonts, motion } from '../theme';

const CYCLE = 4800;
const COLS = 12;
const ROWS = 15;
const REVEAL_AT = 0.42;

type Props = {
  width: number;
  message: string;
  /** Appelé une fois, quand la personne a gratté assez pour lire le secret. */
  onReveal?: () => void;
};

/**
 * Démo de l'accueil. Tant qu'on n'y touche pas, un doigt fantôme gratte la photo et révèle le secret, en boucle.
 * Dès qu'on pose le doigt, c'est la personne qui gratte : son, vibrations, et le secret reste quand il est lu.
 */
export function ScratchDemo({ width, message, onReveal }: Props) {
  const reduce = useReducedMotion();
  const texture = useScratchTexture();
  const pw = width;
  const ph = pw * 1.22;
  const brush = pw * 0.24;

  // ---------- démo automatique ----------
  const pts = useMemo(() => {
    const rows = 6;
    const out: [number, number][] = [];
    for (let i = 0; i < rows; i++) {
      const y = ph * (0.14 + (0.72 * i) / (rows - 1));
      out.push(i % 2 ? [pw * 0.86, y] : [pw * 0.14, y]);
      out.push(i % 2 ? [pw * 0.14, y + ph * 0.05] : [pw * 0.86, y + ph * 0.05]);
    }
    return out;
  }, [pw, ph]);
  const autoPath = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) b.lineTo(x, y);
    return b.detach();
  }, [pts]);
  const cum = useMemo(() => {
    const c = [0];
    for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return c;
  }, [pts]);

  const t = useSharedValue(reduce ? 0.5 : 0);
  // doigt posé : le fantôme se cache pendant le grattage réel et reprend si on lâche sans avoir lu
  const down = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
  }, [reduce, t]);
  // 0 → 0,12 : attente ; 0,12 → 0,62 : grattage ; puis le secret reste lisible ; 0,88 → 1 : la photo revient
  const progress = useDerivedValue(() => (reduce ? 0.7 : Math.min(1, Math.max(0, (t.value - 0.12) / 0.5))));
  const cover = useDerivedValue(() => (reduce ? 0 : Math.min(1, Math.max(0, (t.value - 0.88) / 0.1))));
  const finger = useAnimatedStyle(() => {
    const total = cum[cum.length - 1];
    const d = progress.value * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / Math.max(1, cum[i] - cum[i - 1]);
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
    const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
    const on = t.value > 0.08 && t.value < 0.66 && !reduce && !down.value;
    return { opacity: on ? 1 : 0, transform: [{ translateX: x - 20 }, { translateY: y - 20 }] };
  });

  // ---------- grattage à la main ----------
  const [user, setUser] = useState(false);
  const [tick, setTick] = useState(0);
  const [full, setFull] = useState(false);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const grid = useRef(new Uint8Array(COLS * ROWS));
  const covered = useRef(0);
  const step = useRef(0);
  const done = useRef(false);
  const frame = useRef<number | null>(null);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const userPath = useMemo(() => {
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
    const r = brush / 2;
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
      signature();
      // on efface le reste de la photo d'un coup, le secret saute un peu
      strokes.current.push([{ x: pw / 2, y: ph / 2 }]);
      pop.value = 0.92;
      pop.value = withSpring(1, motion.pop);
      setFull(true);
      onReveal?.();
    }
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (done.current) return;
      down.value = 1;
      if (!user) {
        setUser(true);
        cancelAnimation(t);
      }
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
      down.value = 0;
      // lâché avant la lecture : la boucle fantôme reprend par-dessus les traces laissées
      if (!done.current) t.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
    });

  useEffect(() => () => scratchLoop.stop(), []);

  const photo = (
    <>
      <Rect x={0} y={0} width={pw} height={ph}>
        <LinearGradient start={vec(0, 0)} end={vec(0, ph)} colors={['#6B5BD6', '#C86FB0', '#FF8A7A', '#FFC07A', '#1E8C92', '#12707A', '#F2D3A5', '#E8C08F']} positions={[0, 0.26, 0.44, 0.55, 0.56, 0.72, 0.73, 1]} />
      </Rect>
      <Circle cx={pw * 0.68} cy={ph * 0.36} r={pw * 0.09} color="#FFF1C9" />
      <Rect x={pw * 0.2} y={ph * 0.6} width={pw * 0.07} height={ph * 0.14} color="#3B1E3A" />
      <Rect x={pw * 0.29} y={ph * 0.63} width={pw * 0.06} height={ph * 0.11} color="#3B1E3A" />
      <Rect x={0} y={0} width={pw} height={ph} opacity={0.35}>
        <LinearGradient start={vec(0, 0)} end={vec(pw, ph * 0.75)} colors={['#FFFFFF00', '#FFFFFF', '#FFE6EB', '#FFF7F9', '#FFFFFF00']} positions={[0.2, 0.38, 0.48, 0.58, 0.75]} />
      </Rect>
    </>
  );

  return (
    <View style={{ width, transform: [{ rotate: '-3deg' }] }} accessible accessibilityRole="image" accessibilityLabel={message}>
      <View style={s.card}>
        <GestureDetector gesture={pan}>
          <View style={{ width: pw, height: ph, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.coeur, borderWidth: 5, borderColor: colors.white }}>
            <Animated.View style={[StyleSheet.absoluteFill, s.msgWrap, popStyle]}>
              <Text style={[s.msg, { fontSize: pw * 0.088, lineHeight: pw * 0.096 }]}>{message}</Text>
            </Animated.View>
            {!full && (
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                {user ? (
                  <Group layer>
                    {photo}
                    <Path path={userPath} style="stroke" strokeWidth={brush} strokeCap="round" strokeJoin="round" color="black" blendMode="clear" />
                  </Group>
                ) : (
                  <>
                    <Group layer>
                      {photo}
                      <Path path={autoPath} style="stroke" strokeWidth={brush} strokeCap="round" strokeJoin="round" color="black" blendMode="clear" start={0} end={progress} />
                    </Group>
                    <Group opacity={cover}>{photo}</Group>
                  </>
                )}
              </Canvas>
            )}
            {!full && <Animated.View pointerEvents="none" style={[s.finger, finger]} />}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // carte photo nette, ombre douce (pas de contour ni d'ombre dure)
  card: { borderRadius: 28, backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
  msgWrap: { alignItems: 'flex-start', justifyContent: 'center', padding: 18 },
  // le cœur (DA Fondant) : message en display blanc sur nuit
  msg: { fontFamily: fonts.display, includeFontPadding: false, color: colors.onCoeur, textAlign: 'left' },
  finger: { position: 'absolute', left: 0, top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 7, borderColor: 'rgba(255,255,255,0.45)', shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 10 },
});
