import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Vignettage doux : les bords s'assombrissent à peine, l'œil va au centre —
 * ce qui fait d'un viseur un instrument plutôt qu'un rectangle vidéo.
 */
export function Vignette({ opacity = 0.34, color = '#160F12' }: { opacity?: number; color?: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="v" cx="50%" cy="50%" rx="72%" ry="72%">
          <Stop offset="0.58" stopColor={color} stopOpacity="0" />
          <Stop offset="1" stopColor={color} stopOpacity={opacity} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#v)" />
    </Svg>
  );
}
