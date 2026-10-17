import { Platform } from 'react-native';
import { lang, t } from '../i18n';
import type { SweetHourProps } from '../widgets/SweetHourActivity';
import { supabase } from './supabase';

// expo-widgets n'existe pas dans Expo Go : chargé à la demande, comme expo-notifications (lib/notif).
type Widgets = { addPushToStartTokenListener: typeof import('expo-widgets').addPushToStartTokenListener };
type Activity = { getInstances: () => unknown[]; start: (props: SweetHourProps, url?: string, staleDate?: Date) => void };
let cached: { w: Widgets; a: Activity } | null | undefined;

function live(): { w: Widgets; a: Activity } | null {
  if (Platform.OS !== 'ios') return null;
  if (cached === undefined) {
    try {
      /* eslint-disable @typescript-eslint/no-require-imports -- chargement paresseux volontaire (Expo Go) */
      const w = require('expo-widgets') as Widgets;
      const { SweetHourActivity } = require('../widgets/SweetHourActivity') as { SweetHourActivity: Activity };
      /* eslint-enable @typescript-eslint/no-require-imports */
      cached = { w, a: SweetHourActivity };
    } catch {
      cached = null;
    }
  }
  return cached;
}

let expoToken: string | null = null;
/** Jeton push habituel de l'appareil (renseigné par lib/push), pour relier les deux jetons. */
export const setExpoToken = (token: string) => {
  expoToken = token;
};

/**
 * iOS 17.2+ : enregistre le jeton « push-to-start » de l'appareil, pour que le serveur affiche
 * le compte à rebours du Sweet Hour sur l'écran verrouillé même quand l'app est fermée.
 */
export function watchLiveTokens(userId: string) {
  const m = live();
  if (!m) return () => {};
  const sub = m.w.addPushToStartTokenListener(({ activityPushToStartToken: token }) => {
    supabase
      .from('live_tokens')
      .upsert({ token, user_id: userId, expo_token: expoToken, lang, updated_at: new Date().toISOString() })
      .then(() => {}, () => {});
  });
  return () => sub.remove();
}

/** App ouverte pendant le Sweet Hour sans compte à rebours affiché : on le lance nous-mêmes. */
export function ensureSweetHourActivity(endsAt: number) {
  const m = live();
  if (!m || endsAt <= Date.now()) return;
  try {
    if (m.a.getInstances().length) return;
    m.a.start({ endsAt, title: t('sweet.title'), sub: t('live.sub') }, 'sweetin://camera', new Date(endsAt));
  } catch {
    // Live Activities désactivées dans les réglages : rien à faire
  }
}
