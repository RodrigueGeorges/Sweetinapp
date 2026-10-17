import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '../theme';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Échelle à l'appui (0.94 par défaut). */
  scaleTo?: number;
  /** Retour haptique à l'appui. */
  haptic?: 'light' | 'medium' | 'selection' | false;
};

/** Bouton qui s'enfonce et rebondit comme un objet physique, avec un petit retour haptique. */
export function Bounce({ style, children, scaleTo = 0.94, haptic = 'selection', onPressIn, onPressOut, disabled, ...rest }: Props) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      style={[style, anim]}
      onPressIn={(e) => {
        // eslint-disable-next-line react-hooks/immutability -- une shared value Reanimated se mute dans les callbacks
        if (!reduce) s.value = withSpring(scaleTo, motion.press);
        if (haptic === 'selection') Haptics.selectionAsync();
        else if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability -- idem
        s.value = withSpring(1, motion.pop);
        onPressOut?.(e);
      }}
    >
      {children}
    </APressable>
  );
}
