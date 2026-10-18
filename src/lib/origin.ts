import type { View } from 'react-native';

/**
 * Où était la carte touchée dans la vitrine : la lecture s'ouvre depuis cette carte (Android ; iOS a Link.AppleZoom).
 * Gardé en mémoire le temps d'une ouverture, puis oublié (une lecture ouverte par une notification part du plein écran).
 * La mesure peut arriver une image après l'ouverture de l'écran : on prévient alors qui attend.
 */
export type Origin = { x: number; y: number; w: number; h: number; r: number; at: number };
let last: Origin | null = null;
let pendingSince = 0;
let waiter: ((o: Origin | null) => void) | null = null;

function set(o: Origin | null) {
  pendingSince = 0;
  if (waiter) {
    const w = waiter;
    waiter = null;
    w(o);
  } else last = o;
}

export function rememberOrigin(view: View | null, radius: number) {
  const v = view as (View & { getBoundingClientRect?: () => DOMRect }) | null;
  if (!v) return;
  if (v.getBoundingClientRect) {
    // web (aperçu) : mesure immédiate
    const b = v.getBoundingClientRect();
    return set({ x: b.left, y: b.top, w: b.width, h: b.height, r: radius, at: Date.now() });
  }
  pendingSince = Date.now();
  last = null;
  v.measureInWindow((x, y, w, h) => set(w > 0 && h > 0 ? { x, y, w, h, r: radius, at: Date.now() } : null));
}

/**
 * Rend l'origine si elle date de moins d'une seconde.
 * Mesure encore en cours : `onLate` la recevra (ou null) dès qu'elle arrive, au plus tard après 150 ms.
 */
export function takeOrigin(onLate?: (o: Origin | null) => void): Origin | null | 'pending' {
  // pas effacée à la lecture : en développement, React appelle deux fois l'initialiseur d'état (mode strict) ;
  // elle expire seule après une seconde
  if (last) return Date.now() - last.at < 1000 ? last : null;
  if (pendingSince && Date.now() - pendingSince < 1000 && onLate) {
    waiter = onLate;
    setTimeout(() => {
      if (waiter === onLate) {
        waiter = null;
        onLate(null);
      }
    }, 150);
    return 'pending';
  }
  return null;
}
