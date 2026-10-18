-- Kalender-Abo
begin;
select plan(9);
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'sven@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff', 'Sven');
insert into public.qualifications (id, company_id, name) values ('9a000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Service');
insert into public.member_qualifications (company_id, member_id, qualification_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-000000000001');
insert into public.customers (id, company_id, type, name) values ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Geheime Kundin');
insert into public.events (id, company_id, customer_id, title, starts_at, status, venue_name, city) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Gala', now() + interval '10 days', 'confirmed', 'Halle 3', 'Berlin'),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Anfrage', now() + interval '11 days', 'inquiry', null, null);
create temp table res (name text primary key, t text);
grant all on res to authenticated, anon;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into res select 'admin', public.get_ical_token();
select is(public.get_ical_token(), (select t from res where name = 'admin'), 'Der Link bleibt gleich');
select isnt(public.get_ical_token(true), (select t from res where name = 'admin'), 'Zurücksetzen liefert einen neuen Link');
update res set t = public.get_ical_token() where name = 'admin';
create temp table slot (id uuid);
grant all on slot to authenticated;
insert into slot select public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001', 'qualification_id', '9a000000-0000-4000-8000-000000000001',
  'title', 'Service', 'seats', 1, 'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 5 hours'));
select public.assign_member((select id from slot), 'a2000000-0000-4000-8000-000000000003');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into res select 'staff', public.get_ical_token();
select is((select count(*)::int from public.calendar_tokens), 1, 'Jedes Mitglied liest nur den eigenen Link');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(public.ical_feed('falsch'), null, 'Ein falscher Token liefert nichts');
select is(jsonb_array_length(public.ical_feed((select t from res where name = 'admin')) -> 'entries'), 1, 'Admin: nur bestätigte und optionierte Aufträge, keine Anfragen');
select is(public.ical_feed((select t from res where name = 'admin')) -> 'entries' -> 0 ->> 'title', 'Gala', 'Der Titel des Auftrags');
select ok(position('Geheime Kundin' in public.ical_feed((select t from res where name = 'admin'))::text) = 0, 'Keine Kundendaten im Feed');
select is(public.ical_feed((select t from res where name = 'staff')) -> 'entries' -> 0 ->> 'title', 'Service · Gala', 'Personal: die eigene Schicht');
select throws_ok($$select * from public.calendar_tokens$$, '42501', null, 'anon liest keine Links');
reset role;
select * from finish();
rollback;
