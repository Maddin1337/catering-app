-- Jede Tabelle in public hat RLS aktiv; anon hat keine Tabellenrechte (docs/03 §4.1, §9.5).
begin;
select plan(3);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0,
  'Alle Tabellen in public haben Row-Level-Security aktiv'
);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v')
      and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')),
  0,
  'anon hat keine Rechte auf Tabellen oder Views in public'
);

-- Anlegen und Löschen laufen nur über RPCs bzw. service_role (docs/03 §4.5)
select is(
  (select count(*)::int
     from pg_class c
    where c.oid in ('public.companies'::regclass, 'public.company_members'::regclass,
                    'public.subscriptions'::regclass)
      and has_table_privilege('authenticated', c.oid, 'insert,delete,truncate')),
  0,
  'authenticated darf Firmen, Mitglieder und Abos weder anlegen noch löschen'
);

select * from finish();
rollback;
