/// <reference types="jest" />
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));

import { inviteUrl } from '../src/lib/api';
import { widgetStateFrom } from '../src/lib/widget';

describe('lien d’invitation', () => {
  it('pointe vers la page /u/<pseudo>', () => {
    expect(inviteUrl('loic_b')).toBe('https://sweetin.app/u/loic_b');
  });
  it('encode les caractères spéciaux', () => {
    expect(inviteUrl('a b')).toBe('https://sweetin.app/u/a%20b');
  });
});

describe('widget', () => {
  const item = (name: string) => ({ flip_id: name, created_at: '', mode: 'free' as const, opened: false, preview: 'QUJD', sender: { id: name, username: name } });
  it('n’expose qu’un compteur et un pseudo, jamais de contenu', () => {
    const s = widgetStateFrom([item('fabien'), item('loic')]);
    expect(s.count).toBe(2);
    expect(s.from).toBe('fabien');
    expect(Object.keys(s).sort()).toEqual(['count', 'cta', 'from', 'preview', 'subtitle', 'title']);
    expect(s.preview).toBe('QUJD');
  });
  it('a un état vide', () => {
    expect(widgetStateFrom([]).count).toBe(0);
  });
});

describe('invitation collée ou scannée', () => {
  const { parseInvite } = require('../src/lib/invite') as typeof import('../src/lib/invite');
  it('lit un lien avec sa source', () => {
    expect(parseInvite('https://sweetin.app/u/Loic_B?src=qr')).toEqual({ name: 'loic_b', source: 'qr' });
  });
  it('accepte un lien sans source et du texte autour', () => {
    expect(parseInvite('Ajoute-moi 🍦 https://sweetin.app/u/fab.c merci')).toEqual({ name: 'fab.c', source: 'link' });
  });
  it('refuse ce qui n’est pas un lien Sweetin', () => {
    expect(parseInvite('https://example.com/profile/loic')).toBeNull();
    expect(parseInvite('https://sweetin.app/u/ab')).toBeNull();
  });
  it('ignore une source inconnue', () => {
    expect(parseInvite('sweetin://u/loic?src=hack')?.source).toBe('link');
  });
});
