import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Matière « verre » pour ce qui flotte au-dessus d'une photo (boutons, pastilles, réactions) :
 * Liquid Glass sur iOS 26, flou sombre ailleurs, voile translucide sur le web.
 */
export function Glass({ children, style, interactive }: { children?: ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (liquid) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={[style, { overflow: 'hidden' }]}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'web') return <View style={[style, { backgroundColor: 'rgba(26,10,14,0.42)' }]}>{children}</View>;
  return (
    <View style={[style, { overflow: 'hidden', borderRadius: flat.borderRadius }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(26,10,14,0.18)' }]} />
      {children}
    </View>
  );
}
