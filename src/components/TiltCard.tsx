import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { motion } from '../theme';

type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

/** Carte qui s'incline avec le téléphone (l'ombre dure de la DA est dessinée par la carte elle-même). */
export function TiltCard({ tilt, style, children }: { tilt: Tilt; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const anim = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${tilt.x.value * motion.tiltMax}deg` }, { rotateX: `${-tilt.y.value * motion.tiltMax}deg` }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
