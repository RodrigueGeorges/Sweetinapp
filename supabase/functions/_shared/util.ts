// Outils partagés par les fonctions Sweetin.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { asLang, type Lang } from './copy.ts';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Erreur renvoyée à l'app : `code` est traduit côté app, `error` sert de repli lisible. */
export function fail(message: string, status = 400, code?: string) {
  return json({ error: message, code }, status);
}

/** Client service (contourne la RLS) : à n'utiliser qu'après avoir vérifié l'utilisateur. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** Renvoie l'utilisateur du JWT envoyé par l'app, ou null. */
export async function currentUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, '');
  const { data, error } = await admin().auth.getUser(token);
  if (error) return null;
  return data.user;
}

/** Limite de débit atomique (table rate_limits) : true si l'appel est dans le quota. */
export async function rateHit(db: SupabaseClient, actor: string, action: string, limit: number, windowSec: number) {
  const { data, error } = await db.rpc('rate_hit', { p_actor: actor, p_action: action, p_limit: limit, p_window: windowSec });
  if (error) {
    // la limite ne doit jamais bloquer le service : on laisse passer en cas de panne du compteur
    console.error('rate_hit failed', error);
    return true;
  }
  return data === true;
}

/** Empreinte anonyme de l'IP cliente, pour limiter les endpoints sans compte. */
export async function clientActor(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return `ip:${Array.from(new Uint8Array(hash)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// sons signature embarqués dans l'app (assets/sounds) ; channelId = canal Android qui porte le même son
type Push = { to: string; title?: string; body: string; data?: Record<string, unknown>; sound?: string; channelId?: string };

/** Envoie des notifications via le service push d'Expo (APNs + FCM). Ne bloque jamais l'appel principal. */
/** Types de notifications que la personne peut couper dans les réglages (colonne push_tokens.mute). */
export type PushKind = 'flips' | 'reads' | 'streaks' | 'sweethour';

export async function sendPush(db: SupabaseClient, userIds: string[], build: (uid: string, lang: Lang) => Omit<Push, 'to'>, kind: PushKind = 'flips') {
  if (!userIds.length) return;
  const { data } = await db.from('push_tokens').select('user_id, token, lang, mute').in('user_id', userIds);
  const targets = (data ?? []).filter((t) => !(t.mute ?? []).includes(kind));
  const messages: Push[] = targets.map((t) => ({ to: t.token, sound: 'sweet.wav', channelId: 'flips', ...build(t.user_id, asLang(t.lang)) }));
  if (!messages.length) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(messages) });
    // un reçu Expo est disponible ~15 min après le ticket : le cron cleanup le vérifie
    const tickets = (((await res.json().catch(() => ({}))) as { data?: { status: string; id?: string }[] }).data) ?? [];
    const receipts = tickets.map((t, i) => (t.status === 'ok' && t.id ? { ticket_id: t.id, token: targets[i]!.token } : null)).filter((r): r is { ticket_id: string; token: string } => !!r);
    if (receipts.length) await db.from('push_receipts').upsert(receipts).then(() => {}, () => {});
  } catch (e) {
    console.error('push failed', e);
  }
}

/**
 * Vérifie les reçus Expo des tickets d'il y a plus de 15 minutes :
 * supprime les jetons morts (DeviceNotRegistered), marque les reçus traités.
 * Appelée par le cron cleanup. Max 1000 tickets par appel (limite de l'API Expo).
 */
export async function processReceipts(db: SupabaseClient) {
  const { data } = await db
    .from('push_receipts')
    .select('ticket_id, token')
    .is('checked_at', null)
    .lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .order('created_at')
    .limit(1000);
  const rows = data ?? [];
  if (!rows.length) return 0;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers, body: JSON.stringify({ ids: rows.map((r) => r.ticket_id) }) });
    const receipts = ((await res.json().catch(() => ({}))) as { data?: Record<string, { status: string; details?: { error?: string } }> }).data ?? {};
    const now = new Date().toISOString();
    const done: string[] = [];
    const dead = new Set<string>();
    for (const r of rows) {
      const receipt = receipts[r.ticket_id];
      if (!receipt) continue; // reçu pas encore prêt : on réessaiera à la prochaine passe
      done.push(r.ticket_id);
      if (receipt.details?.error === 'DeviceNotRegistered') dead.add(r.token);
    }
    if (done.length) await db.from('push_receipts').update({ checked_at: now }).in('ticket_id', done);
    if (dead.size) await db.from('push_tokens').delete().in('token', [...dead]);
    return done.length;
  } catch (e) {
    console.error('receipts failed', e);
    return 0;
  }
}

/** Supprime la photo et le message d'un flip (la trace reste). */
export async function destroyContent(db: SupabaseClient, flipId: string) {
  const { data: flip } = await db.from('flips').select('photo_path').eq('id', flipId).maybeSingle();
  if (flip?.photo_path) await db.storage.from('flips').remove([flip.photo_path]);
  await db.from('flip_secrets').delete().eq('flip_id', flipId);
  await db.from('flips').update({ photo_path: null, preview: null }).eq('id', flipId);
}

/** Jeton aléatoire pour les liens (22 caractères, 128 bits). */
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Adresse publique du site (pages /f/ et /u/). */
export const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://sweetinapp.netlify.app').replace(/\/$/, '');

/** Paliers de série fêtés (mêmes valeurs que l'app, components/SentCelebration). */
export const STREAK_MILESTONES = new Set([7, 30, 100, 365]);

/** Notifie l'expéditeur seulement à certains paliers, pour ne pas le spammer. */
export const MILESTONES = new Set([1, 10, 25, 50, 100, 250, 500, 1000]);

/** Efface la photo et le message si plus personne n'a à les voir. */
export async function destroyIfConsumed(db: SupabaseClient, flipId: string) {
  const { data } = await db.rpc('flip_consumed', { p_flip: flipId });
  if (data === true) await destroyContent(db, flipId);
}
