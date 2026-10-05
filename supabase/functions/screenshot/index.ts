// Le destinataire a fait (ou tenté) une capture d'écran pendant la lecture : on le note et on prévient l'expéditeur.
import { admin, cors, currentUser, fail, json, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401, 'NOT_AUTHENTICATED');

  const { flip_id } = (await req.json().catch(() => ({}))) as { flip_id?: string };
  if (!flip_id) return fail('flip_id manquant', 400, 'BAD_REQUEST');
  const db = admin();

  const { data: rec } = await db
    .from('flip_recipients')
    .select('screenshot_at, flips(sender_id)')
    .eq('flip_id', flip_id)
    .eq('recipient_id', user.id)
    .maybeSingle();
  if (!rec) return fail('Flip introuvable', 404, 'NOT_FOUND');
  if (rec.screenshot_at) return json({ ok: true });

  await db.from('flip_recipients').update({ screenshot_at: new Date().toISOString() }).eq('flip_id', flip_id).eq('recipient_id', user.id);
  // deno-lint-ignore no-explicit-any
  const senderId: string = (rec as any).flips?.sender_id;
  const { data: me } = await db.from('profiles').select('username').eq('id', user.id).single();
  await sendPush(db, [senderId], (_u, lang) => ({ body: copy.screenshot(lang, me?.username ?? copy.someone(lang)), data: { screen: 'inbox' } }));
  return json({ ok: true });
});
