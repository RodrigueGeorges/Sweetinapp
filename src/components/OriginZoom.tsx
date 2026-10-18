import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { takeOrigin, type Origin } from '../lib/origin';

/**
 * Android : l'écran s'ouvre depuis la carte touchée. Une fenêtre aux coins arrondis part du cadre de la carte
 * et s'agrandit jusqu'au plein écran, la vitrine s'assombrit derrière. Fermer refait le chemin inverse.
 * iOS (Link.AppleZoom s'en charge), lien ou notification, « réduire les animations » : plein écran direct.
 */
type Ctx = { close: (done: () => void) => void };
const ZoomCtx = createContext<Ctx>({ close: (done) => done() });
export const useOriginZoom = () => useContext(ZoomCtx);

const OPEN = { damping: 22, stiffness: 210, mass: 0.9 };

export function OriginZoom({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  // 'pending' : la carte est encore en train d'être mesurée (une image au plus) ; l'écran reste caché jusque-là
  const [o, setO] = useState<Origin | null | 'pending'>(() => (Platform.OS === 'android' && !reduce ? takeOrigin((late) => setO(late)) : null));
  const p = useSharedValue(o ? 0 : 1);
  const hidden = useSharedValue(o === 'pending' ? 1 : 0);

  useEffect(() => {
    if (o === 'pending') return;
    hidden.value = 0;
    p.value = o ? withSpring(1, OPEN) : 1;
  }, [o, p, hidden]);

  const close = useCallback(
    (done: () => void) => {
      if (!o || o === 'pending') return done();
      p.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(done)();
      });
    },
    [o, p],
  );

  const box = o && o !== 'pending' ? o : null;
  const win = useAnimatedStyle(() => {
    const o = box;
    if (!o) return { left: 0, top: 0, width: W, height: H, borderRadius: 0, opacity: 1 - hidden.value };
    const v = p.value;
    return {
      left: interpolate(v, [0, 1], [o.x, 0]),
      top: interpolate(v, [0, 1], [o.y, 0]),
      width: interpolate(v, [0, 1], [o.w, W]),
      height: interpolate(v, [0, 1], [o.h, H]),
      borderRadius: interpolate(v, [0, 1], [o.r, 0]),
      opacity: 1,
    };
  });
  // le contenu reste à taille réelle et centré sur la fenêtre : on « découvre » l'écran depuis la carte
  const inner = useAnimatedStyle(() => {
    const o = box;
    if (!o) return {};
    const v = p.value;
    const left = interpolate(v, [0, 1], [o.x, 0]);
    const top = interpolate(v, [0, 1], [o.y, 0]);
    const s = interpolate(v, [0, 1], [Math.max(o.w / W, o.h / H), 1]);
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    return {
      transform: [
        { translateX: interpolate(v, [0, 1], [cx - W / 2, 0]) - left },
        { translateY: interpolate(v, [0, 1], [cy - H / 2, 0]) - top },
        { scale: s },
      ],
    };
  });
  const dim = useAnimatedStyle(() => ({ opacity: box ? p.value * 0.55 : 0 }));

  return (
    <ZoomCtx.Provider value={{ close }}>
      <View style={StyleSheet.absoluteFill}>
        {box ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.dim, dim]} /> : null}
        <Animated.View style={[s.win, win]}>
          <Animated.View style={[{ width: W, height: H }, inner]}>{children}</Animated.View>
        </Animated.View>
      </View>
    </ZoomCtx.Provider>
  );
}

const s = StyleSheet.create({
  win: { position: 'absolute', overflow: 'hidden' },
  dim: { backgroundColor: '#000' },
});
