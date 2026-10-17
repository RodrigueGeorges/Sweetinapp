import { clientActor, randomToken, rateHit, sendPush } from './util.ts';

function assertEquals(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
}
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

type RpcResult = { data: unknown; error?: unknown };
// juste assez de client pour rateHit
const dbWithRpc = (result: RpcResult) => ({ rpc: async () => result }) as never;

Deno.test('rateHit : dans le quota', async () => {
  assertEquals(await rateHit(dbWithRpc({ data: true }), 'u1', 'send_flip', 10, 60), true);
});

Deno.test('rateHit : au-delà du quota', async () => {
  assertEquals(await rateHit(dbWithRpc({ data: false }), 'u1', 'send_flip', 10, 60), false);
});

Deno.test('rateHit : une panne du compteur ne bloque jamais le service', async () => {
  assertEquals(await rateHit(dbWithRpc({ data: null, error: { message: 'down' } }), 'u1', 'send_flip', 10, 60), true);
});

Deno.test('randomToken : 22 caractères, sans caractère à échapper dans une URL', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const t = randomToken();
    assertEquals(t.length, 22);
    assert(/^[A-Za-z0-9_-]{22}$/.test(t), `token non url-safe : ${t}`);
    seen.add(t);
  }
  assertEquals(seen.size, 200);
});

Deno.test('clientActor : empreinte stable, courte, et première IP seulement', async () => {
  const req = (ip: string) => new Request('https://x.test', { headers: { 'x-forwarded-for': ip } });
  const a = await clientActor(req('203.0.113.7, 10.0.0.1'));
  const b = await clientActor(req('203.0.113.7'));
  assertEquals(a, b); // le proxy ajoute sa IP en fin de liste : seule la première compte
  assert(/^ip:[0-9a-f]{16}$/.test(a), `format inattendu : ${a}`);
  assert(!(await clientActor(req('198.51.100.2')) === a), 'deux IP distinctes doivent différer');
});

// sendPush : on remplace fetch pour capturer la charge envoyée à Expo (pas de réseau).
Deno.test('sendPush : messages par jeton, wake iOS + silencieux Android, jetons morts nettoyés', async () => {
  const tokens = [
    { user_id: 'u1', token: 'TK-IOS', lang: 'fr', platform: 'ios' },
    { user_id: 'u1', token: 'TK-AND', lang: 'en', platform: 'android' },
  ];
  const deleted: string[] = [];
  const db = {
    from: () => ({
      select: () => ({ in: async () => ({ data: tokens }) }),
      delete: () => ({ in: async (_c: string, vals: string[]) => { deleted.push(...vals); return {}; } }),
      upsert: async () => ({}),
    }),
  } as never;

  const sent: Record<string, unknown>[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (_url: unknown, init: RequestInit | undefined) => {
    sent.push(...(JSON.parse(String(init?.body)) as Record<string, unknown>[]));
    // le ticket iOS déclare l'appareil désinstallé
    return new Response(JSON.stringify({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok', id: 'r1' }, { status: 'ok', id: 'r2' }] }), { status: 200 });
  };
  try {
    await sendPush(db, ['u1'], () => ({ title: 'sweetin', body: 'corps' }), true);
  } finally {
    globalThis.fetch = origFetch;
  }

  // ios : 1 message visible avec contentAvailable ; android : visible + message silencieux
  assertEquals(sent.length, 3);
  const ios = sent.find((m) => m.to === 'TK-IOS')!;
  assertEquals(ios.contentAvailable, true);
  assertEquals(ios.sound, 'sweet.wav');
  const silent = sent.find((m) => m.to === 'TK-AND' && (m.data as { refresh?: boolean })?.refresh === true)!;
  assertEquals(silent.priority, 'high');
  assert(!('title' in silent), 'le wake Android ne doit pas afficher de notification');
  assertEquals(JSON.stringify(deleted), '["TK-IOS"]');
});
