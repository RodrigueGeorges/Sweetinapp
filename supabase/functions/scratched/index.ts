// Le destinataire a gratté : on enregistre la trace, on prévient l'expéditeur,
// et quand tous les destinataires ont gratté, la photo et le message sont supprimés.
// Un second appel avec seulement `reaction` ajoute la réaction à la trace.
import { admin, cors, currentUser, destroyIfConsumed, fail, json, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

type Body = { flip_id?: string; percent?: number; duration_ms?: number; reaction?: string };
/** Les 5 réactions de l'app (dessinées côté app, stockées en emoji). */
const REACTIONS = new Set(['🫠', '😂', '😳', '❤️', '🍦']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401);

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.flip_id) return fail('flip_id manquant');
  const db = admin();

  const { data: rec } = await db
    .from('flip_recipients')
    .select('scratched_at, flips(sender_id)')
    .eq('flip_id', b.flip_id)
    .eq('recipient_id', user.id)
    .maybeSingle();
  if (!rec) return fail('Sweet introuvable', 404);
  // deno-lint-ignore no-explicit-any
  const senderId: string = (rec as any).flips?.sender_id;
  const { data: me } = await db.from('profiles').select('username').eq('id', user.id).single();
  const name = me?.username ?? '';

  // réaction seule, après coup
  if (b.reaction && !REACTIONS.has(b.reaction)) b.reaction = undefined;
  if (rec.scratched_at && b.reaction) {
    await db.from('flip_recipients').update({ reaction: b.reaction.slice(0, 8) }).eq('flip_id', b.flip_id).eq('recipient_id', user.id);
    await sendPush(db, [senderId], (_u, lang) => ({ body: copy.reacted(lang, name || copy.someone(lang), b.reaction!), data: { screen: 'inbox' } }));
    return json({ ok: true });
  }
  if (rec.scratched_at) return json({ ok: true });

  const percent = Math.max(0, Math.min(100, Math.round(b.percent ?? 0)));
  const duration = Math.max(0, Math.min(10 * 60_000, Math.round(b.duration_ms ?? 0)));
  await db
    .from('flip_recipients')
    .update({ scratched_at: new Date().toISOString(), percent, duration_ms: duration, reaction: b.reaction?.slice(0, 8) ?? null })
    .eq('flip_id', b.flip_id)
    .eq('recipient_id', user.id);

  const secs = (duration / 1000).toFixed(1).replace('.', ',');
  await sendPush(db, [senderId], (_u, lang) => ({ body: copy.scratched(lang, name || copy.someone(lang), percent, secs), data: { screen: 'inbox' } }));

  // efface la photo et le message si plus personne (ami ou lien) n'attend
  await destroyIfConsumed(db, b.flip_id);

  return json({ ok: true });
});
