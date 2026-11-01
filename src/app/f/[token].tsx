import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { SkImage } from '@shopify/react-native-skia';
import { Fondue } from '../../components/Fondue';
import { Flaque } from '../../components/Flaque';
import { Drip, Mark } from '../../components/Logo';
import { ScratchCard } from '../../components/ScratchCard';
import { Shimmer } from '../../components/Shimmer';
import { BackButton, Button, IconButton, Screen, Title } from '../../components/ui';
import { t, humanError } from '../../i18n';
import { acceptInvite, linkScratched, openLink, peekLink, type InviteSource, type LinkOpen, type LinkPeek } from '../../lib/api';
import { meltFor } from '../../lib/config';
import { draft } from '../../lib/draft';
import { agoShort, seconds } from '../../lib/format';
import { melt as meltHaptic, tick as tickHaptic } from '../../lib/haptics';
import { loadImageInMemory } from '../../lib/image';
import { track } from '../../lib/monitoring';
import { play } from '../../lib/sounds';
import { rememberInvite, useSession } from '../../lib/session';
import { thumbhashOf } from '../../lib/thumb';
import { useTilt } from '../../lib/useTilt';
import { colors, fonts } from '../../theme';

const LINK_DOMAIN = process.env.APP_LINK_DOMAIN ?? 'sweetinapp.netlify.app';
const HOT_S = 3;

/**
 * Lien privé https://sweetinapp.netlify.app/f/<jeton> (ou sweetin://f/<jeton>).
 * Lu en natif quand l'app est là : captures bloquées, grattage au doigt, réponse
 * directe à la caméra — là où la page web reste le repli pour qui n'a pas l'app.
 * Le « peek » ne consomme rien : le lien privé ne s'ouvre qu'au geste d'ouverture.
 */
