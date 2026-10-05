import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fondue } from '../../components/Fondue';
import type { SkImage } from '@shopify/react-native-skia';
import * as ScreenCapture from 'expo-screen-capture';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bounce } from '../../components/Bounce';
import { Icon } from '../../components/Icon';
import { ScratchCard } from '../../components/ScratchCard';
import { Shimmer } from '../../components/Shimmer';
import { Drip } from '../../components/Logo';
import { NativeMenu } from '../../components/NativeMenu';
import { Glass } from '../../components/Glass';
import { thumbhashOf } from '../../lib/thumb';
import { Image as ExpoImage } from 'expo-image';
import { REACTIONS, ReactionFace } from '../../components/Reactions';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../../components/Toast';
import { Avatar, BackButton, Button, Screen, Title } from '../../components/ui';
import { t } from '../../i18n';
import { markScratched, openFlip, react, report, reportScreenshot, type OpenedFlip } from '../../lib/api';
import { loadImageInMemory } from '../../lib/image';
import { track } from '../../lib/monitoring';
import { draft } from '../../lib/draft';
import { ago, seconds } from '../../lib/format';
import { useTilt } from '../../lib/useTilt';
import { melt as meltHaptic } from '../../lib/haptics';
import { countRead, maybeAskReview } from '../../lib/review';
import { play } from '../../lib/sounds';
import { fonts, tx, useStyles, useTheme, type Palette } from '../../theme';

const COACH_KEY = 'sweetin.coached';
/** Le secret se savoure : lisible quelques secondes, puis il fond. */
const MELT_S = 10;

