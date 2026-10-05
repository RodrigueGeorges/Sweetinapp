import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchSplash } from '../components/LaunchSplash';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider } from '../components/Toast';
import { wrapRoot } from '../lib/monitoring';
import { initSounds, play } from '../lib/sounds';
import { SessionProvider, useSession } from '../lib/session';
import { fonts, useTheme } from '../theme';

const FONTS = {
  [fonts.display]: require('../../assets/fonts/SweetinDisplay.ttf'),
  [fonts.text]: require('../../assets/fonts/SweetinText-Medium.ttf'),
  [fonts.bold]: require('../../assets/fonts/SweetinText-Bold.ttf'),
  [fonts.black]: require('../../assets/fonts/SweetinText-ExtraBold.ttf'),
};

SplashScreen.preventAutoHideAsync();
initSounds();

function Root() {
  const { colors, isDark } = useTheme();
  const { ready } = useSession();
  const [fontsLoaded] = useFonts(FONTS);
  // le splash animé prend le relais du splash natif, une fois par lancement
  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  // un tap sur une notification ouvre directement le flip ou la boîte de réception
  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.flip_id === 'string') router.push(`/read/${data.flip_id}`);
      else if (data?.screen === 'inbox') router.push('/inbox');
      else if (data?.screen === 'camera') router.navigate('/camera');
      else if (data?.screen === 'contacts') router.navigate('/contacts');
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    // app ouverte : on joue nous-mêmes le son signature (la notification est affichée sans son, voir lib/push)
    const recv = Notifications.addNotificationReceivedListener((n) => {
      const d = n.request.content.data as Record<string, unknown> | undefined;
      play(d?.screen === 'camera' ? 'sweethour' : d?.kind === 'streak' ? 'streak' : 'sweet');
    });
    return () => {
      sub.remove();
      recv.remove();
    };
  }, []);

  if (!ready || !fontsLoaded) return null;
  return (
    <>
      <StatusBar style={splash || isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="read/[id]" options={{ animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom', gestureEnabled: true }} />
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
              <Root />
            </ErrorBoundary>
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
