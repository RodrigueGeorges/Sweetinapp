// Épingle les textes de notifications : ils sont cités mot pour mot dans docs/marketing/PUBLIER.md
// et ne doivent pas dériver sans revue.
import { asLang, copy } from './copy.ts';

function assertEquals(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
}

Deno.test('asLang : en reconnu, tout le reste retombe en fr', () => {
  assertEquals(asLang('en'), 'en');
  assertEquals(asLang('fr'), 'fr');
  assertEquals(asLang('de'), 'fr');
  assertEquals(asLang(undefined), 'fr');
});

Deno.test('flip : le push d’un nouveau sweet', () => {
  assertEquals(copy.flip('fr', 'lea'), 'lea t’a caché un mot sous une photo. gratte.');
  assertEquals(copy.flip('en', 'lea'), 'lea hid a word under a photo. scratch it.');
});

Deno.test('scratched : durée affichée au-delà d’une demi-seconde, sinon rien', () => {
  assertEquals(copy.scratched('fr', 'tom', 60, '2,1'), 'tom a lu ton mot en 2,1 s. il a fondu.');
  assertEquals(copy.scratched('en', 'tom', 60, '2,1'), 'tom read your word in 2.1 s. it melted.');
  assertEquals(copy.scratched('fr', 'tom', 60, '0,4'), 'tom a lu ton mot. il a fondu.');
  assertEquals(copy.scratched('en', 'tom', 60, '0.3'), 'tom read your word. it melted.');
});

Deno.test('linkScratched : même règle pour les liens anonymes', () => {
  assertEquals(copy.linkScratched('fr', 60, '3,0'), 'ton lien a été lu en 3,0 s. il a fondu.');
  assertEquals(copy.linkScratched('en', 60, '3,0'), 'your link was read in 3.0 s. it melted.');
  assertEquals(copy.linkScratched('fr', 60, '0'), 'ton lien a été lu. il a fondu.');
});

Deno.test('reacted : la réaction brute est injectée', () => {
  assertEquals(copy.reacted('fr', 'tom', '« je fonds »'), 'tom a réagi « je fonds » à ton sweet');
  assertEquals(copy.reacted('en', 'tom', '"melt"'), 'tom reacted "melt" to your sweet');
});

Deno.test('séries : titre, corps et paliers', () => {
  assertEquals(copy.streakTitle('fr', 12, 'lea'), '12j avec lea');
  assertEquals(copy.streakTitle('en', 12, 'lea'), '12d with lea');
  assertEquals(copy.streakBody('fr'), 'ça fond à minuit. un sweet suffit à la sauver.');
  assertEquals(copy.streakMilestone('fr', 30, 'lea'), '30 jours d’affilée avec lea. lâchez rien.');
});

Deno.test('capture d’écran et divers', () => {
  assertEquals(copy.screenshot('fr', 'tom'), 'tom a tenté une capture de ton sweet. bloquée.');
  assertEquals(copy.linkOpened('fr'), 'quelqu’un vient d’ouvrir ton lien privé');
  assertEquals(copy.storyMilestone('en', 42), '42 people scratched your story');
});

Deno.test('sweet hour : deux variantes par langue, jamais vide', () => {
  for (const lang of ['fr', 'en'] as const) {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = copy.sweetHour(lang);
      if (!s.toLowerCase().includes('sweet hour')) throw new Error(`variante inattendue : ${s}`);
      seen.add(s);
    }
    assertEquals(seen.size, 2);
  }
});
