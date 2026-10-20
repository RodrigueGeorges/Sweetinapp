import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fondue } from '../../components/Fondue';
import { Flaque } from '../../components/Flaque';
import type { SkImage } from '@shopify/react-native-skia';
import * as ScreenCapture from 'expo-screen-capture';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bounce } from '../../components/Bounce';
import { Icon } from '../../components/Icon';
import { ScratchCard } from '../../components/ScratchCard';
import { Rolling } from '../../components/Rolling';
import { OriginZoom, useOriginZoom } from '../../components/OriginZoom';
import { Shimmer } from '../../components/Shimmer';
import { Drip } from '../../components/Logo';
import { NativeMenu } from '../../components/NativeMenu';
import { Glass } from '../../components/Glass';
import { thumbhashOf } from '../../lib/thumb';
import { Image as ExpoImage } from 'expo-image';
import { REACTIONS, Sticker } from '../../components/Reactions';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../../components/Toast';
import { BackButton, Button, IconButton, Screen, Title } from '../../components/ui';
import { t, humanError } from '../../i18n';
import { isWelcome, loadWelcomePhoto, markWelcomeRead, welcomeFlip } from '../../lib/welcome';
import { meltFor } from '../../lib/config';
import { useSession } from '../../lib/session';
import { listInbox, markScratched, openFlip, react, report, reportScreenshot, type InboxItem, type OpenedFlip } from '../../lib/api';
import { loadImageInMemory } from '../../lib/image';
import { track } from '../../lib/monitoring';
import { draft } from '../../lib/draft';
import { ago, agoShort, seconds } from '../../lib/format';
import { useTilt } from '../../lib/useTilt';
import { melt as meltHaptic, tick as tickHaptic } from '../../lib/haptics';
import { countRead, maybeAskReview } from '../../lib/review';
import { play } from '../../lib/sounds';
import { colors, fonts, tx } from '../../theme';

const COACH_KEY = 'sweetin.coached';
/** Le secret se savoure : lisible quelques secondes, puis il fond. */
/** Les réactions arrivent après ce délai : on laisse d'abord le mot se lire. */
const REACT_DELAY_MS = 2500;
/** Les dernières secondes, ça chauffe : la jauge et le bas de l'écran passent en framboise. */
const HOT_S = 3;
/** Hauteur réservée aux deux rangées d'autocollants (pour que le mot ne bouge pas quand ils arrivent). */
const STICKERS_H = 146;

/** Android : la lecture s'ouvre depuis la carte touchée dans la vitrine (voir OriginZoom). */
export default function Read() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // monté sans paramètre (initialRouteName manquant, deep link cassé) : retour à l'aiguillage
  if (!id) return <Redirect href="/" />;
  return (
    <OriginZoom>
      <ReadScreen />
    </OriginZoom>
  );
}

