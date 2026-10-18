import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { ScratchDemo } from '../components/ScratchDemo';
import { Button, Screen } from '../components/ui';
import { t } from '../i18n';
import { track } from '../lib/monitoring';
import { referrerChecked } from '../lib/referrer';
import { peekPendingInvite } from '../lib/session';
import { markWelcomeRead } from '../lib/welcome';
import { colors, fonts, tx } from '../theme';

/**
 * Accueil : une photo à gratter tout de suite (le produit en 3 secondes), la promesse, puis on crée son premier secret.
 * Le compte n'est demandé qu'au moment de l'envoyer.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // la carte prend la place disponible sans jamais pousser les boutons hors de l'écran
  // petit écran (360×640) : le slogan tient sur une ligne, la carte récupère la place
  const compact = height < 720;
  const card = Math.max(150, Math.min(250, width * 0.6, (height - (compact ? 420 : 560)) / 1.22));
  const [revealed, setRevealed] = useState(false);
  // arrivé par une invitation (lien /u/, page /f/ ou referrer Play) : on le dit tout de suite
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    referrerChecked()
      .then(peekPendingInvite)
      .then((n) => {
        if (!alive || !n) return;
        setFrom(n);
        track('welcome_invited');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // le bouton n'apparaît qu'après le grattage : la première action, c'est gratter.
  // Filets de sécurité : il apparaît seul après 6 s sans grattage, et tout de suite avec un lecteur d'écran.
  const [late, setLate] = useState(false);
  useEffect(() => {
    const to = setTimeout(() => setLate(true), 6000);
    // sur le web, react-native-web répond toujours « oui » : on ne s'y fie que sur téléphone
    if (Platform.OS !== 'web') AccessibilityInfo.isScreenReaderEnabled().then((on) => on && setLate(true)).catch(() => {});
    return () => clearTimeout(to);
  }, []);
  const showCta = revealed || late;
  const cta = useSharedValue(0);
  useEffect(() => {
    if (showCta) cta.value = withSpring(1, { damping: 14, stiffness: 160 });
  }, [showCta, cta]);
  const ctaStyle = useAnimatedStyle(() => ({ opacity: withTiming(cta.value > 0 ? 1 : 0, { duration: 180 }), transform: [{ translateY: (1 - cta.value) * 18 }, { scale: 0.96 + 0.04 * cta.value }] }));

  return (
    <Screen tone="cerise">
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Logo size={28} color={colors.ink} />
      </View>

      <Animated.View entering={FadeInUp.delay(80).springify().damping(14)} style={s.hero}>
        <View>
          <ScratchDemo key={from ?? 'demo'} width={card} message={from ? t('welcome.demoFrom', { name: `@${from}` }) : t('welcome.demo')} onReveal={() => {
              setRevealed(true);
              track('demo_scratched');
              // le principe est vécu ici, avant l'inscription : pas de sweet de bienvenue en double ensuite
              markWelcomeRead();
            }} />
          {/* autocollants posés de travers : le côté fun de la marque */}
          <Animated.View pointerEvents="none" entering={ZoomIn.delay(420).springify().damping(9)} style={[s.stickPos, { top: -6, right: -34 }]}>
            <View style={[s.stick, { backgroundColor: colors.citron, transform: [{ rotate: '8deg' }] }]}>
              <Text style={s.stickT}>{from ? `@${from}` : t('welcome.stick')}</Text>
            </View>
          </Animated.View>
          <Animated.View pointerEvents="none" entering={ZoomIn.delay(560).springify().damping(9)} style={[s.stickPos, { bottom: 18, left: -30 }]}>
            <View style={[s.stick, { borderRadius: 12, backgroundColor: colors.cerise, transform: [{ rotate: '-5deg' }] }]}>
              <Text style={s.stickT}>{t('react.melt')}</Text>
            </View>
          </Animated.View>
        </View>
        <Animated.Text key={revealed ? 'done' : 'hint'} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={s.hint}>
          {revealed ? t('welcome.scratchDone') : t('welcome.scratch')}
        </Animated.Text>
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Animated.Text entering={FadeInDown.delay(150).springify()} style={[s.title, compact && s.titleSm]}>
          {compact ? t('welcome.tagline').replace(/\n/g, ' ') : t('welcome.tagline')}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(230).springify()} style={s.sub}>
          {t('welcome.sub')}
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(310).springify()} style={{ gap: 4, marginTop: 14 }}>
          <Animated.View style={ctaStyle} pointerEvents={showCta ? 'auto' : 'none'} accessibilityElementsHidden={!showCta} importantForAccessibility={showCta ? 'auto' : 'no-hide-descendants'}>
            <Button label={revealed ? t('welcome.startAfter') : t('welcome.start')} arrow haptic="medium" onPress={() => router.push('/try')} />
          </Animated.View>
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 16 },
  stickPos: { position: 'absolute' },
  stick: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 3, borderColor: colors.white, shadowColor: '#160F12', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  stickT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 16, color: colors.cacao },
  hint: { ...tx.bold, fontSize: 14, color: colors.muted },
  bottom: { paddingHorizontal: 24, gap: 8 },
  title: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 40, lineHeight: 42, color: colors.ink },
  titleSm: { fontSize: 25, lineHeight: 30 },
  sub: { ...tx.bold, fontSize: 16, lineHeight: 22, color: colors.muted, maxWidth: 340 },
  login: { alignSelf: 'center', paddingVertical: 12 },
  loginT: { ...tx.bold, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
});
