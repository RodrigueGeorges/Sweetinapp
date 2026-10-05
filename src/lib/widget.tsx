import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { t } from '../i18n';
import type { InboxItem } from './api';

/** Groupe d'apps partagé avec le widget iOS (doit correspondre à app.config.ts et targets/widget). */
export const APP_GROUP = `group.${Constants.expoConfig?.ios?.bundleIdentifier ?? 'app.sweetin.ios'}`;
export const WIDGET_KEY = 'sweetin.widget';

/** Ce que le widget affiche. Jamais de photo ni de message : seulement un compteur et un prénom. */
export type WidgetState = { count: number; from: string; title: string; subtitle: string; cta: string; preview: string };

export function widgetStateFrom(items: InboxItem[]): WidgetState {
  const count = items.length;
  const from = items[0]?.sender.username ?? '';
  return {
    count,
    from,
    title: count === 0 ? t('widget.none') : count === 1 ? t('widget.one', { name: from }) : t('widget.many', { n: count }),
    subtitle: count === 0 ? t('widget.noneSub') : t('widget.sub'),
    cta: t('camera.sendFlip'),
    // vignette de 24 px du dernier flip reçu : une tache de couleurs floue, jamais le secret
    preview: items[0]?.preview ?? '',
  };
}

let last = '';

/** Met à jour le widget de l'écran d'accueil (iOS et Android) quand la boîte de réception change. */
export async function updateWidget(items: InboxItem[]) {
  const state = widgetStateFrom(items);
  const key = JSON.stringify(state);
  if (key === last) return;
  last = key;
  try {
    if (Platform.OS === 'ios') {
      const { ExtensionStorage } = await import('@bacons/apple-targets');
      const storage = new ExtensionStorage(APP_GROUP);
      storage.set('count', state.count);
      storage.set('from', state.from);
      storage.set('title', state.title);
      storage.set('subtitle', state.subtitle);
      storage.set('cta', state.cta);
      storage.set('preview', state.preview);
      ExtensionStorage.reloadWidget();
    } else if (Platform.OS === 'android') {
      await AsyncStorage.setItem(WIDGET_KEY, key);
      const [{ requestWidgetUpdate }, { SweetinWidget }] = await Promise.all([import('react-native-android-widget'), import('../widget/SweetinWidget')]);
      await requestWidgetUpdate({ widgetName: 'Sweetin', renderWidget: () => <SweetinWidget {...state} /> });
    }
  } catch {
    // widget absent ou module natif indisponible (Expo Go) : rien à faire
  }
}

export async function readWidgetState(): Promise<WidgetState> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_KEY);
    if (raw) return JSON.parse(raw) as WidgetState;
  } catch {}
  return widgetStateFrom([]);
}
