// Envoie un flip : photo déjà déposée dans le bucket + message caché + destinataires.
// Destinataires possibles : des amis, un lien privé (ouvrable une fois, même sans l'app), une story (lien public 24 h).
// Vérifie le profil, le quota, la modération, puis prévient les amis et entretient les séries.
import { STREAK_MILESTONES, admin, cors, currentUser, fail, json, randomToken, sendPush, SITE_URL } from '../_shared/util.ts';
import { blockingCategory, moderate } from '../_shared/moderation.ts';
import { copy } from '../_shared/copy.ts';

type WordStyle = { x?: number; y?: number; scale?: number };
type Body = { photo_path?: string; message?: string; mode?: 'free' | 'once'; recipients?: string[]; link?: 'single' | 'story' | null; preview?: string; word_style?: WordStyle | null };

/** Placement du mot validé : borné au domaine attendu, sinon ignoré (jamais bloquant). */
function sanitizeWordStyle(v: WordStyle | null | undefined) {
  if (!v || typeof v !== 'object') return null;
  const x = Number(v.x), y = Number(v.y), scale = Number(v.scale);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
  if (Math.abs(x) > 1 || Math.abs(y) > 1 || scale < 0.3 || scale > 3) return null;
  return { x, y, scale };
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
  if (verdict) {
    await dropPhoto();
    console.warn('flip refusé par la modération', user.id, verdict);
    return fail('Ce sweet ne respecte pas les règles de Sweetin', 422, 'MODERATION');
  }

  // envoyé pendant le Sweet Hour ?
  const { data: hour } = await db.from('sweet_hours').select('starts_at').eq('day', new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })).maybeSingle();
  const start = hour ? new Date(hour.starts_at).getTime() : 0;
  const sweet = !!hour && Date.now() >= start && Date.now() <= start + 2 * 60_000;

  // une story ne vit que 24 h
  const expires = new Date(Date.now() + (link === 'story' ? 24 : 7 * 24) * 3600_000).toISOString();
  const { data: flip, error } = await db.from('flips').insert({ sender_id: user.id, photo_path: path, mode, sweet_hour: sweet, preview, expires_at: expires }).select('id').single();
  if (error || !flip) return fail('Envoi impossible, réessaie', 500, 'SERVER');

  await db.from('flip_secrets').insert({ flip_id: flip.id, message, word_style: sanitizeWordStyle(body.word_style) });

  let streak = 0;
  if (allowed.length) {
    await db.from('flip_recipients').insert(allowed.map((rid: string) => ({ flip_id: flip.id, recipient_id: rid })));
    const milestones: { rid: string; days: number }[] = [];
    for (const rid of allowed) {
      const { data: days } = await db.rpc('record_streak', { p_sender: user.id, p_recipient: rid });
      const d = (days as number) ?? 0;
      streak = Math.max(streak, d);
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

  let link_url: string | null = null;
  if (link) {
    const token = randomToken();
    await db.from('flip_links').insert({ token, flip_id: flip.id, kind: link });
    link_url = `${SITE_URL}/f/${token}`;
  }

  return json({ id: flip.id, sent_to: allowed.length, sweet_hour: sweet, link_url, link, streak });
});
