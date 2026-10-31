/// <reference types="jest" />
/** Aiguillage sans session : jamais eu de compte ici → accueil à découvrir (splash à gratter) ; compte déjà ouvert → connexion. */
import { renderHook, waitFor } from '@testing-library/react-native';
import { markHasAccount, useLanding } from '../src/lib/returning';

describe('useLanding', () => {
  // le cache module (`known`) n'est pas réinitialisable sans resetModules, qui casse les hooks :
  // ce test doit donc passer AVANT celui qui marque un compte.
  it('renvoie l’accueil quand aucun compte n’a jamais été ouvert sur ce téléphone', async () => {
    const { result } = await renderHook(() => useLanding());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe('/welcome');
  });

  it('renvoie la connexion quand un compte a déjà existé sur ce téléphone', async () => {
    markHasAccount();
    const { result } = await renderHook(() => useLanding());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe('/auth?mode=login');
  });
});
