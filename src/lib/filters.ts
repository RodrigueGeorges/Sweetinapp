/**
 * Filtres photo façon stories : matrices de couleur Skia (4×5) pour l'app,
 * équivalents CSS pour la page web /f/. Données pures, aucune dépendance.
 *
 * Les looks sont composés comme sur Instagram : les mêmes primitives que les
 * filtres CSS (saturate, contrast, brightness, sepia, grayscale, hue-rotate),
 * enchaînées dans le même ordre — pas des matrices bidouillées à la main.
 */
export type FilterId = 'none' | 'dore' | 'neon' | 'nuit' | 'noir' | 'poudre';

export type FilterDef = { id: FilterId; matrix: number[] | null; css: string | null };

type M = number[]; // 4×5 row-major appliquée à la colonne [r,g,b,a,1]
const I: M = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** a·b : a s'applique APRÈS b (vecteur colonne). */
const mul = (a: M, b: M): M => {
  const o = new Array<number>(20);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      let s = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) s += a[r * 5 + k] * b[k * 5 + c];
      o[r * 5 + c] = s;
    }
  return o;
};

/** Enchaîne les effets dans l'ordre de lecture, comme les filtres CSS : le premier s'applique d'abord. */
const chain = (...ms: M[]): M => ms.reduce((acc, m) => mul(m, acc), I);

const brightness = (v: number): M => [v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, 1, 0];
const contrast = (c: number): M => {
  const o = 0.5 - 0.5 * c;
  return [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
};
const saturate = (s: number): M => {
  const r = 0.2126 * (1 - s), g = 0.7152 * (1 - s), b = 0.0722 * (1 - s);
  return [r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0];
};
const sepia = (s: number): M => {
  const e = 1 - s;
  return [
    0.393 * s + e, 0.769 * s, 0.189 * s, 0, 0,
    0.349 * s, 0.686 * s + e, 0.168 * s, 0, 0,
    0.272 * s, 0.534 * s, 0.131 * s + e, 0, 0,
    0, 0, 0, 1, 0,
  ];
};
const grayscale = (g: number): M => {
  const l = [0.2126, 0.7152, 0.0722], e = 1 - g;
  return [
    l[0] * g + e, l[1] * g, l[2] * g, 0, 0,
    l[0] * g, l[1] * g + e, l[2] * g, 0, 0,
    l[0] * g, l[1] * g, l[2] * g + e, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

export const FILTERS: FilterDef[] = [
  { id: 'none', matrix: null, css: null },
  {
    // golden hour : chaleur propre type Juno — lumière dorée sans boue
    id: 'dore',
    matrix: chain(sepia(0.22), saturate(1.28), contrast(1.08), brightness(1.02)),
    css: 'sepia(0.22) saturate(1.28) contrast(1.08) brightness(1.02)',
  },
  {
    // punch : vif et propre type Lo-Fi — saturation contrôlée, contraste net
    id: 'neon',
    matrix: chain(saturate(1.32), contrast(1.16)),
    css: 'saturate(1.32) contrast(1.16)',
  },
  {
    // nuit : ombres bleutées, ambiance froide — assombrit en douceur
    id: 'nuit',
    matrix: chain(
      brightness(0.94),
      contrast(1.07),
      saturate(0.9),
      [0.93, 0, 0.03, 0, -0.008, 0, 0.96, 0.02, 0, -0.002, 0.01, 0.03, 1.07, 0, 0.02, 0, 0, 0, 1, 0],
    ),
    css: 'brightness(0.94) saturate(0.9) contrast(1.07) hue-rotate(8deg)',
  },
  {
    // noir : N&B film type Inkwell — contraste réel, pointe de chaleur argentique
    id: 'noir',
    matrix: chain(grayscale(1), contrast(1.14), brightness(1.05), sepia(0.1)),
    css: 'grayscale(1) contrast(1.14) brightness(1.05) sepia(0.1)',
  },
  {
    // poudre : pastel aérien type Reyes — contraste doux, voile crème
    id: 'poudre',
    matrix: chain(brightness(1.1), contrast(0.86), saturate(0.82), sepia(0.16)),
    css: 'brightness(1.1) contrast(0.86) saturate(0.82) sepia(0.16)',
  },
];

export const matrixOf = (id?: string | null): number[] | null => FILTERS.find((f) => f.id === id)?.matrix ?? null;

export const cssOf = (id?: string | null): string | null => FILTERS.find((f) => f.id === id)?.css ?? null;
