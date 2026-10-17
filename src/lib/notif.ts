/**
 * expo-notifications a été retiré d'Expo Go avec le SDK 53 : son import lève une erreur à l'évaluation.
 * On le charge donc à la demande — `notif()` renvoie le module ou `null` (Expo Go, web).
 * Tout ce qui touche au push doit passer par là : l'app fonctionne sans, seul le push est désactivé.
 * Depuis expo-notifications 57.0.23, le require ne plante plus dans Expo Go mais logue un warning
 * (LogBox plein écran en dev) : on court-circuite avant même de charger le module.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Notif = typeof import('expo-notifications');

let cached: Notif | null | undefined;

export function notif(): Notif | null {
  if (cached === undefined) {
    // Expo Go sur Android : pas de push distant ni local utile — inutile de charger le module
    if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') return (cached = null);
    try {
      // require à l'intérieur de la fonction : le module est bundlé par Metro,
      // mais son code d'init n'est exécuté — et peut échouer — qu'ici
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux volontaire (cf. note ci-dessus)
      cached = require('expo-notifications') as Notif;
    } catch {
      cached = null;
    }
  }
  return cached;
}
