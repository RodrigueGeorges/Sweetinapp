// Envoie un flip : photo déjà déposée dans le bucket + message caché + destinataires.
// Destinataires possibles : des amis, un lien privé (ouvrable une fois, même sans l'app), une story (lien public 24 h).
// Vérifie le profil, le quota, la modération, puis prévient les amis et entretient les séries.
import { STREAK_MILESTONES, admin, cors, currentUser, fail, json, randomToken, sendPush, SITE_URL } from '../_shared/util.ts';
import { blockingCategory, moderate } from '../_shared/moderation.ts';
import { copy } from '../_shared/copy.ts';

const WORD_INKS = new Set(['#FFFFFF', '#E8FF5A', '#FF6B88', '#CFE4FF', '#FFC9D6', '#FFD6C2']);
const WORD_FILTERS = new Set(['dore', 'neon', 'nuit', 'noir', 'poudre']);
type WordStyle = { x?: number; y?: number; scale?: number; ink?: string; bubble?: boolean; face?: string; filter?: string };
type Body = { request_id?: string; photo_path?: string; message?: string; mode?: 'free' | 'once'; recipients?: string[]; link?: 'single' | 'story' | null; preview?: string; word_style?: WordStyle | null };

/** Placement et style du mot validés : bornés aux domaines attendus, sinon ignorés (jamais bloquant). */
function sanitizeWordStyle(v: WordStyle | null | undefined) {
  if (!v || typeof v !== 'object') return null;
  const x = Number(v.x), y = Number(v.y), scale = Number(v.scale);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
  if (Math.abs(x) > 1 || Math.abs(y) > 1 || scale < 0.3 || scale > 3) return null;
  return {
    x,
    y,
    scale,
    ink: typeof v.ink === 'string' && WORD_INKS.has(v.ink) ? v.ink : undefined,
    bubble: v.bubble === true ? true : undefined,
    face: v.face === 'sans' ? 'sans' : undefined,
    filter: typeof v.filter === 'string' && WORD_FILTERS.has(v.filter) ? v.filter : undefined,
  };
}

