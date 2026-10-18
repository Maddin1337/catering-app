-- Benachrichtigungen: richtige Empfänger, nie der Auslöser, nur eigene lesbar, gelesen markieren
begin;
select plan(16);
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'karl@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'sven@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000004', 'lena@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bob@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Karl'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff', 'Sven'),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'staff', 'Lena'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bob');
insert into public.qualifications (id, company_id, name) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Service');
-- Sven hat die Qualifikation, Lena nicht
insert into public.member_qualifications (company_id, member_id, qualification_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Kundin A');
insert into public.events (id, company_id, customer_id, title, starts_at, status, option_expires_at) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Sommerfest', now() + interval '10 days', 'optioned', now() + interval '5 days');
insert into public.shift_slots (id, company_id, event_id, qualification_id, title, starts_at, ends_at, seats) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000001', 'Service', now() + interval '10 days', now() + interval '10 days 6 hours', 2);

create temp table n as select * from public.notifications where false;
grant all on n to authenticated;
create temp table v (k text primary key, val text);
grant all on v to authenticated;
set local role authenticated;

-- Admin veröffentlicht: nur Sven (passende Qualifikation) erfährt davon, Anna nicht (Auslöserin)
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.publish_slots(array['a4000000-0000-4000-8000-000000000001']::uuid[]);
reset role;
select is((select count(*)::int from public.notifications where kind = 'shift_new'), 1, 'Neue Schicht: genau eine Meldung');
select is((select member_id::text from public.notifications where kind = 'shift_new'),
  'a2000000-0000-4000-8000-000000000003', 'Neue Schicht geht nur an Mitarbeitende mit passender Qualifikation');

-- Sven bewirbt sich: Anna (Admin) bekommt die Meldung, Sven nicht
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into v select 'app', (public.apply_for_slot('a4000000-0000-4000-8000-000000000001', 'gern')).id::text;
reset role;
select is((select array_agg(member_id::text) from public.notifications where kind = 'application_new'),
  array['a2000000-0000-4000-8000-000000000001'], 'Neue Bewerbung geht an die Admins, nicht an Küche oder Bewerber');
select is((select payload ->> 'member_name' from public.notifications where kind = 'application_new'), 'Sven',
  'Meldung nennt den Namen');

-- Anna sagt zu: Sven bekommt „Zusage“
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.decide_application((select val::uuid from v where k = 'app'), true);
reset role;
select is((select member_id::text from public.notifications where kind = 'shift_confirmed'),
  'a2000000-0000-4000-8000-000000000003', 'Zusage geht an das Mitglied');
select is((select payload ? 'event_title' from public.notifications where kind = 'shift_confirmed'), false,
  'Meldung an das Personal enthält keinen Auftragstitel');

-- Sven liest nur seine eigenen Meldungen
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.notifications), 2, 'Mitglied sieht nur eigene Meldungen');
select is(public.mark_notifications_read(null), 2, 'Alle eigenen als gelesen markiert');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'Danach nichts ungelesen');
select throws_ok($$update public.notifications set read_at = null$$, '42501', null, 'Kein direktes Ändern');
reset role;
select is((select count(*)::int from public.notifications where read_at is null and member_id = 'a2000000-0000-4000-8000-000000000001'), 1,
  'Meldungen anderer bleiben ungelesen');

-- Kunde nimmt im Portal an (kein angemeldetes Mitglied): alle Admins der Firma
insert into public.quotes (id, company_id, event_id, revision, snapshot, snapshot_hash, sent_at, sent_via) values
  ('91000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1, '{}'::jsonb, 'x', now(), 'link');
set local request.jwt.claims = '{"role":"anon"}';
update public.quotes set accepted_at = now(), acceptance_revision = 1 where id = '91000000-0000-4000-8000-000000000001';
select is((select array_agg(member_id::text) from public.notifications where kind = 'quote_accepted'),
  array['a2000000-0000-4000-8000-000000000001'], 'Annahme im Portal geht an die Admins');
select is((select payload ->> 'customer_name' from public.notifications where kind = 'quote_accepted'), 'Kundin A',
  'Annahme nennt den Kunden');

-- Sonderessen vom Kunden: Admin und Küche, ohne Gesundheitsdaten
insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, source, guest_name)
values ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 2, 'vegan', 'customer', 'Frau X');
select is((select count(*)::int from public.notifications where kind = 'dietary_added'), 2, 'Sonderessen: Admin und Küche');
select is((select bool_or(payload::text ilike '%Frau X%' or payload::text ilike '%vegan%') from public.notifications where kind = 'dietary_added'),
  false, 'Keine Namen oder Diätformen in der Meldung');
select is((select count(*)::int from public.notifications where company_id = 'b1000000-0000-4000-8000-000000000001'), 0,
  'Keine Meldungen bei der anderen Firma');
select * from finish();
rollback;
