import { addPushToStartTokenListener } from 'expo-widgets';
import { Platform } from 'react-native';
import { lang, t } from '../i18n';
import { SweetHourActivity } from '../widgets/SweetHourActivity';
import { supabase } from './supabase';

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
  if (Platform.OS !== 'ios') return () => {};
  const sub = addPushToStartTokenListener(({ activityPushToStartToken: token }) => {
    supabase
      .from('live_tokens')
      .upsert({ token, user_id: userId, expo_token: expoToken, lang, updated_at: new Date().toISOString() })
      .then(() => {}, () => {});
  });
  return () => sub.remove();
}

/** App ouverte pendant le Sweet Hour sans compte à rebours affiché : on le lance nous-mêmes. */
export function ensureSweetHourActivity(endsAt: number) {
  if (Platform.OS !== 'ios' || endsAt <= Date.now()) return;
  try {
    if (SweetHourActivity.getInstances().length) return;
    SweetHourActivity.start({ endsAt, title: t('sweet.title'), sub: t('live.sub'), cta: t('contacts.flipNow') }, 'sweetin://camera', new Date(endsAt));
  } catch {
    // Live Activities désactivées dans les réglages : rien à faire
  }
}
