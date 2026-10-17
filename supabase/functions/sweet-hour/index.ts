// Sweet Hour : appelée chaque minute par pg_cron. Au début du moment du jour, prévient tout le monde.
// Protégée par le secret partagé `x-cron-secret` = CRON_SECRET.
import { admin, fail, json } from '../_shared/util.ts';
import { asLang, copy } from '../_shared/copy.ts';
import { apnsConfigured, startLiveActivity } from '../_shared/apns.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return fail('Interdit', 403);
  const db = admin();
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

  // le tirage du jour (créé à la première minute si besoin)
  let { data: hour } = await db.from('sweet_hours').select('*').eq('day', day).maybeSingle();
  if (!hour) {
    await db.rpc('pick_sweet_hour', { p_day: day });
    ({ data: hour } = await db.from('sweet_hours').select('*').eq('day', day).maybeSingle());
  }
  if (!hour || hour.notified) return json({ sent: 0 });

  const start = new Date(hour.starts_at).getTime();
  if (Date.now() < start || Date.now() > start + 2 * 60_000) return json({ sent: 0 });

  // on verrouille d'abord pour ne jamais envoyer deux fois
  const { data: locked } = await db.from('sweet_hours').update({ notified: true }).eq('day', day).eq('notified', false).select('day');
  if (!locked?.length) return json({ sent: 0 });

  const endsAt = start + 2 * 60_000;

  // iOS 17.2+ : le compte à rebours s'affiche sur l'écran verrouillé (Live Activity), avec sa propre alerte.
  // Ces appareils ne reçoivent donc pas en plus la notification classique.
  const covered = new Set<string>();
  let live = 0;
  if (apnsConfigured()) {
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await db.from('live_tokens').select('token, expo_token, lang').range(from, from + 999);
      if (!rows?.length) break;
      for (let i = 0; i < rows.length; i += 50) {
        await Promise.all(
          rows.slice(i, i + 50).map(async (r: { token: string; expo_token: string | null; lang: string }) => {
            const lang = asLang(r.lang);
            const ok = await startLiveActivity(r.token, {
              name: 'SweetHour',
              props: { endsAt, title: copy.liveTitle(lang), sub: copy.liveSub(lang) },
              alert: { title: 'sweetin', body: copy.sweetHour(lang) },
              sound: 'sweethour.wav',
              staleAt: new Date(endsAt),
              dismissAt: new Date(endsAt + 60_000),
              url: 'sweetin://camera',
            });
            if (ok) {
              live++;
              if (r.expo_token) covered.add(r.expo_token);
            }
          }),
        );
      }
      if (rows.length < 1000) break;
    }
  }

  let sent = 0;
  for (let from = 0; ; from += 1000) {
    const { data: all } = await db.from('push_tokens').select('token, lang').range(from, from + 999);
    if (!all?.length) break;
    const tokens = all.filter((t: { token: string }) => !covered.has(t.token));
    for (let i = 0; i < tokens.length; i += 100) {
      // ttl : une notification de Sweet Hour arrivée après la fin ne sert à rien
      const batch = tokens.slice(i, i + 100).map((t: { token: string; lang: string }) => ({ to: t.token, title: 'sweetin', body: copy.sweetHour(asLang(t.lang)), sound: 'sweethour.wav', channelId: 'sweethour', priority: 'high', ttl: 120, data: { screen: 'camera' } }));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(batch) }).catch((e) => console.error(e));
      sent += batch.length;
    }
    if (all.length < 1000) break;
  }
  return json({ sent, live });
});
