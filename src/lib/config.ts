import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { setTestGroup } from './monitoring';

/**
 * Réglages modifiables à distance (table app_config), sans nouvelle version de l'app.
 * Aujourd'hui : la durée de lecture avant la fonte, en test A/B (« melt »).
 * L'app garde la dernière valeur reçue (hors ligne) et retombe sur 10 s si rien n'est arrivé.
 */
type Range = { min: number; max: number };
export type MeltConfig = { test: string; split: number; a: Range; b: Range };

const DEFAULT: MeltConfig = { test: 'melt_v1', split: 0, a: { min: 10, max: 10 }, b: { min: 6, max: 10 } };
const CACHE = 'sweetin.config.melt';
let melt: MeltConfig = DEFAULT;

const valid = (r: unknown): r is Range => !!r && typeof (r as Range).min === 'number' && typeof (r as Range).max === 'number';
function accept(v: unknown) {
  const c = v as MeltConfig;
  if (c && typeof c.test === 'string' && typeof c.split === 'number' && valid(c.a) && valid(c.b)) melt = c;
}

/** Au démarrage : la valeur gardée d'abord, puis celle du serveur. */
export async function loadConfig() {
  try {
    const cached = await AsyncStorage.getItem(CACHE);
    if (cached) accept(JSON.parse(cached));
  } catch {}
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'melt').maybeSingle();
    if (data?.value) {
      accept(data.value);
      AsyncStorage.setItem(CACHE, JSON.stringify(data.value)).catch(() => {});
    }
  } catch {}
}

/** Groupe stable par compte et par test (le même à chaque ouverture, sur tous les téléphones). */
export function groupOf(userId: string | undefined, test: string, split: number): 'a' | 'b' {
  if (!userId || split <= 0) return 'a';
  if (split >= 1) return 'b';
  let h = 2166136261; // FNV-1a
  for (const ch of userId + ':' + test) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296 < split ? 'b' : 'a';
}

/** Durée de lecture d'un mot (en secondes), et le groupe du test pour les statistiques. */
export function meltFor(message: string, userId?: string): { seconds: number; group: 'a' | 'b'; test: string } {
  const group = groupOf(userId, melt.test, melt.split);
  const r = melt[group];
  const k = Math.min(1, Math.max(0, (message.length - 12) / (90 - 12)));
  const seconds = Math.round(Math.max(3, Math.min(15, r.min + (r.max - r.min) * k)));
  setTestGroup(melt.test, group);
  return { seconds, group, test: melt.test };
}
