import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { DropGlyph } from './Logo';

export type FondueMood = 'happy' | 'melt' | 'shock' | 'wait' | 'party' | 'sad';

/**
 * Fondue : la goutte de la marque, dans une pastille, qui bouge selon l'humeur.
 * Volontairement sobre (pas de visage dessiné en code) ; la version illustrée et animée (Rive) la remplacera
 * avec la même interface (mood, size, bg). Rien ne bouge si « réduire les animations ».
 */
export function Fondue({ mood = 'happy', size = 120, bg }: { mood?: FondueMood; size?: number; bg?: string }) {
  const { colors } = useTheme();
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
        return { transform: [{ rotate: '-14deg' }, { translateY: v * size * 0.015 }] };
      default:
        return { transform: [{ translateY: -v * size * 0.025 }] };
    }
  });
  const onBrand = bg === colors.cerise;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: onBrand ? 'rgba(255,255,255,0.18)' : colors.riskBg }}
    >
      <Animated.View style={move}>
        <DropGlyph size={size * 0.46} color={onBrand ? colors.white : colors.cerise} />
      </Animated.View>
    </View>
  );
}
