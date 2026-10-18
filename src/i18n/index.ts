import { getLocales } from 'expo-localization';
import { en } from './en';
import { fr, type Key } from './fr';

export type { Key };

const dictionaries = { fr, en } as const;
export type Lang = keyof typeof dictionaries;

/** Langue du téléphone si on la parle, sinon l'anglais. */
export function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    return code in dictionaries ? (code as Lang) : 'en';
  } catch {
    return 'en';
  }
}

export const lang: Lang = detectLang();

/** Traduit une clé et remplace les {variables}. */
export function t(key: Key, vars?: Record<string, string | number>, l: Lang = lang): string {
  let s: string = dictionaries[l][key] ?? fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Traduit un code d'erreur serveur, avec un message de repli. */
export function errorText(code: string | undefined, fallback?: string): string {
  const key = `err.${code}` as Key;
  if (code && key in fr) return t(key);
  if (fallback && isHumanText(fallback)) return fallback;
  if (fallback && /fetch|network|timeout|timed out|offline|internet|connexion/i.test(fallback)) return t('err.OFFLINE');
  return t('common.error');
}

/**
 * Un texte qu'on peut montrer tel quel : nos messages sont en minuscules (DA Fondant).
 * Tout le reste (« TypeError: Failed to fetch », « JWT expired », erreurs Postgres en anglais) est technique.
 */
function isHumanText(m: string): boolean {
  return /^[a-zà-ÿ«“0-9@]/.test(m) && !/error|exception|fetch|network|violates|duplicate key|jwt|token|null|undefined|status code|column|relation|function |supabase|postgres/i.test(m);
}

/** Le message à montrer pour n'importe quelle erreur attrapée (ApiError, Error brute, valeur inconnue). */
export function humanError(e: unknown): string {
  return errorText(undefined, e instanceof Error ? e.message : typeof e === 'string' ? e : undefined);
}
