// Grattage terminé sur la page web d'un lien : trace pour l'expéditeur, puis effacement si plus personne n'attend.
import { admin, cors, destroyIfConsumed, fail, json, MILESTONES, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Méthode non autorisée', 405);
  const b = (await req.json().catch(() => ({}))) as { token?: string; percent?: number; duration_ms?: number };
  if (!b.token || !/^[A-Za-z0-9_-]{16,64}$/.test(b.token)) return fail('Lien invalide', 404, 'NOT_FOUND');

  const db = admin();
  const { data: link } = await db.from('flip_links').select('token, kind, flip_id, opened_at, scratched_at, flips(sender_id)').eq('token', b.token).maybeSingle();
  if (!link) return fail('Lien introuvable', 404, 'NOT_FOUND');
  // deno-lint-ignore no-explicit-any
  const senderId: string = (link as any).flips?.sender_id;
  const percent = Math.max(0, Math.min(100, Math.round(b.percent ?? 0)));
  const duration = Math.max(0, Math.min(10 * 60_000, Math.round(b.duration_ms ?? 0)));

  if (link.kind === 'single') {
    if (!link.opened_at || link.scratched_at) return json({ ok: true });
    await db.from('flip_links').update({ scratched_at: new Date().toISOString(), percent, duration_ms: duration }).eq('token', b.token);
    const secs = (duration / 1000).toFixed(1).replace('.', ',');
    await sendPush(db, [senderId], (_u, lang) => ({ body: copy.linkScratched(lang, percent, secs), data: { screen: 'inbox' } }));
    await destroyIfConsumed(db, link.flip_id);
  } else {
    const { data } = await db.rpc('bump_story', { p_token: b.token, p_scratch: true });
    const n = (data as number) ?? 0;
    if (MILESTONES.has(n) && n > 1) await sendPush(db, [senderId], (_u, lang) => ({ body: copy.storyMilestone(lang, n), data: { screen: 'inbox' } }));
  }
  return json({ ok: true });
});
