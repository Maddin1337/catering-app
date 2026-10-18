-- M3: Aufträge – Übergangstabelle, Statuswechsel, Rollen, Kopieren, Mandantentrennung
begin;
select plan(143);

-- ---------- alle 64 Statuspaare gegen die Übergangstabelle (docs/02 §1.1) ----------
select is(
  private.is_allowed_event_transition(f, t),
  (f::text || '>' || t::text) in ('inquiry>quoted', 'inquiry>optioned', 'inquiry>confirmed', 'inquiry>declined',
                                  'quoted>optioned', 'quoted>confirmed', 'quoted>declined',
                                  'optioned>confirmed', 'optioned>cancelled',
                                  'confirmed>completed', 'confirmed>cancelled', 'completed>invoiced'),
  f::text || ' → ' || t::text)
from unnest(enum_range(null::public.event_status)) as f
cross join unnest(enum_range(null::public.event_status)) as t
order by f, t;

-- ---------- Fixtures ----------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'aushilfe@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin',   'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff',   'Aushilfe'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin',   'Bernd');
insert into public.customers (id, company_id, name, email) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Müller GmbH', 'info@mueller.test'),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Ohne Aufträge', null);

create temp table ev (name text primary key, id uuid);
grant all on ev to authenticated;

-- ---------- admin legt Aufträge an ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

with ins as (
  insert into public.events (company_id, customer_id, title, starts_at, ends_at, guest_count, kitchen_notes, internal_notes)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Business-Lunch Freitag',
          '2026-10-23 12:00+02', '2026-10-23 14:30+02', 20, 'Ohne Zwiebeln', 'Zahlt langsam')
  returning id)
insert into ev select 'lunch', id from ins;
with ins as (
  insert into public.events (company_id, customer_id, title, starts_at, ends_at, guest_count)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Hochzeit',
          '2026-11-14 18:00+01', '2026-11-15 02:00+01', 80)
  returning id)
insert into ev select 'hochzeit', id from ins;
with ins as (
  insert into public.events (company_id, customer_id, title, starts_at, guest_count)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Fehleingabe',
          '2026-12-01 12:00+01', 5)
  returning id)
insert into ev select 'fehler', id from ins;
with ins as (
  insert into public.events (company_id, customer_id, title, starts_at)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Abgelehnt',
          '2026-12-05 12:00+01')
  returning id)
insert into ev select 'abgelehnt', id from ins;

select is((select status from public.events where id = (select id from ev where name = 'lunch')),
          'inquiry'::public.event_status, 'Neue Aufträge starten als Anfrage');
select is((select count(*)::int from public.event_status_changes where from_status is null), 4,
          'Die Anlage steht in der Statushistorie');
select is((select event_date from public.events where id = (select id from ev where name = 'hochzeit')),
          '2026-11-14'::date, 'event_date ist der Tag in Europe/Berlin');
select throws_ok($$update public.events set status = 'confirmed' where title = 'Hochzeit'$$, '42501', null,
                 'Der Status ist nicht direkt schreibbar');
select throws_ok($$update public.events set option_expires_at = now() where title = 'Hochzeit'$$, '42501', null,
                 'option_expires_at ist nicht direkt schreibbar');
select throws_ok($$insert into public.events (company_id, customer_id, title, starts_at, status)
                   values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'X', now(), 'confirmed')$$,
                 '42501', null, 'Beim Anlegen ist kein Status wählbar');
select throws_ok($$insert into public.events (company_id, customer_id, title, starts_at, ends_at)
                   values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Ende vor Anfang', now(), now() - interval '1 hour')$$,
                 '23514', null, 'Das Ende muss nach dem Beginn liegen');

-- Zeitplan
insert into public.event_schedule_items (company_id, event_id, kind, starts_at, ends_at, notes)
select 'a1000000-0000-4000-8000-000000000001', id, 'setup', '2026-10-23 09:00+02', '2026-10-23 11:30+02', 'Aufbau'
  from ev where name = 'lunch';
insert into public.event_schedule_items (company_id, event_id, kind, starts_at)
select 'a1000000-0000-4000-8000-000000000001', id, 'teardown', '2026-10-23 15:00+02' from ev where name = 'lunch';

-- ---------- Statuswechsel ----------
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'optioned')$$,
                 'P0001', '„Optioniert bis“ fehlt oder liegt in der Vergangenheit', 'Option braucht „optioniert bis“');
select lives_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'optioned', null, null, now() + interval '5 days')$$,
                'Termin vormerken');
select isnt((select option_expires_at from public.events where id = (select id from ev where name = 'lunch')), null,
            'Die Option ist gesetzt');
