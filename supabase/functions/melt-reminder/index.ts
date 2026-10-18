// Rappel quotidien (vers 18 h, heure de Paris) : « le sweet de tom disparaît demain. ».
// Sweets envoyés à des amis (pas les stories), jamais grattés, qui expirent dans les 12 à 36 h. Un seul rappel par sweet.
// Type de notification : flips (coupé avec « sweets reçus »). Protégée par `x-cron-secret` = CRON_SECRET.
import { admin, fail, json, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

type Row = { flip_id: string; recipient_id: string; flips: { sender_id: string; expires_at: string; photo_path: string | null } };

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return fail('Interdit', 403);
  const db = admin();
  const now = Date.now();
  const from = new Date(now + 12 * 3600_000).toISOString();
  const to = new Date(now + 36 * 3600_000).toISOString();

  const { data } = await db
    .from('flip_recipients')
    .select('flip_id, recipient_id, flips!inner(sender_id, expires_at, photo_path)')
    .is('scratched_at', null)
    .is('reminded_at', null)
    .gte('flips.expires_at', from)
    .lt('flips.expires_at', to)
    .not('flips.photo_path', 'is', null)
    .limit(10_000);
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return json({ reminded: 0 });

  // par destinataire : le sweet qui expire le plus tôt, et combien d'autres attendent
  const per = new Map<string, { flip: string; sender: string; exp: string; n: number }>();
  for (const r of rows) {
    const cur = per.get(r.recipient_id);
    if (!cur) per.set(r.recipient_id, { flip: r.flip_id, sender: r.flips.sender_id, exp: r.flips.expires_at, n: 1 });
    else {
      cur.n++;
      if (r.flips.expires_at < cur.exp) Object.assign(cur, { flip: r.flip_id, sender: r.flips.sender_id, exp: r.flips.expires_at });
    }
  }
  const senders = [...new Set([...per.values()].map((p) => p.sender))];
  const { data: profiles } = await db.from('profiles').select('id, username').in('id', senders);
  const name = new Map((profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));

  const users = [...per.keys()];
  for (let i = 0; i < users.length; i += 500) {
    await sendPush(db, users.slice(i, i + 500), (uid, lang) => {
      const p = per.get(uid)!;
      return { title: 'sweetin', body: copy.meltSoon(lang, name.get(p.sender) ?? copy.friend(lang), p.n), data: { flip_id: p.flip, kind: 'melt_soon' } };
    }, 'flips');
  }
  // marqués même sans jeton push : le rappel ne doit jamais partir deux fois
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    for (const fid of [...new Set(chunk.map((r) => r.flip_id))]) {
      await db.from('flip_recipients').update({ reminded_at: new Date().toISOString() }).eq('flip_id', fid).in('recipient_id', chunk.filter((r) => r.flip_id === fid).map((r) => r.recipient_id));
    }
  }
  return json({ reminded: users.length });
});
