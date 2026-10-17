import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { ScratchDemo } from '../components/ScratchDemo';
import { Button, Screen } from '../components/ui';
import { t } from '../i18n';
import { track } from '../lib/monitoring';
import { colors, fonts, tx } from '../theme';

/**
 * Accueil : une photo à gratter tout de suite (le produit en 3 secondes), la promesse, puis on crée son premier secret.
 * Le compte n'est demandé qu'au moment de l'envoyer.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // la carte prend la place disponible sans jamais pousser les boutons hors de l'écran
  const card = Math.max(140, Math.min(250, width * 0.6, (height - 560) / 1.22));
  // les autocollants dépassent de la carte, mais jamais de l'écran
  const margin = (width - card) / 2;
  const stickOut = (want: number) => Math.min(want, Math.max(8, margin - 56));
  const [revealed, setRevealed] = useState(false);

  return (
    <Screen tone="cerise">
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Logo size={28} color={colors.ink} />
      </View>

      <Animated.View entering={FadeInUp.delay(80).springify().damping(14)} style={s.hero}>
        <View>
          <ScratchDemo width={card} message={t('welcome.demo')} onReveal={() => {
              setRevealed(true);
              track('demo_scratched');
            }} />
          {/* autocollants posés de travers : le côté fun de la marque (l'entrée anime le wrapper, la rotation reste sur le sticker) */}
          <Animated.View pointerEvents="none" entering={ZoomIn.delay(420).springify().damping(9)} style={[s.stickPos, { top: -6, right: -stickOut(34) }]}>
            <View style={[s.stick, { backgroundColor: colors.citron, transform: [{ rotate: '8deg' }] }]}>
              <Text style={s.stickT}>{t('welcome.stick')}</Text>
            </View>
          </Animated.View>
          <Animated.View pointerEvents="none" entering={ZoomIn.delay(560).springify().damping(9)} style={[s.stickPos, { bottom: 18, left: -stickOut(30) }]}>
            <View style={[s.stick, { borderRadius: 12, backgroundColor: colors.cerise, transform: [{ rotate: '-5deg' }] }]}>
              <Text style={[s.stickT, { color: colors.white }]}>{t('react.melt')}</Text>
            </View>
          </Animated.View>
        </View>
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
        <Animated.View entering={FadeInDown.delay(310).springify()} style={{ gap: 4, marginTop: 14 }}>
          <Button label={t('welcome.start')} haptic="medium" onPress={() => router.push('/try')} />
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
  stickPos: { position: 'absolute' },
  stick: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 3, borderColor: colors.white, shadowColor: '#160F12', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  stickT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 16, color: colors.cacao },
  hint: { ...tx.bold, fontSize: 14, color: colors.muted },
  bottom: { paddingHorizontal: 24, gap: 8 },
  title: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 40, lineHeight: 42, color: colors.ink },
  sub: { ...tx.bold, fontSize: 16, lineHeight: 22, color: colors.muted, maxWidth: 340 },
  login: { alignSelf: 'center', paddingVertical: 12 },
  loginT: { ...tx.bold, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
});
