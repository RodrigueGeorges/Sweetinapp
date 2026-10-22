import { kv } from '../lib/kv';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput, type CameraRef } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, { Easing, FadeInDown, FadeOut, FadeOutUp, interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
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

/**
 * La caméra plein écran, le déclencheur cerise, et le Sweet Hour quand il tombe.
 * `guest` : premier secret avant d'avoir un compte (pas de barre d'onglets, pas de Sweet Hour, retour à l'accueil).
 */
export function CameraScreen({ guest = false }: { guest?: boolean }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(facing);
  const photoOutput = usePhotoOutput({ quality: 0.9, qualityPrioritization: 'balanced' });
  const [torch, setTorch] = useState(false);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const shooting = useRef(false);
  const cam = useRef<CameraRef>(null);
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
      return () => setActive(false);
    }, [draft.replyName]),
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
    if (!hasPermission) {
      Haptics.selectionAsync();
      // refusée pour de bon : le système ne redemandera plus, seul l'écran des réglages peut la rendre
      if (!canRequestPermission) return Linking.openSettings();
      const granted = await requestPermission();
      if (!granted) toast(t('camera.permissionDenied'));
      return;
    }
    try {
      shooting.current = true;
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      play('tap', 0.7);
      blink.value = withSequence(withTiming(0.32, { duration: 70, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220 }));
      const file = await photoOutput.capturePhotoToFile({ flashMode: torch ? 'on' : 'off', enableShutterSound: false }, {});
      if (file?.filePath) await go(`file://${file.filePath}`);
      else throw new Error('no photo');
    } catch {
      toast(t('camera.failed'));
    } finally {
      shooting.current = false;
      setBusy(false);
    }
  };

  // pincer pour zoomer (façon stories) : zoom natif VisionCamera (1 = neutre), borné par l'appareil
  const minZoom = device?.minZoom ?? 1;
  const maxZoom = Math.min(device?.maxZoom ?? 8, 8);
  const zoom = useSharedValue(1);
  const zoomStart = useSharedValue(1);
  const flipCam = () => {
    Haptics.selectionAsync();
    seenCoach();
    zoom.value = withTiming(1, { duration: 250 });
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };
  // tap = focus natif VisionCamera (+ anneau), double-tap = flip, pincement = zoom
  const focusRing = useSharedValue(0);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  const doFocus = (x: number, y: number) => {
    cam.current?.focusTo({ x, y }).catch(() => {});
    focusX.value = x;
    focusY.value = y;
    focusRing.value = 0;
    focusRing.value = withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) }));
  };
  const doubleTap = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(flipCam);
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDistance(16)
    .requireExternalGestureToFail(doubleTap)
    .runOnJS(true)
    .onEnd((e) => doFocus(e.x, e.y));
  const pinchZoom = Gesture.Pinch()
    .onStart(() => {
      zoomStart.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.min(maxZoom, Math.max(minZoom, zoomStart.value * e.scale));
    });
  const camGestures = Gesture.Simultaneous(singleTap, doubleTap, pinchZoom);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: focusRing.value,
    left: focusX.value - 34,
    top: focusY.value - 34,
    transform: [{ scale: interpolate(focusRing.value, [0, 1], [1.25, 0.9]) }],
  }));

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [3, 4] });
    if (!r.canceled && r.assets[0]) await go(r.assets[0].uri);
  };

  const mm = sweet !== null ? `${Math.floor(sweet / 60)}:${String(sweet % 60).padStart(2, '0')}` : '';

  // le double-tap pour retourner la caméra est invisible : on le souffle une seule fois, au premier passage
  const [coach, setCoach] = useState(false);
  useEffect(() => {
    kv.getItem(COACH_FLIP)
      .then((v) => setCoach(!v))
      .catch(() => {});
  }, []);
  const seenCoach = () => {
    setCoach(false);
    kv.setItem(COACH_FLIP, '1').catch(() => {});
  };
  useEffect(() => {
    // le timer ne part que quand la pastille est visible (après l'accord caméra) :
    // sinon le prompt de permission la consomme avant qu'on la voie
    if (!coach || !hasPermission) return;
    const to = setTimeout(seenCoach, 8000);
    return () => clearTimeout(to);
  }, [coach, hasPermission]);

  return (
    <Screen tone="cacao">
      {hasPermission && active && device && (
        <Camera
          ref={cam}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={active}
          outputs={[photoOutput]}
          zoom={zoom}
          torchMode={torch ? 'on' : 'off'}
          resizeMode="cover"
        />
      )}
      {/* anneau de focus au point tapé */}
      {hasPermission && <Reanimated.View pointerEvents="none" style={[s.focusRing, ringStyle]} />}
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
        {hasPermission ? (
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

      {!hasPermission && (
        <View style={s.permWrap}>
          <Icon name="snap" size={56} color={colors.vanille} stroke={2} />
          <Title tone="cacao" size={40} style={{ textAlign: 'center' }}>
            {t('camera.needPermission')}
          </Title>
          <Text style={s.permSub}>{!canRequestPermission ? t('camera.permissionDenied') : t('camera.needPermissionSub')}</Text>
        </View>
      )}

      <View style={[s.bottom, { bottom: (guest ? 40 : layout.tabBarHeight + 34) + Math.max(insets.bottom, 12) }]}>
        {coach && hasPermission ? (
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
          <Bounce accessibilityRole="button" accessibilityLabel={hasPermission ? t('camera.a11yShoot') : !canRequestPermission ? t('camera.openSettings') : t('camera.allow')} onPress={shoot} style={s.shutter} scaleTo={0.88} haptic={false} disabled={busy}>
            <View style={s.ring} />
            <View style={s.shutterIn}>{!hasPermission ? <Text style={s.allowT}>{!canRequestPermission ? t('camera.openSettings') : t('camera.allow')}</Text> : null}</View>
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
  focusRing: { position: 'absolute', width: 68, height: 68, borderRadius: 12, borderWidth: 2, borderColor: colors.vanille },
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
