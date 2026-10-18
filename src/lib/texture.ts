/** Web (aperçu) : pas de vibration continue. Voir texture.native.ts. */
export type Texture = { move: (speed: number) => void; end: () => void } | null;
export function useScratchTexture(): Texture {
  return null;
}
