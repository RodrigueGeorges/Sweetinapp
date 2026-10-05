import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { fonts, tx, useStyles, useTheme, type Palette } from '../theme';
import { Button } from './ui';

/**
 * Carte de confirmation en bas d'écran (bottom sheet DA, remplace les alertes système) :
 * titre, explication, action destructive ou pas, annulation généreuse.
 */
export function ConfirmSheet({ visible, title, body, confirm, onConfirm, onClose, busy }: { visible: boolean; title: string; body?: string; confirm: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles(themed);
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.cancel')} accessibilityRole="button" />
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(200)} exiting={SlideOutDown.duration(180)} style={[s.card, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
          <View style={s.grab} />
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          {body ? <Text style={s.body}>{body}</Text> : null}
          <Button label={confirm} tone="cerise" size="md" loading={busy} onPress={onConfirm} haptic="medium" />
          <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" hitSlop={8} style={s.cancel}>
            <Text style={s.cancelT}>{t('common.cancel')}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14,10,11,0.5)' },
    card: { marginHorizontal: 12, borderRadius: 28, backgroundColor: colors.card2, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.line },
    grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.dashed },
    title: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
    body: { ...tx.text, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
    cancel: { alignSelf: 'center', paddingVertical: 6 },
    cancelT: { ...tx.bold, fontSize: 15, color: colors.muted },
  });
