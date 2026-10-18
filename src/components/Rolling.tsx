import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

/**
 * Chiffres qui défilent comme un compteur mécanique : chaque chiffre est une colonne 0-9 qui glisse jusqu'à sa valeur.
 * `from` : valeur de départ au montage (ex. 0 pour faire monter une série jusqu'à 41), sinon on part de la valeur.
 * Réduire les animations : les chiffres changent d'un coup.
 */
const SPRING = { damping: 16, stiffness: 170, mass: 0.7 };
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Digit({ d, h, style, delay }: { d: number; h: number; style: StyleProp<TextStyle>; delay: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(d);
  useEffect(() => {
    y.value = reduce ? d : withDelay(delay, withSpring(d, SPRING));
  }, [d, reduce, delay, y]);
  const col = useAnimatedStyle(() => ({ transform: [{ translateY: -y.value * h }] }));
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      {/* largeur du chiffre visé, rendu invisible : pas de trou autour d'un « 1 » étroit */}
      <Text style={[style, s.ghost, { height: h, lineHeight: h }]} allowFontScaling={false}>
        {d}
      </Text>
      <Animated.View style={[s.col, col]}>
        {DIGITS.map((c) => (
          <Text key={c} style={[style, { height: h, lineHeight: h }]} allowFontScaling={false}>
            {c}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function Rolling({ value, from, style, lineHeight }: { value: number; from?: number; style: StyleProp<TextStyle>; lineHeight: number }) {
  const v = Math.max(0, Math.round(value));
  // avec `from` : on monte d'abord à `from`, puis on roule jusqu'à la vraie valeur juste après l'apparition
  const [armed, setArmed] = useState(from == null);
  useEffect(() => {
    if (armed) return;
    const id = setTimeout(() => setArmed(true), 120);
    return () => clearTimeout(id);
  }, [armed]);
  const digits = String(v).split('').map(Number);
  const startDigits = String(Math.max(0, Math.round(from ?? 0))).padStart(digits.length, '0').slice(-digits.length).split('').map(Number);
  return (
    <View style={s.row} accessible accessibilityLabel={String(v)}>
      {digits.map((d, i) => (
        <Digit key={digits.length - i} d={armed ? d : startDigits[i]} h={lineHeight} style={style} delay={armed && from != null ? (digits.length - 1 - i) * 90 : 0} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  col: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  ghost: { opacity: 0 },
});
