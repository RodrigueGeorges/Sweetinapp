import { ClipOp, ImageFormat, PaintStyle, Skia, TileMode, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { LOGO_DRIPS, LOGO_VIEWBOX, LOGO_WORD } from '../components/logoPath';

const W = 1080;
const H = 1920;
const HOLO = ['#FFC8E4', '#BDEBFF', '#FFF1A8', '#D5C6FF', '#FFC8E4'];
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

/** Rectangle arrondi façon sticker : ombre dure cacao, puis la forme avec son trait. */
function sticker(canvas: Canvas, r: ReturnType<typeof Skia.XYWHRect>, radius: number, fill: string, offset = 18, stroke = 8) {
  const shadow = Skia.Paint();
  shadow.setColor(Skia.Color('#1A0A0E'));
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(r.x + offset, r.y + offset, r.width, r.height), radius, radius), shadow);
  const body = Skia.Paint();
  body.setColor(Skia.Color(fill));
  canvas.drawRRect(Skia.RRectXY(r, radius, radius), body);
  const line = Skia.Paint();
  line.setColor(Skia.Color('#1A0A0E'));
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(stroke);
  line.setAntiAlias(true);
  canvas.drawRRect(Skia.RRectXY(r, radius, radius), line);
}

/**
 * Image de story Instagram (1080 × 1920) dans la DA Sweetin 2027 :
 * fond cerise, polaroid vanille à ombre dure, photo très floutée sous la feuille holo, « gratte pour lire mon secret. ».
 * Le secret n'apparaît jamais sur l'image : il faut ouvrir le lien.
 */
export async function renderStoryImage(photoUri: string): Promise<string> {
  const surface = Skia.Surface.MakeOffscreen(W, H) ?? Skia.Surface.Make(W, H);
  if (!surface) throw new Error('surface');
  const canvas = surface.getCanvas();

  const bg = Skia.Paint();
  bg.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: H }, [Skia.Color('#FF4473'), Skia.Color('#FF2D5F'), Skia.Color('#EB1650')], [0, 0.45, 1], TileMode.Clamp));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), bg);

  const [display, bold] = await Promise.all([face('display'), face('bold')]);
  const font = (f: SkTypeface | null, size: number) => Skia.Font(f ?? undefined, size);

  // le logo « sweetin. », en vecteur (même tracé que dans l'app)
  const logo = Skia.Path.MakeFromSVGString(`${LOGO_WORD} ${LOGO_DRIPS}`);
  if (logo) {
    const lw = 460;
    const k = lw / LOGO_VIEWBOX.w;
    canvas.save();
    canvas.translate((W - lw) / 2 - LOGO_VIEWBOX.x * k, 110 - LOGO_VIEWBOX.y * k);
    canvas.scale(k, k);
    const lp = Skia.Paint();
    lp.setColor(Skia.Color('#FFFFFF'));
    canvas.drawPath(logo, lp);
    canvas.restore();
  }

  // polaroid incliné
  const cw = 720;
  const pw = cw - 48;
  const ph = (pw * 4) / 3;
  const ch = ph + 24 + 130;
  const cy = 350 + ch / 2;
  canvas.save();
  canvas.translate(W / 2, cy);
  canvas.rotate(-3, 0, 0);
  sticker(canvas, Skia.XYWHRect(-cw / 2, -ch / 2, cw, ch), 56, '#FFF4E6');

  const dst = Skia.XYWHRect(-pw / 2, -ch / 2 + 24, pw, ph);
  canvas.save();
  canvas.clipRRect(Skia.RRectXY(dst, 36, 36), ClipOp.Intersect, true);
  const photo = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(photoUri));
  if (photo) {
    const s = Math.max(pw / photo.width(), ph / photo.height());
    const sw = pw / s;
    const sh = ph / s;
    const src = Skia.XYWHRect((photo.width() - sw) / 2, (photo.height() - sh) / 2, sw, sh);
    const blur = Skia.Paint();
    blur.setImageFilter(Skia.ImageFilter.MakeBlur(56, 56, TileMode.Clamp, null));
    canvas.drawImageRect(photo, src, dst, blur);
    photo.dispose();
  }
  // la feuille holo à gratter, posée sur la photo
  const holo = Skia.Paint();
  holo.setShader(Skia.Shader.MakeLinearGradient({ x: dst.x, y: dst.y }, { x: dst.x + dst.width, y: dst.y + dst.height * 0.75 }, HOLO.map((c) => Skia.Color(c)), [0, 0.3, 0.55, 0.8, 1], TileMode.Clamp));
  holo.setAlphaf(0.72);
  canvas.drawRect(dst, holo);

  // pastille « secret » au centre de la photo
  const label = t('story.pill');
  const lf = font(bold, 54);
  const lw = lf.measureText(label).width + 96;
  sticker(canvas, Skia.XYWHRect(-lw / 2, dst.y + ph / 2 - 60, lw, 120), 60, '#1A0A0E', 10, 6);
  centered(canvas, label, dst.y + ph / 2 + 18, lf, '#FFF4E6', 0);
  canvas.restore();

  centered(canvas, t('story.strip'), ch / 2 - 42, font(display, 70), '#1A0A0E', 0);
  canvas.restore();

  const lines = t('story.title').split('\n');
  lines.forEach((line, i) => centered(canvas, line, cy + ch / 2 + 190 + i * 112, font(display, 118), '#FFF4E6'));
  centered(canvas, t('story.sub'), cy + ch / 2 + 190 + lines.length * 112 + 30, font(bold, 42), '#1A0A0E');

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
