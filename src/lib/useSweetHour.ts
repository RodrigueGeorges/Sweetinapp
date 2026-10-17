import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { currentSweetHour } from './api';
import { ensureSweetHourActivity } from './live';

/**
 * Secondes restantes du Sweet Hour du jour, ou null en dehors.
 * Le serveur ne révèle l'horaire qu'une fois commencé : on vérifie à l'affichage, au retour dans l'app et toutes les 30 s.
 */
export function useSweetHour(enabled = true) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const check = useCallback(() => {
    if (!enabled) return;
    currentSweetHour()
      .then((h) => setEndsAt(h ? new Date(h.ends_at).getTime() : null))
      .catch(() => {});
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      check();
      const poll = setInterval(check, 30_000);
      const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
      return () => {
        clearInterval(poll);
        sub.remove();
      };
    }, [check]),
  );

  const live = endsAt !== null && endsAt > now;
  // compte à rebours aussi sur l'écran verrouillé et dans la Dynamic Island (iOS)
  useEffect(() => {
    if (endsAt !== null && endsAt > Date.now()) ensureSweetHourActivity(endsAt);
  }, [endsAt]);
  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [live]);

  return live ? Math.ceil((endsAt! - now) / 1000) : null;
}
