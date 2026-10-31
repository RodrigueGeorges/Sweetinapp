// Smoke test prod complet : upload photo + send-flip (lien privé) + rejoue idempotent.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split('=')));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }),
}).then((r) => r.json());
if (!login.access_token) { console.log('LOGIN FAIL'); process.exit(1); }
const tok = login.access_token;
const uid = login.user.id;
console.log('LOGIN OK ·', uid);

// 1) vraie photo JPEG (la modération rejette un JPEG invalide — image_parse_error)
const jpg = readFileSync(new URL('../assets/welcome.jpg', import.meta.url));
const path = `${uid}/smoke-x${Date.now()}.jpg`;
const sign = await fetch(`${BASE}/storage/v1/object/upload/sign/flips/${path}`, {
  method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${tok}` },
});
const signed = await sign.json();
console.log('SIGN →', sign.status, JSON.stringify(signed).slice(0, 140));
if (!signed.url) process.exit(1);
const up = await fetch(`${BASE}/storage/v1${signed.url}`, {
  method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpg,
});
console.log('UPLOAD →', up.status, (await up.text()).slice(0, 120));

// 2) send-flip : lien privé 'single', aucun ami requis
const send = async (request_id) => {
  const r = await fetch(`${BASE}/functions/v1/send-flip`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id, photo_path: path, message: 'smoke test prod', mode: 'once', recipients: [], link: 'single', preview: null, word_style: null }),
  });
  return `${r.status} ${(await r.text()).slice(0, 300)}`;
};
const reqId = `smoke-x${Date.now()}`;
console.log('send-flip #1 →', await send(reqId));
console.log('send-flip #2 (même request_id) →', await send(reqId));
