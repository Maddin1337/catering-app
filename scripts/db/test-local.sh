#!/usr/bin/env bash
# Datenbanktests ohne Docker: startet ein Wegwerf-Postgres 16, bildet die nötigen Supabase-Teile
# nach, wendet alle Migrationen an und führt pgTAP aus.
#
# Voraussetzung: postgresql-16 und postgresql-16-pgtap (Paket libtap-parser-sourcehandler-pgtap-perl
# für pg_prove). Die CI nutzt stattdessen `supabase db reset && supabase test db` (docs/03 §9.3 Nr. 6).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGPORT:-54399}"
TMP="$(mktemp -d)"
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$TMP"
  chmod 755 "$ROOT" 2>/dev/null || true
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust -E UTF8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -l "$TMP/pg.log" -w \
  -o "-p $PORT -k $TMP -c listen_addresses=''" start >/dev/null

export PGHOST="$TMP" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
psql() { "${RUN[@]}" "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql -f "$ROOT/scripts/db/stubs.sql"
psql -c "create extension pgtap with schema extensions;"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Migration: $(basename "$f")"
  psql --single-transaction -f "$f"
done

[ -s "$ROOT/supabase/seed.sql" ] && psql -f "$ROOT/supabase/seed.sql"

echo "pgTAP:"
mapfile -t TESTS < <(find "$ROOT/supabase/tests" -name '*.test.sql' | sort)
"${RUN[@]}" env PGHOST="$PGHOST" PGPORT="$PGPORT" PGUSER=postgres PGDATABASE=postgres \
  pg_prove --verbose "${TESTS[@]}"
