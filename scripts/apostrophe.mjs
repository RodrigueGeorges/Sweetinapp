/**
 * Insère l'apostrophe dans le wordmark « sweet'in. » : décale les sous-chemins « in » et la goutte
 * de +DX, insère le glyphe '’' extrait de SweetinDisplay.ttf (coordonnées y inversées, décalé +AX),
 * puis réécrit logoPath.ts. Usage : node scripts/apostrophe.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const fontkit = createRequire(import.meta.url)('fontkit');

const DX = 300; // décalage horizontal de « in. »
const AX = 2560; // position x de l'apostrophe (entre t et i)
const P = new URL('../src/components/logoPath.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

console.log('1 read');
const src = readFileSync(P, 'utf8');
const grab = (n) => src.match(new RegExp(`export const ${n} = '([^']+)'`))[1];
const word = grab('LOGO_WORD');
const drop = grab('LOGO_DROP');

// découpe en sous-chemins (chaque M absolu commence un glyphe)
const subs = word.split(/ (?=M)/);
const left = subs.slice(0, 6).join(' '); // s w e e t
const right = subs.slice(6).join(' '); //   i n

/** translate +dx tous les x d'un path en coordonnées absolues (M L H V Q C A Z). */
function xlate(d, dx) {
  const arity = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 };
  return d.replace(/([MLHVQCAZ])([^MLHVQCAZ]*)/g, (_, cmd, args) => {
    const n = arity[cmd];
    if (!n) return cmd;
    const nums = args.trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 0; i < nums.length; i += n) {
      for (let j = 0; j < n; j++) {
        const isX = cmd === 'H' ? true : cmd === 'V' ? false : cmd === 'A' ? j >= 5 : j % 2 === 0;
        out.push(isX ? nums[i + j] + dx : nums[i + j]);
      }
    }
    return `${cmd}${out.join(' ')}`;
  });
}

// apostrophe '’' : vrai glyphe Gabarito, y fonte → y svg (inversé), positionné en AX
console.log('2 font');
const f = fontkit.openSync('assets/fonts/SweetinDisplay.ttf');
const raw = f.glyphForCodePoint(0x2019).path.toSVG();
console.log('3 glyph', raw.length);
const flipped = raw.replace(/([MLHVQCAZ])([^MLHVQCAZ]*)/g, (_, cmd, args) => {
  const n = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 }[cmd];
  if (!n) return cmd;
  const nums = args.trim().split(/[\s,]+/).map(Number);
  const out = [];
  for (let i = 0; i < nums.length; i += n) {
    for (let j = 0; j < n; j++) {
      const isY = cmd === 'V' ? true : cmd === 'H' ? false : cmd === 'A' ? j === 6 : j % 2 === 1;
      out.push(isY ? -nums[i + j] : nums[i + j]);
    }
  }
  return `${cmd}${out.join(' ')}`;
});
console.log('4 flipped', flipped.length);
const ap = xlate(flipped, AX);
console.log('5 ap', ap.length);

const NEW_WORD = `${left} ${ap} ${xlate(right, DX)}`;
const NEW_DROP = xlate(drop, DX);

let out = src
  .replace(/export const LOGO_WORD = '[^']+'/, `export const LOGO_WORD = '${NEW_WORD}'`)
  .replace(/export const LOGO_DROP = '[^']+'/, `export const LOGO_DROP = '${NEW_DROP}'`)
  .replace(/export const LOGO_VIEWBOX = \{ x: (-?[\d.]+), y: (-?[\d.]+), w: ([\d.]+), h: ([\d.]+) \}/, (m, x, y, w, h) => `export const LOGO_VIEWBOX = { x: ${x}, y: ${y}, w: ${+w + DX}, h: ${h} }`)
  .replace(/générée depuis Gabarito Black/, 'générée depuis Gabarito Black (apostrophe ’ insérée par scripts/apostrophe.mjs)');
writeFileSync(P, out);
console.log('LOGO_WORD :', NEW_WORD.length, 'chars · 10 sous-chemins · viewbox w +', DX);
