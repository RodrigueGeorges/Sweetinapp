/// <reference types="jest" />

import { FILTERS, cssOf, matrixOf } from '../src/lib/filters';

describe('filters', () => {
  it('chaque filtre a une matrice Skia 4×5 et un équivalent CSS (sauf none)', () => {
    const ids = new Set(FILTERS.map((f) => f.id));
    expect(ids.size).toBe(FILTERS.length);
    for (const f of FILTERS) {
      if (f.id === 'none') continue;
      expect(f.matrix).toHaveLength(20);
      expect(f.css).toBeTruthy();
    }
  });

  it('matrixOf/cssOf renvoient la bonne définition et restent prudents', () => {
    expect(matrixOf('noir')).toHaveLength(20);
    expect(cssOf('noir')).toContain('grayscale');
    expect(matrixOf('none')).toBeNull();
    expect(cssOf('none')).toBeNull();
    expect(matrixOf('inconnu')).toBeNull();
    expect(matrixOf(undefined)).toBeNull();
    expect(matrixOf(null)).toBeNull();
  });
});
