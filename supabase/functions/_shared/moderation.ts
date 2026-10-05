// Modération automatique avant livraison d'un flip (API de modération OpenAI, gratuite).
// Sans clé OPENAI_API_KEY, la modération est désactivée et tout passe : à configurer avant le lancement.

export type ModerationResult = { flagged: boolean; categories: Record<string, boolean>; category_scores?: Record<string, number> };

/** Catégories qui bloquent l'envoi. Le harcèlement léger n'est pas bloqué (faux positifs fréquents entre amis). */
const BLOCKING = ['sexual', 'sexual/minors', 'violence/graphic', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'hate/threatening', 'harassment/threatening', 'illicit/violent'];

/** Décide si un résultat de modération doit bloquer l'envoi. Renvoie la catégorie fautive ou null. */
export function blockingCategory(r: ModerationResult | undefined): string | null {
  if (!r) return null;
  for (const c of BLOCKING) if (r.categories?.[c]) return c;
  // une image même légèrement suspecte d'impliquer un mineur est toujours bloquée
  if ((r.category_scores?.['sexual/minors'] ?? 0) > 0.2) return 'sexual/minors';
  return null;
}

/** Envoie le texte et l'image à la modération. Renvoie null si la modération n'est pas configurée ou indisponible. */
export async function moderate(text: string, imageUrl: string): Promise<ModerationResult | null> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
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
      return null;
    }
    const body = await res.json();
    return body.results?.[0] ?? null;
  } catch (e) {
    console.error('moderation failed', e);
    return null;
  }
}
