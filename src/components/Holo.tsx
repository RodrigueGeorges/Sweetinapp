import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Reflet holographique calculé sur le GPU : un trait de lumière irisée qui glisse quand on incline le téléphone,
 * plus quelques paillettes qui scintillent. Se dessine en mode « screen » : le noir n'ajoute rien, la lumière s'additionne.
 */
export const holoEffect = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float2 tilt;
uniform float strength;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

half4 main(float2 p) {
  float2 uv = p / res;
  float pos = 0.62 + tilt.x * 0.55 - tilt.y * 0.35;
  float d = uv.x * 0.8 + uv.y * 0.5 - pos;
  float sheen = exp(-d * d * 34.0);
  float core = exp(-d * d * 260.0);
  float3 iri = 0.5 + 0.5 * cos(6.2831 * (uv.x * 0.7 + uv.y * 0.9 + tilt.x * 0.8 + float3(0.0, 0.33, 0.67)));

  // paillettes rondes, visibles surtout dans la lumière, qui scintillent avec l'inclinaison
  float2 cell = floor(p / 7.0);
  float h = hash(cell);
  float2 f = fract(p / 7.0) - 0.5;
  float dot1 = smoothstep(0.32, 0.0, length(f));
  float twinkle = step(0.965, h) * (0.5 + 0.5 * sin(tilt.x * 22.0 + tilt.y * 15.0 + h * 50.0));
  float glit = dot1 * twinkle * (0.25 + sheen * 1.4);

  float3 c = (mix(float3(1.0), iri, 0.6) * sheen * 0.45 + core * 0.35 + iri * 0.04 + glit * 0.8) * strength;
  // couleur prémultipliée, alpha = intensité : le reflet s'ajoute à la photo sans jamais la noircir,
  // y compris dans un Canvas posé par-dessus une image (où il n'y a rien sous le reflet)
  c = clamp(c, 0.0, 1.0);
  return half4(half3(c), max(c.r, max(c.g, c.b)));
}
`)!;

type Tilt = { x: SharedValue<number>; y: SharedValue<number> };

/** À placer DANS un Canvas Skia existant (au-dessus de la photo). */
export function HoloFill({ width, height, tilt, strength = 1 }: { width: number; height: number; tilt: Tilt; strength?: number }) {
  const uniforms = useDerivedValue(() => ({ res: [width, height], tilt: [tilt.x.value, tilt.y.value], strength }));
  return (
    <Fill blendMode="screen">
      <Shader source={holoEffect} uniforms={uniforms} />
    </Fill>
  );
}

/** Calque autonome à poser au-dessus d'une image (ne capte aucune touche). */
export function HoloLayer({ width, height, tilt, strength = 1 }: { width: number; height: number; tilt: Tilt; strength?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <HoloFill width={width} height={height} tilt={tilt} strength={strength} />
      </Canvas>
    </View>
  );
}
