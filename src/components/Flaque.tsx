import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Circle, Defs, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

const VB = '0 0 300 172';
const RATIO = 172 / 300;
const CONE = 'M116 112 L184 112 L157 26 Q150 10 143 26 Z';

/**
 * La flaque : la glace tombée, cornet en l'air, boule écrasée en flaque framboise, vermicelles citron.
 * Elle remplit l'écran « fondu. » : la flaque s'étale, le cornet tombe dedans, les vermicelles sautent.
 * Rien ne bouge si « réduire les animations ».
 */
export function Flaque({ width }: { width: number }) {
  const reduce = useReducedMotion();
  const spread = useSharedValue(reduce ? 1 : 0);
  const drop = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(reduce ? 1 : 0);
  const wob = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    drop.value = withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) });
    spread.value = withDelay(380, withSpring(1, { damping: 9, stiffness: 140 }));
    pop.value = withDelay(620, withSpring(1, { damping: 8, stiffness: 180 }));
    wob.value = withDelay(400, withSequence(withTiming(1, { duration: 120 }), withSpring(0, { damping: 5, stiffness: 160 })));
  }, [reduce, drop, spread, pop, wob]);

  const h = width * RATIO;
  const puddle = useAnimatedStyle(() => ({ transform: [{ translateY: h * 0.42 }, { scaleX: 0.25 + spread.value * 0.75 }, { scaleY: 0.6 + spread.value * 0.4 }, { translateY: -h * 0.42 }] }));
  const cone = useAnimatedStyle(() => ({
    opacity: drop.value > 0 ? 1 : 0,
    transform: [{ translateY: (drop.value - 1) * h * 0.9 }, { rotate: `${(1 - drop.value) * -40 + wob.value * 6}deg` }],
  }));
  const sprinkles = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ translateY: (1 - pop.value) * 10 }, { scale: 0.6 + pop.value * 0.4 }] }));

  const layer = { width, height: h };
  return (
    <View style={layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, puddle]}>
        <Svg width={width} height={h} viewBox={VB}>
          <Path
            d="M38 140 C30 128 52 121 76 122 C92 116 112 118 128 117 C150 112 176 115 196 118 C214 117 240 119 256 126 C276 130 278 146 258 150 C240 158 214 154 196 157 C176 162 150 160 128 157 C104 160 80 158 62 154 C44 153 30 150 38 140 Z"
            fill={colors.cerise}
          />
          <Circle cx={24} cy={132} r={6} fill={colors.cerise} />
          <Circle cx={12} cy={146} r={3.5} fill={colors.cerise} />
          <Circle cx={279} cy={120} r={5} fill={colors.cerise} />
          <Circle cx={291} cy={136} r={3} fill={colors.cerise} />
          <Path d="M66 133 C84 128 100 128 110 129" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, cone]}>
        <Svg width={width} height={h} viewBox={VB}>
          <Defs>
            <ClipPath id="flaque-cone">
              <Path d={CONE} />
            </ClipPath>
          </Defs>
          <G transform="rotate(16 150 112)">
            <Path d={CONE} fill={colors.ink} stroke={colors.ink} strokeWidth={4} strokeLinejoin="round" />
            <G clipPath="url(#flaque-cone)" stroke={colors.paper} strokeOpacity={0.28} strokeWidth={2.5}>
              <Path d="M100 40 L200 140 M100 60 L200 160 M100 20 L200 120 M100 0 L200 100 M100 80 L200 180" />
              <Path d="M200 40 L100 140 M200 60 L100 160 M200 20 L100 120 M200 0 L100 100 M200 80 L100 180" />
            </G>
          </G>
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, puddle]}>
        <Svg width={width} height={h} viewBox={VB}>
          <Path d="M96 134 C94 112 108 100 124 101 C132 94 142 96 148 99 C156 93 172 96 176 104 C194 104 206 116 204 134 C194 142 108 142 96 134 Z" fill={colors.cerise} />
          <Path d="M112 116 C118 108 126 105 134 105" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={5} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sprinkles]}>
        <Svg width={width} height={h} viewBox={VB}>
          <G fill={colors.citron}>
            <Rect x={140} y={110} width={12} height={5} rx={2.5} transform="rotate(-25 146 112)" />
            <Rect x={176} y={116} width={12} height={5} rx={2.5} transform="rotate(35 182 118)" />
            <Rect x={212} y={136} width={12} height={5} rx={2.5} transform="rotate(-10 218 138)" />
            <Rect x={72} y={142} width={12} height={5} rx={2.5} transform="rotate(20 78 144)" />
            <Rect x={118} y={124} width={12} height={5} rx={2.5} transform="rotate(70 124 126)" />
            <Rect x={246} y={128} width={12} height={5} rx={2.5} transform="rotate(50 252 130)" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

export const FLAQUE_RATIO = RATIO;
