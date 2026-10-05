import { blockingCategory } from './moderation.ts';

function assertEquals(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`attendu ${b}, obtenu ${a}`);
}

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
