import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { matchContacts, type Profile } from './api';

/** Pays du téléphone, pour comprendre les numéros écrits sans indicatif (06…). */
export function deviceCountry(): CountryCode {
  try {
    return (getLocales()[0]?.regionCode ?? 'FR') as CountryCode;
  } catch {
    return 'FR';
  }
}

/** Numéro au format international, ou null s'il n'est pas valide. */
export function toE164(raw: string, country: CountryCode = deviceCountry()): string | null {
  const p = parsePhoneNumberFromString(raw, country);
  return p && p.isValid() ? p.number : null;
}

/** Empreinte envoyée au serveur : SHA-256 des chiffres du numéro international (sans le +). */
export const phoneHash = (e164: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, e164.replace(/\D/g, ''));

/** Indicatifs proposés au choix : la francophonie d'abord, puis les voisins. */
export const PHONE_COUNTRIES: { c: CountryCode; flag: string; dial: string }[] = [
  { c: 'FR', flag: '🇫🇷', dial: '+33' }, { c: 'BE', flag: '🇧🇪', dial: '+32' }, { c: 'CH', flag: '🇨🇭', dial: '+41' }, { c: 'LU', flag: '🇱🇺', dial: '+352' },
  { c: 'MC', flag: '🇲🇨', dial: '+377' }, { c: 'CA', flag: '🇨🇦', dial: '+1' }, { c: 'MA', flag: '🇲🇦', dial: '+212' }, { c: 'DZ', flag: '🇩🇿', dial: '+213' },
  { c: 'TN', flag: '🇹🇳', dial: '+216' }, { c: 'SN', flag: '🇸🇳', dial: '+221' }, { c: 'CI', flag: '🇨🇮', dial: '+225' }, { c: 'RE', flag: '🇷🇪', dial: '+262' },
  { c: 'GP', flag: '🇬🇵', dial: '+590' }, { c: 'MQ', flag: '🇲🇶', dial: '+596' }, { c: 'GB', flag: '🇬🇧', dial: '+44' }, { c: 'ES', flag: '🇪🇸', dial: '+34' },
  { c: 'DE', flag: '🇩🇪', dial: '+49' }, { c: 'IT', flag: '🇮🇹', dial: '+39' }, { c: 'US', flag: '🇺🇸', dial: '+1' },
];

export type ContactsResult = { status: 'denied' } | { status: 'ok'; friends: Profile[]; scanned: number; shared: number; limited: boolean };

/**
 * Cherche quels contacts du téléphone sont sur Sweetin.
 * Les numéros ne quittent jamais le téléphone en clair : seules leurs empreintes sont envoyées, et rien n'est conservé.
 */
export async function findFriendsInContacts(ask = true): Promise<ContactsResult> {
  let perm = await getPermissionsAsync();
  if (!perm.granted && ask && perm.canAskAgain) perm = await requestPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  // iOS 18+ : l'utilisateur peut ne partager que quelques contacts. On le lui dit, avec de quoi en ajouter.
  const limited = Platform.OS === 'ios' && perm.accessPrivileges === 'limited';
  const all = await Contact.getAllDetails([ContactField.PHONES] as const);
  const country = deviceCountry();
  const numbers = new Set<string>();
  for (const c of all) for (const ph of c.phones ?? []) {
    const e = ph.number ? toE164(ph.number, country) : null;
    if (e) numbers.add(e);
    if (numbers.size >= 6000) break;
  }
  const hashes = await Promise.all([...numbers].map(phoneHash));
  const friends = hashes.length ? await matchContacts(hashes) : [];
  return { status: 'ok', friends, scanned: numbers.size, shared: all.length, limited };
}

/** iOS 18+ en accès limité : ouvre le sélecteur système pour partager d'autres contacts, puis relance la recherche. */
export async function shareMoreContacts(): Promise<ContactsResult> {
  try {
    await Contact.presentAccessPicker();
  } catch {
    // sélecteur fermé ou indisponible : on relance quand même avec ce qui est partagé
  }
  return findFriendsInContacts(false);
}
