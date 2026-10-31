// Smoke test prod : login compte de test + RPC request_friend/list_friend_requests.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split('=')));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'cc@dd.ee', password: 'cccccccc' }),
});
const j = await login.json();
if (!j.access_token) { console.log('LOGIN FAIL', JSON.stringify(j).slice(0, 200)); process.exit(1); }
console.log('LOGIN OK ·', j.user?.id);

const rpc = async (name, body) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${j.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return `${r.status} ${(await r.text()).slice(0, 160)}`;
};

console.log('request_friend(pseudo_inexistant) →', await rpc('request_friend', { p_username: 'pseudo_inexistant_xx' }));
console.log('request_friend(soi-même) →', await rpc('request_friend', { p_username: 'bobtest' }));
console.log('list_friend_requests →', await rpc('list_friend_requests', {}));
