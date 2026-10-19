import { MenuView } from '@expo/ui/community/menu';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { t } from '../i18n';

export type MenuItem = { id: string; title: string; sf?: SFSymbol; destructive?: boolean };

/**
 * Menu contextuel natif (SwiftUI Menu sur iOS, DropdownMenu Material sur Android), ancré sur son déclencheur.
 * Sur le web (aperçu), repli sur une alerte.
 */
export function NativeMenu({ title, items, onSelect, children, longPress, label }: { title?: string; items: MenuItem[]; onSelect: (id: string) => void; children: ReactNode; longPress?: boolean; label?: string }) {
  // MenuView est natif : absent d'Expo Go (et du web) — repli sur une alerte, le déclencheur reste visible
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() =>
          Alert.alert(title ?? '', undefined, [
            ...items.map((i) => ({ text: i.title, style: i.destructive ? ('destructive' as const) : undefined, onPress: () => onSelect(i.id) })),
            { text: t('common.cancel'), style: 'cancel' as const },
          ])
        }
      >
        {children}
      </Pressable>
    );
  }
  return (
    <MenuView
      title={title}
      shouldOpenOnLongPress={longPress}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}
      actions={items.map((i) => ({ id: i.id, title: i.title, image: i.sf, attributes: i.destructive ? { destructive: true } : undefined }))}
    >
      {children}
    </MenuView>
  );
}
