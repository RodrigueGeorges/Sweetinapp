import { useTheme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Emplacement de chargement avec un reflet qui balaie la forme, au lieu d'une roue qui tourne. */
export function Shimmer({ style, base, light = false }: { style?: StyleProp<ViewStyle>; base?: string; light?: boolean }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1);
  }, [reduce, t]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + t.value * 200}%` }] }));
  const shine = light ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
  return (
    <View style={[{ backgroundColor: base ?? colors.card, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient colors={['transparent', shine, 'transparent']} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}
