import { Blur, Canvas, Circle, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, sorbet } from '../theme';

/**
 * Fond « sorbet » des écrans vitrine (accueil, vitrine, connexion) : un dégradé très doux
 * et trois taches pastel floutées (framboise, citron, ciel) — les couleurs de la marque,
 * en sourdine, pour que l'écran ait la peps de la DA sans nuire à la lecture.
 * Dessiné une fois en Skia : aucune animation, coût quasi nul.
 */
export function Backdrop() {
  const { width, height } = useWindowDimensions();
  const d = Math.max(width, height);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(width * 0.35, height)} colors={sorbet.base} />
        </Rect>
        <Group opacity={0.8}>
          <Circle cx={width * 1.02} cy={height * 0.05} r={d * 0.4} color={sorbet.blobs[0]}>
            <Blur blur={80} />
          </Circle>
          <Circle cx={-width * 0.18} cy={height * 0.45} r={d * 0.3} color={sorbet.blobs[1]}>
            <Blur blur={90} />
          </Circle>
          <Circle cx={width * 0.92} cy={height * 0.98} r={d * 0.36} color={sorbet.blobs[2]}>
            <Blur blur={95} />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
