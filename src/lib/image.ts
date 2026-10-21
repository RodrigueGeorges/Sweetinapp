import { Skia, type SkImage } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';

/**
 * Télécharge une photo et la décode directement en mémoire GPU.
 * Rien n'est écrit sur le disque : pas de cache image, pas de fichier temporaire.
 */
export async function loadImageInMemory(url: string): Promise<SkImage> {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return decodeImage(bytes);
}

/** Décode un fichier local (brouillon juste pris) en mémoire GPU — même rendu que chez le destinataire. */
export async function loadImageFromFile(uri: string): Promise<SkImage> {
  const bytes = new Uint8Array(await new File(uri).arrayBuffer());
  return decodeImage(bytes);
}

function decodeImage(bytes: Uint8Array): SkImage {
  const data = Skia.Data.fromBytes(bytes);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('photo illisible');
  return img;
}
