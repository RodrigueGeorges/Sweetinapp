// Déploie supabase/migrations/*.sql sur le projet via l'API de management Supabase
// (POST /v1/projects/{ref}/database/query), sans mot de passe Postgres.
// Usage : SUPABASE_ACCESS_TOKEN=sbp_… PROJECT_REF=… node scripts/push-migrations.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.PROJECT_REF;
if (!TOKEN || !REF) {
  console.error('SUPABASE_ACCESS_TOKEN et PROJECT_REF requis.');
  process.exit(1);
}

const dir = new URL('../supabase/migrations', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 600)}`);
  return body;
}

// table de suivi du CLI, créée si le projet n'a jamais vu `supabase db push`
await query(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, inserted_at timestamptz not null default now());`);

const done = JSON.parse(await query(`select version from supabase_migrations.schema_migrations`)).map((r) => r.version);

for (const f of files) {
  const version = f.split('_')[0];
  if (done.includes(version)) {
    console.log(`SKIP ${f} (déjà appliquée)`);
    continue;
  }
  const sql = readFileSync(join(dir, f), 'utf8');
  try {
    await query(sql);
    await query(`insert into supabase_migrations.schema_migrations (version) values ('${version}');`);
    console.log(`OK ${f}`);
  } catch (e) {
    console.error(`FAIL ${f}: ${e.message}`);
    process.exit(1);
  }
}
console.log('\nMigrations à jour.');
