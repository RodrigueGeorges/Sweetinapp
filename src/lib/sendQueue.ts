import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, forgetLocalPhoto, sendFlip, type Mode, type WordStyle } from './api';

const KEY = 'sweetin.sendQueue';
const MAX = 5;
// une photo en cache n'est pas éternelle : au-delà d'une semaine, le fichier a pu être nettoyé
const TTL_MS = 7 * 24 * 3600 * 1000;

/** Un sweet accepté mais pas encore parti (envoi tenté hors connexion). */
export type QueuedSend = { localUri: string; message: string; mode: Mode; recipients: string[]; preview: string | null; wordStyle?: WordStyle | null; queued_at: number };

export async function pendingSends(): Promise<QueuedSend[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedSend[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

/** Abonnement léger : la vitrine affiche les envois en attente dès que la file bouge. */
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function saveQueue(list: QueuedSend[]) {
  try {
    if (list.length) await AsyncStorage.setItem(KEY, JSON.stringify(list));
    else await AsyncStorage.removeItem(KEY);
  } catch {}
  for (const fn of listeners) fn();
}

/** Garde un sweet de côté quand l'envoi a échoué faute de réseau (seulement les envois à des amis : un lien doit repasser par le partage). */
export async function queueSend(input: Omit<QueuedSend, 'queued_at'>) {
  const list = await pendingSends();
  list.push({ ...input, queued_at: Date.now() });
  // file pleine : les plus vieux sortent, leur photo de cache est nettoyée au passage
  const evicted = list.splice(0, Math.max(0, list.length - MAX));
  await saveQueue(list);
  for (const q of evicted) forgetLocalPhoto(q.localUri);
}

/** Appui long sur la ligne « en attente » de la vitrine : on retire le sweet de la file sans l'envoyer. */
export async function removeQueuedAt(index: number) {
  const list = await pendingSends();
  const [gone] = list.splice(index, 1);
  await saveQueue(list);
  if (gone) forgetLocalPhoto(gone.localUri);
}

let flushing = false;

/** Au retour du réseau (ou de l'app au premier plan) : repart les sweets gardés de côté. Renvoie combien sont partis. */
export async function flushSendQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    const all = await pendingSends();
    const expired = all.filter((q) => Date.now() - q.queued_at >= TTL_MS);
    const list = all.filter((q) => Date.now() - q.queued_at < TTL_MS);
    for (const q of expired) forgetLocalPhoto(q.localUri);
    let sent = 0;
    const rest: QueuedSend[] = [];
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      try {
        await sendFlip({ localUri: q.localUri, message: q.message, mode: q.mode, recipients: q.recipients, preview: q.preview, wordStyle: q.wordStyle });
        sent++;
      } catch (e) {
        const code = e instanceof ApiError ? e.code : undefined;
        // un refus définitif (modération, mode) ne retente pas : la photo de cache part avec
        if (!(e instanceof ApiError) || e.retryable) rest.push(q);
        else forgetLocalPhoto(q.localUri);
        // plus de réseau ou pas encore connecté : on garde toute la suite et on réessaiera plus tard
        if (code === 'OFFLINE' || code === 'NOT_AUTHENTICATED') {
          rest.push(...list.slice(i + 1));
          break;
        }
      }
    }
    await saveQueue(rest);
    return sent;
  } finally {
    flushing = false;
  }
}
