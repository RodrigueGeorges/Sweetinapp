import { lang, t, type Lang } from '../i18n';

/** « il y a 3 min », « hier »… */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return t('ago.now');
  if (s < 3600) return t('ago.min', { n: Math.floor(s / 60) });
  if (s < 86400) return t('ago.hour', { n: Math.floor(s / 3600) });
  if (s < 172800) return t('ago.yesterday');
  return t('ago.day', { n: Math.floor(s / 86400) });
}

/** Version courte pour les pastilles sur photo : « 2 min », « 5 h », « 3 j » (« à l'instant », « hier »). */
export function agoShort(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const fr = lang === 'fr';
  if (s < 60) return fr ? 'à l’instant' : 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 172800) return t('ago.yesterday');
  return fr ? `${Math.floor(s / 86400)} j` : `${Math.floor(s / 86400)}d`;
}

/** Secondes avec une décimale, à la française (4,5) ou à l'anglaise (4.5). */
export const seconds = (ms: number | null, l: Lang = lang) => {
  const v = ((ms ?? 0) / 1000).toFixed(1);
  return l === 'fr' ? v.replace('.', ',') : v;
};

/** Âge en années révolues à une date donnée. */
export function ageAt(birth: Date, today = new Date()) {
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  return a;
}

/** Construit une date valide à partir de JJ / MM / AAAA, ou null. */
export function parseBirth(d: string, m: string, y: string): Date | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || y.length !== 4) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date > new Date() || year < 1900) return null;
  return date;
}

/** Format ISO (AAAA-MM-JJ) sans décalage horaire. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
