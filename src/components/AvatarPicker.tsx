import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { t } from '../i18n';
import { avatarColor, tx, useStyles, useTheme, type Palette } from '../theme';
import { Icon } from './Icon';

/** Prend un selfie (caméra avant) ou une photo de la galerie, recadrée en carré. Renvoie l'URI locale. */
export async function pickSelfie(): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return library();
    const r = await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front });
    return r.canceled ? null : r.assets[0].uri;
  };
  const library = async () => {
    const r = await ImagePicker.launchImageLibraryAsync(opts);
    return r.canceled ? null : r.assets[0].uri;
  };
  if (Platform.OS === 'web') return library();
  return new Promise((resolve) => {
    const choices = [t('avatar.selfie'), t('avatar.library'), t('common.cancel')];
    const go = (i: number) => (i === 0 ? camera() : i === 1 ? library() : Promise.resolve(null)).then(resolve, () => resolve(null));
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: choices, cancelButtonIndex: 2 }, go);
    else Alert.alert(t('avatar.title'), undefined, [{ text: choices[0], onPress: () => go(0) }, { text: choices[1], onPress: () => go(1) }, { text: choices[2], style: 'cancel', onPress: () => go(2) }]);
  });
}

/** Grand rond « ta photo » : vide (pointillés + appareil photo) ou le selfie, avec un badge pour le changer. */
export function AvatarPicker({ uri, name, size = 112, onPick }: { uri?: string | null; name?: string; size?: number; onPick: (uri: string) => void }) {
  const { colors } = useTheme();
  const s = useStyles(themed);
  return (
    <Pressable
      onPress={async () => {
        const u = await pickSelfie();
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
            <Icon name="person" size={size * 0.36} color={colors.dashed} />
          </View>
        )}
        <View style={s.badge}>
          <Icon name={uri ? 'retake' : 'snap'} size={15} color={colors.vanille} stroke={2.6} />
        </View>
      </View>
      <Text style={s.label}>{uri ? t('avatar.change') : t('avatar.add')}</Text>
    </Pressable>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
    empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    badge: { position: 'absolute', right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cerise, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
    label: { ...tx.black, fontSize: 14, color: colors.ink },
  });
