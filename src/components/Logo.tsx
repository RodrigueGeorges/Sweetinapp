import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { ICE_CONE, ICE_CONE_MINI, ICE_SCOOP, ICE_SCOOP_MINI, ICE_VIEWBOX as IV, LOGO_CONE, LOGO_SCOOP, LOGO_VIEWBOX as V, LOGO_WORD } from './logoPath';

/** Rapport largeur / hauteur du mot et de la glace. */
export const LOGO_RATIO = V.w / V.h;
export const ICE_RATIO = IV.w / IV.h;

/**
 * Logo « sweetin » (DA Fondant) : le i est une glace. `size` ≈ hauteur du logo en points (24 en tête d'écran).
 * En dessous de 24 de haut le i devient une tache : utiliser la glace seule (`Mark`).
 * `scoop` / `cone` : couleurs de la boule et du cornet du i (par défaut, celle du mot).
 */
export function Logo({ size = 24, color = colors.ink, scoop, cone }: { size?: number; color?: string; scoop?: string; cone?: string }) {
  const h = Math.max(size, 24);
  const w = h * LOGO_RATIO;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Sweetin">
      <Svg width={w} height={h} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}>
        <Path d={LOGO_WORD} fill={color} />
        <Path d={LOGO_CONE} fill={cone ?? color} />
        <Path d={LOGO_SCOOP} fill={scoop ?? color} />
      </Svg>
    </View>
  );
}

/**
 * La glace de la marque : boule (cercle coupé + une goutte) et cornet (triangle), découpes déjà faites. `size` = hauteur.
 * Sous 40 de haut, la version mini (découpes élargies). `color` = boule, `cone` = cornet (par défaut la même couleur).
 */
export function Mark({ size = 40, color = colors.white, cone }: { size?: number; color?: string; cone?: string; gap?: string; accent?: string }) {
  const w = size * ICE_RATIO;
  const mini = size < 40;
  return (
    <Svg width={w} height={size} viewBox={`${IV.x} ${IV.y} ${IV.w} ${IV.h}`}>
      <Path d={mini ? ICE_CONE_MINI : ICE_CONE} fill={cone ?? color} />
      <Path d={mini ? ICE_SCOOP_MINI : ICE_SCOOP} fill={color} />
    </Svg>
  );
}

/** L'icône de l'app : boule blanche et cornet nuit sur framboise. */
export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.225, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cerise }}>
      <Mark size={size * 0.625} color={colors.white} cone={colors.cacao} />
    </View>
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

/** Le coulis qui coule du haut de l'écran (le cœur fondant, quand la photo fond en lecture). */
export function Drip({ width, depth, color = colors.cerise, long = 1 }: { width: number; depth: number; color?: string; long?: number }) {
  const drips = [
    { x: 0.13, w: 0.085, l: 70 * long },
    { x: 0.5, w: 0.105, l: 118 * long },
    { x: 0.79, w: 0.07, l: 46 * long },
  ];
  const h = depth + 130 * long;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} pointerEvents="none">
      <Path d={dripPath(width, depth, drips, 14)} fill={color} />
    </Svg>
  );
}
