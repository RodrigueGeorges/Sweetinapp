import { blockingCategory, moderate } from './moderation.ts';

function assertEquals(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`attendu ${b}, obtenu ${a}`);
}

Deno.test('une modération indisponible ne peut jamais autoriser un envoi', () => {
  assertEquals(blockingCategory('unavailable'), 'unavailable');
});

Deno.test('un contenu sain passe', () => {
  assertEquals(blockingCategory({ flagged: false, categories: {} }), null);
});
Deno.test('un contenu sexuel est bloqué', () => {
  assertEquals(blockingCategory({ flagged: true, categories: { sexual: true } }), 'sexual');
});
Deno.test('un doute sur un mineur bloque même sous le seuil officiel', () => {
  assertEquals(blockingCategory({ flagged: false, categories: {}, category_scores: { 'sexual/minors': 0.3 } }), 'sexual/minors');
});
Deno.test('le harcèlement simple ne bloque pas', () => {
  assertEquals(blockingCategory({ flagged: true, categories: { harassment: true } }), null);
});
Deno.test('pas de résultat (modération désactivée) : on laisse passer', () => {
  assertEquals(blockingCategory(undefined), null);
});

// fail-closed : sans clé, l'appelant doit refuser l'envoi ('unavailable').
// MODERATION_OPTIONAL=1 est l'échappatoire explicitement réservé au développement.
function withoutModerationEnv(run: () => void | Promise<void>) {
  const key = Deno.env.get('OPENAI_API_KEY');
  const opt = Deno.env.get('MODERATION_OPTIONAL');
  Deno.env.delete('OPENAI_API_KEY');
  Deno.env.delete('MODERATION_OPTIONAL');
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (key !== undefined) Deno.env.set('OPENAI_API_KEY', key);
      if (opt !== undefined) Deno.env.set('MODERATION_OPTIONAL', opt);
    });
}

Deno.test('sans clé ni dérogation : unavailable (fail-closed)', () =>
  withoutModerationEnv(async () => {
    assertEquals(await moderate('mot', 'https://x.test/p.jpg'), 'unavailable');
  }));

Deno.test('MODERATION_OPTIONAL=1 : laisse passer en dev', () =>
  withoutModerationEnv(async () => {
    Deno.env.set('MODERATION_OPTIONAL', '1');
    assertEquals(await moderate('mot', 'https://x.test/p.jpg'), null);
  }));

Deno.test('MODERATION_OPTIONAL avec une autre valeur : toujours fail-closed', () =>
  withoutModerationEnv(async () => {
    Deno.env.set('MODERATION_OPTIONAL', '0');
    assertEquals(await moderate('mot', 'https://x.test/p.jpg'), 'unavailable');
  }));
