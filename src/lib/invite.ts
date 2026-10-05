import * as SMS from 'expo-sms';
import { Share } from 'react-native';
import { t } from '../i18n';
import { inviteUrl, type InviteSource } from './api';
import { track } from './monitoring';

const message = (username: string) => t('contacts.shareMessage', { url: inviteUrl(username) });

/** Ouvre l'app SMS avec le lien d'invitation. Renvoie false si les SMS sont indisponibles. */
export async function inviteBySms(username: string) {
  if (!(await SMS.isAvailableAsync())) return false;
  await SMS.sendSMSAsync([], message(username));
  track('invite_shared', { via: 'sms' });
  return true;
}

/** Feuille de partage du système (WhatsApp, Insta, Messages…) avec le lien d'invitation. */
export async function shareInviteLink(username: string) {
  // le lien est dans le message : le passer aussi en `url` le doublerait sur iOS
  const r = await Share.share({ message: message(username) });
  if (r.action === Share.sharedAction) track('invite_shared', { via: r.activityType ?? 'share' });
}

/** Lit un lien d'invitation Sweetin (https://…/u/pseudo?src=…) dans un texte collé ou un QR code. */
export function parseInvite(text: string): { name: string; source: InviteSource } | null {
  const m = text.match(/\/u\/([a-z0-9_.]{3,20})(?:\?src=([a-z]+))?/i);
  if (!m) return null;
  const source = (['link', 'flip', 'story', 'qr', 'contacts'] as const).find((x) => x === m[2]) ?? 'link';
  return { name: m[1].toLowerCase(), source };
}
