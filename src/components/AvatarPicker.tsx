import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';
import { avatarColor, colors, tx } from '../theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const OPTS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
const camera = async () => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return library();
  const r = await ImagePicker.launchCameraAsync({ ...OPTS, cameraType: ImagePicker.CameraType.front });
  return r.canceled ? null : r.assets[0].uri;
};
const library = async () => {
  const r = await ImagePicker.launchImageLibraryAsync(OPTS);
  return r.canceled ? null : r.assets[0].uri;
};

/**
 * Choix selfie/galerie façon Fondant : une Sheet plutôt que la boîte système.
 * `pick()` ouvre la feuille et renvoie l'URI (ou null si fermée sans choix) ;
 * `sheet` doit être rendue dans l'arbre de l'écran.
 */
export function useSelfiePicker(): { pick: () => Promise<string | null>; sheet: ReactNode } {
  const ref = useRef<BottomSheetModal>(null);
  const resolver = useRef<((u: string | null) => void) | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);
  const selected = useRef<string | null>(null);
  const choosing = useRef(false);
  const finish = useCallback((uri: string | null) => {
    resolver.current?.(uri);
    resolver.current = null;
    pending.current = null;
    choosing.current = false;
    selected.current = null;
  }, []);
  useEffect(() => () => finish(null), [finish]);
  const pick = useCallback(() => {
    if (Platform.OS === 'web') return library();
    if (pending.current) return pending.current;
    pending.current = new Promise<string | null>((resolve) => { resolver.current = resolve; });
    ref.current?.present();
    return pending.current;
  }, []);
  const onSelect = useCallback((id: string) => {
    selected.current = id; // la galerie attend la fermeture du panneau
  }, []);
  const onDismiss = useCallback(() => {
    if (choosing.current || !resolver.current) return;
    if (!selected.current) return finish(null);
    choosing.current = true;
    const go = selected.current === 'selfie' ? camera : library;
    const resolve = resolver.current;
    go().then((uri) => { if (resolver.current === resolve) finish(uri); }, () => { if (resolver.current === resolve) finish(null); });
  }, [finish]);
  const sheet = (
    <Sheet
      ref={ref}
      title={t('avatar.title')}
      items={[
        { id: 'selfie', title: t('avatar.selfie'), icon: 'snap' },
        { id: 'library', title: t('avatar.library'), icon: 'gallery' },
      ]}
      onSelect={onSelect}
      onDismiss={onDismiss}
    />
  );
  return { pick, sheet };
}

/** Grand rond « ta photo » : vide (pointillés + appareil photo) ou le selfie, avec un badge pour le changer. */
export function AvatarPicker({ uri, name, size = 112, onPick }: { uri?: string | null; name?: string; size?: number; onPick: (uri: string) => void }) {
  const { pick, sheet } = useSelfiePicker();
  return (
    <>
      <Pressable
        onPress={async () => {
          const u = await pick();
          if (u) onPick(u);
        }}
        accessibilityRole="button"
        accessibilityLabel={uri ? t('avatar.change') : t('avatar.add')}
        style={({ pressed }) => [{ alignItems: 'center', gap: 8 }, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <View style={{ width: size, height: size }}>
          {uri ? (
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: name ? avatarColor(name) : colors.sand }} contentFit="cover" />
            </Animated.View>
          ) : (
            <View style={[s.empty, { width: size, height: size, borderRadius: size / 2 }]}>
              <Icon name="person" size={36} color={colors.muted} />
            </View>
          )}
          <View style={s.badge}>
            <Icon name={uri ? 'retake' : 'snap'} size={15} color={colors.onBrand} stroke={2.6} />
          </View>
        </View>
        <Text style={s.label}>{uri ? t('avatar.change') : t('avatar.add')}</Text>
      </Pressable>
      {sheet}
    </>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cerise, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  label: { ...tx.black, fontSize: 14, color: colors.ink },
});
