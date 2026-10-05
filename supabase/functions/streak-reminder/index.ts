// Rappel quotidien (vers 19 h, heure de Paris) : « ta série s'éteint à minuit ».
// Ne concerne que les séries d'au moins 2 jours pas encore entretenues aujourd'hui.
// Protégée par le secret partagé `x-cron-secret` = CRON_SECRET.
import { admin, fail, json, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

type Row = { user_a: string; user_b: string; days: number; a_sent: string | null; b_sent: string | null };

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return fail('Interdit', 403);
  const db = admin();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);

  const { data } = await db.from('streaks').select('user_a, user_b, days, a_sent, b_sent').eq('last_day', yesterday).gte('days', 2).limit(10_000);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return json({ reminded: 0 });

  const ids = [...new Set(rows.flatMap((r) => [r.user_a, r.user_b]))];
  const { data: profiles } = await db.from('profiles').select('id, username').in('id', ids);
  const name = new Map((profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));

  // pour chaque personne, la plus longue série en danger
  const best = new Map<string, { friend: string; days: number }>();
  for (const r of rows) {
    for (const [me, friend, sent] of [[r.user_a, r.user_b, r.a_sent], [r.user_b, r.user_a, r.b_sent]] as const) {
      if (sent === today) continue;
      const cur = best.get(me);
      if (!cur || r.days > cur.days) best.set(me, { friend, days: r.days });
    }
  }
  const users = [...best.keys()];
  for (let i = 0; i < users.length; i += 500) {
    await sendPush(db, users.slice(i, i + 500), (uid, lang) => {
      const b = best.get(uid)!;
      return { title: copy.streakTitle(lang, b.days, name.get(b.friend) ?? copy.friend(lang)), body: copy.streakBody(lang), sound: 'streak.wav', channelId: 'streaks', data: { screen: 'camera', kind: 'streak' } };
    });
  }
  return json({ reminded: users.length });
});
