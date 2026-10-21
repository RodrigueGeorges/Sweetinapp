import { kv } from './kv';
import * as StoreReview from 'expo-store-review';
import { track } from './monitoring';

const READS = 'sweetin.reads';
const ASKED = 'sweetin.reviewAskedAt';
const MIN_READS = 3;
const EVERY_MS = 60 * 24 * 3600 * 1000;

/** Compte un secret gratté (sert à ne demander une note qu'à quelqu'un qui a vraiment utilisé l'app). */
export async function countRead() {
  const n = Number((await kv.getItem(READS).catch(() => null)) ?? 0) + 1;
  await kv.setItem(READS, String(n)).catch(() => {});
}

/**
 * Demande une note au meilleur moment : juste après une réaction à un secret (un moment heureux),
 * à partir du 3e secret gratté, au plus une fois tous les 60 jours. Le système limite aussi à 3 fois par an.
 */
export async function maybeAskReview() {
  try {
    const n = Number((await kv.getItem(READS)) ?? 0);
    const last = Number((await kv.getItem(ASKED)) ?? 0);
    if (n < MIN_READS || Date.now() - last < EVERY_MS) return;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    await kv.setItem(ASKED, String(Date.now()));
    setTimeout(() => {
      track('review_prompt');
      StoreReview.requestReview().catch(() => {});
    }, 1400);
  } catch {
    // jamais bloquant
  }
}
