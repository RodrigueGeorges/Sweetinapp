// Envoi direct à APNs, pour les Live Activities (le service push d'Expo ne gère pas ce type de notification).
// Variables : APNS_KEY (contenu du fichier .p8), APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (bundle id de l'app),
// APNS_ENV = "production" (par défaut) ou "sandbox" pour les builds de développement.

let cached: { jwt: string; at: number } | null = null;

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Jeton d'authentification APNs (ES256), réutilisé 50 minutes comme le recommande Apple. */
async function token(): Promise<string | null> {
  const pem = Deno.env.get('APNS_KEY');
  const kid = Deno.env.get('APNS_KEY_ID');
  const iss = Deno.env.get('APNS_TEAM_ID');
  if (!pem || !kid || !iss) return null;
  if (cached && Date.now() - cached.at < 50 * 60_000) return cached.jwt;
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64url(JSON.stringify({ alg: 'ES256', kid }))}.${b64url(JSON.stringify({ iss, iat: now }))}`;
  // WebCrypto renvoie la signature au format r||s, celui qu'attend un JWT ES256
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body));
  cached = { jwt: `${body}.${b64url(sig)}`, at: Date.now() };
  return cached.jwt;
}

export const apnsConfigured = () => !!(Deno.env.get('APNS_KEY') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_TOPIC'));

/**
 * Démarre une Live Activity à distance (push-to-start, iOS 17.2+).
 * `name` et `props` correspondent au composant déclaré dans l'app (src/widgets, expo-widgets).
 * Renvoie true si APNs l'a acceptée.
 */
export async function startLiveActivity(
  deviceToken: string,
  opts: { name: string; props: Record<string, unknown>; alert: { title: string; body: string }; sound?: string; staleAt: Date; dismissAt: Date; url?: string },
): Promise<boolean> {
  const jwt = await token();
  const topic = Deno.env.get('APNS_TOPIC');
  if (!jwt || !topic) return false;
  const host = Deno.env.get('APNS_ENV') === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aps: {
      timestamp: now,
      event: 'start',
      'attributes-type': 'LiveActivityAttributes',
      attributes: { url: opts.url ?? null },
      'content-state': { name: opts.name, props: JSON.stringify(opts.props) },
      'stale-date': Math.floor(opts.staleAt.getTime() / 1000),
      'dismissal-date': Math.floor(opts.dismissAt.getTime() / 1000),
      alert: { title: opts.alert.title, body: opts.alert.body },
      ...(opts.sound ? { sound: opts.sound } : {}),
    },
  };
  try {
    const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': `${topic}.push-type.liveactivity`,
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(opts.dismissAt.getTime() / 1000)),
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn('apns', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.error('apns failed', e);
    return false;
  }
}
