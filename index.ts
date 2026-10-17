// Point d'entrée : Expo Router, plus le gestionnaire du widget Android (qui tourne sans l'interface).
// Le module widget n'existe que dans un dev build natif : import paresseux, no-op en Expo Go.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- imports paresseux volontaires (cf. note ci-dessus) */
    const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { widgetTaskHandler } = require('./src/widget/task-handler') as typeof import('./src/widget/task-handler');
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Expo Go / pas de module natif : le widget sera branché dans le dev build
  }
}
