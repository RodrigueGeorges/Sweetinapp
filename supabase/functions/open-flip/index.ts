// Ouvre un flip pour le destinataire : URL signée de la photo (2 minutes) + message caché.
import { admin, cors, currentUser, fail, json, rateHit } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401, 'NOT_AUTHENTICATED');

  const { flip_id } = (await req.json().catch(() => ({}))) as { flip_id?: string };
  if (!flip_id) return fail('flip_id manquant');

  const db = admin();
  // anti-énumération : 300 ouvertures par jour et par compte suffisent largement
  if (!(await rateHit(db, user.id, 'open_flip', 300, 86_400))) return fail('Tu as ouvert beaucoup de sweets, réessaie demain', 429, 'RATE_LIMIT');
  const { data: rec } = await db
    .from('flip_recipients')
    .select('opened_at, scratched_at, flips(id, sender_id, photo_path, mode, expires_at, created_at, preview)')
    .eq('flip_id', flip_id)
    .eq('recipient_id', user.id)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const flip = (rec as any)?.flips;
  if (!rec || !flip) return fail('Sweet introuvable', 404, 'NOT_FOUND');
  if (rec.scratched_at) return fail('Déjà gratté, il n’en reste rien', 410, 'ALREADY_SCRATCHED');
  if (!flip.photo_path || new Date(flip.expires_at) < new Date()) return fail('Ce sweet a fondu', 410, 'EXPIRED');

  const [{ data: secret }, { data: sender }, signed] = await Promise.all([
    db.from('flip_secrets').select('message').eq('flip_id', flip_id).single(),
    db.from('profiles').select('username, avatar_path').eq('id', flip.sender_id).single(),
    db.storage.from('flips').createSignedUrl(flip.photo_path, 120),
  ]);
  if (!secret || signed.error) return fail('Sweet indisponible', 410, 'EXPIRED');

  if (!rec.opened_at) {
    await db.from('flip_recipients').update({ opened_at: new Date().toISOString() }).eq('flip_id', flip_id).eq('recipient_id', user.id);
  }

  return json({
    id: flip.id,
    sender_id: flip.sender_id,
    sender: sender?.username ?? 'un ami',
    preview: (flip as { preview?: string | null }).preview ?? null,
    sender_avatar: sender?.avatar_path ? db.storage.from('avatars').getPublicUrl(sender.avatar_path).data.publicUrl : null,
    mode: flip.mode,
    created_at: flip.created_at,
    photo_url: signed.data.signedUrl,
    message: secret.message,
  });
});
