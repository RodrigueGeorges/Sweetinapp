import * as Haptics from 'expo-haptics';
import { Mark } from '../components/Logo';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, interpolate, runOnJS, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Bounce } from '../components/Bounce';
import { HoloLayer } from '../components/Holo';
import { Icon } from '../components/Icon';
import { TiltCard } from '../components/TiltCard';
import { BottomCTA, Button, Header, Screen, Toggle } from '../components/ui';
import { t, type Key } from '../i18n';
import { draft } from '../lib/draft';
import { track } from '../lib/monitoring';
import { useSession } from '../lib/session';
import { play } from '../lib/sounds';
import { useTilt } from '../lib/useTilt';
import { colors, fonts, isDark, layout, motion, tx } from '../theme';

const MAX = 90;
/** Le secret rapetisse quand il s'allonge, pour toujours tenir sur la carte. */
// Climate Crisis est très large : tailles plus petites qu'avec une fonte normale
const fit = (n: number) => (n > 70 ? 17 : n > 45 ? 19 : n > 20 ? 22 : 26);
const IDEAS: Key[] = ['create.idea1', 'create.idea2', 'create.idea3', 'create.idea4', 'create.idea5'];

/** Carte polaroid : on valide la photo (recto), elle se retourne, on écrit le secret (verso). */
export default function Create() {
  const { session } = useSession();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const w = Math.max(160, Math.min(layout.cardWidth, screenW - 72, (screenH - 360) / layout.cardRatio));
  const photoH = w * layout.cardRatio;
  const [flipped, setFlipped] = useState(false);
  const [text, setText] = useState(draft.message);
  const [once, setOnce] = useState(draft.mode === 'once');
  const rot = useSharedValue(0);
  const reduce = useReducedMotion();

  // la carte suit l'inclinaison du téléphone, sauf pendant qu'on écrit au dos
  const raw = useTilt();
  const on = useSharedValue(1);
  const tilt = { x: useDerivedValue(() => raw.x.value * on.value), y: useDerivedValue(() => raw.y.value * on.value) };

  // arrivée depuis la caméra : la photo plein écran se réduit et devient la carte (aucun flash, aucun fondu blanc)
  const [fromCam] = useState(() => draft.takeFromCamera() && !reduce);
  const intro = useSharedValue(fromCam ? 0 : 1);
  const [introDone, setIntroDone] = useState(!fromCam);
  const photoRef = useRef<View>(null);
  const measured = useRef(false);
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const pw = useSharedValue(screenW);
  const ph = useSharedValue(screenH);
  const landed = () => {
    setIntroDone(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onPhotoLayout = () => {
    if (!fromCam || measured.current) return;
    measured.current = true;
    requestAnimationFrame(() =>
      photoRef.current?.measureInWindow((x, y, mw, mh) => {
        px.value = x;
        py.value = y;
        pw.value = mw;
        ph.value = mh;
        intro.value = withSpring(1, { damping: 19, stiffness: 170, mass: 0.9 }, (f) => {
          if (f) runOnJS(landed)();
        });
      }),
    );
  };
  const overlay = useAnimatedStyle(() => {
    const k = intro.value;
    return {
      left: px.value * k,
      top: py.value * k,
      width: screenW + (pw.value - screenW) * k,
      height: screenH + (ph.value - screenH) * k,
      borderRadius: 16 * k,
      transform: [{ rotate: `${-1.5 * k}deg` }],
    };
  });
  const cardIn = useAnimatedStyle(() => ({ opacity: interpolate(intro.value, [0.82, 1], [0, 1], 'clamp') }));
  const uiIn = useAnimatedStyle(() => ({ opacity: interpolate(intro.value, [0.35, 1], [0, 1], 'clamp') }));

  const flip = (to: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    play('tap', 0.8);
    setFlipped(to);
    on.value = withTiming(to ? 0 : 1, { duration: 300 });
    rot.value = withSpring(to ? 180 : 0, motion.card);
  };

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rot.value}deg` }],
    opacity: interpolate(rot.value, [89, 91], [1, 0], 'clamp'),
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rot.value + 180}deg` }],
    opacity: interpolate(rot.value, [89, 91], [0, 1], 'clamp'),
  }));

  const next = () => {
    const m = text.trim();
    if (!m) return;
    draft.setMessage(m, once);
    if (session) return router.push('/sendto');
    // premier secret sans compte : on le garde de côté et on crée le compte pour l'envoyer
    draft.save();
    track('guest_signup');
    router.push({ pathname: '/auth', params: { mode: 'signup', next: 'send' } });
  };

  const idea = (k: Key) => {
    Haptics.selectionAsync();
    setText(t(k).slice(0, MAX));
  };

  if (!draft.uri) return <Redirect href={session ? '/camera' : '/try'} />;
  const cardH = photoH + layout.stripHeight + 7;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Animated.View style={uiIn}>
          <Header back={flipped ? () => flip(false) : true} title={flipped ? t('create.titleBack') : t('create.titleFront')} />
        </Animated.View>
        <ScrollView contentContainerStyle={s.zone} keyboardShouldPersistTaps="handled" scrollEnabled={false}>
          {/* l'entrée anime le wrapper : le penché de la carte et cardIn restent sur la vue intérieure */}
          <Animated.View entering={fromCam ? undefined : FadeInUp.springify().damping(14)}>
          <Animated.View style={[{ transform: [{ rotate: '-1.5deg' }] }, cardIn]}>
            <TiltCard tilt={tilt} style={{ width: w, height: cardH }}>
              {/* recto */}
              <Animated.View style={[s.cardWrap, front]} pointerEvents={flipped ? 'none' : 'auto'}>
                <View style={s.plate} />
                <View style={s.card}>
                  <View ref={photoRef} onLayout={onPhotoLayout} collapsable={false} style={{ width: w - 14, height: photoH, borderRadius: 16, overflow: 'hidden' }}>
                    <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {!reduce && <HoloLayer width={w - 14} height={photoH} tilt={tilt} strength={0.4} />}
                  </View>
                  <View style={s.strip}>
                    <Bounce accessibilityLabel={t('create.retake')} accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={s.stripBtn} scaleTo={0.85}>
                      <Icon name="retake" size={18} color={colors.cacao} />
                      <Text style={s.stripT}>{t('create.retake')}</Text>
                    </Bounce>
                    <Mark size={22} color={colors.cerise} cone={colors.cacao} />
                  </View>
                </View>
              </Animated.View>

              {/* verso */}
              <Animated.View style={[s.cardWrap, back]} pointerEvents={flipped ? 'auto' : 'none'}>
                <View style={s.plate} />
                {/* le cœur (DA Fondant) : nuit, le mot en display blanc, une pointe de citron */}
                <View style={s.heart}>
                  <Text style={s.over}>{t('create.hiddenUnder')}</Text>
                  <View style={s.inputWrap}>
                    {flipped && (
                      <TextInput
                        value={text}
                        onChangeText={(v) => setText(v.slice(0, MAX))}
                        placeholder={t('create.placeholder')}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        multiline
                        autoFocus
                        maxLength={MAX}
                        selectionColor={colors.citron}
                        cursorColor={colors.citron}
                        style={[s.input, { fontSize: fit(text.length), lineHeight: fit(text.length) * 1.12 }]}
                        accessibilityLabel={t('create.secretA11y')}
                      />
                    )}
                  </View>
                  <Text style={[s.countT, text.length > MAX - 10 && { color: colors.citron }]}>
                    {text.length}/{MAX}
                  </Text>
                </View>
              </Animated.View>
            </TiltCard>
          </Animated.View>
          </Animated.View>

          {flipped ? (
            <Animated.View entering={FadeInDown.delay(250).springify()} style={{ alignSelf: 'stretch', gap: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={s.ideas} keyboardShouldPersistTaps="always">
                {IDEAS.map((k) => (
                  <Pressable key={k} onPress={() => idea(k)} accessibilityRole="button" style={({ pressed }) => [s.idea, pressed && { backgroundColor: colors.pistache }]}>
                    <Text style={s.ideaT}>{t(k)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={s.option}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionT}>{t('send.once')}</Text>
                  <Text style={s.optionS}>{t('send.onceHint')}</Text>
                </View>
                <Toggle label={t('send.once')} value={once} onValueChange={setOnce} />
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[{ alignItems: 'center', gap: 14, alignSelf: 'stretch' }, uiIn]}>
              <Text style={s.tip}>{t('create.tip')}</Text>
              {/* le mode « un seul passage » est visible dès le recto : plus besoin de retourner la carte pour le découvrir */}
              <Bounce onPress={() => { Haptics.selectionAsync(); setOnce((v) => !v); }} accessibilityRole="togglebutton" accessibilityState={{ checked: once }} accessibilityLabel={`${t('send.once')}. ${t('send.onceHint')}`} scaleTo={0.94} haptic={false}>
                <View style={[s.onceChip, once && s.onceChipOn]}>
                  <Icon name="hourglass" size={14} color={once ? colors.cacao : colors.muted} stroke={2.6} />
                  <Text style={[s.onceT, once && s.onceTOn]}>{t('send.once')}</Text>
                  <View style={[s.onceDot, once && { backgroundColor: colors.cerise, borderColor: colors.cerise }]}>{once ? <Icon name="check" size={9} stroke={3.6} color={colors.white} /> : null}</View>
                </View>
              </Bounce>
            </Animated.View>
          )}
        </ScrollView>
        <Animated.View style={uiIn}>
        <BottomCTA>
          {flipped ? (
            <Button label={t('create.next')} arrow disabled={!text.trim()} onPress={next} haptic="medium" />
          ) : (
            <Button label={t('create.keep')} arrow onPress={() => flip(true)} haptic={false} accessibilityLabel={t('create.validate')} />
          )}
        </BottomCTA>
        </Animated.View>
      </KeyboardAvoidingView>
      {/* la photo prise, plein écran, qui se pose dans la carte */}
      {!introDone && (
        <Animated.View pointerEvents="none" style={[s.overlay, overlay]}>
          <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', overflow: 'hidden', zIndex: 50, backgroundColor: colors.cacao },
  zone: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 22 },
  cardWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  plate: { display: 'none' },
  // carte photo nette : fond blanc, ombre douce, pas de contour
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 26, padding: 7, paddingBottom: 0, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  strip: { height: layout.stripHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  stripBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  stripT: { ...tx.bold, fontSize: 13, color: colors.cacao },
  heart: { flex: 1, borderRadius: 26, backgroundColor: colors.coeur, borderWidth: isDark ? 1 : 0, borderColor: 'rgba(255,255,255,0.14)', padding: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  over: { ...tx.black, fontSize: 13, color: colors.citron },
  inputWrap: { flex: 1, justifyContent: 'center' },
  input: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 23, lineHeight: 26, color: colors.onCoeur, textAlign: 'left', textAlignVertical: 'center', maxHeight: '100%' },
  countT: { alignSelf: 'flex-end', ...tx.bold, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  ideas: { gap: 8, paddingHorizontal: 20 },
  idea: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  ideaT: { ...tx.bold, fontSize: 14, color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  optionT: { ...tx.black, fontSize: 15, color: colors.ink },
  optionS: { ...tx.text, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  tip: { ...tx.text, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  onceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed },
  onceChipOn: { backgroundColor: colors.citron, borderStyle: 'solid', borderColor: colors.citron },
  onceT: { ...tx.black, fontSize: 13.5, color: colors.muted },
  onceTOn: { color: colors.cacao },
  onceDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.dashed, alignItems: 'center', justifyContent: 'center' },
});
