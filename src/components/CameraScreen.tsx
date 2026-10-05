import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeOutUp, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
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
import { colors, fonts, layout, tx } from '../theme';

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
  const cam = useRef<CameraView>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  // zoom par pincement : 0 = grand-angle natif de l'appareil, 1 = zoom max
  const [zoom, setZoom] = useState(0);
  const zoomCur = useRef(0);
  const zoomStart = useRef(0);
  const sweet = useSweetHour(!guest);
  const [replyName, setReplyName] = useState<string | null>(draft.replyName);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  // la caméra ne tourne que quand l'onglet est affiché (batterie)
  const syncDraft = useCallback(() => setReplyName(draft.replyName), [setReplyName]);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      syncDraft();
      return () => setActive(false);
    }, [syncDraft]),
  );

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  const go = (uri: string) => {
    draft.uri = uri;
    // série en danger : message pré-rempli, on file directement à l'envoi (2 taps)
    draft.message = draft.quick ? t('streak.quick') : '';
    // la réponse reste attachée au brouillon jusqu'à l'envoi
    router.push(draft.quick ? '/sendto' : '/create');
  };

  const shoot = async () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) return toast(t('camera.permissionDenied'));
      return;
    }
    try {
      setBusy(true);
      flash.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 380 }));
      const photo = await cam.current?.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) go(photo.uri);
    } catch {
      toast(t('camera.failed'));
    } finally {
      setBusy(false);
    }
  };

  const flipCam = () => {
    Haptics.selectionAsync();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };
  const doubleTap = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(flipCam);
  // pincer pour zoomer (comme dans l'appareil photo natif), double-tap pour retourner la caméra
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      zoomStart.current = zoomCur.current;
    })
    .onUpdate((e) => {
      const z = Math.min(1, Math.max(0, zoomStart.current + (e.scale - 1) * 0.6));
      zoomCur.current = z;
      setZoom(z);
    });
  const camGestures = Gesture.Race(pinch, doubleTap);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [3, 4] });
    if (!r.canceled && r.assets[0]) go(r.assets[0].uri);
  };

  const ring = { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.3] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }) };
  const mm = sweet !== null ? `${Math.floor(sweet / 60)}:${String(sweet % 60).padStart(2, '0')}` : '';

  return (
    <Screen tone="cacao">
      {perm?.granted && active && <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} zoom={zoom} flash={torch ? 'on' : 'off'} animateShutter />}
      {/* double tap = selfie, pincement = zoom */}
      <GestureDetector gesture={camGestures}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
      <LinearGradient colors={['rgba(26,10,14,0.7)', 'rgba(26,10,14,0)']} style={[s.shade, { height: 200 }]} pointerEvents="none" />
      <LinearGradient colors={sweet !== null ? ['rgba(255,45,95,0)', 'rgba(255,45,95,0.75)'] : ['rgba(26,10,14,0)', 'rgba(26,10,14,0.65)']} style={[s.shade, { bottom: 0, height: 320 }]} pointerEvents="none" />

      <View style={[s.top, { marginTop: insets.top + 6 }]}>
        {guest ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton icon="back" label={t('common.back')} tone="cacao" filled onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
            <Logo size={22} color={colors.white} />
          </View>
        ) : (
          <Logo size={22} color={colors.white} />
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
          <Text style={s.permSub}>{t('camera.needPermissionSub')}</Text>
        </View>
      )}

      <View style={[s.bottom, { bottom: (guest ? 40 : layout.tabBarHeight + 34) + Math.max(insets.bottom, 12) }]}>
        <View style={s.controls}>
          <Bounce onPress={pick} accessibilityRole="button" accessibilityLabel={t('camera.gallery')} scaleTo={0.88}>
            <Glass style={s.side}>
              <Icon name="gallery" size={24} color={colors.vanille} />
            </Glass>
          </Bounce>
          <View style={s.btnWrap}>
            <Animated.View pointerEvents="none" style={[s.pulse, ring]} />
            <Bounce accessibilityRole="button" accessibilityLabel={perm?.granted ? t('camera.a11yShoot') : t('camera.allow')} onPress={shoot} style={s.shutter} scaleTo={0.9} haptic={false}>
              <View style={s.shutterIn}>{!perm?.granted ? <Text style={s.allowT}>{t('camera.allow')}</Text> : null}</View>
            </Bounce>
          </View>
          <Bounce accessibilityLabel={t('camera.switch')} accessibilityRole="button" hitSlop={10} onPress={flipCam} scaleTo={0.85}>
            <Glass style={s.side}>
              <Icon name="flipCam" size={24} color={colors.vanille} />
            </Glass>
          </Bounce>
        </View>
      </View>
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.vanille }, flashStyle]} />
    </Screen>
  );
}

const s = StyleSheet.create({
  shade: { position: 'absolute', left: 0, right: 0, top: 0 },
  top: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, gap: 12 },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.pistache },
  replyT: { flexShrink: 1, ...tx.black, fontSize: 13, color: colors.cacao },
  sweet: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 2 },
  sweetT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 88, lineHeight: 94, letterSpacing: -2.5, color: colors.vanille, marginTop: 4 },
  sweetB: { ...tx.black, fontSize: 15, color: colors.vanille },
  permWrap: { position: 'absolute', top: '24%', left: 36, right: 36, alignItems: 'center', gap: 16 },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 14 },
  permSub: { ...tx.bold, fontSize: 15, lineHeight: 21, color: colors.mutedOnDark, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  side: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.vanille },
  shutter: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.vanille, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.cerise, borderWidth: 2.5, borderColor: colors.cacao, alignItems: 'center', justifyContent: 'center' },
  allowT: { ...tx.black, fontSize: 11, lineHeight: 13, color: colors.vanille, textAlign: 'center', paddingHorizontal: 6 },
});
