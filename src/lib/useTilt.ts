import { useAnimatedReaction, useAnimatedSensor, useReducedMotion, useSharedValue, SensorType } from 'react-native-reanimated';

/**
 * Inclinaison du téléphone, lissée, entre -1 et 1 sur chaque axe.
 * La position de repos se recalibre lentement : tenir le téléphone droit ou couché donne le même point neutre.
 * Désactivée quand l'utilisateur a demandé à réduire les animations.
 */
export function useTilt() {
  const reduce = useReducedMotion();
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 20 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const baseP = useSharedValue(Number.NaN);
  const baseR = useSharedValue(Number.NaN);

  useAnimatedReaction(
    () => sensor.sensor.value,
    (v) => {
      if (reduce) return;
      if (Number.isNaN(baseP.value)) {
        baseP.value = v.pitch;
        baseR.value = v.roll;
      }
      baseP.value += (v.pitch - baseP.value) * 0.015;
      baseR.value += (v.roll - baseR.value) * 0.015;
      const tx = Math.max(-1, Math.min(1, (v.roll - baseR.value) / 0.35));
      const ty = Math.max(-1, Math.min(1, (v.pitch - baseP.value) / 0.35));
      x.value += (tx - x.value) * 0.18;
      y.value += (ty - y.value) * 0.18;
    },
  );

  return { x, y };
}
