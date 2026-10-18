-- ============================================================================
-- Welche SQL-Updates sind in dieser Datenbank schon eingespielt?
-- Nur lesend: ändert nichts und kann beliebig oft ausgeführt werden.
-- Im Supabase SQL Editor einfügen und „Run“ drücken.
-- Ergebnis: eine Zeile je Update. Spalte „stand“ zeigt OK oder FEHLT.
-- Alle Zeilen mit FEHLT der Reihe nach einspielen (Datei siehe Spalte „datei“).
-- ============================================================================
select p.nr as "nr",
       'remote-update-' || p.version || '.sql' as "datei",
       p.titel as "titel",
       case when p.ok then 'OK' else 'FEHLT' end as "stand"
from (values
  (1,  '20261021090000', 'Team und Einladungen',                  to_regclass('public.invitations') is not null),
  (2,  '20261022090000', 'Gerichte, Zutaten, Pakete',             to_regclass('public.dish_ingredients') is not null),
  (3,  '20261023090000', 'Kunden und Aufträge',                   to_regclass('public.event_dietary_requirements') is not null),
  (4,  '20261024090000', 'Angebots-Chat',                         to_regclass('public.intake_questions') is not null),
  (5,  '20261025090000', 'Angebote (Entwurf)',                    to_regclass('public.quote_items') is not null),
  (6,  '20261026090000', 'Angebot beim Kopieren mitnehmen',
        coalesce((select bool_or(p.prosrc ilike '%quote_items%') from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'copy_event'), false)),
  (7,  '20261027090000', 'Angebot versenden',                     to_regclass('public.quote_revisions') is not null),
  (8,  '20261028090000', 'Kundenportal',
        exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'quotes' and column_name = 'accepted_at')),
  (9,  '20261029090000', 'Küche: verbindlicher Stand',            to_regclass('public.kitchen_event_lines') is not null),
  (10, '20261030090000', 'Schichtbörse',                          to_regclass('public.shift_slots') is not null),
  (11, '20261031090000', 'Menüwahl im Portal',
        exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'quotes' and column_name = 'portal_selection')),
  (12, '20261101090000', 'Firmenlogo',
        coalesce((select count(*) > 0 from storage.buckets where id = 'logos'), false)),
  (13, '20261102090000', 'Sonderessen im Portal',
        exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'portal_save_dietary')),
  (14, '20261103090000', 'Korrekturen Sicherheitsprüfung',
        exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'quotes' and column_name = 'binding_revision')),
  (15, '20261104090000', 'Annahme durch das Team macht Fassung verbindlich',
        coalesce((select bool_or(p.prosrc ilike '%binding_revision%') from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'set_event_status'), false)),
  (16, '20261105090000', 'Kalender-Abo',                          to_regclass('public.calendar_tokens') is not null),
  (17, '20261106090000', 'Umsatzübersicht auf der Startseite',
        exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'revenue_overview'))
) as p(nr, version, titel, ok)
order by p.nr;
