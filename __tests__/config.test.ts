/// <reference types="jest" />
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/monitoring', () => ({ setTestGroup: jest.fn() }));
import { groupOf, meltFor } from '../src/lib/config';

describe('durée de lecture (test A/B « melt »)', () => {
  test('sans réglage reçu : 10 s pour tous les mots', () => {
    expect(meltFor('tu me plais.', 'u1').seconds).toBe(10);
    expect(meltFor('x'.repeat(90), 'u1').seconds).toBe(10);
  });
  test('test arrêté (split 0) : tout le monde en a', () => {
    expect(groupOf('u1', 'melt_v1', 0)).toBe('a');
    expect(groupOf(undefined, 'melt_v1', 0.5)).toBe('a');
  });
  test('le groupe est stable et la répartition proche du split', () => {
    expect(groupOf('abc', 'melt_v1', 0.5)).toBe(groupOf('abc', 'melt_v1', 0.5));
    let b = 0;
    for (let i = 0; i < 2000; i++) if (groupOf(`user-${i}`, 'melt_v1', 0.5) === 'b') b++;
    expect(b / 2000).toBeGreaterThan(0.45);
    expect(b / 2000).toBeLessThan(0.55);
  });
});
