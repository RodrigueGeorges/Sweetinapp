#!/usr/bin/env bash
# Rejoue toutes les migrations sur une base fraîche, puis les scénarios.
# Usage : .pg-test/run.sh   (nécessite PostgreSQL démarré sur 127.0.0.1:55432)
set -e
PG=${PG:-/c/Users/DELL/tools/pgsql/pgsql/bin}
export PSQL="$PG/psql.exe -h 127.0.0.1 -p 55432 -U postgres -q"
$PSQL -c "drop database if exists sweetin_test" -c "create database sweetin_test"
$PSQL -v ON_ERROR_STOP=1 -d sweetin_test -f "$(dirname "$0")/00_supabase_shim.sql"
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do
  echo "--- $(basename "$f")"
  $PSQL -v ON_ERROR_STOP=1 -d sweetin_test -f "$f" 2>&1 | grep -iE "error|erreur" && exit 1 || true
done
echo "--- scénarios"
$PSQL -At -d sweetin_test -f "$(dirname "$0")/10_scenarios.sql" | grep -E "PASS|FAIL|FIN"
