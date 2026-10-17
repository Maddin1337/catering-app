#!/usr/bin/env bash
# Fasst alle Migrationen in EINE Datei, die sich im Supabase-Dashboard (SQL Editor) einfügen lässt.
# Ausgabe: supabase/remote-setup.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/supabase/remote-setup.sql"
{
  echo "-- ============================================================================"
  echo "-- Alle Migrationen in einer Datei, zum Einfügen in den Supabase SQL Editor."
  echo "-- Erzeugt mit: npm run db:bundle  (nicht von Hand ändern)"
  echo "-- Nur EINMAL ausführen: Die Datei legt Typen und Tabellen an und schlägt beim"
  echo "-- zweiten Lauf mit „already exists“ fehl."
  echo "-- ============================================================================"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo
    echo "-- >>>>>>>>>> $(basename "$f")"
    cat "$f"
  done
} > "$OUT"
echo "Geschrieben: $OUT ($(wc -l < "$OUT") Zeilen)"
