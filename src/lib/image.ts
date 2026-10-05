import { Skia, type SkImage } from '@shopify/react-native-skia';

/**
 * Télécharge une photo et la décode directement en mémoire GPU.
 * Rien n'est écrit sur le disque : pas de cache image, pas de fichier temporaire.
 */
export async function loadImageInMemory(url: string): Promise<SkImage> {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const data = Skia.Data.fromBytes(bytes);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('photo illisible');
  return img;
}
