// Signale un flip ou un utilisateur. Le message est conservé pour la modération, l'expéditeur est bloqué.
import { admin, cors, currentUser, fail, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401);

  const { flip_id, user_id, reason } = (await req.json().catch(() => ({}))) as { flip_id?: string; user_id?: string; reason?: string };
  const db = admin();
  let reported = user_id ?? null;
  let kept: string | null = null;

  if (flip_id) {
    const { data: rec } = await db.from('flip_recipients').select('flips(sender_id)').eq('flip_id', flip_id).eq('recipient_id', user.id).maybeSingle();
    if (!rec) return fail('Sweet introuvable', 404);
    // deno-lint-ignore no-explicit-any
    reported = (rec as any).flips?.sender_id ?? reported;
    const { data: s } = await db.from('flip_secrets').select('message').eq('flip_id', flip_id).maybeSingle();
    kept = s?.message ?? null;
  }
  if (!reported) return fail('Rien à signaler');

  await db.from('reports').insert({ reporter_id: user.id, reported_id: reported, flip_id: flip_id ?? null, reason: (reason ?? 'Contenu inapproprié').slice(0, 200), kept_message: kept });
  await db.from('blocks').upsert({ blocker_id: user.id, blocked_id: reported });
  await db.from('friendships').delete().or(`and(user_id.eq.${user.id},friend_id.eq.${reported}),and(user_id.eq.${reported},friend_id.eq.${user.id})`);
  if (flip_id) await db.from('flip_recipients').delete().eq('flip_id', flip_id).eq('recipient_id', user.id);

  return json({ ok: true });
});
