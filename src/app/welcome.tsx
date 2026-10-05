import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { ScratchDemo } from '../components/ScratchDemo';
import { Button, Screen } from '../components/ui';
import { t } from '../i18n';
import { track } from '../lib/monitoring';
import { peekPendingInvite } from '../lib/session';
import { colors, fonts, tx } from '../theme';

/**
 * Accueil : une photo à gratter tout de suite (le produit en 3 secondes), la promesse, puis on crée son premier secret.
 * Le compte n'est demandé qu'au moment de l'envoyer.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // la carte prend la place disponible sans jamais pousser les boutons hors de l'écran
  const card = Math.max(150, Math.min(260, width * 0.62, (height - 500) / 1.22));
  const [revealed, setRevealed] = useState(false);
  // arrivé par un lien d'invitation : on accueille la personne par le nom de son ami
  const [inviter, setInviter] = useState<string | null>(null);
  useEffect(() => {
    peekPendingInvite().then(setInviter);
  }, []);

  return (
    <Screen tone="cerise">
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Logo size={34} color={colors.white} />
      </View>

      <Animated.View entering={FadeInUp.delay(80).springify().damping(14)} style={s.hero}>
        <ScratchDemo width={card} message={t('welcome.demo')} onReveal={() => {
            setRevealed(true);
            track('demo_scratched');
          }} />
        <Animated.Text key={revealed ? 'done' : 'hint'} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={s.hint}>
          {revealed ? t('welcome.scratchDone') : t('welcome.scratch')}
        </Animated.Text>
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Animated.Text entering={FadeInDown.delay(150).springify()} style={s.title}>
          {t('welcome.tagline')}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(230).springify()} style={s.sub}>
          {t('welcome.sub')}
        </Animated.Text>
        {inviter ? (
          <Animated.View entering={FadeInDown.delay(280).springify()} style={s.invite}>
            <Text style={s.inviteT}>{t('welcome.invited', { name: inviter })}</Text>
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.delay(310).springify()} style={{ gap: 4, marginTop: 14 }}>
          <Button label={t('welcome.start')} tone="snow" haptic="medium" onPress={() => router.push('/try')} />
          <Pressable onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} accessibilityRole="button" hitSlop={8} style={s.login}>
            <Text style={s.loginT}>{t('welcome.login')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { alignItems: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 20 },
  hint: { ...tx.bold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  bottom: { paddingHorizontal: 24, gap: 8 },
  title: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 40, lineHeight: 42, letterSpacing: -1.2, color: colors.white },
  sub: { ...tx.text, fontSize: 16, lineHeight: 22, color: 'rgba(255,255,255,0.86)', maxWidth: 340 },
  invite: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  inviteT: { ...tx.black, fontSize: 14, color: colors.white },
  login: { alignSelf: 'center', paddingVertical: 12 },
  loginT: { ...tx.bold, fontSize: 15, color: colors.white },
});