const DAILY_LIMIT = 150;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401, 'NOT_AUTHENTICATED');

  const body = (await req.json().catch(() => ({}))) as Body;
  const message = (body.message ?? '').trim();
  const link = body.link === 'single' || body.link === 'story' ? body.link : null;
  const mode = body.mode === 'once' && link !== 'story' ? 'once' : 'free';
  const recipients = [...new Set(body.recipients ?? [])].slice(0, 20);
  const path = body.photo_path ?? '';
  const preview = typeof body.preview === 'string' && body.preview.length <= 6000 && /^[A-Za-z0-9+/=]+$/.test(body.preview) ? body.preview : null;

  if (!path.startsWith(`${user.id}/`) || !path.endsWith('.jpg')) return fail('Photo invalide', 400, 'PHOTO_INVALID');
  if (message.length < 1 || message.length > 90) return fail('Le message doit faire entre 1 et 90 caractères', 400, 'MESSAGE_LENGTH');
  if (!recipients.length && !link) return fail('Choisis au moins une personne', 400, 'NO_RECIPIENT');

  const db = admin();
  const requestId = body.request_id ?? path;
  if (typeof requestId !== 'string' || !requestId.length || requestId.length > 200) return fail('Envoi invalide', 400, 'INVALID_REQUEST');
  const { data: receipt, error: receiptError } = await db.from('send_receipts').select('result').eq('sender_id', user.id).eq('request_id', requestId).maybeSingle();
  if (receiptError) return fail('Envoi indisponible, réessaie', 503, 'SERVER');
  const response = (r: { id: string; sent_to: number; sweet_hour: boolean; link: string | null; link_token: string | null; streak: number }) =>
    json({ id: r.id, sent_to: r.sent_to, sweet_hour: r.sweet_hour, link: r.link, streak: r.streak, link_url: r.link_token ? `${SITE_URL}/f/${r.link_token}` : null });
  if (receipt) return response(receipt.result);
  const dropPhoto = () => db.storage.from('flips').remove([path]);

  const { data: me } = await db.from('profiles').select('username, onboarded').eq('id', user.id).single();
  if (!me?.onboarded) return fail('Termine ton profil d’abord', 403, 'PROFILE_INCOMPLETE');

  // quota anti-spam
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: sentToday } = await db.from('flips').select('*', { count: 'exact', head: true }).eq('sender_id', user.id).gte('created_at', since);
  if ((sentToday ?? 0) >= DAILY_LIMIT) {
    await dropPhoto();
    return fail('Tu as envoyé beaucoup de sweets aujourd’hui, réessaie demain', 429, 'RATE_LIMIT');
  }

  // uniquement des amis, et personne qui t'a bloqué
  let allowed: string[] = [];
  if (recipients.length) {
    const { data: friends } = await db.from('friendships').select('friend_id').eq('user_id', user.id).in('friend_id', recipients);
    const { data: blockedMe } = await db.from('blocks').select('blocker_id').eq('blocked_id', user.id).in('blocker_id', recipients);
    const blocked = new Set((blockedMe ?? []).map((b: { blocker_id: string }) => b.blocker_id));
    allowed = (friends ?? []).map((f: { friend_id: string }) => f.friend_id).filter((id: string) => !blocked.has(id));
  }
  if (!allowed.length && !link) {
    await dropPhoto();
    return fail('Aucun destinataire valide', 400, 'NO_RECIPIENT');
  }

  // modération de la photo et du message avant toute livraison
  const signed = await db.storage.from('flips').createSignedUrl(path, 120);
  if (signed.error) return fail('Photo introuvable, renvoie-la', 400, 'PHOTO_INVALID');
  const verdict = blockingCategory((await moderate(message, signed.data.signedUrl)) ?? undefined);
  if (verdict === 'unavailable') return fail('Le contrôle de sécurité ne répond pas, réessaie', 503, 'MODERATION_UNAVAILABLE');
  if (verdict) {
    await dropPhoto();
    console.warn('flip refusé par la modération', user.id, verdict);
    return fail('Ce sweet ne respecte pas les règles de Sweetin', 422, 'MODERATION');
  }

  // envoyé pendant le Sweet Hour ?

  // une story ne vit que 24 h
  const { data: committed, error } = await db.rpc('commit_flip', {
    p_sender: user.id, p_request: requestId, p_path: path, p_message: message, p_mode: mode,
    p_recipients: recipients, p_link: link, p_token: randomToken(), p_preview: preview,
    p_style: sanitizeWordStyle(body.word_style),
  });
  if (error || !committed) {
    const code = ['NO_RECIPIENT', 'PROFILE_INCOMPLETE', 'RATE_LIMIT'].find((c) => error?.message === c);
    return fail('Envoi impossible, réessaie', code ? 400 : 503, code ?? 'SERVER');
  }
  if (!committed.created) return response(committed);
  const flip = { id: committed.id };
  allowed = committed.recipients;
  if (allowed.length) {
    const milestones: { rid: string; days: number }[] = [];
    for (const rid of allowed) {
      const [first, second] = [user.id, rid].sort();
      const { data: current } = await db.from('streaks').select('days').eq('user_a', first).eq('user_b', second).maybeSingle();
      const d = current?.days ?? 0;
      // palier atteint aujourd'hui : on prévient l'ami une seule fois
      if (STREAK_MILESTONES.has(d)) {
        const [a, b] = [user.id, rid].sort();
        const { data: row } = await db.from('streaks').update({ celebrated: d }).eq('user_a', a).eq('user_b', b).lt('celebrated', d).select('celebrated');
        if (row?.length) milestones.push({ rid, days: d });
      }
    }
    for (const m of milestones) {
      await sendPush(db, [m.rid], (_uid, lang) => ({ title: 'sweetin', body: copy.streakMilestone(lang, m.days, me.username), sound: 'streak.wav', channelId: 'streaks', data: { screen: 'contacts', kind: 'streak' } }), 'streaks');
    }
    await sendPush(db, allowed, (_uid, lang) => ({
      title: me.username,
      body: copy.flipBody(lang),
      data: { flip_id: flip.id },
    }), 'flips');
  }

  return response(committed);
});
