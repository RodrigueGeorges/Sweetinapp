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
  return fallback ?? t('common.error');
}
