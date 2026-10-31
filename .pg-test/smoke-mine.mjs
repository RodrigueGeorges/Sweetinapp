// Smoke prod « ma story » : envoi story → open-mine par l'expéditeur → refus anonyme.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split('=')));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, FN = `${BASE}/functions/v1`;

const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }),
});
const j = await login.json();
if (!j.access_token) { console.log('LOGIN FAIL'); process.exit(1); }
const t = j.access_token;
console.log('LOGIN OK');

const img = readFileSync(new URL('../assets/welcome.jpg', import.meta.url));
const path = `${j.user.id}/mine-${Date.now()}.jpg`;
const sign = await (await fetch(`${BASE}/storage/v1/object/upload/sign/flips/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: '{}' })).json();
await fetch(`${BASE}/storage/v1${sign.url}`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: img });
console.log('UPLOAD OK');

const send = await fetch(`${FN}/send-flip`, {
  method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ request_id: `mine-${Date.now()}`, photo_path: path, message: 'ma story de test', mode: 'free', recipients: [], link: 'story', preview: null, word_style: null }),
});
const sj = await send.json();
console.log('send-flip(story) →', send.status, JSON.stringify(sj).slice(0, 200));
const token = sj.link_url?.split('/f/')[1];
if (!token) process.exit(1);

// l'expéditeur consulte sa story
const mine = await fetch(`${FN}/open-mine`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
const mj = await mine.json();
console.log('open-mine →', mine.status, JSON.stringify({ ...mj, photo_url: mj.photo_url ? '(signée)' : null }).slice(0, 300));

// anonyme : doit être refusé
const anon = await fetch(`${FN}/open-mine`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
console.log('open-mine anonyme →', anon.status, JSON.stringify(await anon.json()));
