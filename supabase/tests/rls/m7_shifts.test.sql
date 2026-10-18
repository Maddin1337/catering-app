-- Schichtbörse: Slots, Bewerbung, Zusage, Absagefrist, Sichtbarkeit
begin;
select plan(30);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'sven@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000004', 'bea@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email, shift_cancel_deadline_hours) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test', 48),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test', 48);
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna Admin'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch Kurt'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff', 'Sven Service'),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'staff', 'Bea Bar'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bernd');
insert into public.qualifications (id, company_id, name) values
  ('9a000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Service'),
  ('9a000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Bar');
insert into public.member_qualifications (company_id, member_id, qualification_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', '9a000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', '9a000000-0000-4000-8000-000000000002');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'business', 'Müller GmbH');
insert into public.events (id, company_id, customer_id, title, starts_at, status, street, city, onsite_contact_name, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Gala', now() + interval '10 days', 'confirmed', 'Hauptstr. 1', 'Berlin', 'Frau Ansprech', 80),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Nur Anfrage', now() + interval '10 days', 'inquiry', null, null, null, 20),
  ('e1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Morgen', now() + interval '1 day', 'confirmed', 'Kurzstr. 2', 'Berlin', null, 10);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create temp table apps (name text primary key, id uuid);
grant all on apps to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($$select public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001', 'title', 'Service',
  'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 6 hours', 'seats', 2))$$,
  'P0001', 'Qualifikation fehlt', 'Ein Slot braucht genau eine Qualifikation');

insert into ids select 'service', public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001',
  'qualification_id', '9a000000-0000-4000-8000-000000000001', 'title', 'Service', 'seats', 1,
  'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 6 hours', 'meeting_point', 'Hintereingang'));
insert into ids select 'bar', public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001',
  'qualification_id', '9a000000-0000-4000-8000-000000000002', 'title', 'Bar', 'seats', 2,
  'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 6 hours'));
insert into ids select 'soon', public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000003',
  'qualification_id', '9a000000-0000-4000-8000-000000000001', 'title', 'Kurz', 'seats', 1,
  'starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 4 hours'));
select is(public.publish_slots(array[(select id from ids where name = 'service'), (select id from ids where name = 'bar'), (select id from ids where name = 'soon')]), 3,
          'Slots lassen sich veröffentlichen');
select throws_ok($$select public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001', 'qualification_id', '9a000000-0000-4000-8000-000000000001',
  'title', 'Zu viel', 'seats', 0, 'starts_at', now() + interval '10 days', 'ends_at', now() + interval '10 days 1 hour'))$$, '23514', null, 'Mindestens ein Platz');

-- Sven (Service)
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.shift_board), 2, 'Sven sieht nur Slots mit seiner Qualifikation (Service)');
select throws_ok($$select public.apply_for_slot((select id from ids where name = 'bar'))$$, 'P0001', 'Qualifikation fehlt', 'Ohne Qualifikation keine Bewerbung');
select lives_ok($$insert into apps select 'sven', id from public.apply_for_slot((select id from ids where name = 'service'), 'gern')$$, 'Sven bewirbt sich');
select throws_ok($$select public.apply_for_slot((select id from ids where name = 'service'))$$, 'P0001', 'Bewerbung existiert bereits', 'Doppelt bewerben geht nicht');
select is((select street from public.my_shifts where shift_slot_id = (select id from ids where name = 'service')), null, 'Vor der Zusage keine Adresse');
select is((select my_application_status::text from public.shift_board where shift_slot_id = (select id from ids where name = 'service')), 'applied', 'Die Börse zeigt den eigenen Status');
select is((select count(*)::int from public.events), 0, 'Staff liest keine Auftragstabelle');
select is(public.can_read_event('e1000000-0000-4000-8000-000000000001'), false, 'Nur beworben: kein Zugriff auf den Auftrag');

-- Admin sagt zu
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.decide_application((select id from apps where name = 'sven'), true)$$, 'Der Admin sagt zu');
select is((select taken_seats from public.shift_slots where id = (select id from ids where name = 'service')), 1, 'Der Platz ist belegt');

-- Bea bewirbt sich auf den vollen Slot
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.apply_for_slot((select id from ids where name = 'service'))$$, 'P0001', 'Alle Plätze sind bereits vergeben', 'Voller Slot: keine neue Bewerbung');
select lives_ok($$insert into apps select 'bea_bar', id from public.apply_for_slot((select id from ids where name = 'bar'))$$, 'Bea bewirbt sich auf die Bar');

-- Sven nach der Zusage
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select street from public.my_shifts where shift_slot_id = (select id from ids where name = 'service')), 'Hauptstr. 1', 'Nach der Zusage steht die Adresse da');
select is((select meeting_point from public.my_shifts where shift_slot_id = (select id from ids where name = 'service')), 'Hintereingang', 'Treffpunkt des Slots');
select is(public.can_read_event('e1000000-0000-4000-8000-000000000001'), true, 'Zugesagt: Zugriff auf den Auftrag');
select is(public.can_read_event('e1000000-0000-4000-8000-000000000002'), false, 'Andere Aufträge bleiben gesperrt');
select lives_ok($$select public.cancel_my_application((select id from apps where name = 'sven'), 'krank')$$, 'Vor der Frist ist die Absage möglich');

-- Absage nach der Frist (Slot „Kurz“ beginnt in 24 h, Frist 48 h)
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$insert into apps select 'sven_soon', (public.assign_member((select id from ids where name = 'soon'), 'a2000000-0000-4000-8000-000000000003')).id$$, 'Direkt einplanen');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.cancel_my_application((select id from apps where name = 'sven_soon'))$$, 'P0001', 'Absagefrist abgelaufen – bitte telefonisch absagen', 'Nach der Frist nur noch telefonisch');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.record_late_cancellation((select id from apps where name = 'sven_soon'), 'telefonisch')$$, 'Der Admin trägt die späte Absage ein');
select is((select late_cancellation from public.shift_applications where id = (select id from apps where name = 'sven_soon')), true, 'Die späte Absage ist markiert');

-- Überbuchung: ein Platz, zwei Zusagen
select lives_ok($$select public.assign_member((select id from ids where name = 'service'), 'a2000000-0000-4000-8000-000000000003')$$, 'Erste Belegung des Einzelplatz-Slots');
select throws_ok($$select public.assign_member((select id from ids where name = 'service'), 'a2000000-0000-4000-8000-000000000004')$$, 'P0001', 'Alle Plätze sind bereits vergeben', 'Zweite Belegung scheitert (Überbuchungsschutz)');
select throws_ok($$select public.assign_member((select id from ids where name = 'bar'), 'a2000000-0000-4000-8000-000000000003')$$, 'P0001', 'Mitglied hat die Qualifikation nicht', 'Ohne Qualifikation nur mit Ausnahme');
select lives_ok($$select public.assign_member((select id from ids where name = 'bar'), 'a2000000-0000-4000-8000-000000000003', true)$$, 'Mit Ausnahme geht es');

-- Rollen und Firmen
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.shift_slots), 0, 'Eine fremde Firma sieht keine Slots');
select throws_ok($$select public.cancel_slot((select id from ids where name = 'bar'))$$, 'P0001', 'Schicht nicht gefunden', 'Fremde Slots lassen sich nicht absagen');

reset role;
select * from finish();
rollback;
