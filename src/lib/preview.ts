import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Aperçu minuscule (24 px de large) de la photo, en base64.
 * À cette taille la photo n'est qu'une tache de couleurs : il sert de vignette floue dans la boîte de réception et le widget.
 */
export async function makePreview(uri: string): Promise<string | null> {
  try {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 24 }).renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.5, format: SaveFormat.JPEG, base64: true });
    return saved.base64 && saved.base64.length <= 6000 ? saved.base64 : null;
  } catch {
    return null;
  }
}

export const previewUri = (b64: string | null | undefined) => (b64 ? `data:image/jpeg;base64,${b64}` : undefined);