/** Lecture : on gratte la photo pour découvrir le message, puis « Répondre ». */
function ReadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const welcome = isWelcome(id); // sweet de bienvenue : local, rien n'est envoyé au serveur
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const tilt = useTilt();
  const zoom = useOriginZoom();
  const closeRead = () => zoom.close(() => (router.canGoBack() ? router.back() : router.replace('/inbox')));
  // retour Android : la carte se referme vers la vitrine
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRead();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [flip, setFlip] = useState<OpenedFlip | null>(null);
  const { session } = useSession();
  // durée de lecture : réglable à distance (app_config « melt »), 10 s par défaut ; fixée une fois le mot connu
  const meltConf = useMemo(() => meltFor(flip?.message ?? '', session?.user.id), [flip?.message, session?.user.id]);
  const MELT_S = meltConf.seconds;
  const meltProps = { melt_s: MELT_S, melt_group: meltConf.group };
  // test de durée : quitter avant la fonte veut dire que c'était trop long (ou que le mot n'a pas accroché)
  const leave = useRef({ done: false, melted: false, at: 0, props: meltProps, welcome: false });
  const [photo, setPhoto] = useState<SkImage | null>(null);
  const snapped = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);
  const [progress, setProgress] = useState(0);
  const [force, setForce] = useState(false);
  const [ms, setMs] = useState(0);
  // fonte : la vanille coule du haut de la carte jusqu'à tout recouvrir
  const [left, setLeft] = useState(MELT_S);
  // la durée peut arriver après le premier rendu : le décompte repart sur la bonne base (ajustement pendant le rendu)
  const [leftBase, setLeftBase] = useState(MELT_S);
  if (leftBase !== MELT_S) {
    setLeftBase(MELT_S);
    if (!done) setLeft(MELT_S);
  }
  const [melted, setMelted] = useState(false);
  // d'autres sweets attendent ? on les enchaîne depuis « fondu. » au lieu de repasser par la vitrine
  const [next, setNext] = useState<{ item: InboxItem; left: number } | null>(null);
  useEffect(() => {
    if (!melted || welcome) return;
    let alive = true;
    listInbox()
      .then((list) => {
        const rest = list.filter((x) => x.flip_id !== id && !isWelcome(x.flip_id));
        if (alive && rest.length) setNext({ item: rest[0], left: rest.length });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [melted, welcome, id]);
  const goNext = () => {
    if (!next) return;
    track('next_tapped', { left: next.left });
    router.replace(`/read/${next.item.flip_id}`);
  };
  const [meltingWord, setMeltingWord] = useState(false);
  const melt = useSharedValue(0);
  const meltStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (melt.value - 1) * (screenH + 200) }] }));
  // compte à rebours : jauge continue, tic à chaque seconde, ça chauffe à la fin
  const [showReacts, setShowReacts] = useState(false);
  const [bottomH, setBottomH] = useState(STICKERS_H + 160); // estimation avant la mesure réelle du bloc du bas
  const count = useSharedValue(0);
  const hot = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${(1 - count.value) * 100}%` }));
  const hotStyle = useAnimatedStyle(() => ({ opacity: hot.value }));
  useEffect(() => {
    if (!done) return;
    count.value = withTiming(1, { duration: MELT_S * 1000, easing: Easing.linear });
    hot.value = withDelay((MELT_S - HOT_S) * 1000, withTiming(1, { duration: HOT_S * 1000, easing: Easing.in(Easing.quad) }));
    const rt = setTimeout(() => setShowReacts(true), REACT_DELAY_MS);
    const iv = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const to = setTimeout(() => {
      meltHaptic();
      play('melt');
      // d'abord le mot fond lettre par lettre, puis le fond coule par-dessus
      setMeltingWord(true);
      melt.value = withDelay(900, withTiming(1, { duration: 1400, easing: Easing.in(Easing.quad) }));
      setTimeout(() => setMelted(true), 2200);
    }, MELT_S * 1000);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
      clearTimeout(rt);
    };
  }, [done, melt, screenH, count, hot, MELT_S]);
  // un tic à chaque seconde ; les dernières, un petit son en plus
  useEffect(() => {
    if (!done || left >= MELT_S || left <= 0) return;
    tickHaptic();
    if (left <= HOT_S) play('tap', 0.35);
  }, [done, left]);

  useEffect(() => {
    leave.current = { ...leave.current, done, melted, props: meltProps, welcome };
    if (done && !leave.current.at) leave.current.at = Date.now();
  });
  useEffect(
    () => () => {
      const l = leave.current;
      if (l.done && !l.melted && !l.welcome) track('flip_left_early', { ...l.props, after_ms: Date.now() - l.at });
    },
    [],
  );

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
    if (!welcome) reportScreenshot(flip.id).catch(() => {});
  });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (welcome ? Promise.resolve(welcomeFlip()) : openFlip(id))
      .then(async (f) => {
        if (!alive) return;
        setFlip(f);
        track(welcome ? 'welcome_opened' : 'flip_opened');
        const img = welcome ? await loadWelcomePhoto() : await loadImageInMemory(f.photo_url);
        if (alive) setPhoto(img);
      })
      .catch((e) => alive && setError(humanError(e)));
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
    track(welcome ? 'welcome_scratched' : 'flip_scratched', { percent, ms, ...meltProps });
    if (welcome) markWelcomeRead();
    else markScratched(id!, percent, ms).catch(() => {});
    countRead();
  };

  const sendReaction = (r: string, word: string) => {
    if (!done || reaction) return;
    setReaction(r);
    if (welcome) {
      toast(t('welcome.reacted', { e: word }));
      return;
    }
    react(id!, r)
      .then(() => {
        track('flip_reacted', meltProps);
        toast(t('read.reacted', { e: word, name: flip?.sender ?? '' }));
        maybeAskReview();
      })
      .catch(() => setReaction(null));
  };

  const reply = () => {
    draft.reset();
    if (welcome) {
      track('welcome_start');
      if (router.canDismiss()) router.dismissAll(); // sans pile (lien ouvert à froid), dismissAll lève une erreur
      router.replace('/camera');
      return;
    }
    if (flip) {
      draft.replyTo = flip.sender_id;
      draft.replyName = flip.sender;
    }
    track('reply_tapped', meltProps);
    if (router.canDismiss()) router.dismissAll(); // sans pile (lien ouvert à froid), dismissAll lève une erreur
    router.replace('/camera');
    toast(t('read.replyToast', { name: flip?.sender ?? '' }));
  };

  // raison choisie dans le menu : la modération trie plus vite, et Google Play l'attend pour le contenu des utilisateurs
  const REASONS = { harass: 'Harcèlement', sexual: 'Contenu sexuel', violence: 'Violence ou menace', other: 'Autre' } as const;
  const reportFlip = (why: string) =>
    report({ flip_id: id!, reason: REASONS[why as keyof typeof REASONS] ?? REASONS.other })
      .then(() => {
        toast(t('read.reported'));
        router.back();
      })
      .catch((e) => toast(humanError(e)));

  // erreur (déjà gratté, expiré…) : écran de marque, pas de photo
  if (error) {
    return (
      <Screen tone="cerise">
        <View style={[s.head, { marginTop: insets.top + 4 }]}>
          <BackButton tone="cerise" />
        </View>
        <View style={s.zone}>
          <Animated.View entering={FadeInDown.springify()} style={s.err}>
            <Fondue mood="melt" size={130} />
            <Title tone="cerise" size={46} style={{ textAlign: 'center' }}>
              {error}
            </Title>
            <Text style={s.errSub}>{t('read.errSub')}</Text>
            <Button label={t('read.errBack')} icon="inbox" onPress={() => router.replace('/inbox')} style={{ marginTop: 8 }} />
          </Animated.View>
        </View>
      </Screen>
    );
  }

  // la flaque remplit l'espace entre « fondu. » et la feuille du bas ; elle disparaît sur les petits écrans
  const flaqueW = Math.min(300, screenW - 64, (screenH - insets.top - insets.bottom - 560) / 0.573);

  // couleur de l'en-tête : blanc sur la photo, nuit sur le cœur framboise, encre une fois fondu
  const ink = melted ? colors.ink : colors.vanille;
  const inkSub = melted ? colors.muted : colors.mutedOnDark;

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
              wordStyle={flip.word_style}
              mode="free" // l'ancien mode « un seul passage » est retiré : tout se gratte librement
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
              forceReveal={force}
              melting={meltingWord}
              safeTop={insets.top + 60}
              safeBottom={bottomH + 12}
            />
          )}
          {done && !melted && (
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
      </Link.AppleZoomTarget>

      {/* invite de la coque : « gratte. » sur la photo, s'efface au premier coup de doigt */}
      {flip && photo && !done && progress === 0 && (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={[s.cover, { paddingBottom: insets.bottom + 130 }]}>
          {/* en bas, sur un voile : le haut et le centre de la photo (souvent un visage) restent libres */}
          <LinearGradient colors={['rgba(22,15,18,0)', 'rgba(22,15,18,0.5)']} style={StyleSheet.absoluteFill} />
          <Text style={s.coverT} allowFontScaling={false}>
            {t('inbox.scratch')}
          </Text>
          <Text style={s.coverSub}>{t('read.cover', { name: flip.sender })}</Text>
        </Animated.View>
      )}

      {/* en-tête : fermer, « de dan » au centre, options */}
      {!melted && !done && <LinearGradient pointerEvents="none" colors={['rgba(22,15,18,0.5)', 'rgba(22,15,18,0)']} style={[s.scrimTop, { height: insets.top + 110 }]} />}
      <View style={[s.head, { marginTop: insets.top + 4 }]} pointerEvents="box-none">
        <IconButton icon="close" label={t('common.close')} tone={melted ? 'vanille' : 'cacao'} filled onPress={closeRead} />
        {flip ? (
          <View style={s.from} accessible accessibilityRole="header" accessibilityLabel={`${t('read.from', { name: flip.sender })}, ${ago(flip.created_at)}`}>
            <Text style={[s.fromName, { color: ink }]} numberOfLines={1}>
              {t('read.from', { name: flip.sender })}
            </Text>
            <Text style={[s.fromAgo, { color: inkSub }]}>{agoShort(flip.created_at)}</Text>
          </View>
        ) : (
          <View />
        )}
        {flip && !welcome ? (
          <NativeMenu
            title={t('read.reportWhy')}
            items={(['harass', 'sexual', 'violence', 'other'] as const).map((k) => ({ id: k, title: t(`report.${k}`), sf: 'exclamationmark.bubble' as const, destructive: true }))}
            onSelect={reportFlip} label={t('read.more')}>
            {done ? (
              <View style={[s.glassBtn, { backgroundColor: melted ? colors.card : 'rgba(255,255,255,0.14)' }]}>
                <Icon name="more" size={20} color={melted ? colors.ink : colors.vanille} />
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

      {/* fondu : le mot a fondu, ne reste que la réaction et la réponse */}
      {melted && flip ? (
        <>
          <Animated.View entering={FadeIn.duration(500)} style={[s.meltedBox, { top: insets.top + 120 }]} pointerEvents="none">
            <Text style={s.meltT} allowFontScaling={false}>
              {t('read.melted')}
            </Text>
            <Text style={s.meltSub}>{welcome ? t('welcome.readSub') : force ? t('read.readNoScratch', { name: flip.sender }) : t('read.readIn', { s: seconds(ms), name: flip.sender })}</Text>
            {flaqueW >= 180 ? (
              <View style={s.flaque}>
                <Flaque width={flaqueW} />
              </View>
            ) : null}
          </Animated.View>
          <Animated.View entering={FadeInDown.springify().damping(18).delay(200)} style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
            <View style={s.grab} />
            <Text style={s.sheetT}>{t('read.howFelt')}</Text>
            <Text style={s.sheetSub}>{t('read.howFeltSub', { name: flip.sender })}</Text>
            <Stickers reaction={reaction} onPick={sendReaction} />
            <Button label={welcome ? t('welcome.start') : t('read.replyTo', { name: flip.sender })} onPress={reply} style={{ alignSelf: 'stretch', marginTop: 6 }} />
            {next ? (
              <Animated.View entering={FadeIn.delay(500)}>
                <Bounce onPress={goNext} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={next.left > 1 ? t('read.nextMany', { name: next.item.sender.username, n: next.left }) : t('read.next', { name: next.item.sender.username })} style={s.next}>
                  <Text style={s.nextT} numberOfLines={1}>
                    {next.left > 1 ? t('read.nextMany', { name: next.item.sender.username, n: next.left }) : t('read.next', { name: next.item.sender.username })}
                  </Text>
                  <Icon name="arrow" size={16} color={colors.ink} />
                </Bounce>
              </Animated.View>
            ) : null}
          </Animated.View>
        </>
      ) : (
        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]} pointerEvents="box-none" onLayout={(e) => done && !melted && setBottomH(e.nativeEvent.layout.height)}>
          {done ? (
            <>
              {/* la place des réactions est réservée : elles arrivent après la lecture, sans faire bouger le mot */}
              <View style={s.stickersBox}>{showReacts ? <Stickers reaction={reaction} onPick={sendReaction} /> : null}</View>
              {/* le décompte roule seconde par seconde, comme un compteur */}
              <View style={s.statusRow} accessible accessibilityLiveRegion="polite" accessibilityLabel={t('read.meltsIn', { s: left })}>
                {t('read.meltsIn', { s: '\u0000' }).split('\u0000').map((part, i) =>
                  i === 0 ? (
                    <Text key={i} style={[s.status, left <= HOT_S && s.statusHot]}>
                      {part}
                    </Text>
                  ) : (
                    <View key={i} style={s.statusRow}>
                      <Rolling value={left} style={[s.status, left <= HOT_S && s.statusHot]} lineHeight={20} />
                      <Text style={[s.status, left <= HOT_S && s.statusHot]}>{part}</Text>
                    </View>
                  ),
                )}
              </View>
              <View style={s.meltBar}>
                <Animated.View style={[s.meltFill, left <= HOT_S && s.meltFillHot, barStyle]} />
              </View>
              <Button label={welcome ? t('welcome.startShort') : t('read.reply')} tone="vanille" onPress={reply} style={{ alignSelf: 'stretch' }} />
            </>
          ) : flip && photo ? (
            progress === 0 ? (
              <>
                {/* le geste, c'est gratter : « lire sans gratter » reste là (accessibilité) mais en simple lien discret */}
                <Text style={s.rule}>{t('read.meltRule', { s: MELT_S })}</Text>
                <Bounce onPress={() => setForce(true)} accessibilityRole="button" accessibilityLabel={t('read.noScratch')} style={s.noScratch}>
                  <Text style={s.noScratchT}>{t('read.noScratch')}</Text>
                </Bounce>
              </>
            ) : (
              <Glass style={[s.hintRow, { marginBottom: 30 }]}>
                <Text style={s.hintT}>{t('read.keepGoing')}</Text>
                <View style={s.progTrack}>
                  <View style={[s.progFill, { width: `${Math.min(100, progress * 2)}%` }]} />
                </View>
              </Glass>
            )
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** Les cinq autocollants de réaction : celui qu'on choisit rebondit, les autres s'effacent. */
function Stickers({ reaction, onPick }: { reaction: string | null; onPick: (emoji: string, word: string) => void }) {
  return (
    <View style={s.stickers}>
      {REACTIONS.map((r, i) => (
        <Animated.View key={r.key} entering={ZoomIn.springify().damping(11).delay(150 + i * 60)}>
          <Bounce onPress={() => onPick(r.emoji, t(`react.${r.key}`))} scaleTo={0.85} haptic="light" accessibilityRole="button" accessibilityLabel={t('read.react', { e: t(`react.${r.key}`) })} accessibilityState={{ selected: reaction === r.emoji }}>
            <Wiggle on={reaction === r.emoji}>
              <Sticker kind={r.key} on={reaction === r.emoji} dim={!!reaction && reaction !== r.emoji} />
            </Wiggle>
          </Bounce>
        </Animated.View>
      ))}
    </View>
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

const s = StyleSheet.create({
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', top: 0, left: 0, right: 0, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  from: { position: 'absolute', left: 70, right: 70, alignItems: 'center' },
  fromName: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 17 },
  fromAgo: { ...tx.bold, fontSize: 12, marginTop: 2 },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  coverT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 52, color: colors.white, textShadowColor: 'rgba(22,15,18,0.35)', textShadowRadius: 22, textShadowOffset: { width: 0, height: 2 } },
  coverSub: { ...tx.bold, fontSize: 15, color: colors.white, textShadowColor: 'rgba(22,15,18,0.45)', textShadowRadius: 10 },
  meltBox: { position: 'absolute', top: 0, left: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meltLayer: { position: 'absolute', top: 0, left: 0 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, paddingHorizontal: 12 },
  nextT: { ...tx.black, fontSize: 15, color: colors.ink, flexShrink: 1 },
  meltedBox: { position: 'absolute', left: 24, right: 24, gap: 10 },
  meltT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 56, color: colors.ink },
  meltSub: { ...tx.text, fontSize: 15, color: colors.muted },
  flaque: { alignSelf: 'center', marginTop: 18 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, gap: 6, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.paper, shadowColor: '#160F12', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 8 },
  sheetT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 20, color: colors.ink },
  sheetSub: { ...tx.text, fontSize: 13, color: colors.muted, marginBottom: 6 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
  hintT: { ...tx.bold, fontSize: 15, color: colors.vanille },
  rule: { ...tx.bold, fontSize: 12, color: colors.mutedOnDark, marginBottom: 14 },
  progTrack: { width: 90, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progFill: { height: 5, borderRadius: 3, backgroundColor: colors.cerise },
  status: { ...tx.black, fontSize: 15, lineHeight: 20, color: colors.vanille },
  statusHot: { color: '#FF8FA6' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stickersBox: { minHeight: STICKERS_H, justifyContent: 'center' },
  noScratch: { paddingVertical: 6, paddingHorizontal: 12, marginTop: -8, marginBottom: 8 },
  noScratchT: { ...tx.bold, fontSize: 13, color: colors.mutedOnDark, textDecorationLine: 'underline' },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, rowGap: 6, paddingVertical: 4 },
  meltBar: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  meltFill: { height: 8, borderRadius: 4, backgroundColor: colors.citron },
  meltFillHot: { backgroundColor: colors.cerise },
  err: { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  errSub: { ...tx.bold, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
});
