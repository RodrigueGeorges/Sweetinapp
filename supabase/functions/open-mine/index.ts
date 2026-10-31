// Revoir son propre lien (story ou privé) depuis l'app : photo signée, mot caché et statistiques.
// Réservé à l'expéditeur du flip ; le contenu déjà détruit (lien privé gratté, story fondue) renvoie juste les stats.
import { admin, cors, currentUser, fail, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Méthode non autorisée', 405);
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401, 'UNAUTHENTICATED');
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return fail('Lien invalide', 404, 'NOT_FOUND');

  const db = admin();
  const { data: link } = await db
    .from('flip_links')
    .select('token, kind, opened_at, scratched_at, percent, duration_ms, opens, scratches, flips(id, sender_id, photo_path, mode, expires_at, created_at)')
    .eq('token', token)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const flip = (link as any)?.flips;
  if (!link || !flip) return fail('Lien introuvable', 404, 'NOT_FOUND');
  if (flip.sender_id !== user.id) return fail('Ce lien n’est pas à toi', 403, 'FORBIDDEN');

  const stats = {
    kind: link.kind,
    mode: flip.mode,
    created_at: flip.created_at,
    expires_at: flip.expires_at,
    opened_at: link.opened_at,
    scratched_at: link.scratched_at,
    percent: link.percent,
    duration_ms: link.duration_ms,
    opens: link.opens,
    scratches: link.scratches,
    gone: !flip.photo_path || new Date(flip.expires_at) < new Date(),
  };

  if (stats.gone || !flip.photo_path) return json({ ...stats, gone: true });

  const [{ data: secret }, signed] = await Promise.all([
    db.from('flip_secrets').select('message, word_style').eq('flip_id', flip.id).single(),
    db.storage.from('flips').createSignedUrl(flip.photo_path, 300),
  ]);

  return json({
    ...stats,
    photo_url: signed.error ? null : signed.data.signedUrl,
    message: secret?.message ?? '',
    word_style: secret?.word_style ?? null,
  });
});
