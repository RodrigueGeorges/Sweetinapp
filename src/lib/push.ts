import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { lang, t } from '../i18n';
import { setExpoToken } from './live';
import { registerWidgetSync } from './background';
import { notif } from './notif';

notif()?.setNotificationHandler({
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
  const N = notif();
  if (!N || !Device.isDevice) return false;
  const p = await N.getPermissionsAsync().catch(() => null);
  return !!p && p.status === 'undetermined' && p.canAskAgain;
}

const PUSH_WANTED = 'sweetin.pushWanted';

/** L'utilisateur peut couper les notifications depuis les réglages (activées par défaut). */
export async function pushWanted() {
  return (await AsyncStorage.getItem(PUSH_WANTED).catch(() => null)) !== '0';
}

/** Interrupteur des réglages : on retire le jeton du serveur, ou on le repose (avec demande système au besoin). */
export async function setPushWanted(on: boolean, userId?: string) {
  await AsyncStorage.setItem(PUSH_WANTED, on ? '1' : '0').catch(() => {});
  if (on && userId) await registerForPush(userId, true);
  else await unregisterPush();
}

/**
 * Enregistre le jeton push de l'appareil pour l'utilisateur connecté.
 * `ask` : affiche la demande système si besoin ; sinon on n'enregistre que si c'est déjà autorisé.
 */
export async function registerForPush(userId: string, ask = false) {
  const N = notif();
  if (!N || !Device.isDevice || !(await pushWanted())) return;
  if (Platform.OS === 'android') {
    // un canal par son signature (le son d'un canal Android est fixé à sa création)
    await N.setNotificationChannelAsync('flips', {
      name: t('channel.flips'),
      importance: N.AndroidImportance.HIGH,
      lightColor: '#FF2E5B',
      sound: 'sweet.wav',
      vibrationPattern: [0, 40, 60, 40],
    });
    await N.setNotificationChannelAsync('sweethour', {
      name: t('channel.sweethour'),
      importance: N.AndroidImportance.HIGH,
      lightColor: '#C6F36B',
      sound: 'sweethour.wav',
      vibrationPattern: [0, 60, 80, 60, 80, 120],
    });
    await N.setNotificationChannelAsync('streaks', {
      name: t('channel.streaks'),
      importance: N.AndroidImportance.DEFAULT,
      lightColor: '#FF2E5B',
      sound: 'streak.wav',
    });
  }
  let { status } = await N.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await N.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  registerWidgetSync();
  const { data: token } = await N.getExpoPushTokenAsync({ projectId });
  setExpoToken(token);
  // le jeton identifie l'appareil : un utilisateur peut en avoir plusieurs,
  // et si un autre compte se connecte ici le jeton bascule vers lui
  await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang });
}

/** Retire le jeton de cet appareil (déconnexion) pour ne plus recevoir les notifications du compte. */
export async function unregisterPush() {
  const N = notif();
  if (!N || !Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data: token } = await N.getExpoPushTokenAsync({ projectId }).catch(() => ({ data: '' }));
  if (token) await supabase.from('push_tokens').delete().eq('token', token);
}
