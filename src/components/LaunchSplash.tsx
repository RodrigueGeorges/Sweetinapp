import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, useStyles, type Palette } from '../theme';
import { MARK_DROP, MARK_S, MARK_VIEWBOX as MV } from './logoPath';

/** Même largeur que l'image du splash natif (150 px) : le « s. » ne saute pas au passage natif → animé. */
const MW = 150;
const MH = (MW * MV.h) / MV.w;
const VB = `${MV.x} ${MV.y} ${MV.w} ${MV.h}`;

/**
 * Lancement : le « s. » du splash natif rebondit, puis sa goutte tombe et l'écran s'efface. ~1,1 s.
 * Rien ne bouge si « réduire les animations ».
 */
export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const s = useStyles(themed);
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const pop = useSharedValue(0);
  const fall = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      fade.value = withDelay(250, withTiming(0, { duration: 250 }, (f) => f && runOnJS(onDone)()));
      return;
    }
    pop.value = withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 200 }));
    fall.value = withDelay(520, withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) }));
    fade.value = withDelay(860, withTiming(0, { duration: 240 }, (f) => f && runOnJS(onDone)()));
  }, [reduce, pop, fall, fade, onDone]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.08 }] }));
  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fall.value * (height / 2 + MH) }, { scaleY: 1 + fall.value * 0.35 }, { scaleX: 1 - fall.value * 0.12 }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.root, rootStyle]}>
      <View style={s.center}>
        <Animated.View style={[{ width: MW, height: MH }, markStyle]}>
          <Svg width={MW} height={MH} viewBox={VB} style={StyleSheet.absoluteFill}>
            <Path d={MARK_S} fill={colors.white} />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, dropStyle]}>
            <Svg width={MW} height={MH} viewBox={VB}>
              <Path d={MARK_DROP} fill={colors.white} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
    root: { backgroundColor: colors.cerise, zIndex: 100 },
    center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  });
