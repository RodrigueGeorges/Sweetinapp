import * as Haptics from 'expo-haptics';
import { Logo } from '../components/Logo';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp, interpolate, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
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
import { layout, motion, tx, useStyles, useTheme, type Palette } from '../theme';

const MAX = 90;
/** Le secret rapetisse quand il s'allonge, pour toujours tenir sur la carte. */
const fit = (n: number) => (n > 70 ? 18 : n > 45 ? 20 : n > 20 ? 23 : 27);
const IDEAS: Key[] = ['create.idea1', 'create.idea2', 'create.idea3', 'create.idea4', 'create.idea5'];

/** Carte polaroid : on valide la photo (recto), elle se retourne, on écrit le secret (verso). */
export default function Create() {
  const { colors } = useTheme();
  const s = useStyles(themed);
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

  // la photo « se développe » comme un vrai polaroid : voile laiteux puis couleurs
  const develop = useSharedValue(reduce ? 0 : 1);
  useEffect(() => {
    develop.value = withDelay(250, withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [develop]);
  const veil = useAnimatedStyle(() => ({ opacity: develop.value }));
  const sepia = useAnimatedStyle(() => ({ opacity: develop.value * 0.5 }));

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
    draft.message = m;
    draft.mode = once ? 'once' : 'free';
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header back={flipped ? () => flip(false) : true} title={flipped ? t('create.titleBack') : t('create.titleFront')} />
        <ScrollView contentContainerStyle={s.zone} keyboardShouldPersistTaps="handled" scrollEnabled={false}>
          <Animated.View entering={FadeInUp.springify().damping(14)} style={{ transform: [{ rotate: '-1.5deg' }] }}>
            <TiltCard tilt={tilt} style={{ width: w, height: cardH }}>
              {/* recto */}
              <Animated.View style={[s.cardWrap, front]} pointerEvents={flipped ? 'none' : 'auto'}>
                <View style={s.plate} />
                <View style={s.card}>
                  <View style={{ width: w - 14, height: photoH, borderRadius: 16, overflow: 'hidden' }}>
                    <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#B98E5E' }, sepia]} />
                    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.vanille }, veil]} />
                    {!reduce && <HoloLayer width={w - 14} height={photoH} tilt={tilt} strength={0.7} />}
                  </View>
                  <View style={s.strip}>
                    <Bounce accessibilityLabel={t('create.retake')} accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={s.stripBtn} scaleTo={0.85}>
                      <Icon name="retake" size={18} />
                      <Text style={s.stripT}>{t('create.retake')}</Text>
                    </Bounce>
                    <Logo size={13} color={colors.cerise} />
                  </View>
                </View>
              </Animated.View>

              {/* verso */}
              <Animated.View style={[s.cardWrap, back]} pointerEvents={flipped ? 'auto' : 'none'}>
                <View style={s.plate} />
                <View style={[s.card, { backgroundColor: colors.white }]}>
                  <View style={{ width: w - 14, height: photoH, borderRadius: 16, overflow: 'hidden' }}>
                    <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,244,230,0.8)' }]} />
                    <View style={s.inputWrap}>
                      {flipped && (
                        <TextInput
                          value={text}
                          onChangeText={(v) => setText(v.slice(0, MAX))}
                          placeholder={t('create.placeholder')}
                          placeholderTextColor="#B9A797"
                          multiline
                          autoFocus
                          maxLength={MAX}
                          selectionColor={colors.cerise}
                          style={[s.input, { fontSize: fit(text.length), lineHeight: fit(text.length) * 1.28 }]}
                          accessibilityLabel={t('create.secretA11y')}
                        />
                      )}
                    </View>
                    <View style={[s.count, text.length > MAX - 10 && { backgroundColor: colors.cerise }]}>
                      <Text style={s.countT}>
                        {text.length}/{MAX}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.strip, { justifyContent: 'center', gap: 6 }]}>
                    <Icon name="lock" size={15} stroke={2.6} />
                    <Text style={s.stripT}>{t('create.invisible')}</Text>
                  </View>
                </View>
              </Animated.View>
            </TiltCard>
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
            <Text style={s.tip}>{t('create.tip')}</Text>
          )}
        </ScrollView>
        <BottomCTA>
          {flipped ? (
            <Button label={t('create.next')} arrow disabled={!text.trim()} onPress={next} haptic="medium" />
          ) : (
            <Button label={t('create.keep')} icon="check" tone="cerise" onPress={() => flip(true)} haptic={false} accessibilityLabel={t('create.validate')} />
          )}
        </BottomCTA>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
  zone: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 22 },
  cardWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  plate: { display: 'none' },
  // carte photo nette : fond blanc, ombre douce, pas de contour
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 26, padding: 7, paddingBottom: 0, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  strip: { height: layout.stripHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  stripBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  stripT: { ...tx.bold, fontSize: 13, color: colors.cacao },
  inputWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 22 },
  input: { ...tx.black, fontSize: 23, lineHeight: 30, color: colors.cacao, textAlign: 'center', textAlignVertical: 'center', maxHeight: '100%' },
  count: { position: 'absolute', right: 10, bottom: 10, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.cacao },
  countT: { ...tx.bold, fontSize: 11, color: colors.vanille },
  ideas: { gap: 8, paddingHorizontal: 20 },
  idea: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  ideaT: { ...tx.bold, fontSize: 14, color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  optionT: { ...tx.black, fontSize: 15, color: colors.ink },
  optionS: { ...tx.text, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  tip: { ...tx.text, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
});
