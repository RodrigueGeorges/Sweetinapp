#!/usr/bin/env bash
# Rejoue toutes les migrations sur une base fraîche, puis les scénarios.
# Usage : .pg-test/run.sh
#   Local Windows : PostgreSQL portable attendu sur 127.0.0.1:55432 (user postgres).
#   CI : psql du PATH, PGHOST/PGPORT/PGUSER/PGDATABASE standard.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"

if command -v psql >/dev/null 2>&1; then
  PSQL="psql -v ON_ERROR_STOP=1 -q"
  DB=${PGDATABASE:-sweetin_test}
  HOST=${PGHOST:-127.0.0.1}
  PORT=${PGPORT:-5432}
  USER=${PGUSER:-postgres}
else
  PSQL="/c/Users/DELL/tools/pgsql/pgsql/bin/psql.exe -v ON_ERROR_STOP=1 -q"
  DB=sweetin_test
  HOST=127.0.0.1
  PORT=55432
  USER=postgres
fi

run() { $PSQL -h "$HOST" -p "$PORT" -U "$USER" "$@"; }

run -d postgres -c "drop database if exists $DB" -c "create database $DB"
run -d "$DB" -f "$HERE/00_supabase_shim.sql" >/dev/null
for f in "$HERE"/../supabase/migrations/*.sql; do
  echo "--- $(basename "$f")"
  run -d "$DB" -f "$f" 2>&1 | grep -iE "error|erreur" && exit 1 || true
done
echo "--- scénarios"
OUT=$(run -At -d "$DB" -f "$HERE/10_scenarios.sql" | grep -E "PASS|FAIL|FIN")
echo "$OUT"
echo "$OUT" | grep -q "FAIL" && { echo "ÉCHEC : des scénarios ont échoué"; exit 1; }
echo "OK : toutes les migrations et tous les scénarios passent"
