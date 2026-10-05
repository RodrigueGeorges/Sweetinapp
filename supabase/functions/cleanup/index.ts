// Nettoyage planifié (toutes les heures) : supprime photos et messages des flips expirés.
// Protégé par un secret partagé : header `x-cron-secret` = CRON_SECRET.
import { admin, destroyContent, fail, json, processReceipts } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return fail('Interdit', 403);
  const db = admin();
  const { data } = await db.from('flips').select('id').lt('expires_at', new Date().toISOString()).not('photo_path', 'is', null).limit(500);
  for (const f of data ?? []) await destroyContent(db, f.id);

  // flips entièrement consommés (ex. lien privé ouvert il y a plus de 10 minutes sans être gratté jusqu'au bout)
  const { data: consumed } = await db.rpc('consumed_flips', { p_limit: 500 });
  for (const id of (consumed ?? []) as string[]) await destroyContent(db, id);

  // durées de conservation annoncées dans la politique de confidentialité
  const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  // traces des flips (qui, quand, % gratté, réaction) : 90 jours
  const { count: traces } = await db.from('flips').delete({ count: 'exact' }).lt('created_at', days(90)).is('photo_path', null);
  // signalements et message conservé pour la modération : 12 mois
  const { count: reports } = await db.from('reports').delete({ count: 'exact' }).lt('created_at', days(365));
  // tirages du Sweet Hour : 30 jours
  await db.from('sweet_hours').delete().lt('day', days(30).slice(0, 10));
  // compteurs de débit : fenêtres closes depuis plus de 2 jours
  await db.from('rate_limits').delete().lt('window_start', days(2));
  // reçus de push : traite les tickets en attente (jetons morts), purge après 2 jours
  const receipts = await processReceipts(db);
  await db.from('push_receipts').delete().lt('created_at', days(2));

  return json({ cleaned: data?.length ?? 0, traces: traces ?? 0, reports: reports ?? 0, receipts });
});
