// Test de bout en bout « comme un vrai utilisateur » contre la production.
// Scénario : expéditrice connectée → photo → sweet par lien → destinataire anonyme
// sur le site Netlify → aperçu → ouverture → grattage → seconde ouverture refusée.
// Usage : node .pg-test/e2e-user.mjs   (lit .env : EXPO_PUBLIC_SUPABASE_*, SMOKE_*)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split('=')));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FN = `${BASE}/functions/v1`;
const SITE = (env.APP_LINK_DOMAIN && `https://${env.APP_LINK_DOMAIN}`) || 'https://sweetinapp.netlify.app';

let pass = 0, failCount = 0;
const step = (ok, label, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : failCount++;
};
const call = async (name, body, token) => {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

console.log('\n🧑‍💻 SCÉNARIO 1 — La destinataire reçoit un lien avant tout le reste\n');
{
  const r = await fetch(`${SITE}/f/jetonquilenestpas12345`);
  step(r.status === 200, 'la page /f/ se charge dans le navigateur', `${r.status}`);
  const html = await r.text();
  step(html.includes('sweetin-api'), 'la page connaît l’adresse de l’API');
  const peek = await call('open-link', { token: 'jetonquilenestpas12345', peek: true });
  step(peek.status === 404 && peek.body.code === 'NOT_FOUND', 'un faux jeton est refusé proprement', `${peek.status} ${peek.body.error ?? ''}`);
  const home = await fetch(SITE);
  step(home.status === 200, 'la page d’accueil du site répond', `${home.status}`);
}

console.log('\n📱 SCÉNARIO 2 — L’expéditrice ouvre l’app et envoie un sweet par lien\n');
let token, uid, linkUrl, linkToken;
{
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }),
  });
  const j = await r.json();
  step(!!j.access_token, 'connexion au compte', j.user?.email ?? JSON.stringify(j).slice(0, 120));
  token = j.access_token; uid = j.user?.id;
  if (!token) process.exit(1);

  const prof = await fetch(`${BASE}/rest/v1/profiles?id=eq.${uid}&select=id,username,onboarded,avatar_path`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  const pj = await prof.json();
  step(prof.status === 200 && pj.length === 1, 'le profil se charge', pj[0]?.username ?? '');

  const img = readFileSync(new URL('../assets/welcome.jpg', import.meta.url));
  const path = `${uid}/e2e-${Date.now()}.jpg`;
  const sign = await fetch(`${BASE}/storage/v1/object/upload/sign/flips/${path}`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  const sj = await sign.json();
  step(sign.status === 200 && sj.url, 'l’app obtient une URL d’upload signée', `${sign.status}`);
  const up = await fetch(`${BASE}/storage/v1${sj.url}`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: img });
  step(up.status === 200, 'la photo est déposée dans le storage', `${up.status}`);

  const requestId = `e2e-${Date.now()}`;
  const send = await call('send-flip', {
    photo_path: path, mode: 'once', message: 'ceci est un test de bout en bout 🍬',
    recipients: [], link: 'single', request_id: requestId, preview: null, word_style: null,
  }, token);
  step(send.status === 200 && send.body.link_url, 'send-flip crée le sweet et son lien', `${send.status} ${send.body.link_url ?? JSON.stringify(send.body).slice(0, 160)}`);
  linkUrl = send.body.link_url;
  linkToken = linkUrl?.split('/f/')[1];
  step(!!linkUrl?.startsWith(SITE), 'le lien pointe sur le site hébergé', linkUrl ?? '');

  const again = await call('send-flip', {
    photo_path: path, mode: 'once', message: 'ceci est un test de bout en bout 🍬',
    recipients: [], link: 'single', request_id: requestId, preview: null, word_style: null,
  }, token);
  step(again.body.id === send.body.id && again.body.link_url === linkUrl, 'un double appui ne crée pas de doublon');
}

console.log('\n🌐 SCÉNARIO 3 — Le destinataire ouvre le lien dans son navigateur\n');
if (linkToken) {
  const page = await fetch(`${SITE}/f/${linkToken}`);
  step(page.status === 200, 'le lien s’ouvre sur la page de grattage', `${page.status}`);

  const peek = await call('open-link', { token: linkToken, peek: true });
  step(peek.status === 200 && peek.body.sender, 'aperçu avant ouverture : pseudo de l’expéditrice', peek.body.sender ?? JSON.stringify(peek.body).slice(0, 120));

  const open = await call('open-link', { token: linkToken });
  step(open.status === 200 && open.body.photo_url && open.body.message, 'ouverture : photo signée + mot secret', `${open.status} « ${open.body.message ?? ''} »`);
  step(open.body.mode === 'once', 'mode « une fois » respecté', open.body.mode ?? '');

  if (open.body.photo_url) {
    const photo = await fetch(open.body.photo_url);
    const buf = await photo.arrayBuffer();
    step(photo.status === 200 && buf.byteLength > 1000, 'la photo se télécharge', `${photo.status} ${(buf.byteLength / 1024).toFixed(0)} Ko`);
  }

  const scratch = await call('link-scratched', { token: linkToken, percent: 72, duration_ms: 3400 });
  step(scratch.status < 400, 'la trace de grattage est enregistrée', `${scratch.status}`);

  const reopen = await call('open-link', { token: linkToken });
  step(reopen.status === 410 && ['ALREADY_OPENED', 'EXPIRED'].includes(reopen.body.code), 'impossible de rouvrir : contenu détruit après grattage', `${reopen.status} ${reopen.body.error ?? ''}`);

  const peek2 = await call('open-link', { token: linkToken, peek: true });
  step(peek2.status === 410, 'l’aperçu dit aussi que c’est fondu', `${peek2.status}`);
}

console.log('\n👥 SCÉNARIO 4 — Vie sociale du compte\n');
{
  const friends = await fetch(`${BASE}/rest/v1/rpc/list_friend_requests`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
  const fj = await friends.json();
  step(friends.status === 200, 'la liste des demandes d’amis se charge', JSON.stringify(fj).slice(0, 100));
  const circle = await fetch(`${BASE}/rest/v1/friendships?user_id=eq.${uid}&select=friend_id`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  const cj = await circle.json();
  step(circle.status === 200, 'le cercle d’amis se charge', Array.isArray(cj) ? `${cj.length} ami(s)` : JSON.stringify(cj).slice(0, 100));
  const inbox = await fetch(`${BASE}/rest/v1/flip_recipients?recipient_id=eq.${uid}&select=flip_id,scratched_at&limit=5`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  const ij = await inbox.json();
  step(inbox.status === 200 && Array.isArray(ij), 'la boîte de réception se charge', Array.isArray(ij) ? `${ij.length} sweet(s)` : '');
  const sent = await fetch(`${BASE}/rest/v1/flips?sender_id=eq.${uid}&select=id,created_at,mode&order=created_at.desc&limit=3`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  const sj = await sent.json();
  step(sent.status === 200 && Array.isArray(sj), 'l’historique des envois se charge', Array.isArray(sj) ? `${sj.length} dernier(s)` : '');
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  ${pass} ✅ · ${failCount} ❌\n`);
process.exit(failCount ? 1 : 0);
