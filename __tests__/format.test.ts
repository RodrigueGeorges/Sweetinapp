/// <reference types="jest" />
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
import { ageAt, ago, isoDate, parseBirth, seconds } from '../src/lib/format';

describe('date de naissance', () => {
  it('refuse les dates impossibles', () => {
    expect(parseBirth('31', '02', '2000')).toBeNull();
    expect(parseBirth('12', '13', '2000')).toBeNull();
    expect(parseBirth('1', '1', '99')).toBeNull();
    expect(parseBirth('1', '1', '1850')).toBeNull();
    expect(parseBirth('1', '1', String(new Date().getFullYear() + 1))).toBeNull();
    expect(parseBirth('', '', '')).toBeNull();
  });

  it('accepte une date valide, y compris le 29 février bissextile', () => {
    expect(isoDate(parseBirth('29', '02', '2004')!)).toBe('2004-02-29');
    expect(isoDate(parseBirth('5', '7', '1999')!)).toBe('1999-07-05');
  });

  it('calcule l’âge à la veille et au jour de l’anniversaire', () => {
    const birth = new Date(2010, 5, 15);
    expect(ageAt(birth, new Date(2026, 5, 14))).toBe(15);
    expect(ageAt(birth, new Date(2026, 5, 15))).toBe(16);
  });
});

describe('affichage', () => {
  it('formate les secondes à la française et à l’anglaise', () => {
    expect(seconds(4321, 'fr')).toBe('4,3');
    expect(seconds(null, 'fr')).toBe('0,0');
    expect(seconds(4321, 'en')).toBe('4.3');
  });

  it('donne des durées relatives', () => {
    const now = Date.parse('2026-10-03T12:00:00Z');
    const at = (s: number) => new Date(now - s * 1000).toISOString();
    expect(ago(at(10), now)).toMatch(/instant|now/);
    expect(ago(at(5 * 60), now)).toMatch(/5 min/);
    expect(ago(at(3 * 3600), now)).toMatch(/3 h/);
    expect(ago(at(30 * 3600), now)).toMatch(/hier|yesterday/);
    expect(ago(at(4 * 86400), now)).toMatch(/4/);
  });
});

describe('numéros de téléphone', () => {
  const { toE164 } = require('../src/lib/contacts') as typeof import('../src/lib/contacts');
  it('comprend un numéro français écrit localement', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678');
    expect(toE164('+33 6 12 34 56 78', 'BE')).toBe('+33612345678');
  });
  it('refuse les numéros invalides', () => {
    expect(toE164('12', 'FR')).toBeNull();
    expect(toE164('pas un numéro', 'FR')).toBeNull();
  });
});
