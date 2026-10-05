// Point d'entrée : Expo Router, plus le gestionnaire du widget Android (qui tourne sans l'interface).
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/task-handler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
