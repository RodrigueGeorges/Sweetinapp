// Liste d'attente iPhone (lancement Android d'abord) : appelée par les pages web /f/ et /u/ quand on les ouvre sur un iPhone.
// Sans compte. Un email = une ligne (upsert) ; aucune donnée renvoyée.
import { admin, clientActor, cors, fail, json, rateHit } from '../_shared/util.ts';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const HOURLY_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Méthode non autorisée', 405);

  // endpoint public sans compte : quota par empreinte d'IP, comme open-link
  const db = admin();
  if (!(await rateHit(db, await clientActor(req), 'waitlist', HOURLY_LIMIT, 3600))) return fail('Réessaie dans un instant', 429, 'RATE_LIMIT');

  const body = (await req.json().catch(() => ({}))) as { email?: string; platform?: string; src?: string; ref?: string; lang?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return fail('Email invalide', 400, 'BAD_EMAIL');
  const platform = body.platform === 'android' || body.platform === 'web' ? body.platform : 'ios';
  const src = (body.src ?? '').replace(/[^a-z]/g, '').slice(0, 24) || null;
  const ref = (body.ref ?? '').replace(/[^a-z0-9_.]/gi, '').toLowerCase().slice(0, 32) || null;
  const lang = body.lang === 'en' ? 'en' : 'fr';
  const { error } = await db.from('waitlist').upsert({ email, platform, src, ref, lang }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) return fail('Réessaie dans un instant', 500);
  return json({ ok: true });
});
