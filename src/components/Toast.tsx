import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, tx } from '../theme';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Pastille cacao qui tombe du haut de l'écran, avec son ombre dure cerise. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [y] = useState(() => new Animated.Value(-140));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      setText(message);
      if (timer.current) clearTimeout(timer.current);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 13, stiffness: 190 }).start();
      // les messages longs (erreurs lisibles) restent un peu plus : ~30 ms par caractère au-delà de 40
      const hold = 2800 + Math.min(1200, Math.max(0, message.length - 40) * 30);
      timer.current = setTimeout(() => {
        Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start();
      }, hold);
    },
    [y],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" style={[s.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]} accessibilityLiveRegion="polite">
        <View style={s.toast}>
          <Text style={s.text}>{text}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20 },
  toast: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.card2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 6px 18px rgba(22,15,18,0.25)' },
  text: { ...tx.bold, fontSize: 15, lineHeight: 20, color: colors.vanille, textAlign: 'center' },
});
