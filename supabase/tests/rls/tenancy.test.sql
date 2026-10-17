-- Mandantentrennung im Stand von M0: Hilfsfunktionen und default deny (docs/03 §4.1, §4.2).
-- M1 ergänzt die Policies; dann kommt hier der Test „Firma A sieht Firma B nicht“ für die Tabellen selbst.
begin;
select plan(18);

-- Hinweis: Seit M1 sind die Tabellen per Policy lesbar; der Zugriffstest der Tabellen steht in
-- m1_company.test.sql. Hier bleiben die Hilfsfunktionen.

-- Fixtures (als Eigentümer, RLS gilt nicht)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test'),
  ('c0000000-0000-4000-8000-000000000001', 'carla@ohne-firma.test');

insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');

insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() - interval '1 day');

insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'kitchen', 'Bernd');

-- ---------- Anna (admin, Firma A, Abo aktiv) ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.auth_company_id(), 'a1000000-0000-4000-8000-000000000001'::uuid,
          'Anna: auth_company_id() liefert Firma A');
select is(public.auth_member_id(), 'a2000000-0000-4000-8000-000000000001'::uuid,
          'Anna: auth_member_id() liefert ihr Mitglied');
select is(public.auth_role(), 'admin'::public.member_role, 'Anna: auth_role() ist admin');
select ok(public.company_is_writable(), 'Anna: Firma A ist schreibbar');
select ok(not public.company_is_writable('b1000000-0000-4000-8000-000000000001'),
          'Anna: Firma B ist für sie nicht schreibbar (Abo abgelaufen)');
select lives_ok('select public.assert_writable()', 'Anna: assert_writable() läuft durch');
select is((select count(*)::int from public.companies), 1,
          'Anna: sieht nur die eigene Firma, nie Firma B');
select is((select count(*)::int from public.company_members), 1,
          'Anna: sieht nur Mitglieder der eigenen Firma');
select is((select count(*)::int from public.subscriptions), 1,
          'Anna: sieht nur das Abo der eigenen Firma');

-- ---------- Bernd (kitchen, Firma B, Abo abgelaufen = Lesemodus) ----------
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.auth_company_id(), 'b1000000-0000-4000-8000-000000000001'::uuid,
          'Bernd: auth_company_id() liefert Firma B, nie Firma A');
select is(public.auth_role(), 'kitchen'::public.member_role, 'Bernd: auth_role() ist kitchen');
select ok(not public.company_is_writable(), 'Bernd: Firma B ist im Lesemodus');
select throws_ok('select public.assert_writable()', 'P0001',
                 'Nur-Lesen-Modus: Änderungen sind derzeit nicht möglich',
                 'Bernd: assert_writable() bricht im Lesemodus ab');

-- ---------- Carla (Konto ohne Firma) ----------
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(public.auth_company_id(), null::uuid, 'Carla: ohne Mitgliedschaft keine Firma');
select ok(not public.company_is_writable(), 'Carla: ohne Firma nie schreibbar');

-- ---------- Entfernte Mitglieder und Firmenlöschung wirken sofort ----------
reset role;
update public.company_members set removed_at = now()
 where id = 'a2000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.auth_company_id(), null::uuid, 'Entfernte Mitglieder verlieren den Zugriff sofort');

reset role;
update public.company_members set removed_at = null where id = 'a2000000-0000-4000-8000-000000000001';
update public.companies set deletion_requested_at = now()
 where id = 'a1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.auth_company_id(), null::uuid, 'Beantragte Firmenlöschung sperrt den Zugriff sofort');

-- ---------- anon ----------
reset role;
set local role anon;
set local request.jwt.claims = '';
select throws_ok('select count(*) from public.companies', '42501', null,
                 'anon: companies nicht lesbar');

reset role;
select * from finish();
rollback;
