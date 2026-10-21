/**
 * Filtres photo façon stories : matrices de couleur Skia (4×5) pour l'app,
 * équivalents CSS pour la page web /f/. Données pures, aucune dépendance.
 */
export type FilterId = 'none' | 'dore' | 'neon' | 'nuit' | 'noir' | 'poudre';

export type FilterDef = { id: FilterId; matrix: number[] | null; css: string | null };

export const FILTERS: FilterDef[] = [
  { id: 'none', matrix: null, css: null },
  {
    id: 'dore',
    matrix: [1.12, 0.06, 0, 0, 0.015, 0.04, 1.06, 0, 0, 0.01, 0, 0.02, 0.82, 0, -0.02, 0, 0, 0, 1, 0],
    css: 'sepia(0.3) saturate(1.3) contrast(1.03)',
  },
  {
    id: 'neon',
    matrix: [1.4724, -0.4291, -0.0433, 0, 0.02, -0.1276, 1.1709, -0.0433, 0, 0.02, -0.1276, -0.4291, 1.5567, 0, 0.02, 0, 0, 0, 1, 0],
    css: 'saturate(1.6) contrast(1.04)',
  },
  {
    id: 'nuit',
    matrix: [0.85, 0, 0.1, 0, -0.02, 0, 0.92, 0.06, 0, -0.01, 0.04, 0.05, 1.12, 0, 0.03, 0, 0, 0, 1, 0],
    css: 'saturate(0.85) brightness(0.93) contrast(1.06)',
  },
  {
    id: 'noir',
    matrix: [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0],
    css: 'grayscale(1) contrast(1.05)',
  },
  {
    id: 'poudre',
    matrix: [0.86, 0, 0.04, 0, 0.1, 0, 0.88, 0.02, 0, 0.09, 0.03, 0, 0.83, 0, 0.11, 0, 0, 0, 1, 0],
    css: 'brightness(1.1) contrast(0.88) saturate(0.95)',
  },
];

export const matrixOf = (id?: string | null): number[] | null => FILTERS.find((f) => f.id === id)?.matrix ?? null;

export const cssOf = (id?: string | null): string | null => FILTERS.find((f) => f.id === id)?.css ?? null;
