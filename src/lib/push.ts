import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { lang, t } from '../i18n';
import { setExpoToken } from './live';
import { registerWidgetSync } from './background';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // au premier plan, l'app joue elle-même le son signature (lib/sounds)
    shouldSetBadge: true,
  }),
});

/**
 * La permission n'a encore jamais été demandée : on la demande au bon moment (juste après le premier envoi,
 * « sois prévenu quand il le gratte »), pas au lancement.
 */
export async function shouldAskPush() {
  if (!Device.isDevice) return false;
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  return !!p && p.status === 'undetermined' && p.canAskAgain;
}

/**
 * Enregistre le jeton push de l'appareil pour l'utilisateur connecté.
 * `ask` : affiche la demande système si besoin ; sinon on n'enregistre que si c'est déjà autorisé.
 */
export async function registerForPush(userId: string, ask = false) {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    // un canal par son signature (le son d'un canal Android est fixé à sa création)
    await Notifications.setNotificationChannelAsync('flips', {
      name: t('channel.flips'),
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FF2D5F',
      sound: 'sweet.wav',
      vibrationPattern: [0, 40, 60, 40],
    });
    await Notifications.setNotificationChannelAsync('sweethour', {
      name: t('channel.sweethour'),
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#C6F36B',
      sound: 'sweethour.wav',
      vibrationPattern: [0, 60, 80, 60, 80, 120],
    });
    await Notifications.setNotificationChannelAsync('streaks', {
      name: t('channel.streaks'),
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FF2D5F',
      sound: 'streak.wav',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  registerWidgetSync();
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  setExpoToken(token);
  // le jeton identifie l'appareil : un utilisateur peut en avoir plusieurs,
  // et si un autre compte se connecte ici le jeton bascule vers lui
  await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang });
}

/** Retire le jeton de cet appareil (déconnexion) pour ne plus recevoir les notifications du compte. */
export async function unregisterPush() {
  if (!Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => ({ data: '' }));
  if (token) await supabase.from('push_tokens').delete().eq('token', token);
}
