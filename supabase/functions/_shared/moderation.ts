// Modération automatique avant livraison d'un flip (API de modération OpenAI, gratuite).
// Fail-closed : sans clé OPENAI_API_KEY ou si l'API ne répond pas, l'envoi est refusé ('unavailable').
// Développement seulement : MODERATION_OPTIONAL=1 laisse tout passer quand la clé n'est pas configurée.

export type ModerationResult = { flagged: boolean; categories: Record<string, boolean>; category_scores?: Record<string, number> };

/** 'unavailable' = la modération n'a pas pu répondre : l'appelant doit refuser l'envoi. null = modération désactivée en dev. */
export type Moderation = ModerationResult | 'unavailable' | null;

/** Catégories qui bloquent l'envoi. Le harcèlement léger n'est pas bloqué (faux positifs fréquents entre amis). */
const BLOCKING = ['sexual', 'sexual/minors', 'violence/graphic', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'hate/threatening', 'harassment/threatening', 'illicit/violent'];

/** Décide si un résultat de modération doit bloquer l'envoi. Renvoie la catégorie fautive ou null. */
export function blockingCategory(r: Moderation | undefined): string | null {
  if (r === 'unavailable') return 'unavailable';
  if (!r) return null;
  for (const c of BLOCKING) if (r.categories?.[c]) return c;
  // une image même légèrement suspecte d'impliquer un mineur est toujours bloquée
  if ((r.category_scores?.['sexual/minors'] ?? 0) > 0.2) return 'sexual/minors';
  return null;
}

/** Envoie le texte et l'image à la modération. 'unavailable' si la modération est indisponible, null si désactivée en dev. */
export async function moderate(text: string, imageUrl: string): Promise<Moderation> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) {
    if (Deno.env.get('MODERATION_OPTIONAL') === '1') {
      console.warn('modération désactivée (MODERATION_OPTIONAL=1) : tout passe');
      return null;
    }
    console.error('OPENAI_API_KEY absente : envoi refusé (fail-closed)');
    return 'unavailable';
  }
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }),
    });
    if (!res.ok) {
      console.error('moderation http', res.status, await res.text());
      return 'unavailable';
    }
    const body = await res.json();
    return body.results?.[0] ?? 'unavailable';
  } catch (e) {
    console.error('moderation failed', e);
    return 'unavailable';
  }
}
