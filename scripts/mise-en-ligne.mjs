#!/usr/bin/env node
/**
 * Mise en ligne : remplace les valeurs à compléter dans web/ et eas.json à partir de .env (ou des variables d'environnement),
 * puis liste ce qui manque encore. À relancer autant de fois que nécessaire : il ne touche qu'aux valeurs encore à compléter.
 *
 *   node scripts/mise-en-ligne.mjs          # remplace et vérifie
 *   node scripts/mise-en-ligne.mjs --check  # vérifie seulement, sans rien écrire
 *
 * Variables lues (voir .env.example) :
 *   APPLE_TEAM_ID            identifiant d'équipe Apple (developer.apple.com > Membership), 10 caractères
 *   APP_STORE_ID             identifiant numérique de l'app (App Store Connect > Informations sur l'app > Identifiant Apple)
 *   EXPO_PUBLIC_SUPABASE_URL https://<ref>.supabase.co
 *   ANDROID_SHA256           empreinte(s) SHA-256 du certificat de signature, séparées par des virgules
 *                            (eas credentials > Android, et Play Console > Intégrité de l'app > signature d'app)
 *   APP_BUNDLE_ID / APP_PACKAGE (facultatifs, par défaut app.sweetin.ios / app.sweetin.android)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

// .env, sans dépendance : CLE=valeur, commentaires ignorés ; l'environnement l'emporte
const env = {};
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const get = (k) => (process.env[k] ?? env[k] ?? '').trim();

const teamId = get('APPLE_TEAM_ID');
const appStoreId = get('APP_STORE_ID');
const supabaseUrl = get('EXPO_PUBLIC_SUPABASE_URL');
const supabaseRef = (supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) ?? [])[1] ?? '';
const sha = get('ANDROID_SHA256')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const bundle = get('APP_BUNDLE_ID') || 'app.sweetin.ios';
const pkg = get('APP_PACKAGE') || 'app.sweetin.android';

const problems = [];
const okTeam = /^[A-Z0-9]{10}$/.test(teamId);
const okStore = /^\d{6,12}$/.test(appStoreId);
const okSha = sha.length > 0 && sha.every((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
if (!okTeam) problems.push('APPLE_TEAM_ID manquant ou invalide (10 caractères, lettres et chiffres).');
if (!okStore) problems.push('APP_STORE_ID manquant (identifiant numérique App Store Connect).');
if (!supabaseRef) problems.push('EXPO_PUBLIC_SUPABASE_URL manquant (https://<ref>.supabase.co).');
if (!okSha) problems.push('ANDROID_SHA256 manquant ou invalide (AA:BB:… 32 octets ; mets la clé EAS et celle de Google Play, séparées par une virgule).');

const edits = [];
function patch(rel, fn) {
  const p = join(root, rel);
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) {
    if (!edits.includes(rel)) edits.push(rel);
    if (!check) writeFileSync(p, after);
  }
}

if (okTeam) {
  patch('web/.well-known/apple-app-site-association', (s) => s.replaceAll('TEAMID.', `${teamId}.`).replaceAll('app.sweetin.ios', bundle));
}
if (okStore) {
  for (const f of ['web/index.html', 'web/f/index.html', 'web/u/index.html']) patch(f, (s) => s.replaceAll('APP_STORE_ID', appStoreId));
  patch('eas.json', (s) => s.replace('REMPLACER_PAR_L_ID_APP_STORE_CONNECT', appStoreId));
}
if (supabaseRef) {
  for (const f of ['web/index.html', 'web/f/index.html', 'web/u/index.html'])
    patch(f, (s) => s.replaceAll('https://REF-DU-PROJET.supabase.co/functions/v1', `https://${supabaseRef}.supabase.co/functions/v1`));
}
if (okSha) {
  patch('web/.well-known/assetlinks.json', (s) => {
    const j = JSON.parse(s);
    j[0].target.package_name = pkg;
    j[0].target.sha256_cert_fingerprints = sha;
    return JSON.stringify(j, null, 2) + '\n';
  });
}

// ce qui reste à compléter, partout
const left = [];
const scan = {
  'web/.well-known/apple-app-site-association': ['TEAMID'],
  'web/.well-known/assetlinks.json': ['REMPLACER'],
  'web/index.html': ['REF-DU-PROJET'],
  'web/f/index.html': ['APP_STORE_ID', 'REF-DU-PROJET'],
  'web/u/index.html': ['APP_STORE_ID', 'REF-DU-PROJET'],
  'eas.json': ['REMPLACER_PAR'],
};
for (const [rel, keys] of Object.entries(scan)) {
  const s = check && edits.includes(rel) ? '' : readFileSync(join(root, rel), 'utf8');
  for (const k of keys) if (s.includes(k)) left.push(`${rel} : ${k}`);
}
const legal = ['conditions', 'confidentialite', 'securite-enfants', 'suppression-compte', 'en/terms', 'en/privacy', 'en/child-safety', 'en/delete-account'];
for (const page of legal) {
  const n = (readFileSync(join(root, 'web', page, 'index.html'), 'utf8').match(/class="todo"/g) ?? []).length;
  if (n) left.push(`web/${page}/ : ${n} passage(s) surligné(s) à compléter (raison sociale, hébergeur…)`);
}
for (const k of ['EAS_PROJECT_ID', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) if (!get(k)) left.push(`.env : ${k} vide`);

console.log(check ? 'Vérification (rien n’est écrit)' : 'Mise en ligne');
if (edits.length) console.log(`${check ? 'À remplacer' : 'Remplacé'} dans : ${edits.join(', ')}`);
for (const p of problems) console.log(`• ${p}`);
if (left.length) {
  console.log('\nReste à compléter :');
  for (const l of left) console.log(`  - ${l}`);
}
console.log(left.length || problems.length ? '\nPas encore prêt.' : '\nTout est rempli.');
process.exitCode = left.length || problems.length ? 1 : 0;
