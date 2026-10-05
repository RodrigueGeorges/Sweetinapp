import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tx, useStyles, type Palette } from '../theme';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Pastille cacao qui tombe du haut de l'écran, avec son ombre dure cerise. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const s = useStyles(themed);
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [text, setText] = useState('');
  const [y] = useState(() => new Animated.Value(-140));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const show = useCallback(
    (message: string) => {
      setText(message);
      if (timer.current) clearTimeout(timer.current);
      if (reduce) {
        y.setValue(0);
        timer.current = setTimeout(() => y.setValue(-140), 2600);
        return;
      }
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 13, stiffness: 190 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start();
      }, 2600);
    },
    [y, reduce],
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

const themed = (colors: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 20, right: 20 },
    toast: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.card2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 6px 18px rgba(26,10,14,0.25)' },
    text: { ...tx.bold, fontSize: 15, lineHeight: 20, color: colors.vanille, textAlign: 'center' },
  });