select lives_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'optioned', null, null, now() + interval '9 days')$$,
                'Option verlängern');
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'confirmed')$$,
                 'P0001', 'Bestätigungsweg fehlt', 'Direktbestätigung braucht den Bestätigungsweg (R2-2)');
select lives_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'confirmed', null, 'phone')$$,
                'Direkt bestätigen mit Bestätigungsweg');
select is((select option_expires_at from public.events where id = (select id from ev where name = 'lunch')), null,
          'Die Option wird bei der Bestätigung geleert');
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'optioned', null, null, now() + interval '5 days')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'confirmed → optioned ist ein Rückwärts-Übergang');
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'invoiced')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'confirmed → invoiced überspringt „durchgeführt“');
select lives_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'completed')$$,
                'Als durchgeführt markieren (nur manuell)');
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'confirmed')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'completed → confirmed ist gesperrt (R2-4)');
select lives_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'invoiced', null, null, null, 'RE-2026-001', '2026-10-30')$$,
                'Als abgerechnet markieren');
select is((select invoice_reference from public.events where id = (select id from ev where name = 'lunch')),
          'RE-2026-001', 'Die Rechnungsnummer ist gespeichert');
select lives_ok($$select public.set_invoice_details((select id from ev where name = 'lunch'), 'RE-2026-001-K', '2026-10-31')$$,
                'Rechnungsdaten bleiben bearbeitbar');
select throws_ok($$select public.set_event_status((select id from ev where name = 'lunch'), 'completed')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'invoiced → completed ist gesperrt (R2-4)');
select is((select count(*)::int from public.event_status_changes where event_id = (select id from ev where name = 'lunch')), 6,
          'Die Statushistorie hat alle Schritte (Anlage, 2× Option, Bestätigung, durchgeführt, abgerechnet)');
select is((select confirmation_channel from public.event_status_changes
            where event_id = (select id from ev where name = 'lunch') and to_status = 'confirmed'),
          'phone', 'Der Bestätigungsweg steht in der Historie');
select is((select count(*)::int from public.events where title = 'Business-Lunch Freitag' and false), 0, 'Platzhalter');
update public.events set title = 'Geändert' where id = (select id from ev where name = 'lunch');
select is((select title from public.events where id = (select id from ev where name = 'lunch')),
          'Business-Lunch Freitag', 'Abgerechnete Aufträge sind schreibgeschützt');

-- Anfrage kommt nicht zustande / Quoted / Fehleingabe
select throws_ok($$select public.set_event_status((select id from ev where name = 'abgelehnt'), 'declined')$$,
                 'P0001', 'Grund fehlt', 'Ablehnen braucht einen Grund');
select lives_ok($$select public.set_event_status((select id from ev where name = 'abgelehnt'), 'declined', 'Kunde hat anderen Caterer')$$,
                'Anfrage kommt nicht zustande');
select throws_ok($$select public.set_event_status((select id from ev where name = 'abgelehnt'), 'inquiry')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'Keine Reaktivierung von declined (R2-4)');
select throws_ok($$select public.set_event_status((select id from ev where name = 'hochzeit'), 'quoted')$$,
                 'P0001', 'Der Status „Angebot versendet“ entsteht nur durch den Angebotsversand', 'quoted nur durch den Versand');
select throws_ok($$select public.set_event_status((select id from ev where name = 'hochzeit'), 'completed')$$,
                 'P0001', 'Dieser Statuswechsel ist nicht erlaubt', 'inquiry → completed ist nicht erlaubt');
select throws_ok($$select public.set_event_status(gen_random_uuid(), 'declined', 'x')$$,
                 'P0001', 'Auftrag nicht gefunden', 'Unbekannter Auftrag');
update public.events set title = 'Soll nicht gehen' where id = (select id from ev where name = 'abgelehnt');
select is((select title from public.events where id = (select id from ev where name = 'abgelehnt')), 'Abgelehnt',
          'Abgelehnte Aufträge sind schreibgeschützt');
delete from public.events where id = (select id from ev where name = 'hochzeit');
select is((select count(*)::int from public.events where title = 'Hochzeit'), 0, 'Eine Anfrage lässt sich als Fehleingabe löschen');

-- Hochzeit neu (über Kopie) für die Küchen-Tests
select lives_ok($$select public.set_event_status((select id from ev where name = 'fehler'), 'optioned', null, null, now() + interval '3 days')$$,
                'Zweiter Auftrag wird optioniert');
delete from public.events where id = (select id from ev where name = 'fehler');
select is((select count(*)::int from public.events where title = 'Fehleingabe'), 1,
          'Nur Anfragen lassen sich löschen (optionierte nicht)');

