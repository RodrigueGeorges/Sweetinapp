import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import type { InviteSource } from './api';
import { track } from './monitoring';
import { rememberInvite } from './session';

/**
 * Invitation qui survit à l'installation (Android) : les liens /u/<pseudo> et /f/ envoient vers le Play Store avec
 * referrer=invite=<pseudo>&src=<source>. Au tout premier lancement, on relit ce referrer et on garde l'invitation :
 * l'ami est ajouté tout seul à la fin de l'inscription, sans « coller un lien d'invitation ».
 */
const KEY = 'sweetin.referrerChecked';
const SOURCES: InviteSource[] = ['link', 'flip', 'story', 'qr', 'contacts', 'username'];

export function parseReferrer(raw: string): { name: string; source: InviteSource } | null {
  if (!raw) return null;
  let s = raw;
  try {
    if (/%3D/i.test(s)) s = decodeURIComponent(s); // certains appareils renvoient le referrer encore encodé
  } catch {}
  const q = new URLSearchParams(s);
  const name = (q.get('invite') ?? '').trim().replace(/^@/, '');
  if (!/^[a-z0-9._]{3,20}$/i.test(name)) return null;
  const src = q.get('src') as InviteSource | null;
  return { name, source: src && SOURCES.includes(src) ? src : 'link' };
}

let ready: Promise<void> = Promise.resolve();
/** Se résout quand le referrer a été relu (ou tout de suite hors Android) : l'accueil attend ça pour dire « @tom t'attend. ». */
export const referrerChecked = () => ready;

export function checkInstallReferrer() {
  ready = readReferrer();
  return ready;
}

async function readReferrer() {
  if (Platform.OS !== 'android') return;
  try {
    if (await AsyncStorage.getItem(KEY)) return;
    await AsyncStorage.setItem(KEY, '1');
    const inv = parseReferrer(await Application.getInstallReferrerAsync());
    if (!inv) return;
    await rememberInvite(inv.name, inv.source);
    track('install_referrer', { source: inv.source });
  } catch {}
}
