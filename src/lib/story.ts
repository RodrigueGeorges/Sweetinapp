import { BlurStyle, ClipOp, ImageFormat, Skia, TileMode, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { LOGO_CONE, LOGO_SCOOP, LOGO_VIEWBOX, LOGO_WORD } from '../components/logoPath';

const W = 1080;
const H = 1920;
const SUGAR = ['#FFFFFF', '#FFFFFF', '#FFF7F9', '#FFFFFF', '#FFFFFF']; // le sucre givré qui recouvre la photo
const faces: Record<string, SkTypeface | null> = {};

const FONT_FILES = {
  display: require('../../assets/fonts/SweetinDisplay.ttf'),
  bold: require('../../assets/fonts/SweetinText-ExtraBold.ttf'),
};

async function face(name: keyof typeof FONT_FILES) {
  if (faces[name]) return faces[name];
  const asset = Asset.fromModule(FONT_FILES[name]);
  await asset.downloadAsync();
  faces[name] = Skia.Typeface.MakeFreeTypeFaceFromData(await Skia.Data.fromURI(asset.localUri ?? asset.uri));
  return faces[name];
}

type Canvas = ReturnType<NonNullable<ReturnType<typeof Skia.Surface.MakeOffscreen>>['getCanvas']>;

function centered(canvas: Canvas, text: string, y: number, font: SkFont, color: string, x = W / 2) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAntiAlias(true);
  const w = font.measureText(text).width;
  canvas.drawText(text, x - w / 2, y, p, font);
}

/** Ombre douce sous une forme arrondie. */
function shadow(canvas: Canvas, r: ReturnType<typeof Skia.XYWHRect>, radius: number, alpha = 0.3, blur = 30, dy = 24) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(`rgba(22,15,18,${alpha})`));
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(r.x, r.y + dy, r.width, r.height), radius, radius), p);
}

/** Autocollant découpé (DA Fondant) : un mot en display sur une pastille, liseré blanc, posé de travers. */
function sticker(canvas: Canvas, text: string, cx: number, cy: number, rot: number, f: SkFont, fill: string, ink: string) {
  const tw = f.measureText(text).width;
  const h = f.getSize() * 1.9;
  const w = tw + h * 0.95;
  const r = Skia.XYWHRect(-w / 2, -h / 2, w, h);
  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate(rot, 0, 0);
  shadow(canvas, r, h / 2, 0.28, 18, 10);
  const edge = Skia.Paint();
  edge.setColor(Skia.Color('#FFFFFF'));
  edge.setAntiAlias(true);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(r.x - 9, r.y - 9, r.width + 18, r.height + 18), h / 2 + 9, h / 2 + 9), edge);
  const body = Skia.Paint();
  body.setColor(Skia.Color(fill));
  body.setAntiAlias(true);
  canvas.drawRRect(Skia.RRectXY(r, h / 2, h / 2), body);
  centered(canvas, text, f.getSize() * 0.36, f, ink, 0);
  canvas.restore();
}

/** Dessine la photo en remplissant `dst` (recadrage au centre), avec un flou optionnel. */
function cover(canvas: Canvas, photo: NonNullable<ReturnType<typeof Skia.Image.MakeImageFromEncoded>>, dst: ReturnType<typeof Skia.XYWHRect>, blur: number) {
  const s = Math.max(dst.width / photo.width(), dst.height / photo.height());
  const sw = dst.width / s;
  const sh = dst.height / s;
  const src = Skia.XYWHRect((photo.width() - sw) / 2, (photo.height() - sh) / 2, sw, sh);
  const p = Skia.Paint();
  if (blur) p.setImageFilter(Skia.ImageFilter.MakeBlur(blur, blur, TileMode.Clamp, null));
  canvas.drawImageRect(photo, src, dst, p);
}

/**
 * Image de story Instagram (1080 × 1920) dans la DA Fondant (« net en grand, éclats en petit ») :
 * la photo elle-même en fond, très floutée et assombrie (c'est elle qui porte la couleur), le logo blanc,
 * la photo-carte givrée penchée avec « gratte. », deux autocollants (citron « gratte-moi », framboise « mot caché »),
 * puis « gratte pour lire mon mot. » en blanc. Le mot n'apparaît jamais sur l'image : il faut ouvrir le lien.
 */