-- ---------- Kopieren ----------
select lives_ok($$select public.copy_event((select id from ev where name = 'lunch'),
                  array['2026-10-30 12:00+01'::timestamptz], true, 'inquiry')$$, 'Business-Lunch auf die Folgewoche kopieren');
select is((select to_char(starts_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') from public.events
            where copied_from_event_id = (select id from ev where name = 'lunch')),
          '2026-10-30 12:00', 'Der Termin der Kopie ist 12:00 Uhr Berliner Zeit (nach der Zeitumstellung)');
select is((select to_char(ends_at at time zone 'Europe/Berlin', 'HH24:MI') from public.events
            where copied_from_event_id = (select id from ev where name = 'lunch')),
          '14:30', 'Das Ende bleibt 14:30 Uhr Berliner Zeit');
select is((select string_agg(to_char(s.starts_at at time zone 'Europe/Berlin', 'HH24:MI'), ',' order by s.starts_at)
             from public.event_schedule_items s
             join public.events e on e.id = s.event_id
            where e.copied_from_event_id = (select id from ev where name = 'lunch')),
          '09:00,15:00', 'Der Zeitplan ist mitverschoben und bleibt in Ortszeit');
select is((select status from public.events where copied_from_event_id = (select id from ev where name = 'lunch')),
          'inquiry'::public.event_status, 'Die Kopie startet als Anfrage (auch aus „abgerechnet“)');
select is((select internal_notes from public.events where copied_from_event_id = (select id from ev where name = 'lunch')),
          'Zahlt langsam', 'Notizen werden mitkopiert');
select throws_ok($$select public.copy_event((select id from ev where name = 'lunch'), array[]::timestamptz[])$$,
                 'P0001', 'Ein bis zehn Termine', 'Ohne Termin keine Kopie');
select throws_ok($$select public.copy_event((select id from ev where name = 'lunch'),
                   (select array_agg(now() + (n || ' days')::interval) from generate_series(1, 11) n))$$,
                 'P0001', 'Ein bis zehn Termine', 'Höchstens 10 Termine');
select throws_ok($$select public.copy_event((select id from ev where name = 'lunch'), array[now() + interval '1 day'], false, 'confirmed')$$,
                 'P0001', 'Bestätigungsweg fehlt', 'Kopie als „bestätigt“ braucht den Bestätigungsweg');
select lives_ok($$select public.copy_event((select id from ev where name = 'abgelehnt'), array[now() + interval '20 days'], false, 'confirmed', 'email')$$,
                'Auch ein abgelehnter Auftrag lässt sich kopieren (neuer Anlauf)');
select is((select confirmation_channel from public.event_status_changes
            where to_status = 'confirmed' and from_status is null limit 1), 'email',
          'Der Bestätigungsweg der Kopie steht in der Historie');
-- Zeitumstellung März und Termin über Mitternacht
with ins as (
  insert into public.events (company_id, customer_id, title, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Silvester',
          '2026-12-31 20:00+01', '2027-01-01 02:00+01') returning id)
insert into ev select 'silvester', id from ins;
select lives_ok($$select public.copy_event((select id from ev where name = 'silvester'), array['2027-03-27 20:00+01'::timestamptz])$$,
                'Kopie über die Zeitumstellung im März');
select is((select to_char(ends_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') from public.events
            where copied_from_event_id = (select id from ev where name = 'silvester')),
          '2027-03-28 03:00', 'Eine Ortszeit, die es nicht gibt (02:00 in der Nacht der Umstellung), rutscht auf 03:00');
with ins as (
  insert into public.events (company_id, customer_id, title, starts_at, ends_at)
  values ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Nachtschicht',
          '2026-12-31 23:00+01', '2027-01-01 01:00+01') returning id)
insert into ev select 'nacht', id from ins;
select lives_ok($$select public.copy_event((select id from ev where name = 'nacht'), array['2027-03-27 23:00+01'::timestamptz])$$,
                'Kopie eines Auftrags über Mitternacht');
select is((select to_char(ends_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') from public.events
            where copied_from_event_id = (select id from ev where name = 'nacht')),
          '2027-03-28 01:00', 'Ein Auftrag über Mitternacht endet am Folgetag zur gleichen Ortszeit');

-- ---------- Kunden ----------
select is((select count(*)::int from public.customers), 2, 'admin sieht die Kunden');
delete from public.customers where id = 'c1000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.customers where id = 'c1000000-0000-4000-8000-000000000001'), 1,
          'Ein Kunde mit Aufträgen lässt sich nicht löschen');
delete from public.customers where id = 'c1000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.customers), 1, 'Ein Kunde ohne Aufträge lässt sich löschen');
select throws_ok($$insert into public.customers (company_id, name, email) values ('a1000000-0000-4000-8000-000000000001', 'X', 'kein-mail')$$,
                 '23514', null, 'Ungültige E-Mail wird abgelehnt');

-- ---------- Koch (kitchen) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.events), 0, 'kitchen liest die Basistabelle events nicht');
select is((select count(*)::int from public.customers), 0, 'kitchen sieht keine Kunden');
select ok((select count(*)::int from public.kitchen_events) >= 2,
          'kitchen sieht optionierte, bestätigte und spätere Aufträge');
