import Constants from 'expo-constants';
import { lang } from '../i18n';

const raw = (Constants.expoConfig?.extra ?? {}) as { privacyUrl?: string; termsUrl?: string; privacyUrlEn?: string; termsUrlEn?: string; safetyUrl?: string; safetyUrlEn?: string; supportEmail?: string };

/** Pages légales dans la langue de l'app, et adresse de contact. */
export const legal = {
  privacyUrl: lang === 'fr' ? raw.privacyUrl : (raw.privacyUrlEn ?? raw.privacyUrl),
  termsUrl: lang === 'fr' ? raw.termsUrl : (raw.termsUrlEn ?? raw.termsUrl),
  safetyUrl: lang === 'fr' ? raw.safetyUrl : (raw.safetyUrlEn ?? raw.safetyUrl),
  supportEmail: raw.supportEmail,
};
