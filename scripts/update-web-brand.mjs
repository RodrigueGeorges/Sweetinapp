/**
 * Rebrand « Sweet’in » côté web/ : remplace les mentions texte et régénère les wordmark SVG
 * embarqués (viewBox + tracés) depuis src/components/logoPath.ts. Usage : node scripts/update-web-brand.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const src = readFileSync(join(root, 'src/components/logoPath.ts'), 'utf8');
const grab = (n) => src.match(new RegExp(`export const ${n} = '([^']+)'`))[1];
const WORD = grab('LOGO_WORD');
const DROP = grab('LOGO_DROP');
const VB = src.match(/export const LOGO_VIEWBOX = \{ x: (-?[\d.]+), y: (-?[\d.]+), w: ([\d.]+), h: ([\d.]+) \}/);
const VB_STR = `${VB[1]} ${VB[2]} ${VB[3]} ${VB[4]}`;

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

let touched = 0;
for (const f of htmlFiles(join(root, 'web'))) {
  let h = readFileSync(f, 'utf8');
  const before = h;
  // mentions de marque (le domaine sweetin.app ne change pas)
  h = h.replace(/Sweetin(?!\.app)/g, 'Sweet’in').replace(/sweetin(?!\.|\.app|\.)/g, 'sweet’in');
  // wordmark : viewBox puis les paths « mot » (commence par M239) et « goutte » (commence par M3503)
  h = h.replace(/viewBox="19 -750 3579 750"/g, `viewBox="${VB_STR}"`);
  h = h.replace(/d="M239 [^"]+"/g, `d="${WORD}"`);
  h = h.replace(/d="M3503\.0,-280\.2 [^"]+"/g, `d="${DROP}"`);
  // label d'accessibilité du logo
  h = h.replace(/aria-label="Sweetin"/g, 'aria-label="Sweet’in"');
  if (h !== before) {
    writeFileSync(f, h);
    console.log('✓', f.replace(root, ''));
    touched++;
  }
}
console.log(touched, 'fichiers web mis à jour');