/** Lecture : on gratte la photo pour découvrir le message, puis « Répondre ». */
export default function Read() {
  const { colors } = useTheme();
  const s = useStyles(themed);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const tilt = useTilt();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [flip, setFlip] = useState<OpenedFlip | null>(null);
  const [photo, setPhoto] = useState<SkImage | null>(null);
  const snapped = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ms, setMs] = useState(0);
  // fonte : la vanille coule du haut de la carte jusqu'à tout recouvrir
  const [left, setLeft] = useState(MELT_S);
  const [melted, setMelted] = useState(false);
  const melt = useSharedValue(0);
  const meltStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (melt.value - 1) * (screenH + 200) }] }));
  useEffect(() => {
    if (!done) return;
    const iv = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const to = setTimeout(() => {
      meltHaptic();
      play('melt');
      melt.value = withTiming(1, { duration: 1700, easing: Easing.in(Easing.quad) });
      setTimeout(() => setMelted(true), 1500);
    }, MELT_S * 1000);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [done, melt, screenH]);

  // confidentialité : pas de capture, pas d'aperçu dans le sélecteur d'apps, photo jamais écrite sur le disque
  ScreenCapture.usePreventScreenCapture(`read-${id}`);
  useEffect(() => {
    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => {
      ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, []);
  ScreenCapture.useScreenshotListener(() => {
    if (!flip || snapped.current) return;
    snapped.current = true;
    track('screenshot_attempt');
    toast(t('read.screenshot', { name: flip.sender }));
    reportScreenshot(flip.id).catch(() => {});
  });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    openFlip(id)
      .then(async (f) => {
        if (!alive) return;
        setFlip(f);
        track('flip_opened', { once: f.mode === 'once' });
        const img = await loadImageInMemory(f.photo_url);
        if (alive) setPhoto(img);
      })
      .catch((e) => alive && setError((e as Error).message));
    AsyncStorage.getItem(COACH_KEY).then((v) => setCoach(!v));
    return () => {
      alive = false;
    };
  }, [id]);

  // la photo décodée est libérée dès qu'on quitte l'écran
  useEffect(() => () => photo?.dispose(), [photo]);

  const onReveal = (percent: number, ms: number) => {
    setDone(true);
    setMs(ms);
    track('flip_scratched', { percent, ms, once: flip?.mode === 'once' });
    markScratched(id!, percent, ms).catch(() => {});
    countRead();
  };

  const sendReaction = (r: string) => {
    if (!done || reaction) return;
    setReaction(r);
    react(id!, r)
      .then(() => {
        track('flip_reacted');
        toast(t('read.reacted', { e: r, name: flip?.sender ?? '' }));
        maybeAskReview();
      })
      .catch(() => setReaction(null));
  };

  const reply = () => {
    draft.reset();
    if (flip) {
      draft.replyTo = flip.sender_id;
      draft.replyName = flip.sender;
    }
    track('reply_tapped');
    router.dismissAll();
    router.replace('/camera');
    toast(t('read.replyToast', { name: flip?.sender ?? '' }));
  };

  const reportFlip = () =>
    report({ flip_id: id!, reason: 'Contenu inapproprié' })
      .then(() => {
        toast(t('read.reported'));
        router.back();
      })
      .catch((e) => toast((e as Error).message));

  // erreur (déjà gratté, expiré…) : écran de marque, pas de photo
  if (error) {
    return (
      <Screen tone="cerise">
        <View style={[s.head, { marginTop: insets.top + 4 }]}>
          <BackButton tone="cerise" />
        </View>
        <View style={s.zone}>
          <Animated.View entering={FadeInDown.springify()} style={s.err}>
            <Fondue mood="melt" size={130} bg={colors.cerise} />
            <Title tone="cerise" size={46} style={{ textAlign: 'center' }}>
              {error}
            </Title>
            <Text style={s.errSub}>{t('read.errSub')}</Text>
            <Button label={t('read.errBack')} tone="vanille" icon="inbox" onPress={() => router.replace('/inbox')} style={{ marginTop: 8 }} />
          </Animated.View>
        </View>
      </Screen>
    );
  }

  // lecture plein écran : la photo occupe tout l'écran, bord à bord, et se gratte du doigt
  return (
    <Screen tone="cacao">
      <Link.AppleZoomTarget>
        <View style={StyleSheet.absoluteFill}>
          {!flip || !photo ? (
            // la photo floutée apparaît tout de suite (ThumbHash), la vraie arrive par-dessus
            flip?.preview && thumbhashOf(flip.preview) ? (
              <ExpoImage placeholder={{ thumbhash: thumbhashOf(flip.preview)! }} placeholderContentFit="cover" style={{ width: screenW, height: screenH }} />
            ) : (
              <Shimmer style={{ width: screenW, height: screenH }} />
            )
          ) : (
            <ScratchCard
              photo={photo}
              message={flip.message}
              mode={flip.mode}
              width={screenW}
              height={screenH}
              radius={0}
              showHint={coach}
              tilt={tilt}
              onFirstTouch={() => AsyncStorage.setItem(COACH_KEY, '1')}
              onProgress={(p) => {
                if (done) return;
                setProgress(p);
              }}
              onReveal={onReveal}
            />
          )}
          {done && (
            <View pointerEvents="none" style={[s.meltBox, { width: screenW, height: screenH }]}>
              <Animated.View style={[s.meltLayer, meltStyle]}>
                <Drip width={screenW} depth={screenH + 10} color={colors.paper} long={1.4} />
              </Animated.View>
              {melted && (
                <Animated.Text entering={FadeIn.duration(400)} style={s.meltT}>
                  {t('read.melted')}
                </Animated.Text>
              )}
            </View>
          )}
        </View>
      </Link.AppleZoomTarget>

      {/* en-tête posé sur la photo, sur un voile pour rester lisible */}
      {!melted && <LinearGradient pointerEvents="none" colors={['rgba(26,10,14,0.55)', 'rgba(26,10,14,0)']} style={[s.scrimTop, { height: insets.top + 110 }]} />}
      <View style={[s.head, { marginTop: insets.top + 4 }]} pointerEvents="box-none">
        <BackButton tone={melted ? 'vanille' : 'cacao'} />
        {flip ? (
          <View style={s.from}>
            <Avatar name={flip.sender} uri={flip.sender_avatar} size={34} ring />
            <View>
              <Text style={[s.fromName, melted && { color: colors.ink }]}>{flip.sender}</Text>
              <Text style={[s.fromAgo, melted && { color: colors.muted }]}>{ago(flip.created_at)}</Text>
            </View>
          </View>
        ) : (
          <View />
        )}
        {flip ? (
          <NativeMenu title={t('read.menuTitle')} items={[{ id: 'report', title: t('read.report'), sf: 'exclamationmark.bubble', destructive: true }]} onSelect={reportFlip} label={t('read.more')}>
            {melted ? (
              <View style={[s.glassBtn, { backgroundColor: colors.card }]}>
                <Icon name="more" size={20} color={colors.ink} />
              </View>
            ) : (
              <Glass style={s.glassBtn}>
                <Icon name="more" size={20} color={colors.vanille} />
              </Glass>
            )}
          </NativeMenu>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* bas : consigne et progression, puis réactions et réponse */}
      {!melted && <LinearGradient pointerEvents="none" colors={['rgba(26,10,14,0)', done ? 'rgba(26,10,14,0.35)' : 'rgba(26,10,14,0.6)']} style={[s.scrimBottom, { height: insets.bottom + 220 }]} />}
      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]} pointerEvents="box-none">
        {done ? (
          <>
            <View style={s.reactions}>
              {REACTIONS.map((r, i) => (
                <Animated.View key={r.key} entering={ZoomIn.springify().damping(11).delay(250 + i * 50)}>
                  <Bounce onPress={() => sendReaction(r.emoji)} scaleTo={0.78} haptic="light" style={reaction && reaction !== r.emoji ? { opacity: 0.35 } : null} accessibilityLabel={t('read.react', { e: t(`react.${r.key}`) })}>
                    {melted ? (
                      <View style={[s.react, { backgroundColor: colors.card }, reaction === r.emoji && s.reactOn]}>
                        <Wiggle on={reaction === r.emoji}>
                          <ReactionFace kind={r.key} size={34} />
                        </Wiggle>
                      </View>
                    ) : (
                      <Glass style={[s.react, reaction === r.emoji && s.reactOn]}>
                        <Wiggle on={reaction === r.emoji}>
                          <ReactionFace kind={r.key} size={34} />
                        </Wiggle>
                      </Glass>
                    )}
                  </Bounce>
                </Animated.View>
              ))}
            </View>
            <Text style={[s.status, !melted && { color: colors.vanille, opacity: 0.9 }]}>{melted ? t('read.scratchedIn', { s: seconds(ms) }) : t('read.meltsIn', { s: left })}</Text>
            {!melted && (
              <View style={s.meltBar}>
                <View style={[s.meltFill, { width: `${(left / MELT_S) * 100}%` }]} />
              </View>
            )}
            <Button label={t('read.reply')} icon="snap" tone="cerise" onPress={reply} style={{ alignSelf: 'stretch' }} />
          </>
        ) : flip ? (
          <Glass style={s.hintRow}>
            <Icon name="hand" size={18} color={colors.vanille} />
            <Text style={s.hintT}>{flip.mode === 'once' ? t('read.onceHint') : t('read.hint')}</Text>
            {progress > 0 ? <Text style={s.pct}>{t('read.progress', { p: progress })}</Text> : null}
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}

/** La réaction choisie se trémousse : retour visuel joyeux, puis elle se pose. */
function Wiggle({ on, children }: { on: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (on) r.value = withSequence(withTiming(-14, { duration: 90 }), withTiming(12, { duration: 110 }), withTiming(-8, { duration: 100 }), withTiming(0, { duration: 120 }));
  }, [on, r]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }, { scale: on ? 1.12 : 1 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

const themed = (colors: Palette) =>
  StyleSheet.create({
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', top: 0, left: 0, right: 0, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fromName: { ...tx.black, fontSize: 15, color: colors.vanille },
  fromAgo: { ...tx.text, fontSize: 12, color: colors.mutedOnDark },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meltBox: { position: 'absolute', top: 0, left: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meltLayer: { position: 'absolute', top: 0, left: 0 },
  meltT: { position: 'absolute', fontFamily: fonts.display, fontSize: 60, letterSpacing: -1.6, color: colors.ink },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, marginBottom: 12 },
  hintT: { ...tx.black, fontSize: 15, color: colors.vanille },
  pct: { ...tx.black, fontSize: 15, color: colors.pistache, marginLeft: 4 },
  status: { ...tx.bold, fontSize: 13, color: colors.cacao, opacity: 0.75 },
  reactions: { flexDirection: 'row', gap: 10 },
  react: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  reactOn: { backgroundColor: colors.cerise },
  meltBar: { width: 160, height: 6, borderRadius: 3, backgroundColor: 'rgba(26,10,14,0.15)', overflow: 'hidden' },
  meltFill: { height: 6, borderRadius: 3, backgroundColor: colors.cerise },
  err: { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  errSub: { ...tx.bold, fontSize: 15, lineHeight: 21, color: colors.cacao, textAlign: 'center' },
});
