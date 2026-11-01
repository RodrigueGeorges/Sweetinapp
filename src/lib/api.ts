import NetInfo from '@react-native-community/netinfo';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { errorText } from '../i18n';
import type { FilterId } from './filters';
import { supabase } from './supabase';

export type Profile = { id: string; username: string; avatar_url?: string | null };
export type MyProfile = Profile & { onboarded: boolean };
type RawProfile = { id: string; username: string; avatar_path?: string | null };

/** Photo de profil : bucket public, chemin aléatoire (introuvable sans le connaître). */
export const avatarUrl = (path: string | null | undefined) => (path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null);
const prof = <T extends RawProfile>({ avatar_path, ...p }: T) => ({ ...p, avatar_url: avatarUrl(avatar_path) });
export type Mode = 'free' | 'once';

export type InboxItem = { flip_id: string; created_at: string; mode: Mode; sender: Profile; opened: boolean; preview: string | null };
export type LinkKind = 'single' | 'story';
export type InviteSource = 'link' | 'flip' | 'story' | 'qr' | 'contacts' | 'username';

export type SentItem = {
  flip_id: string;
  created_at: string;
  recipient: Profile;
  scratched_at: string | null;
  screenshot_at: string | null;
  percent: number | null;
  duration_ms: number | null;
  reaction: string | null;
  /** ThumbHash de la photo envoyée (vignette floue) */
  preview?: string | null;
};

/** Encres du mot : toutes lisibles sur la nuit du cœur ; en bulle, la pastille prend l'encre et le texte passe en nuit. */
export const wordInks = ['#FFFFFF', '#E8FF5A', '#FF6B88', '#CFE4FF', '#FFC9D6', '#FFD6C2'] as const;
export type WordInk = (typeof wordInks)[number];
export type WordFace = 'display' | 'sans';
export type { FilterId };

/** Placement et style du mot sur le verso, façon stories : décalage relatif au centre, échelle, couleur, pastille, fonte + filtre de la photo. */
export type WordStyle = { x: number; y: number; scale: number; ink?: WordInk; bubble?: boolean; face?: WordFace; filter?: FilterId };

export type OpenedFlip = { id: string; sender_id: string; sender: string; sender_avatar?: string | null; preview?: string | null; mode: Mode; created_at: string; photo_url: string; message: string; word_style?: WordStyle | null };

/** Erreur lisible par l'utilisateur. `code` vient du serveur (voir i18n `err.*`). */
export class ApiError extends Error {
  constructor(
    public code: string | undefined,
    message?: string,
    public retryable = false,
  ) {
    super(errorText(code, message));
  }
}

/** Erreur d'une fonction Postgres (le message porte le code, ex. USERNAME_TAKEN). */
function rpcError(error: { message: string }) {
  const code = /^[A-Z_]+$/.test(error.message) ? error.message : undefined;
  return new ApiError(code, code ? undefined : error.message);
}

/** Appelle une fonction serveur et transforme les erreurs en ApiError. */
async function call<T>(name: string, body: object, accessToken?: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body, ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}) });
  if (error) {
    let code: string | undefined;
    let msg: string | undefined;
    let status = 0;
    try {
      const ctx = (error as { context?: Response }).context;
      status = ctx?.status ?? 0;
      const parsed = ctx ? await ctx.json() : null;
      code = parsed?.code;
      msg = parsed?.error;
    } catch {}
    throw new ApiError(code, msg, status === 0 || status >= 500);
  }
  return data as T;
}

/** Réessaie une opération réseau avec une attente croissante (0,8 s, 2 s, 4,5 s). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable = !(e instanceof ApiError) || e.retryable;
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, [800, 2000, 4500][i] ?? 4500));
    }
  }
  throw last;
}

export async function isOnline() {
  const s = await NetInfo.fetch();
  return s.isConnected !== false && s.isInternetReachable !== false;
}

export async function myId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError('NOT_AUTHENTICATED');
  return id;
}

// ---------- connexion ----------
export async function signInWithApple() {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  if (!cred.identityToken) throw new ApiError(undefined);
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce });
  if (error) throw new ApiError(undefined, error.message);
}

/** Google via la page de connexion sécurisée du système (PKCE), sans SDK natif. Renvoie false si annulé. */
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/google-auth');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw new ApiError(undefined, error?.message);
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return false;
  const code = new URL(res.url).searchParams.get('code');
  if (!code) throw new ApiError(undefined);
  const { error: e2 } = await supabase.auth.exchangeCodeForSession(code);
  if (e2) throw new ApiError(undefined, e2.message);
  return true;
}

