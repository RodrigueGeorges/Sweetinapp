// Ouverture d'un flip depuis un lien (page web /f/<jeton>), sans compte.
// Appelée seulement quand la personne touche « Ouvrir » : les robots qui génèrent les aperçus de lien ne consomment rien.
// Lien privé : une seule ouverture. Story : ouvrable par tous jusqu'à expiration (24 h).
import { admin, clientActor, cors, fail, json, MILESTONES, rateHit, sendPush } from '../_shared/util.ts';
import { copy } from '../_shared/copy.ts';

const MAX_STORY_OPENS = 5000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Méthode non autorisée', 405);
  const { token, peek } = (await req.json().catch(() => ({}))) as { token?: string; peek?: boolean };
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return fail('Lien invalide', 404, 'NOT_FOUND');

  const db = admin();
  // endpoint sans compte : on limite par empreinte d'IP (120 ouvertures/heure)
  if (!(await rateHit(db, await clientActor(req), 'open_link', 120, 3600))) return fail('Trop de tentatives, réessaie plus tard', 429, 'RATE_LIMIT');
  const { data: link } = await db
    .from('flip_links')
    .select('token, kind, opened_at, flips(id, sender_id, photo_path, mode, expires_at, created_at)')
    .eq('token', token)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const flip = (link as any)?.flips;
  if (!link || !flip) return fail('Lien introuvable', 404, 'NOT_FOUND');
  if (!flip.photo_path || new Date(flip.expires_at) < new Date()) return fail('Ce sweet a fondu', 410, 'EXPIRED');

  // aperçu avant ouverture (pseudo + vignette floue), sans rien consommer
  if (peek) {
    if (link.kind === 'single' && link.opened_at) return fail('Ce sweet a déjà été gratté', 410, 'ALREADY_OPENED');
    const [{ data: sender }, { data: p }] = await Promise.all([
      db.from('profiles').select('username').eq('id', flip.sender_id).single(),
      db.from('flips').select('preview').eq('id', flip.id).single(),
    ]);
    return json({ kind: link.kind, sender: sender?.username ?? 'un ami', mode: link.kind === 'single' ? flip.mode : 'free', preview: p?.preview ?? null });
  }

  let opens = 0;
  if (link.kind === 'single') {
    // ouverture unique, atomique
    const { data: claimed } = await db.from('flip_links').update({ opened_at: new Date().toISOString() }).eq('token', token).is('opened_at', null).select('token');
    if (!claimed?.length) return fail('Ce sweet a déjà été gratté', 410, 'ALREADY_OPENED');
  } else {
    const { data } = await db.rpc('bump_story', { p_token: token, p_scratch: false });
    opens = (data as number) ?? 0;
    if (opens > MAX_STORY_OPENS) return fail('Ce sweet a fondu', 410, 'EXPIRED');
  }

  const [{ data: secret }, { data: sender }, signed] = await Promise.all([
    db.from('flip_secrets').select('message').eq('flip_id', flip.id).single(),
    db.from('profiles').select('username').eq('id', flip.sender_id).single(),
    db.storage.from('flips').createSignedUrl(flip.photo_path, 300),
  ]);
  if (!secret || signed.error) return fail('Ce sweet a fondu', 410, 'EXPIRED');

  if (link.kind === 'single') {
    await sendPush(db, [flip.sender_id], (_u, lang) => ({ body: copy.linkOpened(lang), data: { screen: 'inbox' } }));
  } else if (MILESTONES.has(opens)) {
    await sendPush(db, [flip.sender_id], () => ({ body: opens === 1 ? '👀 Ta story a été ouverte' : `👀 ${opens} personnes ont ouvert ta story`, data: { screen: 'inbox' } }));
  }

  return json({
    kind: link.kind,
    sender: sender?.username ?? 'un ami',
    mode: link.kind === 'single' ? flip.mode : 'free',
    created_at: flip.created_at,
    photo_url: signed.data.signedUrl,
    message: secret.message,
  });
});