export async function renderStoryImage(photoUri: string): Promise<string> {
  const surface = Skia.Surface.MakeOffscreen(W, H) ?? Skia.Surface.Make(W, H);
  if (!surface) throw new Error('surface');
  const canvas = surface.getCanvas();
  const [display, bold] = await Promise.all([face('display'), face('bold')]);
  const font = (f: SkTypeface | null, size: number) => Skia.Font(f ?? undefined, size);
  const photo = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(photoUri));

  // fond : nuit, puis la photo plein cadre très floutée et assombrie
  const bg = Skia.Paint();
  bg.setColor(Skia.Color('#160F12'));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), bg);
  if (photo) cover(canvas, photo, Skia.XYWHRect(-80, -80, W + 160, H + 160), 70);
  const veil = Skia.Paint();
  veil.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: H }, [Skia.Color('rgba(22,15,18,0.35)'), Skia.Color('rgba(22,15,18,0.2)'), Skia.Color('rgba(22,15,18,0.75)')], [0, 0.45, 1], TileMode.Clamp));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), veil);

  // le logo « sweetin » (le i est une glace), en vecteur et en blanc (même tracé que dans l'app)
  const logo = Skia.Path.MakeFromSVGString(`${LOGO_WORD} ${LOGO_CONE} ${LOGO_SCOOP}`);
  if (logo) {
    const lw = 460;
    const k = lw / LOGO_VIEWBOX.w;
    canvas.save();
    canvas.translate((W - lw) / 2 - LOGO_VIEWBOX.x * k, 120 - LOGO_VIEWBOX.y * k);
    canvas.scale(k, k);
    const lp = Skia.Paint();
    lp.setColor(Skia.Color('#FFFFFF'));
    lp.setAntiAlias(true);
    canvas.drawPath(logo, lp);
    canvas.restore();
  }

  // la photo-carte penchée : liseré blanc, photo floutée sous le sucre givré, « gratte. » au milieu
  const cw = 700;
  const ch = (cw * 4) / 3;
  const cy = 300 + ch / 2;
  canvas.save();
  canvas.translate(W / 2, cy);
  canvas.rotate(-4, 0, 0);
  const card = Skia.XYWHRect(-cw / 2, -ch / 2, cw, ch);
  shadow(canvas, card, 56, 0.45, 40, 30);
  const edge = Skia.Paint();
  edge.setColor(Skia.Color('#FFFFFF'));
  edge.setAntiAlias(true);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(card.x - 14, card.y - 14, card.width + 28, card.height + 28), 70, 70), edge);
  canvas.save();
  canvas.clipRRect(Skia.RRectXY(card, 56, 56), ClipOp.Intersect, true);
  if (photo) cover(canvas, photo, card, 46);
  const sugar = Skia.Paint();
  sugar.setShader(Skia.Shader.MakeLinearGradient({ x: card.x, y: card.y }, { x: card.x + card.width, y: card.y + card.height * 0.75 }, SUGAR.map((c) => Skia.Color(c)), [0, 0.3, 0.55, 0.8, 1], TileMode.Clamp));
  sugar.setAlphaf(0.32);
  canvas.drawRect(card, sugar);
  canvas.restore();
  const scratch = font(display, 120);
  const shade = Skia.Paint();
  shade.setColor(Skia.Color('rgba(22,15,18,0.35)'));
  shade.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 24, true));
  const sw = scratch.measureText(t('inbox.scratch')).width;
  canvas.drawText(t('inbox.scratch'), -sw / 2, 46, shade, scratch);
  centered(canvas, t('inbox.scratch'), 40, scratch, '#FFFFFF', 0);
  canvas.restore();

  // les autocollants, posés sur les coins de la carte
  sticker(canvas, t('story.strip'), W / 2 + 250, cy - ch / 2 + 30, 8, font(display, 46), '#E8FF5A', '#160F12');
  sticker(canvas, t('story.pill'), W / 2 - 230, cy + ch / 2 - 40, -6, font(display, 42), '#FF2E5B', '#FFFFFF');
  photo?.dispose();

  // le titre et la consigne, en blanc
  const lines = t('story.title').split('\n');
  const ty = cy + ch / 2 + 190;
  lines.forEach((line, i) => centered(canvas, line, ty + i * 92, font(display, 80), '#FFFFFF'));
  centered(canvas, t('story.sub'), ty + lines.length * 92 + 24, font(bold, 40), 'rgba(255,255,255,0.82)');

  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes(ImageFormat.JPEG, 92);
  const file = new File(Paths.cache, `sweetin-story-${Date.now()}.jpg`);
  file.write(bytes);
  return file.uri;
}

/**
 * Partage la story : l'image part vers Instagram (ou une autre app), et le lien est copié
 * pour être collé dans le sticker « Lien » d'Instagram.
 */
export async function shareStory(imageUri: string, linkUrl: string) {
  await Clipboard.setStringAsync(linkUrl);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(imageUri, {
      mimeType: 'image/jpeg',
      UTI: Platform.OS === 'ios' ? 'public.jpeg' : undefined,
      dialogTitle: t('story.dialog'),
    });
  }
  try {
    new File(imageUri).delete();
  } catch {}
}
