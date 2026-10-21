import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, { Easing, FadeInDown, FadeOut, FadeOutUp, useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bounce } from '../components/Bounce';
import { Glass } from '../components/Glass';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { useToast } from '../components/Toast';
import { Chip, IconButton, Screen, Title } from '../components/ui';
import { t } from '../i18n';
import { draft } from '../lib/draft';
import { useSweetHour } from '../lib/useSweetHour';
import { play } from '../lib/sounds';
import { colors, fonts, layout, tx } from '../theme';

const COACH_FLIP = 'sweetin.coach.camflip';
// zoom piloté en UI thread : la prop native `zoom` (0–1) suit le pincement sans re-render
const AnimatedCamera = Reanimated.createAnimatedComponent(CameraView);

/**
 * La caméra plein écran, le déclencheur cerise, et le Sweet Hour quand il tombe.
 * `guest` : premier secret avant d'avoir un compte (pas de barre d'onglets, pas de Sweet Hour, retour à l'accueil).
 */
export function CameraScreen({ guest = false }: { guest?: boolean }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const shooting = useRef(false);
  const cam = useRef<CameraView>(null);
  const paused = useRef(false);
  const sweet = useSweetHour(!guest);
  const [replyName, setReplyName] = useState<string | null>(draft.replyName);
  // déclenchement : un clin d'œil nuit très bref (pas de flash blanc), l'image se fige aussitôt
  const blink = useSharedValue(0);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  // la caméra ne tourne que quand l'onglet est affiché (batterie)
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      setReplyName(draft.replyName);
      // retour sur la caméra (« reprendre ») : l'aperçu figé repart
      if (paused.current) {
        paused.current = false;
        cam.current?.resumePreview().catch(() => {});
      }
      return () => setActive(false);
    }, []),
  );

  const go = async (uri: string) => {
    draft.uri = uri;
    draft.message = '';
    draft.fromCamera = true;
    // l'image est déjà décodée quand la carte s'ouvre : pas d'écran vide entre les deux
    await Image.prefetch(uri).catch(() => false);
    // la réponse reste attachée au brouillon jusqu'à l'envoi
    router.push('/create');
  };

  const shoot = async () => {
    // ref synchrone : deux appuis dans la même frame passeraient le garde `busy` (state pas encore re-rendu)
    if (busy || shooting.current) return;
    if (!perm?.granted) {
      Haptics.selectionAsync();
      // refusée pour de bon : le système ne redemandera plus, seul l'écran des réglages peut la rendre
      if (perm && !perm.canAskAgain) return Linking.openSettings();
      const r = await requestPerm();
      if (!r.granted && !r.canAskAgain) toast(t('camera.permissionDenied'));
      return;
    }
    try {
      shooting.current = true;
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      play('tap', 0.7);
      blink.value = withSequence(withTiming(0.32, { duration: 70, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220 }));
      // pausePreview() fait unbindAll() côté natif : l'appeler pendant la capture détache ImageCapture
      // et la promesse ne se résout jamais — on fige l'aperçu seulement une fois la photo en main.
      const photo = await cam.current?.takePictureAsync({ quality: 0.82, shutterSound: false });
      if (photo?.uri) {
        cam.current?.pausePreview().then(() => (paused.current = true)).catch(() => {});
        await go(photo.uri);
      } else throw new Error('no photo');
    } catch {
      if (paused.current) {
        paused.current = false;
        cam.current?.resumePreview().catch(() => {});
      }
      toast(t('camera.failed'));
    } finally {
      shooting.current = false;
      setBusy(false);
    }
  };

  // pincer pour zoomer (façon stories) : 0 = champ max, 1 = zoom numérique max de l'appareil
  const zoom = useSharedValue(0);
  const zoomStart = useSharedValue(0);
  const flipCam = () => {
    Haptics.selectionAsync();
    seenCoach();
    zoom.value = withTiming(0, { duration: 250 });
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };
  const doubleTap = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(flipCam);
  const pinchZoom = Gesture.Pinch()
    .onStart(() => {
      zoomStart.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.min(1, Math.max(0, zoomStart.value * e.scale));
    });
  const camProps = useAnimatedProps(() => ({ zoom: zoom.value }));
  const camGestures = Gesture.Simultaneous(doubleTap, pinchZoom);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [3, 4] });
    if (!r.canceled && r.assets[0]) await go(r.assets[0].uri);
  };

  const mm = sweet !== null ? `${Math.floor(sweet / 60)}:${String(sweet % 60).padStart(2, '0')}` : '';

  // le double-tap pour retourner la caméra est invisible : on le souffle une seule fois, au premier passage
  const [coach, setCoach] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(COACH_FLIP)
      .then((v) => setCoach(!v))
      .catch(() => {});
  }, []);
  const seenCoach = () => {
    setCoach(false);
    AsyncStorage.setItem(COACH_FLIP, '1').catch(() => {});
  };
  useEffect(() => {
    // le timer ne part que quand la pastille est visible (après l'accord caméra) :
    // sinon le prompt de permission la consomme avant qu'on la voie
    if (!coach || !perm?.granted) return;
    const to = setTimeout(seenCoach, 8000);
    return () => clearTimeout(to);
  }, [coach, perm?.granted]);

  return (
    <Screen tone="cacao">
      {perm?.granted && active && <AnimatedCamera ref={cam} style={StyleSheet.absoluteFill} facing={facing} flash={torch ? 'on' : 'off'} animateShutter={false} animatedProps={camProps} />}
      {/* double tap n'importe où : on change de caméra ; pincer : on zoome */}
      <GestureDetector gesture={camGestures}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
      {/* léger fondu bas uniquement pendant le Sweet Hour (compte à rebours lisible) */}
      {sweet !== null && (
        <LinearGradient colors={['rgba(255,46,91,0)', 'rgba(255,46,91,0.8)']} style={[s.shade, { bottom: 0, height: 320 }]} pointerEvents="none" />
      )}

      <View style={[s.top, { marginTop: insets.top + 6 }]}>
        {guest ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton icon="back" label={t('common.back')} tone="cacao" filled onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
            <Logo size={22} color={colors.white} />
          </View>
        ) : (
          // ouverte en plein écran depuis le déclencheur de la vitrine : on la referme vers la vitrine
          <IconButton icon="close" label={t('common.close')} tone="cacao" filled onPress={() => (router.canGoBack() ? router.back() : router.replace('/inbox'))} />
        )}
        {!guest && (
          <View style={s.logoMid} pointerEvents="none">
            <Logo size={24} color={colors.white} />
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {replyName ? (
          <Pressable
            onPress={() => {
              draft.replyTo = null;
              draft.replyName = null;
              setReplyName(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('camera.replyTo', { name: replyName })}. ${t('camera.replyCancel')}`}
            hitSlop={8}
          >
            <View style={s.reply}>
              <Icon name="message" size={15} />
              <Text style={s.replyT} numberOfLines={1}>
                {t('camera.replyTo', { name: `@${replyName}` })}
              </Text>
              <Icon name="close" size={14} stroke={3} />
            </View>
          </Pressable>
        ) : null}
        {perm?.granted ? (
          <IconButton
            icon={torch ? 'flash' : 'flashOff'}
            label={torch ? t('camera.flashOff') : t('camera.flashOn')}
            tone="cacao"
            filled
            onPress={() => setTorch((v) => !v)}
          />
        ) : null}
        </View>
      </View>

      {sweet !== null && (
        <Reanimated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOutUp} style={[s.sweet, { top: insets.top + 70 }]} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${t('sweet.title')}. ${t('sweet.body')} ${mm}`}>
          <Chip label={t('sweet.title')} tone="pistache" icon="sparkle" style={{ alignSelf: 'center' }} />
          <Text style={s.sweetT} allowFontScaling={false}>
            {mm}
          </Text>
          <Text style={s.sweetB}>{t('sweet.body')}</Text>
        </Reanimated.View>
      )}

      {!perm?.granted && (
        <View style={s.permWrap}>
          <Icon name="snap" size={56} color={colors.vanille} stroke={2} />
          <Title tone="cacao" size={40} style={{ textAlign: 'center' }}>
            {t('camera.needPermission')}
          </Title>
          <Text style={s.permSub}>{perm && !perm.canAskAgain ? t('camera.permissionDenied') : t('camera.needPermissionSub')}</Text>
        </View>
      )}

      <View style={[s.bottom, { bottom: (guest ? 40 : layout.tabBarHeight + 34) + Math.max(insets.bottom, 12) }]}>
        {coach && perm?.granted ? (
          <Reanimated.View entering={FadeInDown.springify()} exiting={FadeOut.duration(180)} style={s.coach} pointerEvents="none" accessibilityLiveRegion="polite">
            <Text style={s.coachT}>{t('camera.coachFlip')}</Text>
          </Reanimated.View>
        ) : null}
        <View style={s.controls}>
          <Bounce onPress={pick} accessibilityRole="button" accessibilityLabel={t('camera.gallery')} scaleTo={0.88}>
            <Glass style={s.side}>
              <Icon name="gallery" size={24} color={colors.vanille} />
            </Glass>
          </Bounce>
          {/* même déclencheur que la vitrine (DA Fondant) : 84 pt de framboise, l'espace du fond, un anneau blanc sur la caméra */}
          <Bounce accessibilityRole="button" accessibilityLabel={perm?.granted ? t('camera.a11yShoot') : perm && !perm.canAskAgain ? t('camera.openSettings') : t('camera.allow')} onPress={shoot} style={s.shutter} scaleTo={0.88} haptic={false} disabled={busy}>
            <View style={s.ring} />
            <View style={s.shutterIn}>{!perm?.granted ? <Text style={s.allowT}>{perm && !perm.canAskAgain ? t('camera.openSettings') : t('camera.allow')}</Text> : null}</View>
          </Bounce>
          <Bounce accessibilityLabel={t('camera.switch')} accessibilityRole="button" hitSlop={10} onPress={flipCam} scaleTo={0.85}>
            <Glass style={s.side}>
              <Icon name="flipCam" size={24} color={colors.vanille} />
            </Glass>
          </Bounce>
        </View>
      </View>
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.cacao }, blinkStyle]} />
    </Screen>
  );
}

