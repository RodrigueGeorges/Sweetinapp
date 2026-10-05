// Rattache une photo de profil au compte, après modération automatique (comme les flips).
// Une photo refusée est effacée tout de suite ; l'ancienne photo est supprimée quand la nouvelle est acceptée.
import { blockingCategory, moderate } from '../_shared/moderation.ts';
import { admin, cors, currentUser, fail, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401);
  const { path } = (await req.json().catch(() => ({}))) as { path?: string | null };
  const db = admin();

  // retirer sa photo
  if (!path) {
    await db.from('profiles').update({ avatar_path: null }).eq('id', user.id);
    return json({ ok: true, avatar_path: null });
  }
  if (path.split('/')[0] !== user.id || path.includes('..')) return fail('Chemin invalide', 400, 'AVATAR_PATH');

  const url = db.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const verdict = blockingCategory((await moderate('photo de profil', url)) ?? undefined);
  if (verdict) {
    await db.storage.from('avatars').remove([path]);
    console.warn('avatar refusé', user.id, verdict);
    return fail('Photo refusée', 422, 'AVATAR_REFUSED');
  }

  const { data: before } = await db.from('profiles').select('avatar_path').eq('id', user.id).single();
  const { error } = await db.from('profiles').update({ avatar_path: path }).eq('id', user.id);
  if (error) return fail('Mise à jour impossible', 500);
  if (before?.avatar_path && before.avatar_path !== path) await db.storage.from('avatars').remove([before.avatar_path]);
  return json({ ok: true, avatar_path: path });
});
