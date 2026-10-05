// Suppression du compte depuis l'app (obligatoire sur l'App Store et le Play Store).
import { admin, cors, currentUser, fail, json } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await currentUser(req);
  if (!user) return fail('Non connecté', 401);
  const db = admin();

  // photos déposées par l'utilisateur (flips et photo de profil)
  for (const bucket of ['flips', 'avatars']) {
    const { data: files } = await db.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await db.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }

  // le reste part en cascade (profil, amis, flips, traces, jetons)
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return fail('Suppression impossible, réessaie', 500);
  return json({ ok: true });
});
