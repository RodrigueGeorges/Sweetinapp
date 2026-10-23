import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { BackButton, Body, BottomCTA, Button, Chip, Header, Screen, Title } from '../components/ui';
import { t, humanError } from '../i18n';
import { acceptInvite } from '../lib/api';
import { parseInvite } from '../lib/invite';
import { useScanOutput } from '../lib/scanOutput';
import { track } from '../lib/monitoring';
import { colors } from '../theme';

/** Scanner le QR code d'un ami pour l'ajouter (en vrai, à côté de lui). */
export default function Scan() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const busy = useRef(false);
  const lastBad = useRef('');

  const onScan = async ({ data }: { data: string }) => {
    if (busy.current) return;
    const inv = parseInvite(data);
    if (!inv) {
      if (lastBad.current !== data) toast(t('scan.notSweetin'));
      lastBad.current = data;
      return;
    }
    busy.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const p = await acceptInvite(inv.name, 'qr');
      track('qr_scanned');
      toast(t('invite.added', { name: p.username }));
      if (router.canGoBack()) router.back();
      else router.replace('/contacts');
    } catch (e) {
      toast(humanError(e));
      setTimeout(() => (busy.current = false), 1500);
    }
  };

  // la détection elle-même dépend de la plateforme : natif sur iOS, ML Kit sur Android
  const objectOutput = useScanOutput((value) => void onScan({ data: value }));

  if (!hasPermission) {
    return (
      <Screen>
        <Header back />
        <View style={s.center}>
          <Icon name="scan" size={64} stroke={2} />
          <Title size={38} style={{ textAlign: 'center' }}>
            {t('scan.title')}
          </Title>
          <Body style={{ textAlign: 'center' }}>{t('scan.permission')}</Body>
        </View>
        <BottomCTA>
          <Button
            label={!canRequestPermission ? t('camera.openSettings') : t('camera.allow')}
            onPress={() => (!canRequestPermission ? Linking.openSettings() : requestPermission())}
          />
        </BottomCTA>
      </Screen>
    );
  }

  return (
    <Screen tone="cacao">
      {device && <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[objectOutput]} />}
      <View style={[s.backPos, { top: insets.top + 8 }]}>
        <BackButton tone="cacao" />
      </View>
      <View style={s.center} pointerEvents="none">
        <Chip label={t('scan.title')} tone="pistache" />
        <View style={s.frame} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  backPos: { position: 'absolute', left: 16, zIndex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  frame: { width: 240, height: 240, borderRadius: 36, borderWidth: 5, borderColor: colors.pistache },
});
