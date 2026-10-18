import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchSplash } from '../components/LaunchSplash';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider, useToast } from '../components/Toast';
import { t } from '../i18n';
import { track, wrapRoot } from '../lib/monitoring';
import { notif } from '../lib/notif';
import { checkInstallReferrer } from '../lib/referrer';
import { initSounds, play } from '../lib/sounds';
import { SessionProvider, useSession } from '../lib/session';
import { flushSendQueue } from '../lib/sendQueue';
import { colors, fonts } from '../theme';

const FONTS = {
  [fonts.display]: require('../../assets/fonts/SweetinDisplay.ttf'),
  [fonts.displayHeavy]: require('../../assets/fonts/SweetinDisplayHeavy.ttf'),
  [fonts.text]: require('../../assets/fonts/SweetinText-Medium.ttf'),
  [fonts.bold]: require('../../assets/fonts/SweetinText-Bold.ttf'),
  [fonts.black]: require('../../assets/fonts/SweetinText-ExtraBold.ttf'),
};

SplashScreen.preventAutoHideAsync();
initSounds();

// l'écran par défaut de la pile : sans lui, un lancement sans lien (Expo Go, APK)
// retombe sur le premier <Stack.Screen> déclaré — read/[id] sans id → écran noir protégé
export const unstable_settings = { anchor: 'index' };

function Root() {
  const { ready, session } = useSession();
  const toast = useToast();
  const [fontsLoaded] = useFonts(FONTS);
  // le splash animé prend le relais du splash natif, une fois par lancement
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  // installé depuis un lien d'invitation : l'ami sera ajouté tout seul après l'inscription
  useEffect(() => {
    checkInstallReferrer();
  }, []);

  // un tap sur une notification ouvre directement le flip ou la boîte de réception
  useEffect(() => {
    const N = notif();
    if (!N) return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.flip_id === 'string') router.push(`/read/${data.flip_id}`);
      else if (data?.screen === 'inbox') router.push('/inbox');
      else if (data?.screen === 'camera') router.navigate('/camera');
      else if (data?.screen === 'contacts') router.navigate('/contacts');
    };
    const last = N.getLastNotificationResponse();
    if (last) {
      // la réponse de démarrage est persistée : on l'efface pour ne pas la rejouer à chaque lancement
      N.clearLastNotificationResponseAsync().catch(() => {});
      open(last.notification.request.content.data);
    }
    const sub = N.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    // app ouverte : on joue nous-mêmes le son signature (la notification est affichée sans son, voir lib/push)
    const recv = N.addNotificationReceivedListener((n) => {
      const d = n.request.content.data as Record<string, unknown> | undefined;
      play(d?.screen === 'camera' ? 'sweethour' : d?.kind === 'streak' ? 'streak' : 'sweet');
    });
    return () => {
      sub.remove();
      recv.remove();
    };
  }, []);

  // les sweets gardés de côté hors connexion repartent seuls au retour du réseau (et au retour au premier plan)
  const uid = session?.user.id;
  useEffect(() => {
    if (!ready || !uid) return;
    let stop = false;
    const flush = () =>
      flushSendQueue()
        .then((n) => {
          if (n > 0 && !stop) {
            toast(t('queue.sent'));
            play('sent');
            track('send_queue_flushed', { n });
          }
        })
        .catch(() => {});
    flush();
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) flush();
    });
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') flush();
    });
    return () => {
      stop = true;
      net();
      app.remove();
    };
  }, [ready, uid, toast]);

  if (!ready || !fontsLoaded) return null;
  return (
    <>
      <StatusBar style={splash ? 'light' : 'dark'} />
      {/* transitions natives de chaque plateforme (glissé iOS, Material Android) ; les animations sur mesure sont réservées aux moments forts */}
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: 'default', contentStyle: { backgroundColor: colors.paper } }}>
        {/* Android : écran transparent, c'est la carte de la vitrine qui s'agrandit (OriginZoom) ; iOS : Link.AppleZoom */}
        <Stack.Screen
          name="read/[id]"
          options={Platform.OS === 'ios' ? { animation: 'default', gestureEnabled: true } : { presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        {/* la carte s'ouvre sans transition de pile : c'est la photo elle-même qui se réduit en carte (voir create.tsx) */}
        <Stack.Screen name="create" options={{ animation: 'none' }} />
        <Stack.Screen name="sendto" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile-setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="u/[username]" options={{ animation: 'fade' }} />
        <Stack.Screen name="google-auth" options={{ animation: 'none' }} />
        <Stack.Screen name="friends-setup" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="phone" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {splash && <LaunchSplash onDone={endSplash} />}
    </>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ToastProvider>
            <ErrorBoundary>
              {/* app en bord à bord sur Android (SDK 57) : barres translucides, et on le reste même module coupé */}
              <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
                <Root />
              </KeyboardProvider>
            </ErrorBoundary>
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
