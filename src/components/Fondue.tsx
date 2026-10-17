import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';
import { Mark } from './Logo';

export type FondueMood = 'happy' | 'melt' | 'shock' | 'wait' | 'party' | 'sad';

/**
 * Fondue : la glace de la marque dans une pastille framboise douce, qui bouge selon l'humeur
 * (écrans vides, célébration, erreurs). Sobre, sans visage ; même interface (mood, size, bg) que la future version animée.
 * Rien ne bouge si « réduire les animations ».
 */
export function Fondue({ mood = 'happy', size = 120, bg = colors.paper }: { mood?: FondueMood; size?: number; bg?: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const d = mood === 'party' ? 520 : mood === 'shock' ? 90 : 1500;
    t.value = withRepeat(withSequence(withTiming(1, { duration: d, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: d, easing: Easing.inOut(Easing.quad) })), mood === 'shock' ? 6 : -1);
  }, [reduce, mood, t]);
  const move = useAnimatedStyle(() => {
    const v = t.value;
    switch (mood) {
      case 'party':
        return { transform: [{ translateY: -v * size * 0.08 }, { scaleY: 1 + v * 0.06 }, { scaleX: 1 - v * 0.04 }] };
      case 'melt':
        return { transform: [{ translateY: v * size * 0.04 }, { scaleY: 1 + v * 0.12 }, { scaleX: 1 - v * 0.05 }] };
      case 'shock':
        return { transform: [{ translateX: (v - 0.5) * size * 0.04 }] };
      case 'sad':
        return { transform: [{ rotate: `${-4 + v * 4}deg` }, { translateY: v * size * 0.015 }] };
      default:
        return { transform: [{ translateY: -v * size * 0.025 }] };
    }
  });
  const onBrand = bg === colors.cerise || bg === colors.coeur;
  // boule framboise (ou blanche sur la marque), cornet nuit : les découpes sont dans le dessin
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: onBrand ? 'rgba(255,255,255,0.1)' : colors.brandTint }}
    >
      <Animated.View style={move}>
        <Mark size={size * 0.56} color={colors.cerise} cone={colors.cacao} />
      </Animated.View>
    </View>
  );
}
