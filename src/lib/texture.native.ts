import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Le grain du grattage, sous le doigt : une vibration continue qui suit la vitesse (Pulsar, Software Mansion).
 * Doucement, ça frotte à peine ; vite, ça grésille, comme un ticket à gratter.
 * Téléphones sans moteur de vibration fin (ou module absent, ex. Expo Go) : `null`, l'app garde ses petits « tic » à chaque dixième.
 */
type Pulsar = typeof import('react-native-pulsar');
let P: Pulsar | null = null;
try {
  P = require('react-native-pulsar') as Pulsar;
} catch {
  P = null;
}

function supported() {
  try {
    if (!P || P.Settings.getHapticsSupportLevel() < P.HapticSupport.STANDARD_SUPPORT) return false;
    // Android : des micro-impulsions plutôt que l'enveloppe continue (instable selon les téléphones) ; c'est aussi plus « grain »
    if (Platform.OS === 'android') P.Settings.setRealtimeComposerStrategy(P.RealtimeComposerStrategy.PRIMITIVE_TICK);
    return true;
  } catch {
    return false;
  }
}

export type Texture = { move: (speed: number) => void; end: () => void } | null;

// le hook est toujours appelé (règles des hooks) ; sans le module natif, le repli renvoie juste null
const useRealtimeComposer: () => ReturnType<Pulsar['useRealtimeComposer']> | null = P ? () => P.useRealtimeComposer() : () => null;

/** `speed` en px/ms (vitesse du doigt). */
export function useScratchTexture(): Texture {
  const ok = useMemo(() => supported(), []);
  const rt = useRealtimeComposer();
  const last = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (idle.current) clearTimeout(idle.current);
      rt?.stop();
    },
    [rt],
  );
  return useMemo(() => {
    if (!ok || !rt) return null;
    return {
      move(speed: number) {
        // doigt posé mais immobile : plus rien ne frotte
        if (idle.current) clearTimeout(idle.current);
        idle.current = setTimeout(() => {
          try {
            rt.stop();
          } catch {}
        }, 90);
        const now = Date.now();
        if (now - last.current < 32) return; // ~30 mises à jour par seconde suffisent
        last.current = now;
        const v = Math.min(1, speed / 2.2); // 2,2 px/ms : un grattage énergique
        const amplitude = 0.12 + 0.68 * v;
        const frequency = 0.25 + 0.55 * v; // plus vite = plus aigu, le « grésillement »
        try {
          rt.set(amplitude, frequency);
        } catch {}
      },
      end() {
        if (idle.current) clearTimeout(idle.current);
        try {
          rt.stop();
        } catch {}
      },
    };
  }, [ok, rt]);
}