export default function FlipLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const t0 = String(token ?? '');
  const insets = useSafeAreaInsets();
  const tilt = useTilt();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { session, profile } = useSession();

  const [peek, setPeek] = useState<LinkPeek | null>(null);
  const [flip, setFlip] = useState<LinkOpen | null>(null);
  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ms, setMs] = useState(0);
  const [progress, setProgress] = useState(0);
  const [force, setForce] = useState(false);
  const [melted, setMelted] = useState(false);
  const [meltingWord, setMeltingWord] = useState(false);
  const [left, setLeft] = useState(0);

  const meltConf = useMemo(() => meltFor(flip?.message ?? '', session?.user.id), [flip?.message, session?.user.id]);
  const MELT_S = meltConf.seconds;

  const melt = useSharedValue(0);
  const count = useSharedValue(0);
  const hot = useSharedValue(0);
  const meltStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (melt.value - 1) * (screenH + 200) }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${(1 - count.value) * 100}%` }));
  const hotStyle = useAnimatedStyle(() => ({ opacity: hot.value }));

  // confidentialité : pas de capture, pas d'aperçu dans le sélecteur d'apps (la page web ne peut pas l'offrir)
  ScreenCapture.usePreventScreenCapture(`link-${t0}`);
  useEffect(() => {
    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => {
      ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!t0) return void router.replace('/');
    let alive = true;
    peekLink(t0)
      .then((p) => alive && (setPeek(p), track('link_peeked', { kind: p.kind })))
      .catch((e) => alive && setError(humanError(e)));
    return () => {
      alive = false;
    };
  }, [t0]);

  // la photo décodée est libérée dès qu'on quitte l'écran
  useEffect(() => () => photo?.dispose(), [photo]);

  const open = () => {
    if (opening || flip) return;
    setOpening(true);
    openLink(t0)
      .then(async (f) => {
        setFlip(f);
        track('link_opened', { kind: f.kind });
        const img = await loadImageInMemory(f.photo_url);
        setPhoto(img);
      })
      .catch((e) => setError(humanError(e)))
      .finally(() => setOpening(false));
  };

  const onReveal = (percent: number, ms0: number) => {
    setDone(true);
    setMs(ms0);
    setLeft(MELT_S);
    track('link_scratched', { percent, ms: ms0, kind: flip?.kind ?? 'single' });
    linkScratched(t0, percent, ms0).catch(() => {});
  };

  // la lecture se savoure puis fond : jauge continue, tic chaque seconde, framboise à la fin
  useEffect(() => {
    if (!done) return;
    count.value = withTiming(1, { duration: MELT_S * 1000, easing: Easing.linear });
    hot.value = withDelay((MELT_S - HOT_S) * 1000, withTiming(1, { duration: HOT_S * 1000, easing: Easing.in(Easing.quad) }));
    const iv = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const to = setTimeout(() => {
      meltHaptic();
      play('melt');
      setMeltingWord(true);
      melt.value = withDelay(900, withTiming(1, { duration: 1400, easing: Easing.in(Easing.quad) }));
      setTimeout(() => setMelted(true), 2200);
    }, MELT_S * 1000);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [done, melt, count, hot, MELT_S]);
  useEffect(() => {
    if (!done || left >= MELT_S || left <= 0) return;
    tickHaptic();
    if (left <= HOT_S) play('tap', 0.35);
  }, [done, left, MELT_S]);

  /** Répondre en natif : connecté → ami ajouté (comme le lien /u/) + caméra pré-remplie ; invité → caméra invitée, l'ami se lie à l'inscription. */
  const reply = () => {
    if (!flip) return;
    const src: InviteSource = flip.kind === 'story' ? 'story' : 'flip';
    draft.reset();
    if (session && profile?.onboarded) {
      acceptInvite(flip.sender, src)
        .then((p) => {
          draft.replyTo = p.id;
          draft.replyName = p.username;
        })
        .catch(() => {});
    } else {
      draft.replyName = flip.sender;
      rememberInvite(flip.sender, src).catch(() => {});
    }
    track('link_reply_tapped', { kind: flip.kind });
    router.replace(session ? '/camera' : '/try');
  };

  const openOnWeb = () => Linking.openURL(`https://${LINK_DOMAIN}/f/${encodeURIComponent(t0)}`).catch(() => {});

  // erreur (déjà gratté, expiré, introuvable) : écran de marque, pas de photo
  if (error) {
    return (
      <Screen tone="cerise">
        <View style={[s.head, { marginTop: insets.top + 4 }]}>
          <BackButton tone="cerise" onPress={leave} />
        </View>
        <View style={s.zone}>
          <Animated.View entering={FadeInDown.springify()} style={s.err}>
            <Fondue mood="melt" size={130} />
            <Title tone="cerise" size={46} style={{ textAlign: 'center' }}>
              {error}
            </Title>
            <Text style={s.errSub}>{t('read.errSub')}</Text>
            <Button label={t('welcome.startAfter')} icon="snap" onPress={() => router.replace(session ? '/camera' : '/try')} style={{ marginTop: 8 }} />
          </Animated.View>
        </View>
      </Screen>
    );
  }

  // le mot a fondu : reste la réponse
  if (melted && flip) {
    const flaqueW = Math.min(300, screenW - 64, (screenH - insets.top - insets.bottom - 560) / 0.573);
    return (
      <Screen tone="vanille">
        <View style={[s.head, { marginTop: insets.top + 4 }]}>
          <IconButton icon="close" label={t('common.close')} tone="vanille" filled onPress={leave} />
        </View>
        <Animated.View entering={FadeIn.duration(500)} style={[s.meltedBox, { top: insets.top + 120 }]} pointerEvents="none">
          <Text style={s.meltT} allowFontScaling={false}>
            {t('read.melted')}
          </Text>
          <Text style={s.meltSub}>{t('read.readIn', { s: seconds(ms), name: flip.sender })}</Text>
          {flaqueW >= 180 ? (
            <View style={s.flaque}>
              <Flaque width={flaqueW} />
            </View>
          ) : null}
        </Animated.View>
        <Animated.View entering={FadeInDown.springify().damping(18).delay(200)} style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
          <View style={s.grab} />
          <Text style={s.sheetT}>{t('flip.replySub', { name: flip.sender })}</Text>
          <Button label={t('read.replyTo', { name: flip.sender })} icon="snap" onPress={reply} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel={t('flip.later')} hitSlop={10} style={s.later}>
            <Text style={s.laterT}>{t('flip.later')}</Text>
          </Pressable>
        </Animated.View>
      </Screen>
    );
  }

  // lecture : la photo plein écran, à gratter du doigt
  if (flip && photo) {
    return (
      <Screen tone="cacao">
        <View style={StyleSheet.absoluteFill}>
          <ScratchCard
            photo={photo}
            message={flip.message}
            wordStyle={flip.word_style}
            mode="free" // l'ancien mode « un seul passage » est retiré : tout se gratte librement
            width={screenW}
            height={screenH}
            radius={0}
            showHint={false}
            tilt={tilt}
            onProgress={(p) => {
              if (!done) setProgress(p);
            }}
            onReveal={onReveal}
            forceReveal={force}
            melting={meltingWord}
            safeTop={insets.top + 60}
            safeBottom={170}
          />
          {done && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, hotStyle]}>
              <LinearGradient colors={['rgba(255,46,91,0)', 'rgba(255,46,91,0.32)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          )}
          {done && (
            <View pointerEvents="none" style={[s.meltBox, { width: screenW, height: screenH }]}>
              <Animated.View style={[s.meltLayer, meltStyle]}>
                <Drip width={screenW} depth={screenH + 10} color={colors.paper} long={1.4} />
              </Animated.View>
            </View>
          )}
        </View>

        {flip && !done && progress === 0 && (
          <Animated.View pointerEvents="none" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={[s.cover, { paddingBottom: insets.bottom + 130 }]}>
            <LinearGradient colors={['rgba(22,15,18,0)', 'rgba(22,15,18,0.5)']} style={StyleSheet.absoluteFill} />
            <Text style={s.coverT} allowFontScaling={false}>
              {t('inbox.scratch')}
            </Text>
            <Text style={s.coverSub}>{t('read.cover', { name: flip.sender })}</Text>
          </Animated.View>
        )}

        {!done && <LinearGradient pointerEvents="none" colors={['rgba(22,15,18,0.5)', 'rgba(22,15,18,0)']} style={[s.scrimTop, { height: insets.top + 110 }]} />}
        <View style={[s.head, { marginTop: insets.top + 4 }]} pointerEvents="box-none">
          <IconButton icon="close" label={t('common.close')} tone="cacao" filled onPress={leave} />
          <View style={s.from} accessible accessibilityRole="header" accessibilityLabel={`${t('read.from', { name: flip.sender })}, ${agoShort(flip.created_at)}`}>
            <Text style={[s.fromName, { color: colors.vanille }]} numberOfLines={1}>
              {t('read.from', { name: flip.sender })}
            </Text>
            <Text style={[s.fromAgo, { color: colors.mutedOnDark }]}>{agoShort(flip.created_at)}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {done ? (
          <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]} pointerEvents="none">
            <Text style={s.meltIn}>{t('read.meltsIn', { s: left })}</Text>
            <View style={s.meltBar}>
              <Animated.View style={[s.meltFill, barStyle]} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setForce(true)} accessibilityRole="button" accessibilityLabel={t('read.noScratch')} hitSlop={10} style={[s.noScratch, { bottom: Math.max(insets.bottom, 16) + 10 }]}>
            <Text style={s.noScratchT}>{t('read.noScratch')}</Text>
          </Pressable>
        )}
      </Screen>
    );
  }

  // chargement de la photo après ouverture : vignette floue en attendant (ThumbHash)
  if (flip || opening) {
    return (
      <Screen tone="cacao">
        {peek?.preview && thumbhashOf(peek.preview) ? <ExpoImage placeholder={{ thumbhash: thumbhashOf(peek.preview)! }} placeholderContentFit="cover" style={{ width: screenW, height: screenH }} /> : <Shimmer style={{ width: screenW, height: screenH }} />}
      </Screen>
    );
  }

  // teaser : « x a caché un mot pour toi » — le lien privé n'est consommé qu'au geste
  return (
    <Screen tone="cerise">
      <View style={[s.head, { marginTop: insets.top + 4 }]}>
        <BackButton tone="cerise" onPress={leave} />
      </View>
      {peek ? (
        <View style={s.zone}>
          <Animated.View entering={FadeInDown.springify()} style={s.err}>
            {peek.preview && thumbhashOf(peek.preview) ? (
              <ExpoImage placeholder={{ thumbhash: thumbhashOf(peek.preview)! }} placeholderContentFit="cover" transition={200} style={s.teaserImg} />
            ) : (
              <Mark size={72} cone={colors.cacao} />
            )}
            <Title tone="cerise" size={40} style={{ textAlign: 'center' }}>
              {peek.sender && peek.sender !== 'quelqu’un' ? t('flip.from', { name: peek.sender }) : t('flip.anon')}
            </Title>
            <Text style={s.errSub}>{t('flip.sub')}</Text>
            {peek.kind === 'single' && <Text style={s.once}>{t('flip.once')}</Text>}
            <Button label={t('flip.open')} icon="sparkle" onPress={open} style={{ marginTop: 10 }} />
            <Pressable onPress={openOnWeb} accessibilityRole="button" accessibilityLabel={t('flip.web')} hitSlop={10} style={s.later}>
              <Text style={s.webT}>{t('flip.web')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : (
        <View style={s.center}>
          <Mark size={64} cone={colors.cacao} />
          <Title tone="cerise" size={34} style={{ textAlign: 'center' }}>
            {t('flip.opening')}
          </Title>
          <ActivityIndicator color={colors.cacao} />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  err: { alignItems: 'center', gap: 12 },
  errSub: { fontFamily: fonts.text, fontSize: 15, color: colors.muted, textAlign: 'center' },
  once: { fontFamily: fonts.text, fontSize: 13, color: colors.cerise, textAlign: 'center' },
  teaserImg: { width: 220, height: 220, borderRadius: 26, backgroundColor: colors.card },
  head: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  from: { alignItems: 'center', maxWidth: '60%' },
  fromName: { fontFamily: fonts.display, fontSize: 17 },
  fromAgo: { fontFamily: fonts.text, fontSize: 12 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  coverT: { fontFamily: fonts.display, fontSize: 44, color: colors.vanille },
  coverSub: { fontFamily: fonts.text, fontSize: 15, color: colors.mutedOnDark },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  meltBox: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  meltLayer: { position: 'absolute', top: 0, left: 0 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 8 },
  meltIn: { fontFamily: fonts.display, fontSize: 15, color: colors.vanille },
  meltBar: { width: 150, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  meltFill: { height: '100%', backgroundColor: colors.cerise, borderRadius: 3 },
  noScratch: { position: 'absolute', alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14 },
  noScratchT: { fontFamily: fonts.text, fontSize: 13, color: colors.mutedOnDark, textDecorationLine: 'underline' },
  meltedBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  meltT: { fontFamily: fonts.display, fontSize: 54, color: colors.ink },
  meltSub: { fontFamily: fonts.text, fontSize: 15, color: colors.muted, textAlign: 'center' },
  flaque: { marginTop: 10 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  grab: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.muted, opacity: 0.4 },
  sheetT: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, textAlign: 'center' },
  later: { paddingVertical: 8 },
  laterT: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  webT: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },
});