// ---------- profil ----------
export async function getMyProfile(): Promise<MyProfile | null> {
  const id = await myId();
  const { data } = await supabase.from('profiles').select('id, username, onboarded, avatar_path').eq('id', id).maybeSingle();
  return data ? (prof(data as RawProfile & { onboarded: boolean }) as MyProfile) : null;
}

/** Pseudo + date de naissance (AAAA-MM-JJ). L'âge minimum est vérifié par le serveur. */
export async function completeProfile(username: string, birthIso: string): Promise<MyProfile> {
  const { data, error } = await supabase.rpc('complete_profile', { p_username: username.trim().toLowerCase(), p_birth_date: birthIso });
  if (error) throw rpcError(error);
  const res = data as { profile?: MyProfile; error?: string };
  if (res.error || !res.profile) throw new ApiError(res.error ?? undefined);
  return prof(res.profile as MyProfile & RawProfile) as MyProfile;
}

/** Selfie de profil : carré 320 px, déposé dans son dossier, puis rattaché au profil par le serveur. */
export async function setAvatar(localUri: string): Promise<string | null> {
  const uid = await myId();
  const rendered = await ImageManipulator.manipulate(localUri).resize({ width: 320 }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = await new File(saved.uri).arrayBuffer();
  const path = `${uid}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new ApiError('UPLOAD', undefined, true);
  // la fonction serveur modère la photo avant de la rattacher au profil
  await call<{ ok: true }>('set-avatar', { path });
  return avatarUrl(path);
}

// ---------- amis ----------
export async function listFriends(): Promise<Profile[]> {
  const uid = await myId();
  const { data, error } = await supabase.from('friendships').select('friend:profiles!friendships_friend_id_fkey(id, username, avatar_path)').eq('user_id', uid);
  if (error) throw new ApiError(undefined, error.message, true);
  return (data ?? [])
    .map((r) => (r as unknown as { friend: RawProfile }).friend)
    .filter(Boolean)
    .map(prof)
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** Ajoute l'ami d'une invitation (lien, QR, flip reçu…) et enregistre d'où vient le nouvel utilisateur. */
export async function acceptInvite(username: string, source: InviteSource = 'link'): Promise<Profile> {
  const { data, error } = await supabase.rpc('accept_invite', { p_username: username.trim().replace(/^@/, ''), p_source: source });
  if (error) throw rpcError(error);
  return prof(data as RawProfile);
}

/** 'friends' : amitié créée (demande mutuelle) — 'sent' : demande envoyée, en attente de l'autre. */
export type FriendResult = { profile: Profile; status: 'friends' | 'sent' };

export async function addFriend(username: string): Promise<FriendResult> {
  const { data, error } = await supabase.rpc('request_friend', { p_username: username.trim().replace(/^@/, '') });
  if (error) throw rpcError(error);
  const d = data as { profile: RawProfile; status: string };
  return { profile: prof(d.profile), status: d.status === 'friends' ? 'friends' : 'sent' };
}

export async function listFriendRequests(): Promise<{ incoming: Profile[]; outgoing: Profile[] }> {
  const { data, error } = await supabase.rpc('list_friend_requests');
  if (error) throw rpcError(error);
  const d = (data ?? {}) as { incoming?: RawProfile[]; outgoing?: RawProfile[] };
  return { incoming: (d.incoming ?? []).map(prof), outgoing: (d.outgoing ?? []).map(prof) };
}

export async function acceptFriend(id: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('accept_friend', { p_user: id });
  if (error) throw rpcError(error);
  return prof(data as RawProfile);
}

export async function declineFriend(id: string) {
  const { error } = await supabase.rpc('decline_friend', { p_user: id });
  if (error) throw rpcError(error);
}

export async function removeFriend(id: string) {
  const { error } = await supabase.rpc('remove_friend', { p_friend: id });
  if (error) throw rpcError(error);
}

export async function blockUser(id: string) {
  const { error } = await supabase.rpc('block_user', { p_user: id });
  if (error) throw rpcError(error);
}

// ---------- boîte de réception ----------
export async function listInbox(): Promise<InboxItem[]> {
  const uid = await myId();
  const { data, error } = await supabase
    .from('flip_recipients')
    .select('flip_id, opened_at, flips!inner(created_at, mode, expires_at, photo_path, preview, sender:profiles!flips_sender_id_fkey(id, username, avatar_path))')
    .eq('recipient_id', uid)
    .is('scratched_at', null)
    .gt('flips.expires_at', new Date().toISOString())
    .not('flips.photo_path', 'is', null);
  if (error) throw new ApiError(undefined, error.message, true);
  type Row = { flip_id: string; opened_at: string | null; flips: { created_at: string; mode: Mode; sender: RawProfile; preview: string | null } };
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({ flip_id: r.flip_id, created_at: r.flips.created_at, mode: r.flips.mode, sender: prof(r.flips.sender), opened: !!r.opened_at, preview: r.flips.preview }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listSent(): Promise<SentItem[]> {
  const uid = await myId();
  const { data, error } = await supabase
    .from('flip_recipients')
    .select('flip_id, scratched_at, screenshot_at, percent, duration_ms, reaction, recipient:profiles!flip_recipients_recipient_id_fkey(id, username, avatar_path), flips!inner(created_at, sender_id, preview)')
    .eq('flips.sender_id', uid)
    .limit(50);
  if (error) throw new ApiError(undefined, error.message, true);
  type Row = Omit<SentItem, 'created_at'> & { flips: { created_at: string; preview: string | null } };
  return ((data ?? []) as unknown as Row[]).map(({ flips, ...r }) => ({ ...r, recipient: prof(r.recipient as RawProfile), created_at: flips.created_at, preview: flips.preview })).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- flips ----------
/** Envoie des octets vers une URL de dépôt signée, avec la progression (0 à 1). */
function putWithProgress(url: string, bytes: ArrayBuffer, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', 'image/jpeg');
    xhr.setRequestHeader('cache-control', 'max-age=0');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError('UPLOAD', undefined, xhr.status >= 500)));
    xhr.onerror = () => reject(new ApiError('UPLOAD', undefined, true));
    xhr.ontimeout = () => reject(new ApiError('UPLOAD', undefined, true));
    xhr.timeout = 60_000;
    xhr.send(bytes);
  });
}

/** Compresse la photo, la dépose dans le dossier privé de l'utilisateur, puis efface les fichiers locaux. */
export async function uploadPhoto(localUri: string, onProgress?: (p: number) => void, ownerId?: string): Promise<string> {
  const uid = await myId();
  if (ownerId && ownerId !== uid) throw new ApiError('ACCOUNT_CHANGED');
  const rendered = await ImageManipulator.manipulate(localUri).resize({ width: 1080 }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const resized = new File(saved.uri);
  const bytes = await resized.arrayBuffer();
  const path = `${uid}/${Crypto.randomUUID()}.jpg`;
  await withRetry(async () => {
    const { data, error } = await supabase.storage.from('flips').createSignedUploadUrl(path);
    if (error || !data) throw new ApiError('UPLOAD', undefined, true);
    await putWithProgress(data.signedUrl, bytes, onProgress);
  });
  try {
    resized.delete();
  } catch {}
  return path;
}

/** Supprime la photo d'origine du téléphone une fois le flip envoyé. */
export function forgetLocalPhoto(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists && /\/cache\//i.test(uri)) f.delete();
  } catch {}
}

export type SendResult = { id: string; sent_to: number; sweet_hour: boolean; link_url: string | null; link: LinkKind | null; streak: number };

export async function sendFlip(input: { localUri: string; message: string; mode: Mode; recipients: string[]; link?: LinkKind | null; preview?: string | null; wordStyle?: WordStyle | null; sendId?: string; ownerId?: string }, onProgress?: (p: number) => void) {
  if (!(await isOnline())) throw new ApiError('OFFLINE', undefined, true);
  const uid = await myId();
  if (input.ownerId && input.ownerId !== uid) throw new ApiError('ACCOUNT_CHANGED');
  const request_id = input.sendId ?? Crypto.randomUUID();
  const photo_path = await uploadPhoto(input.localUri, (p) => onProgress?.(p * 0.9), uid);
  const res = await withRetry(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== uid) throw new ApiError('ACCOUNT_CHANGED');
    return call<SendResult>('send-flip', { request_id, photo_path, message: input.message, mode: input.mode, recipients: input.recipients, link: input.link ?? null, preview: input.preview ?? null, word_style: input.wordStyle ?? null }, session.access_token);
  });
  onProgress?.(1);
  // la photo locale sert encore à fabriquer l'image de story : on l'efface après le partage
  if (input.link !== 'story') forgetLocalPhoto(input.localUri);
  return res;
}

export const openFlip = (flip_id: string) => withRetry(() => call<OpenedFlip>('open-flip', { flip_id }));

/** Revoir son propre lien (story ou privé) : photo signée + mot + stats, tant que le contenu existe. */
export type MineFlip = {
  kind: LinkKind;
  mode: Mode;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  scratched_at: string | null;
  percent: number | null;
  duration_ms: number | null;
  opens: number;
  scratches: number;
  gone: boolean;
  photo_url?: string | null;
  message?: string;
  word_style?: WordStyle | null;
};
export const openMine = (token: string) => withRetry(() => call<MineFlip>('open-mine', { token }));

/** Lien partagé /f/<jeton> : aperçu sans rien consommer, puis ouverture (lien privé = une seule fois). */
export type LinkPeek = { kind: LinkKind; sender: string; mode: Mode; preview: string | null };
export type LinkOpen = LinkPeek & { created_at: string; photo_url: string; message: string; word_style?: WordStyle | null };
export const peekLink = (token: string) => withRetry(() => call<LinkPeek>('open-link', { token, peek: true }));
export const openLink = (token: string) => call<LinkOpen>('open-link', { token });
export const linkScratched = (token: string, percent: number, duration_ms: number) => call<{ ok: true }>('link-scratched', { token, percent, duration_ms });

export const markScratched = (flip_id: string, percent: number, duration_ms: number) => withRetry(() => call<{ ok: true }>('scratched', { flip_id, percent, duration_ms }));
export const react = (flip_id: string, reaction: string) => call<{ ok: true }>('scratched', { flip_id, reaction });
export const reportScreenshot = (flip_id: string) => call<{ ok: true }>('screenshot', { flip_id });
export const report = (input: { flip_id?: string; user_id?: string; reason: string }) => call<{ ok: true }>('report', input);
export const deleteAccount = () => call<{ ok: true }>('delete-account', {});

// ---------- Sweet Hour ----------
export async function currentSweetHour(): Promise<{ starts_at: string; ends_at: string } | null> {
  const { data } = await supabase.rpc('current_sweet_hour');
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

// ---------- lien d'invitation ----------
const INVITE_BASE = process.env.EXPO_PUBLIC_INVITE_BASE ?? 'https://sweetinapp.netlify.app/u/';
export const inviteUrl = (username: string) => `${INVITE_BASE}${encodeURIComponent(username)}`;

// ---------- liens envoyés (lien privé, story) ----------
export type SentLink = { token: string; kind: LinkKind; created_at: string; opened_at: string | null; scratched_at: string | null; percent: number | null; duration_ms: number | null; opens: number; scratches: number; preview?: string | null };

export async function listLinks(): Promise<SentLink[]> {
  const uid = await myId();
  const { data, error } = await supabase
    .from('flip_links')
    .select('token, kind, opened_at, scratched_at, percent, duration_ms, opens, scratches, flips!inner(created_at, sender_id, preview)')
    .eq('flips.sender_id', uid)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new ApiError(undefined, error.message, true);
  type Row = Omit<SentLink, 'created_at'> & { flips: { created_at: string; preview: string | null } };
  return ((data ?? []) as unknown as Row[]).map(({ flips, ...r }) => ({ ...r, created_at: flips.created_at, preview: flips.preview }));
}

// ---------- séries ----------
export type Streak = { friend_id: string; days: number; at_risk: boolean };
export async function myStreaks(): Promise<Map<string, Streak>> {
  const { data } = await supabase.rpc('my_streaks');
  return new Map(((data ?? []) as Streak[]).map((s) => [s.friend_id, s]));
}

export type LostStreak = { friend_id: string; days: number; can_save: boolean };
/** Séries de 3 jours ou plus éteintes hier soir, encore rallumables aujourd'hui. */
export async function myLostStreaks(): Promise<LostStreak[]> {
  const { data } = await supabase.rpc('my_lost_streaks');
  return (data ?? []) as LostStreak[];
}

/** Rallume une série perdue hier (un sauvetage par mois). */
export async function restoreStreak(friendId: string) {
  const { error } = await supabase.rpc('restore_streak', { p_friend: friendId });
  if (error) throw rpcError(error);
}

// ---------- contacts et numéro ----------
export async function matchContacts(hashes: string[]): Promise<Profile[]> {
  const out: Profile[] = [];
  for (let i = 0; i < hashes.length && i < 6000; i += 2000) {
    const { data, error } = await supabase.rpc('match_contacts', { p_hashes: hashes.slice(i, i + 2000) });
    if (error) throw rpcError(error);
    out.push(...((data ?? []) as RawProfile[]).map(prof));
  }
  return [...new Map(out.map((p) => [p.id, p])).values()];
}

/** Types de notifications qu'on peut couper (même liste que le serveur, _shared/util.ts). */
export type PushKind = 'flips' | 'reads' | 'streaks' | 'sweethour';

/** Types coupés sur ce compte ; null si aucune notification n'est encore autorisée sur ce téléphone. */
export async function myMute(): Promise<PushKind[] | null> {
  const id = await myId();
  const { data } = await supabase.from('push_tokens').select('mute').eq('user_id', id).limit(1);
  return data && data.length ? ((data[0].mute ?? []) as PushKind[]) : null;
}

/** Coupe ou rétablit des types de notifications sur tous les appareils du compte. */
export async function setMute(mute: PushKind[]) {
  const id = await myId();
  const { error } = await supabase.from('push_tokens').update({ mute }).eq('user_id', id);
  if (error) throw new ApiError(undefined, error.message, true);
}

export async function mySettings(): Promise<{ discoverable: boolean; has_phone: boolean }> {
  const { data } = await supabase.rpc('my_settings');
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? { discoverable: true, has_phone: false };
}

export async function setDiscoverable(on: boolean) {
  const { error } = await supabase.rpc('set_discoverable', { p_on: on });
  if (error) throw rpcError(error);
}

/**
 * Classe une erreur d'envoi SMS Supabase Auth : le code machine (sms_send_failed,
 * phone_provider_disabled…) est dans `error.code`, le message reste une heuristique.
 */
export function phoneSendError(error: { message: string; code?: string }): ApiError {
  const code = (error.code ?? '').toLowerCase();
  const m = error.message.toLowerCase();
  if (code.includes('rate') || m.includes('rate')) return new ApiError('RATE_LIMIT', undefined, false);
  if (
    /sms_send_failed|phone_provider|unsupported_phone/.test(code) ||
    /sms_send_failed|to provider|phone provider|provider.*(disabled|not enabled)|sms.*(provider|not configured|failed)/i.test(error.message)
  )
    return new ApiError('PHONE_DISABLED', undefined, false);
  return new ApiError('PHONE_INVALID', undefined, false);
}

/** Étape 1 : envoie un code par SMS au numéro (format international, ex. +33612345678). */
export async function requestPhoneCode(phone: string) {
  const { error } = await supabase.auth.updateUser({ phone });
  if (error) throw phoneSendError(error);
}

/** Étape 2 : vérifie le code reçu. Le numéro devient alors trouvable par tes amis. */
export async function verifyPhoneCode(phone: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'phone_change' });
  if (error) throw new ApiError('CODE_INVALID');
}
