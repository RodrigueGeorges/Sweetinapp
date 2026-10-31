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
Deno.test('sendPush : messages par jeton actif, reçus enregistrés pour le cron', async () => {
  const tokens = [
    { user_id: 'u1', token: 'TK-1', lang: 'fr', mute: [] },
    { user_id: 'u1', token: 'TK-2', lang: 'en', mute: [] },
    { user_id: 'u1', token: 'TK-MUTED', lang: 'fr', mute: ['flips'] },
  ];
  const receipts: { ticket_id: string; token: string }[] = [];
  const db = {
    from: () => ({
      select: () => ({ in: async () => ({ data: tokens }) }),
      upsert: async (rows: { ticket_id: string; token: string }[]) => { receipts.push(...rows); return {}; },
    }),
  } as never;

  const sent: Record<string, unknown>[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (_url: unknown, init: RequestInit | undefined) => {
    sent.push(...(JSON.parse(String(init?.body)) as Record<string, unknown>[]));
    // un ticket en erreur n'est pas enregistré ; les deux autres attendront le cron
    return new Response(JSON.stringify({ data: [{ status: 'ok', id: 't1' }, { status: 'error' }] }), { status: 200 });
  };
  try {
    await sendPush(db, ['u1'], () => ({ title: 'sweetin', body: 'corps' }));
  } finally {
    globalThis.fetch = origFetch;
  }

  // le jeton qui a coupé « flips » ne reçoit rien
  assertEquals(sent.length, 2);
  assertEquals(sent[0].to, 'TK-1');
  assertEquals(sent[0].sound, 'sweet.wav');
  // seul le ticket ok produit un reçu à vérifier plus tard
  assertEquals(JSON.stringify(receipts), '[{"ticket_id":"t1","token":"TK-1"}]');
});
