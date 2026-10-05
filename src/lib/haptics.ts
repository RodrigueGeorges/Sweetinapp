import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Vibrations comme un langage : peu de motifs, chacun veut dire une chose.
 * - tick : la feuille qui se gratte (à chaque dixième gratté)
 * - signature : « swee-ti-n », trois touches qui montent, calées sur le son signature (révélation, envoi)
 * Sur Android, les retours système (Clock_Tick, Confirm) sont plus nets que des vibrations brutes.
 */
export function tick() {
  if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick).catch(() => Haptics.selectionAsync());
  else Haptics.selectionAsync();
}

export function signature() {
  if (Platform.OS === 'android') {
    const p = (h: Haptics.AndroidHaptics) => Haptics.performAndroidHapticsAsync(h).catch(() => {});
    p(Haptics.AndroidHaptics.Clock_Tick);
    setTimeout(() => p(Haptics.AndroidHaptics.Clock_Tick), 110);
    setTimeout(() => p(Haptics.AndroidHaptics.Confirm), 240);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 110);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), 240);
}

/** « ça fond » : trois touches qui ralentissent et s'adoucissent, comme des gouttes. */
export function melt() {
  const steps: [number, Haptics.ImpactFeedbackStyle][] = [
    [0, Haptics.ImpactFeedbackStyle.Medium],
    [260, Haptics.ImpactFeedbackStyle.Light],
    [620, Haptics.ImpactFeedbackStyle.Soft],
  ];
  for (const [ms, style] of steps) setTimeout(() => Haptics.impactAsync(style).catch(() => {}), ms);
}
