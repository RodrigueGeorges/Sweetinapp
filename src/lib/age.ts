import { Platform } from 'react-native';
import { MIN_AGE } from './constants';

// expo-age-range n'est pas dans Expo Go : chargé à la demande, comme expo-notifications (lib/notif).
type AgeRange = typeof import('expo-age-range');
let cached: AgeRange | null | undefined;
function ageRange(): AgeRange | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux volontaire (Expo Go)
      cached = require('expo-age-range') as AgeRange;
    } catch {
      cached = null;
    }
  }
  return cached;
}

/**
 * Âge déclaré au store, là où une loi l'impose (Texas depuis juin 2026, puis d'autres États) :
 * Apple « Declared Age Range » (iOS 26.2+) et Google Play « Age Signals ».
 * Renvoie true si le store indique moins de MIN_AGE ans. Ailleurs, ou en cas d'erreur, renvoie false :
 * la date de naissance saisie reste la règle, vérifiée par le serveur.
 */
export async function storeSaysUnderage(): Promise<boolean> {
  try {
    const AgeRange = ageRange();
    if (!AgeRange) return false;
    if (Platform.OS === 'ios') {
      // ne montre la feuille système qu'aux personnes concernées par une loi
      if ((await AgeRange.isEligibleForAgeFeaturesAsync()) !== true) return false;
    } else if (Platform.OS !== 'android') return false;
    const r = await AgeRange.requestAgeRangeAsync({ threshold1: MIN_AGE, threshold2: 18 });
    return r.upperBound != null && r.upperBound < MIN_AGE;
  } catch {
    return false;
  }
}
