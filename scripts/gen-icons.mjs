/**
 * Génère tous les assets icône/splash depuis les tracés de marque de src/components/logoPath.ts
 * (source unique). Palette « Pop print » : cerise plat, encre charbon, cyan électrique, crème.
 * L'icône = l'esquimau de la marque (sticker à contour encre) sur cerise — même famille que Fondue.
 * Usage : node scripts/gen-icons.mjs
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const CERISE = '#FF2451';
const CERISE_DARK = '#FF5C7D'; // cerise du mode sombre
const CACAO = '#16141A'; // encre charbon
const VANILLE = '#FFFBF2';
const CONE = '#F2C48D';
const WHITE = '#FFFFFF';

// extraction des constantes exportées de logoPath.ts
const src = readFileSync(new URL('../src/components/logoPath.ts', import.meta.url), 'utf8');
const grab = (name) => src.match(new RegExp(`export const ${name} = '([^']+)'`))[1];
const vb = (name) => Object.fromEntries(src.match(new RegExp(`export const ${name} = \\{ x: (-?[\\d.]+), y: (-?[\\d.]+), w: ([\\d.]+), h: ([\\d.]+) \\}`)).slice(1).map((v, i) => [['x', 'y', 'w', 'h'][i], +v]));
const MARK_S = grab('MARK_S');
const MARK_DROP = grab('MARK_DROP');
const LOGO_WORD = grab('LOGO_WORD');
const LOGO_DROP = grab('LOGO_DROP');
const MV = vb('MARK_VIEWBOX');
const LV = vb('LOGO_VIEWBOX');

// L'esquimau de la marque (mêmes tracés que Fondue.tsx). viewBox -50 -85 100 170.
const POP_BODY = 'M-30,-38 C-30,-55 -26,-64 -20,-68 Q-17,-58 -13,-66 C-8,-74 -2,-75 1,-68 Q4,-60 8,-68 C16,-72 22,-64 26,-56 C29,-50 30,-44 30,-38 L30,44 Q30,54 20,54 L-20,54 Q-30,54 -30,44 Z';
const POP_STICK = 'M-9,54 L9,54 L9,72 Q9,79 0,79 Q-9,79 -9,72 Z';

/**
 * SVG du popsicle (sans fond) : `body` couleur de la glace, `face` couleur du visage, encre = contour.
 * `h` = hauteur du popsicle en % du canvas (le tracé fait 170 unités de haut).
 */
function popSvg({ size, body, face, ink = CACAO, h = 64 }) {
  const s = h / 170;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><g transform="translate(50,51) scale(${s})"><g transform="translate(0,-3)">
    <path d="${POP_STICK}" fill="${CONE}" stroke="${ink}" stroke-width="3"/>
    <path d="${POP_BODY}" fill="${body}"/>
    <path d="${POP_BODY}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"/>
    <circle cx="-11" cy="-12" r="3.6" fill="${face}"/><circle cx="11" cy="-12" r="3.6" fill="${face}"/>
    <path d="M-9,8 Q0,18 9,8" stroke="${face}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
  </g></g></svg>`;
}

/** SVG du monogramme « s. » : les paths du marque, viewBox élargi pour occuper `ratio` du canvas carré. */
function markSvg({ size, fill, ratio, dy = 0 }) {
  const w = MV.w / ratio;
  const h = w;
  const x = MV.x - (w - MV.w) / 2;
  const y = MV.y - (h - MV.h) / 2 + dy;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x} ${y} ${w} ${h}"><path fill="${fill}" d="${MARK_S}"/><path fill="${fill}" d="${MARK_DROP}"/></svg>`;
}

/** PNG carré : fond plat cerise + popsicle sticker centré (la trame reste dans l'app — l'icône doit claquer net). */
async function iconPng(file, { size = 1024, bg, body = WHITE, face = CERISE, ink = CACAO }) {
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/></svg>`;
  await sharp(Buffer.from(bgSvg)).composite([{ input: Buffer.from(popSvg({ size, body, face, ink })) }]).png().toFile(file);
  console.log('✓', file);
}

/** PNG : glyphe seul sur transparent. */
async function glyphPng(file, { size, fill, ratio, dy = 0 }) {
  await sharp(Buffer.from(markSvg({ size, fill, ratio, dy }))).png().toFile(file);
  console.log('✓', file);
}

const A = (n) => new URL(`../assets/${n}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// iOS — l'esquimau sticker sur cerise plat
await iconPng(A('icon.png'), { bg: CERISE });
await iconPng(A('icon-dark.png'), { bg: CACAO, body: CERISE_DARK, face: VANILLE, ink: VANILLE });
await glyphPng(A('icon-tinted.png'), { size: 1024, fill: WHITE, ratio: 0.58 });

// Android adaptatif — fond cerise plat + premier plan = popsicle seul sur transparent
await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${CERISE}"/></svg>`),
).png().toFile(A('android-icon-background.png'));
console.log('✓ android-icon-background.png');
await sharp(Buffer.from(popSvg({ size: 1024, body: WHITE, face: CERISE }))).png().toFile(A('android-icon-foreground.png'));
console.log('✓ android-icon-foreground.png');
await glyphPng(A('android-icon-monochrome.png'), { size: 1024, fill: WHITE, ratio: 0.55 });

// splash natif : le popsicle blanc sur cerise (continuité avec LaunchSplash)
await sharp(Buffer.from(popSvg({ size: 400, body: WHITE, face: CERISE, h: 70 }))).png().toFile(A('splash-icon.png'));
console.log('✓ splash-icon.png');
await glyphPng(A('notification-icon.png'), { size: 96, fill: WHITE, ratio: 0.9 });
await iconPng(A('favicon.png'), { size: 48, bg: CERISE });

// logo wordmark blanc (référence / usages externes)
{
  const s = 672;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${Math.round((s * LV.h) / LV.w)}" viewBox="${LV.x} ${LV.y} ${LV.w} ${LV.h}"><path fill="${WHITE}" d="${LOGO_WORD}"/><path fill="${WHITE}" d="${LOGO_DROP}"/></svg>`;
  await sharp({ create: { width: 672, height: 288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(Buffer.from(svg)).png().toBuffer(), gravity: 'center' }])
    .png()
    .toFile(A('widget-logo.png'));
  console.log('✓ widget-logo.png');
}
