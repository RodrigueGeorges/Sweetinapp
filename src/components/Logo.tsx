import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { DROP, LOGO_DROP, LOGO_VIEWBOX as V, LOGO_WORD, MARK_DROP, MARK_S, MARK_VIEWBOX as MV } from './logoPath';

/**
 * Logo « sweetin. » : le nom en minuscules, le point final est une goutte (la glace qui fond, en un seul détail).
 * `size` ≈ hauteur des minuscules × 2 (équivalent taille de police). Goutte en `accent` (cerise si le nom est en encre).
 */
export function Logo({ size = 28, color, accent }: { size?: number; color?: string; accent?: string; mark?: boolean; drop?: string }) {
  const { colors } = useTheme();
  const h = size * 0.75;
  const w = (h * V.w) / V.h;
  const c = color ?? colors.ink;
  const dropColor = accent ?? (c === colors.ink ? colors.cerise : c);
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Sweetin">
      <Svg width={w} height={h} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}>
        <Path d={LOGO_WORD} fill={c} />
        <Path d={LOGO_DROP} fill={dropColor} />
      </Svg>
    </View>
  );
}

/** Le monogramme « s. » (icône de l'app), sans fond. `size` = hauteur. */
export function Mark({ size = 40, color, accent }: { size?: number; color?: string; accent?: string }) {
  const { colors } = useTheme();
  const w = (size * MV.w) / MV.h;
  return (
    <Svg width={w} height={size} viewBox={`${MV.x} ${MV.y} ${MV.w} ${MV.h}`}>
      <Path d={MARK_S} fill={color ?? colors.white} />
      <Path d={MARK_DROP} fill={accent ?? color ?? colors.white} />
    </Svg>
  );
}

/** L'icône de l'app : « s. » blanc sur carré arrondi cerise. */
export function AppIcon({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.225, backgroundColor: colors.cerise, alignItems: 'center', justifyContent: 'center' }}>
      <Mark size={size * 0.46} />
    </View>
  );
}

/** La goutte seule. `size` = hauteur. */
export function DropGlyph({ size = 24, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={(size * 2) / 2.95} height={size} viewBox="-1 -1.95 2 2.95">
      <Path d={DROP} fill={color ?? colors.cerise} />
    </Svg>
  );
}

/** Bande nappée : plein en haut jusqu'à `depth`, puis 3 coulures de longueurs inégales. Coordonnées en fractions de la largeur. */
export function dripPath(W: number, depth: number, drips: { x: number; w: number; l: number }[], wave = 8) {
  let d = `M0,0 H${W} V${depth}`;
  let cx = W;
  for (const { x: fx, w: fw, l } of [...drips].sort((a, b) => b.x - a.x)) {
    const x = fx * W;
    const w = fw * W;
    const r = w / 2;
    const mid = (cx + x + w) / 2;
    d += ` Q${mid},${depth + wave} ${x + w + r * 0.7},${depth} Q${x + w},${depth} ${x + w},${depth + r} V${depth + l - r} A${r},${r} 0 0 1 ${x},${depth + l - r} V${depth + r} Q${x},${depth} ${x - r * 0.7},${depth}`;
    cx = x - r * 0.7;
  }
  return `${d} Q${cx / 2},${depth + wave} 0,${depth} Z`;
}

/** Le nappage qui coule (photo qui fond en lecture). */
export function Drip({ width, depth, color, long = 1 }: { width: number; depth: number; color?: string; long?: number }) {
  const { colors } = useTheme();
  const drips = [
    { x: 0.13, w: 0.085, l: 70 * long },
    { x: 0.5, w: 0.105, l: 118 * long },
    { x: 0.79, w: 0.07, l: 46 * long },
  ];
  const h = depth + 130 * long;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} pointerEvents="none">
      <Path d={dripPath(width, depth, drips, 14)} fill={color ?? colors.cerise} />
    </Svg>
  );
}
