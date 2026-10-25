import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { forwardRef, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { t } from '../i18n';
import { colors, fonts, tx } from '../theme';

export type SheetItem = { id: string; title: string; icon?: IconName; destructive?: boolean };

/**
 * Feuille d'actions façon Fondant (@gorhom/bottom-sheet) : fond vanille, poignée,
 * lignes à icône, « annuler » en bas. Réf = BottomSheetModal → `present()`.
 */
export const Sheet = forwardRef<BottomSheetModal, { title?: string; items: SheetItem[]; onSelect: (id: string) => void; onDismiss?: () => void }>(function Sheet({ title, items, onSelect, onDismiss }, ref) {
  const insets = useSafeAreaInsets();
  const backdrop = useCallback((p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior="close" />, []);
  const pick = (id: string) => {
    (ref as React.RefObject<BottomSheetModal | null>)?.current?.dismiss();
    if (id !== '__cancel') onSelect(id);
  };
  return (
    <BottomSheetModal ref={ref} backdropComponent={backdrop} backgroundStyle={s.bg} handleIndicatorStyle={s.grip} enablePanDownToClose enableDynamicSizing onDismiss={onDismiss}>
      <BottomSheetView style={[s.body, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
        {title ? <Text style={s.title}>{title}</Text> : null}
        <View style={s.list}>
          {items.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => {
                Haptics.selectionAsync();
                pick(i.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={i.title}
              style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.sand }]}
            >
              {i.icon ? <Icon name={i.icon} size={20} color={i.destructive ? colors.cerise : colors.ink} /> : <View style={s.noIcon} />}
              <Text style={[s.rowT, i.destructive && { color: colors.cerise }]}>{i.title}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => pick('__cancel')} accessibilityRole="button" accessibilityLabel={t('common.cancel')} style={({ pressed }) => [s.cancel, pressed && { opacity: 0.75 }]}>
          <Text style={s.cancelT}>{t('common.cancel')}</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  bg: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grip: { backgroundColor: colors.muted, width: 42 },
  body: { paddingHorizontal: 14, paddingTop: 6 },
  title: { fontFamily: fonts.displayHeavy, fontSize: 24, lineHeight: 28, color: colors.ink, textAlign: 'center', marginBottom: 12 },
  list: { borderRadius: 18, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  noIcon: { width: 20 },
  rowT: { ...tx.bold, fontSize: 16, color: colors.ink },
  cancel: { marginTop: 10, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', paddingVertical: 15 },
  cancelT: { ...tx.black, fontSize: 16, color: colors.ink },
});
