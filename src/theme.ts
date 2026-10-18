import { Appearance, type TextStyle } from 'react-native';

// Direction artistique Sweetin « Fondant » — seule source des couleurs, polices, tailles et mouvements.
// Fond blanc net, encre nuit : la photo porte la couleur. Le cœur (le mot caché) est nuit, le mot en blanc.
// Le fun vient des éclats : framboise (déclencheur, pastilles, logo) et citron (autocollants, séries, sweet hour), toujours en petit. Le logo : le i de sweetin est une glace.
// Titres en Climate Crisis (la fonte qui fond), texte en Funnel Sans. Fond blanc ; nuit si le téléphone est en sombre.
// Noms historiques : `cerise` = framboise, `onBrand` = texte sur la marque (blanc), `cacao` = nuit (encre fixe), `pistache` = citron.
export const scheme: 'dark' | 'light' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const isDark = scheme === 'dark';

const brand = {
  cerise: '#FF2E5B', // framboise : la marque, le déclencheur, le bouton principal (texte blanc)
  brandTop: '#FF2E5B', // la framboise est à plat : plus de dégradé (noms gardés pour l'historique)
  brandBottom: '#FF2E5B',
  ceriseText: isDark ? '#FF6B88' : '#C40E3B', // framboise lisible en texte sur le fond (contraste AA)
  onBrand: '#FFFFFF', // texte et icônes posés sur la framboise
  ceriseDeep: isDark ? '#FF6B88' : '#C40E3B', // alerte : série en danger, suppression
  pop: '#FF2E5B',
  cacao: '#160F12', // nuit : encre fixe
  vanille: '#FFFFFF', // blanc fixe : texte sur photo
  white: '#FFFFFF',
  citron: '#E8FF5A', // la pointe : stickers, sweet hour, nouveau. Jamais un bouton, jamais un fond d'écran, texte nuit dessus
  sucre: '#FFE6EB', // framboise très pâle : les écrans de marque (accueil, envoyé), les bandeaux, les lignes à sauver
  coeur: '#160F12', // le cœur : là où le mot est caché (lecture, création, démo), nuit avec le mot en blanc
  onCoeur: '#FFFFFF',
  bubblegum: '#FFC9D6', // sorbets doux : couleurs des gens
  pistache: '#E8FF5A', // = citron (nom historique)
  lemon: '#F4FFB8',
  sky: '#CFE4FF',
  lilac: '#E3D8FF',
  peach: '#FFD6C2',
  cone: '#F2C48D',
  mutedOnDark: 'rgba(255,255,255,0.78)',
};

const ui = isDark
  ? {
      paper: '#0E0B0C', // fond des écrans
      card: '#1C1618', // cartes, champs, groupes
      card2: '#262022', // surfaces au-dessus des cartes
      ink: '#FFFFFF', // texte principal
      muted: '#A89EA2', // texte secondaire
      line: 'rgba(255,255,255,0.09)', // filets
      sand: '#2B2427', // bouton désactivé, piste d'interrupteur
      dashed: 'rgba(255,255,255,0.22)', // pointillés (emplacements vides)
      placeholder: '#958B8F', // 5,4:1 sur les cartes (AA)
      riskBg: 'rgba(255,46,91,0.16)', // série en danger
      okBg: 'rgba(255,255,255,0.08)', // gratté, vu
      brandTint: 'rgba(255,46,91,0.16)', // pastille framboise douce
      ghost: 'rgba(255,255,255,0.10)', // boutons secondaires translucides
    }
  : {
      paper: '#FFFFFF',
      card: '#F4F0F1',
      card2: '#160F12',
      ink: '#160F12',
      muted: '#6F6468',
      line: 'rgba(22,15,18,0.08)',
      sand: '#ECE6E8',
      dashed: 'rgba(22,15,18,0.2)',
      placeholder: '#736A6D', // 4,6:1 sur les cartes (AA)
      riskBg: '#FFE6EB',
      okBg: '#F4F0F1',
      brandTint: '#FFE6EB',
      ghost: 'rgba(22,15,18,0.05)',
    };

export const colors = { ...brand, ...ui } as const;


/** La feuille à gratter : sucre givré (blanc, framboise très pâle), toujours dans ce sens. Le nom « holo » est historique. */
export const holo = {
  colors: ['#FFFFFF', '#FFE6EB', '#FFF7F9', '#FFE6EB', '#FFFFFF'] as const,
  locations: [0, 0.3, 0.55, 0.8, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0.75 },
};

export const fonts = {
  display: 'SweetinDisplay', // titres : Climate Crisis (année 2008), minuscules, sans approche négative
  displayHeavy: 'SweetinDisplayHeavy', // chiffres et très grands titres : Climate Crisis 1979, la plus grasse
  text: 'SweetinText-Medium', // Funnel Sans 500
  bold: 'SweetinText-Bold', // Funnel Sans 700
  black: 'SweetinText-ExtraBold', // Funnel Sans 800
} as const;

/**
 * Texte d'interface en Funnel Sans (texte, gras, très gras). Les polices sont des instances statiques :
 * la graisse vient du fichier, jamais de `fontWeight` (sinon Android en fabrique une fausse).
 */
export const tx = {
  text: { fontFamily: fonts.text } as TextStyle,
  bold: { fontFamily: fonts.bold } as TextStyle,
  black: { fontFamily: fonts.black } as TextStyle,
} as const;

/** Les titres en Climate Crisis sont très larges : ce facteur ramène une taille pensée pour une fonte normale. */
export const displayScale = 0.72;

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
export function flavorTint(name: string, strong = false) {
  return avatarColor(name) + (isDark ? (strong ? '40' : '22') : strong ? '66' : '38');
}
