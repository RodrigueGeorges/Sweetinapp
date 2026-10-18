import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Le téléphone se souvient qu'un compte y a déjà été ouvert.
 * Déconnecté, on revient alors sur la connexion, pas sur l'accueil à gratter (fait pour découvrir l'app).
 */
const KEY = 'sweetin.hasAccount';
let known: boolean | null = null;

export function markHasAccount() {
  if (known) return;
  known = true;
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}

/** Après une suppression de compte : le prochain passage repart de l'accueil. */
export function clearHasAccount() {
  known = false;
  AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Où envoyer quelqu'un sans session : la connexion si un compte a déjà existé ici, sinon l'accueil. null pendant la lecture. */
export function useLanding(): '/welcome' | '/auth?mode=login' | null {
  const [has, setHas] = useState<boolean | null>(known);
  useEffect(() => {
    if (has !== null) return;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        known = !!v;
        setHas(known);
      })
      .catch(() => setHas(false));
  }, [has]);
  if (has === null) return null;
  return has ? '/auth?mode=login' : '/welcome';
}

export const LOGIN_ROUTE = { pathname: '/auth', params: { mode: 'login' } } as const;
