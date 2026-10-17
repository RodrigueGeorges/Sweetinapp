import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Text, TextPath } from 'react-native-svg';
import { t } from '../i18n';
import { colors, fonts, isDark } from '../theme';
import { Bounce } from './Bounce';

/**
 * Le déclencheur de la vitrine (DA Fondant) : 84 pt de framboise, la seule grande forme de couleur de l'interface.
 * Hors sweet hour : la devise tourne lentement autour (« gratte · lis · ça fond · »).
 * Pendant le sweet hour, l'anneau devient un compte à rebours (`progress` de 1 à 0) : encre en clair, citron en sombre.
 */
export function Shutter({ onPress, label, progress }: { onPress: () => void; label: string; progress?: number | null }) {
  const live = progress !== null && progress !== undefined;
  const ringColor = isDark ? colors.citron : colors.cacao;
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (live || reduce) return;
    // un tour en 36 s : la devise dérive, presque imperceptiblement
    spin.value = withRepeat(withTiming(360, { duration: 36000, easing: Easing.linear }), -1);
    return () => {
      spin.value = 0;
    };
  }, [live, reduce, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Bounce onPress={onPress} accessibilityRole="button" accessibilityLabel={label} haptic="medium" scaleTo={0.92} style={s.wrap}>
      {live ? (
        <Svg width={112} height={112} viewBox="0 0 112 112" style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
          <Circle cx={56} cy={56} r={51} fill="none" stroke={isDark ? colors.card2 : colors.sand} strokeWidth={6} />
          <Circle cx={56} cy={56} r={51} fill="none" stroke={ringColor} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${Math.max(0.02, progress!) * 320.4} 400`} />
        </Svg>
      ) : (
        <>
          <View style={[s.ring, { borderColor: isDark ? colors.white : colors.cacao }]} />
          <Reanimated.View style={[StyleSheet.absoluteFill, spinStyle]} pointerEvents="none">
            <Svg width={136} height={136} viewBox="0 0 136 136">
              <Defs>
                <Path id="shutterRing" d="M68,68 m-61,0 a61,61 0 1,1 122,0 a61,61 0 1,1 -122,0" />
              </Defs>
              <Text fontSize={9.5} fontFamily={fonts.black} letterSpacing={3.4} fill={isDark ? colors.muted : colors.cacao} opacity={0.72}>
                <TextPath href="#shutterRing">{t('shutter.ring').repeat(2)}</TextPath>
              </Text>
            </Svg>
          </Reanimated.View>
        </>
      )}
      <View style={s.button} />
    </Bounce>
  );
}

const s = StyleSheet.create({
  wrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center' },
  // 84 de framboise + 6 du fond + 3 d'encre
  ring: { position: 'absolute', width: 102, height: 102, borderRadius: 51, borderWidth: 3 },
  button: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.cerise },
});