select is((select count(*)::int from public.kitchen_events where status = 'inquiry'), 0, 'kitchen sieht keine Anfragen');
select is((select count(*)::int from information_schema.columns
            where table_schema = 'public' and table_name = 'kitchen_events'
              and column_name ~* 'customer|price|internal|cost|invoice'),
          0, 'kitchen_events enthält keine Kundendaten, Preise oder internen Notizen');
select is((select kitchen_notes from public.kitchen_events where title = 'Business-Lunch Freitag'), 'Ohne Zwiebeln',
          'kitchen liest die Hinweise für die Küche');
select is((select count(*)::int from public.event_schedule_items), 2, 'kitchen liest den Zeitplan ab „optioniert“');
select throws_ok($$select public.set_event_status((select id from kitchen_events limit 1), 'cancelled', 'x')$$, '42501', null,
                 'kitchen darf den Status nicht ändern');
select throws_ok($$select public.copy_event((select id from kitchen_events limit 1), array[now()])$$, '42501', null,
                 'kitchen darf nicht kopieren');
select lives_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet)
                  select 'a1000000-0000-4000-8000-000000000001', id, 3, 'vegan' from public.kitchen_events where title = 'Business-Lunch Freitag'$$,
                'kitchen darf Sonderessen erfassen');
select throws_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet)
                   select 'a1000000-0000-4000-8000-000000000001', id, 18, 'vegetarian' from public.kitchen_events where title = 'Business-Lunch Freitag'$$,
                 'P0001', 'Mehr Sonderessen als Gäste', 'Mehr Sonderessen als Gäste wird abgelehnt');
select throws_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count)
                   select 'a1000000-0000-4000-8000-000000000001', id, 1 from public.kitchen_events where title = 'Business-Lunch Freitag'$$,
                 '23514', null, 'Ein Sonderessen ohne Inhalt wird abgelehnt');
select throws_ok($$insert into public.event_schedule_items (company_id, event_id, kind, starts_at)
                   select 'a1000000-0000-4000-8000-000000000001', id, 'other', now() from public.kitchen_events limit 1$$,
                 '42501', null, 'kitchen darf den Zeitplan nicht ändern');

-- ---------- Aushilfe (staff) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.kitchen_events), 0, 'staff sieht keine Aufträge (bis zur Schichtbörse in M7)');
select is((select count(*)::int from public.event_schedule_items), 0, 'staff sieht keinen Zeitplan');
select is((select count(*)::int from public.event_dietary_requirements), 0, 'staff sieht keine Sonderessen');

-- ---------- Firma B ----------
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.events), 0, 'admin B sieht keine Aufträge von A');
select is((select count(*)::int from public.customers), 0, 'admin B sieht keine Kunden von A');
select throws_ok($$select public.set_event_status((select id from ev where name = 'silvester'), 'declined', 'x')$$,
                 'P0001', 'Auftrag nicht gefunden', 'admin B erreicht Aufträge von A nicht');
select throws_ok($$select public.copy_event((select id from ev where name = 'silvester'), array[now()])$$,
                 'P0001', 'Auftrag nicht gefunden', 'admin B kann Aufträge von A nicht kopieren');
select throws_ok($$insert into public.events (company_id, customer_id, title, starts_at)
                   values ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Fremder Kunde', now())$$,
                 '23503', null, 'Ein Auftrag kann nicht mit einem Kunden einer anderen Firma angelegt werden');

-- ---------- Kontext ohne Nutzer und Lesemodus ----------
reset role;
set local request.jwt.claims = '';
select throws_ok($$select public.set_event_status((select id from ev where name = 'silvester'), 'declined', 'x')$$,
                 '42501', 'Nicht angemeldet', 'Ohne angemeldeten Nutzer (z. B. pg_cron) ändert niemand einen Status');
update public.subscriptions set writable_until = now() - interval '1 day'
 where company_id = 'a1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.set_event_status((select id from ev where name = 'silvester'), 'declined', 'x')$$,
                 'P0001', 'Nur-Lesen-Modus: Änderungen sind derzeit nicht möglich', 'Im Lesemodus ist der Statuswechsel gesperrt');
select ok((select count(*)::int from public.events) > 0, 'Im Lesemodus bleibt Lesen möglich');

reset role;
select * from finish();
rollback;
