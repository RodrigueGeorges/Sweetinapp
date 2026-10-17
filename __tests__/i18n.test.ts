/// <reference types="jest" />
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { errorText, t } from '../src/i18n';

const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('traductions', () => {
  it('ont exactement les mêmes clés en français et en anglais', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('utilisent les mêmes {variables} dans les deux langues', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect([key, vars(en[key])]).toEqual([key, vars(fr[key])]);
    }
  });

  it('ne laissent aucun texte vide', () => {
    for (const [k, v] of [...Object.entries(fr), ...Object.entries(en)]) expect([k, v.trim().length > 0]).toEqual([k, true]);
  });

  it('remplacent les variables', () => {
    expect(t('read.from', { name: 'loic' }, 'fr')).toBe('de loic');
    expect(t('read.from', { name: 'loic' }, 'en')).toBe('from loic');
    expect(t('send.ctaMany', { n: 3 }, 'fr')).toBe('envoyer à 3');
  });

  it('traduisent les codes d’erreur du serveur, avec repli', () => {
    expect(errorText('USERNAME_TAKEN')).toBe(t('err.USERNAME_TAKEN'));
    expect(errorText('INCONNU', 'message brut')).toBe('message brut');
    expect(errorText(undefined)).toBe(t('common.error'));
  });

  it('couvrent tous les codes d’erreur renvoyés par les fonctions serveur', () => {
    const codes = ['USERNAME_INVALID', 'USERNAME_TAKEN', 'AGE_INVALID', 'UNDERAGE', 'USER_NOT_FOUND', 'SELF', 'PROFILE_INCOMPLETE', 'NOT_FOUND', 'ALREADY_SCRATCHED', 'EXPIRED', 'MODERATION', 'MODERATION_UNAVAILABLE', 'RATE_LIMIT', 'NO_RECIPIENT', 'MESSAGE_LENGTH', 'PHOTO_INVALID'];
    for (const c of codes) expect(`err.${c}` in fr).toBe(true);
  });
});
