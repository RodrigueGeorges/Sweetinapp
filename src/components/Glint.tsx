import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useReducedMotion, type SharedValue } from 'react-native-reanimated';

/**
 * Les cristaux du sucre givré qui accrochent la lumière : chaque cristal a sa facette, il ne s'allume que
 * quand l'inclinaison du téléphone tombe dans son angle. On bouge le téléphone, le sucre scintille, comme une carte holo.
 * Sans capteur (aperçu web) ou immobile : un scintillement lent et rare, jamais une animation qui clignote.
 */
const glint = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float2 tilt;
uniform float t;
uniform float strength;

float2 hash2(float2 p) {
  p = float2(dot(p, float2(127.1, 311.7)), dot(p, float2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

half4 main(float2 p) {
  float size = 16.0;
  float2 cell = floor(p / size);
  float2 r = hash2(cell);
  float2 r2 = hash2(cell + 17.0);
  // un cristal sur trois environ
  if (r.x > 0.36) return half4(0.0);
  float2 c = (cell + 0.25 + r2 * 0.5) * size;
  float2 d = p - c;
  // la facette s'allume quand l'inclinaison passe par son angle ; le temps fait une lente dérive
  float phase = r.y * 6.2831 + tilt.x * 5.0 - tilt.y * 3.6 + t * 0.35;
  float on = pow(max(0.0, sin(phase)), 28.0);
  float rad = 1.4 + r2.x * 2.0;
  float core = exp(-dot(d, d) / (rad * rad));
  // petite étoile à 4 branches pour les plus brillants
  float arms = exp(-abs(d.x) * 0.55) * exp(-d.y * d.y / 0.7) + exp(-abs(d.y) * 0.55) * exp(-d.x * d.x / 0.7);
  float a = clamp((core * 1.3 + arms * 0.9 * step(0.6, r2.y)) * on * strength, 0.0, 1.0);
  // blanc légèrement rosé (sucre framboise), prémultiplié
  half3 col = half3(1.0, 0.94, 0.97);
  return half4(col * a, a);
}
`)!;

type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

export function Glint({ width, height, tilt, strength = 1 }: { width: number; height: number; tilt?: Tilt; strength?: number }) {
  const reduce = useReducedMotion();
  const clock = useClock();
  const uniforms = useDerivedValue(() => ({
    res: [width, height],
    tilt: [tilt ? tilt.x.value : 0, tilt ? tilt.y.value : 0],
    t: reduce ? 0 : clock.value / 1000,
    strength,
  }));
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={glint} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}
