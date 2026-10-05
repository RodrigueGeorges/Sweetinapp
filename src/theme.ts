import { useMemo } from 'react';
import { Appearance, Platform, useColorScheme, type TextStyle } from 'react-native';

// Direction artistique Sweetin — seule source des couleurs, polices, tailles et mouvements.
// Blanc pur et blocs de couleur par défaut (chaleureux, social) ; nuit si le téléphone est réglé en sombre.
// Les moments photo (caméra, lecture) sont toujours en nuit, les moments de marque en cerise.
// Un rôle par couleur :
// paper/card/ink/muted/line = l'interface (changent avec le mode) · cerise = la marque et l'action principale
// cacao (foncé) et vanille (crème) = couleurs fixes : textes sur cerise, sur photo, objets de marque (polaroid, glace)
// pistache = en direct ou réussi · les 6 parfums = les gens (avatars) · holo = uniquement ce qui se gratte

const brand = (dark: boolean) =>
  ({
    cerise: dark ? '#FF4572' : '#FF2D5F',
    ceriseDeep: '#E0164A',
    cacao: '#1A0A0E', // encre foncée fixe
    vanille: '#FFF7F2', // crème fixe : texte sur cerise, sur photo, la glace
    white: '#FFFFFF',
    bubblegum: '#FF9EC4', // fraise
    pistache: '#C5EE6A',
    lemon: '#FFE36E', // citron
    sky: '#9FD8FF', // myrtille
    lilac: '#C7B6FF', // lavande
    peach: '#FFB46B', // mangue
    cone: '#F2C48D', // biscuit
    mutedOnDark: 'rgba(255,247,242,0.72)',
  }) as const;

const ui = (dark: boolean) =>
  dark
    ? ({
        paper: '#0E0A0B', // fond des écrans
        card: '#1A1416', // cartes, champs, groupes
        card2: '#241C1F', // barre d'onglets, surfaces au-dessus des cartes
        ink: '#FFF7F2', // texte principal
        muted: '#A99A9E', // texte secondaire (contraste 7:1 sur paper)
        line: 'rgba(255,255,255,0.08)', // filets
        sand: '#2A2124', // bouton désactivé, piste d'interrupteur
        dashed: 'rgba(255,255,255,0.22)', // pointillés (emplacements vides)
        placeholder: 'rgba(255,247,242,0.38)',
        riskBg: 'rgba(255,45,95,0.14)', // série en danger
        okBg: 'rgba(197,238,106,0.16)', // gratté, vu
        ghost: 'rgba(255,255,255,0.10)', // boutons secondaires translucides
      } as const)
    : ({
        paper: '#FFFFFF',
        card: '#F5F2F3',
        card2: '#140D0F',
        ink: '#140D0F',
        muted: '#6E6266',
        line: 'rgba(20,13,15,0.08)',
        sand: '#ECE6E8',
        dashed: 'rgba(20,13,15,0.22)',
        placeholder: 'rgba(20,13,15,0.38)',
        riskBg: '#FFEDF0',
        okBg: '#ECF8CF',
        ghost: 'rgba(20,13,15,0.06)',
      } as const);

export type Palette = ReturnType<typeof brand> & ReturnType<typeof ui>;

// Palettes figées : l'interface bascule clair/sombre à chaud, sans relancer l'app.
export const lightColors: Palette = { ...brand(false), ...ui(false) };
export const darkColors: Palette = { ...brand(true), ...ui(true) };

/** Mode au lancement + palette du lancement, pour le code hors React (services, modules). */
export const scheme: 'dark' | 'light' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const isDark = scheme === 'dark';
export const colors: Palette = isDark ? darkColors : lightColors;

/** Palette courante, réactive : se met à jour quand le téléphone passe en mode sombre. */
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return { scheme: dark ? ('dark' as const) : ('light' as const), isDark: dark, colors: dark ? darkColors : lightColors };
}

/**
 * StyleSheet dépendant du thème : `const themed = (colors: Palette) => StyleSheet.create({…})`,
 * puis `const s = useStyles(themed)` dans le composant. Recalculé au changement de mode.
 */
export function useStyles<T>(make: (colors: Palette) => T): T {
  const { colors: c } = useTheme();
  return useMemo(() => make(c), [c, make]);
}

/** Le holo : les couleurs de la feuille à gratter, toujours dans ce sens. */
export const holo = {
  colors: ['#FFC8E4', '#BDEBFF', '#FFF1A8', '#D5C6FF', '#FFC8E4'] as const, // version pâle des parfums, pour la feuille à gratter
  locations: [0, 0.3, 0.55, 0.8, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0.75 },
};

/**
 * Texte d'interface en police système (SF Pro sur iOS, Roboto sur Android) : lisibilité et finition natives.
 * Bricolage (fonts.display) reste la voix de la marque pour les titres, les chiffres et le logo.
 */
const sys = (weight: TextStyle['fontWeight']): TextStyle =>
  Platform.select<TextStyle>({
    ios: { fontWeight: weight },
    android: { fontFamily: 'sans-serif', fontWeight: weight },
    default: { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: weight },
  });
export const tx = { text: sys('400'), bold: sys('600'), black: sys('700') } as const;

export const fonts = {
  display: 'SweetinDisplay', // titres : 800 condensé, minuscules, ponctuation forte
  text: 'SweetinText-Medium',
  bold: 'SweetinText-Bold',
  black: 'SweetinText-ExtraBold',
} as const;

/** Trait et ombre dure des stickers. */
export const ink = { border: 2.5, shadow: 4 } as const;

export const layout = {
  headerHeight: 56,
  tabBarHeight: 50, // barre d'onglets native (hors zone sûre)
  cardWidth: 300,
  cardRatio: 4 / 3, // hauteur photo / largeur
  stripHeight: 52,
  radius: 22,
} as const;

/** Les 6 parfums, dans l'ordre des boules d'une série. */
export const flavors = [colors.bubblegum, colors.pistache, colors.sky, colors.lemon, colors.lilac, colors.peach] as const;

/** Parfum stable dérivé du pseudo : la couleur de la personne partout dans l'app. */
const palette = [colors.bubblegum, colors.sky, colors.lemon, colors.lilac, colors.pistache, colors.peach];
export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/** Mouvement : des ressorts plutôt que des durées, pour que tout réagisse comme un objet physique. */
export const motion = {
  press: { damping: 15, stiffness: 320, mass: 0.6 }, // appui sur un bouton
  pop: { damping: 11, stiffness: 220, mass: 0.8 }, // apparition joyeuse (badge, réaction)
  card: { damping: 14, stiffness: 120, mass: 0.9 }, // carte qui se retourne
  settle: { damping: 18, stiffness: 140, mass: 1 }, // retour au repos
  tiltMax: 7, // inclinaison maximale de la carte, en degrés
} as const;

/** Bloc de couleur d'une personne : son parfum, en teinte douce (fond de sa ligne, de sa carte). */
export function flavorTint(name: string, strong = false, dark = isDark) {
  return avatarColor(name) + (dark ? (strong ? '40' : '22') : strong ? '66' : '38');
}
