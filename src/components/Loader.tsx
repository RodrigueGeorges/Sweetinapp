import { useEffect } from 'react';
import Reanimated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Mark } from './Logo';
import { colors } from '../theme';

/**
 * Le chargement signature : la glace se tasse et rebondit doucement, comme une boule posée.
 * Remplace les roues natives sur les écrans d'attente (jamais dans un bouton : là, la roue reste).
 */
export function Loader({ size = 40, color = colors.cerise, cone = colors.cacao }: { size?: number; color?: string; cone?: string }) {
  const reduce = useReducedMotion();
  const a = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    a.value = withRepeat(withSequence(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 750, easing: Easing.inOut(Easing.quad) })), -1);
  }, [a, reduce]);
  const st = useAnimatedStyle(() => ({
    transform: [{ rotate: `${a.value * 14 - 7}deg` }, { scaleX: 1 + a.value * 0.1 }, { scaleY: 1 - a.value * 0.16 }],
  }));
  return (
    <Reanimated.View accessibilityRole="progressbar" accessibilityLabel="chargement" style={st}>
      <Mark size={size} color={color} cone={cone} />
    </Reanimated.View>
  );
}