const s = StyleSheet.create({
  logoMid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  shade: { position: 'absolute', left: 0, right: 0, top: 0 },
  top: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, gap: 12 },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.pistache },
  replyT: { flexShrink: 1, ...tx.black, fontSize: 13, color: colors.cacao },
  sweet: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 2 },
  sweetT: { fontFamily: fonts.displayHeavy, includeFontPadding: false, fontSize: 64, lineHeight: 68, color: colors.onBrand, marginTop: 4 },
  sweetB: { ...tx.black, fontSize: 15, color: colors.onBrand },
  permWrap: { position: 'absolute', top: '24%', left: 36, right: 36, alignItems: 'center', gap: 16 },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 14 },
  permSub: { ...tx.bold, fontSize: 15, lineHeight: 21, color: colors.mutedOnDark, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  coach: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(22,15,18,0.72)' },
  coachT: { ...tx.bold, fontSize: 14, color: colors.vanille },
  side: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  // 84 de framboise + 6 d'espace + 3 d'anneau blanc (comme Shutter, en version sombre)
  shutter: { width: 102, height: 102, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 102, height: 102, borderRadius: 51, borderWidth: 3, borderColor: colors.white },
  shutterIn: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.cerise, alignItems: 'center', justifyContent: 'center' },
  allowT: { ...tx.black, fontSize: 11, lineHeight: 13, color: colors.vanille, textAlign: 'center', paddingHorizontal: 6 },
});
