import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { rgbaToThumbHash } from 'thumbhash';

const cache = new Map<string, string | null>();

/**
 * ThumbHash de l'aperçu (JPEG de 24 px en base64) : un flou lisse et fidèle aux couleurs,
 * affiché par expo-image à la place d'une vignette pixelisée. Calculé une fois, en mémoire.
 */
export function thumbhashOf(previewB64: string | null | undefined): string | null {
  if (!previewB64) return null;
  if (cache.has(previewB64)) return cache.get(previewB64)!;
  let out: string | null = null;
  try {
    const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(previewB64));
    if (img) {
      const w = Math.min(100, img.width());
      const h = Math.min(100, img.height());
      const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
      img.dispose();
      if (px) {
        const hash = rgbaToThumbHash(w, h, px as Uint8Array);
        let bin = '';
        for (const b of hash) bin += String.fromCharCode(b);
        out = globalThis.btoa(bin);
      }
    }
  } catch {
    out = null;
  }
  cache.set(previewB64, out);
  return out;
}
