import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { Drip, ICE_RATIO, LOGO_RATIO, Mark } from './Logo';
import { ICE_VIEWBOX as IV, LOGO_I, LOGO_VIEWBOX as V, LOGO_WORD } from './logoPath';

/**
 * Même taille que la glace du splash natif : la glace ne saute pas au passage natif → animé.
 * iOS : 150 pt de large (imageWidth). Android 12+ : 161 dp de haut dans le cercle système (splash-icon-android.png), soit 104 dp de large.
 */
const MW = Platform.OS === 'android' ? 104 : 150;
const MH = MW / ICE_RATIO;
/** Le mot final, centré sur l'écran comme la glace. */
const WW = 260;
const WH = WW / LOGO_RATIO;
/** La glace une fois devenue le i du mot : taille et décalage depuis le centre. */
const IH = (IV.h / V.h) * WH;
const K = IH / MH;
const DX = ((LOGO_I.cx - V.x) / V.w) * WW - WW / 2;
const DY = ((IV.y + IV.h / 2 - V.y) / V.h) * WH - WH / 2;
/** Hauteur des coulures sous le rideau framboise quand il remonte. */
const DRIP_LONG = 1.1;

/**
 * Lancement (≈ 1,3 s), dans la continuité du splash natif (framboise, glace blanche au centre) :
 * 1. la glace respire (petit écrasement, comme un objet mou) ;
 * 2. elle saute en arc et se pose à la place du i, pendant que les lettres montent de la ligne de base ;
 * 3. elle atterrit (rebond doux, une touche haptique) ;
 * 4. le rideau framboise remonte en coulant (bord en coulures, DA Fondant) et découvre l'app.
 * « Réduire les animations » : le mot apparaît, puis simple fondu.
 */
export function LaunchSplash({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const breathe = useSharedValue(0);
  const fly = useSharedValue(0);
  const word = useSharedValue(0);
  const land = useSharedValue(0);
  const lift = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      fly.value = 1;
      word.value = 1;
      fade.value = withDelay(500, withTiming(1, { duration: 250 }, (f) => f && runOnJS(onDone)()));
      return;
    }
    breathe.value = withSequence(withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 8, stiffness: 260 }));
    fly.value = withDelay(260, withTiming(1, { duration: 480, easing: Easing.inOut(Easing.cubic) }));
    word.value = withDelay(430, withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }));
    land.value = withDelay(
      740,
      withSequence(
        withTiming(1, { duration: 70 }, (f) => f && runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light)),
        withSpring(0, { damping: 9, stiffness: 300 }),
      ),
    );
    lift.value = withDelay(1020, withTiming(1, { duration: 440, easing: Easing.inOut(Easing.cubic) }, (f) => f && runOnJS(onDone)()));
  }, [reduce, breathe, fly, word, land, lift, fade, onDone]);

  // le rideau (fond framboise + coulures) remonte d'un écran entier, plus la longueur des coulures
  const sheet = useAnimatedStyle(() => ({
    opacity: 1 - fade.value,
    transform: [{ translateY: -lift.value * (height + 140 * DRIP_LONG) }],
  }));

  const markStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const k = 1 + (K - 1) * f;
    // l'arc : la glace monte un peu avant de redescendre dans le mot
    const arc = -46 * Math.sin(Math.PI * f);
    const b = breathe.value * 0.06 + land.value * 0.12;
    return {
      transform: [{ translateX: DX * f }, { translateY: DY * f + arc }, { scaleX: k * (1 + b) }, { scaleY: k * (1 - b) }],
    };
  });
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: interpolate(word.value, [0, 1], [WH * 0.35, 0]) }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, sheet]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cerise }]} />
        {/* les coulures sous le rideau : elles pendent pendant qu'il remonte */}
        <View style={{ position: 'absolute', top: height - 1, left: 0, right: 0 }}>
          <DripBand />
        </View>
        <View style={s.center}>
          {/* les lettres seules, qui montent de la ligne de base (masquées en dessous) */}
          <View style={{ width: WW, height: WH, overflow: 'hidden' }}>
            <Animated.View style={wordStyle}>
              <Svg width={WW} height={WH} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}>
                <Path d={LOGO_WORD} fill={colors.white} />
              </Svg>
            </Animated.View>
          </View>
        </View>
        <View style={s.center}>
          <Animated.View style={markStyle}>
            <Mark size={MH} color={colors.white} cone={colors.cacao} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/** Bande de coulures framboise (le haut est collé au rideau). */
function DripBand() {
  const { width } = useWindowDimensions();
  return <Drip width={width} depth={2} color={colors.cerise} long={DRIP_LONG} />;
}

const s = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
