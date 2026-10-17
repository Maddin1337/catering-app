#!/usr/bin/env bash
# Fasst Migrationen in EINE Datei, die sich im Supabase-Dashboard (SQL Editor) einfügen lässt.
#   bundle.sh            alle Migrationen        -> supabase/remote-setup.sql
#   bundle.sh <Version>  nur Migrationen ab <Version> (z. B. 20261020090000)
#                                                -> supabase/remote-update-<Version>.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FROM="${1:-}"
if [ -n "$FROM" ]; then OUT="$ROOT/supabase/remote-update-$FROM.sql"; else OUT="$ROOT/supabase/remote-setup.sql"; fi
{
  echo "-- ============================================================================"
  if [ -n "$FROM" ]; then
    echo "-- Update: Migrationen ab $FROM, zum Einfügen in den Supabase SQL Editor."
    echo "-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind."
  else
    echo "-- Alle Migrationen in einer Datei, zum Einfügen in den Supabase SQL Editor."
  fi
  echo "-- Erzeugt mit: bash scripts/db/bundle.sh $FROM  (nicht von Hand ändern)"
  echo "-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl."
  echo "-- ============================================================================"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    v="$(basename "$f" | cut -d_ -f1)"
    if [ -z "$FROM" ] || [ "$v" -ge "$FROM" ]; then
      echo
      echo "-- >>>>>>>>>> $(basename "$f")"
      cat "$f"
    fi
  done
} > "$OUT"
echo "Geschrieben: $OUT ($(wc -l < "$OUT") Zeilen)"
