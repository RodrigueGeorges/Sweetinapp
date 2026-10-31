import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { ApiError, forgetLocalPhoto, myId, sendFlip, type Mode, type WordStyle } from './api';

const KEY = 'sweetin.sendQueue.v2';
const MAX = 5;
// une photo en cache n'est pas éternelle : au-delà d'une semaine, le fichier a pu être nettoyé
const TTL_MS = 7 * 24 * 3600 * 1000;

/** Un sweet accepté mais pas encore parti (envoi tenté hors connexion). */
export type QueuedSend = { localUri: string; message: string; mode: Mode; recipients: string[]; preview: string | null; wordStyle?: WordStyle | null; queued_at: number; sendId: string; ownerId: string; failure?: string };

async function readQueue(uid: string): Promise<QueuedSend[]> {
  const raw = await AsyncStorage.getItem(`${KEY}:${uid}`);
  const list: QueuedSend[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(list) || list.some((q) => q.ownerId !== uid || !q.sendId)) throw new ApiError('QUEUE_INVALID');
  return list;
}

export async function pendingSends(): Promise<QueuedSend[]> {
  return readQueue(await myId());
}

const listeners = new Set<() => void>();
let mutation = Promise.resolve();
const inFlight = new Set<string>();
const locked = <T,>(work: () => Promise<T>): Promise<T> => {
  const next = mutation.then(work);
  mutation = next.then(() => {}, () => {});
  return next;
};

/** Abonnement léger : la vitrine affiche les envois en attente dès que la file bouge. */
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function saveQueue(uid: string, list: QueuedSend[]) {
  if (list.length) await AsyncStorage.setItem(`${KEY}:${uid}`, JSON.stringify(list));
  else await AsyncStorage.removeItem(`${KEY}:${uid}`);
  for (const fn of listeners) fn();
}

/** Garde un sweet de côté quand l'envoi a échoué faute de réseau (seulement les envois à des amis : un lien doit repasser par le partage). */
export async function queueSend(input: Omit<QueuedSend, 'queued_at' | 'sendId' | 'ownerId'> & { sendId?: string; ownerId?: string }) {
  const uid = await myId();
  if (input.ownerId && input.ownerId !== uid) throw new ApiError('ACCOUNT_CHANGED');
  await locked(async () => {
    const list = await readQueue(uid);
    const sendId = input.sendId ?? randomUUID();
    if (list.some((q) => q.sendId === sendId)) return;
    // file pleine : on refuse le nouvel envoi sans supprimer les précédents
    if (list.length >= MAX) throw new ApiError('QUEUE_FULL');
    list.push({ ...input, ownerId: uid, sendId, queued_at: Date.now() });
    await saveQueue(uid, list);
  });
}

/** Appui long sur la ligne « en attente » de la vitrine : on retire le sweet de la file sans l'envoyer. */
export async function removeQueuedAt(id: string | number) {
  const uid = await myId();
  await locked(async () => {
    const list = await readQueue(uid);
    const index = typeof id === 'number' ? id : list.findIndex((q) => q.sendId === id);
    if (index < 0 || !list[index]) return;
    if (inFlight.has(list[index].sendId)) throw new ApiError('QUEUE_BUSY');
    const [gone] = list.splice(index, 1);
    await saveQueue(uid, list);
    forgetLocalPhoto(gone.localUri);
  });
}

let flushing = false;

/** Au retour du réseau (ou de l'app au premier plan) : repart les sweets gardés de côté. Renvoie combien sont partis. */
export async function flushSendQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    const uid = await myId();
    const all = await locked(() => readQueue(uid));
    let sent = 0;
    for (const q of all) {
      if (await myId() !== uid) break;
      if (q.failure) continue;
      const exists = await locked(async () => {
        if (!(await readQueue(uid)).some((item) => item.sendId === q.sendId)) return false;
        inFlight.add(q.sendId);
        return true;
      });
      if (!exists) continue;
      let failure: string | undefined;
      try {
        if (Date.now() - q.queued_at >= TTL_MS) throw new ApiError('QUEUE_EXPIRED');
        await sendFlip({ ...q });
        sent++;
      } catch (e) {
        const code = e instanceof ApiError ? e.code : undefined;
        // un refus définitif reste visible dans la file, sans nouvelle tentative automatique
        if (e instanceof ApiError && !e.retryable) failure = code ?? 'SERVER';
        // plus de réseau ou pas encore connecté : on garde toute la suite et on réessaiera plus tard
        if (code === 'OFFLINE' || code === 'NOT_AUTHENTICATED' || code === 'ACCOUNT_CHANGED') break;
        if (!failure) continue;
      } finally {
        inFlight.delete(q.sendId);
      }
      await locked(async () => {
        const current = await readQueue(uid);
        await saveQueue(uid, failure ? current.map((item) => item.sendId === q.sendId ? { ...item, failure } : item) : current.filter((item) => item.sendId !== q.sendId));
      });
    }
    return sent;
  } finally {
    flushing = false;
  }
}
