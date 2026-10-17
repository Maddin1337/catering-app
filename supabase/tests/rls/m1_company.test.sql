-- M1: Firma anlegen, Mandantentrennung und Rollen auf den Tabellen (docs/03 §4.5, §7.6, §7.8)
begin;
select plan(37);

-- ---------- Fixtures (als Eigentümer) ----------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),    -- admin A
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),    -- kitchen A
  ('a0000000-0000-4000-8000-000000000003', 'aushilfe@firma-a.test'),-- staff A
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test'),   -- admin B
  ('c0000000-0000-4000-8000-000000000001', 'neu@gruender.test'),    -- ohne Firma
  ('c0000000-0000-4000-8000-000000000002', 'zweite@gruender.test'); -- ohne Firma

insert into public.companies (id, name, contact_email, vat_id) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test', 'DE123'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test', 'DE999');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'admin',   'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'staff',   'Aushilfe'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'admin',   'Bernd');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');
select private.seed_company_defaults('b1000000-0000-4000-8000-000000000001');

-- ---------- Firma anlegen (neuer Nutzer) ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.create_company('Neue Firma', 'neu@firma.test', true)$$,
  'create_company legt eine Firma an');
select is((select role from public.company_members), 'admin'::public.member_role,
          'Der Gründer ist admin der neuen Firma');
select is((select count(*)::int from public.company_members), 1, 'Es gibt genau ein Mitglied');
select is((select status from public.subscriptions), 'trialing'::public.subscription_status,
          'Das Abo startet als Testphase');
select ok((select writable_until from public.subscriptions) > now() + interval '13 days'
          and (select writable_until from public.subscriptions) < now() + interval '16 days',
          'Die Testphase dauert 14 Tage');
select is((select count(*)::int from public.tax_rates), 6, 'Sechs Steuersätze sind vorbelegt');
select is((select rate_bp from public.tax_rates where category = 'food'), 700,
          'Speisen mit 7 % (700 Basispunkte)');
select is((select count(*)::int from public.qualifications), 6, 'Sechs Qualifikationen sind vorbelegt');
select ok(public.company_is_writable(), 'Die neue Firma ist schreibbar');
select is((select avv_version from public.companies), '2026-10', 'Die AVV-Version ist gespeichert');
select throws_ok(
  $$select public.create_company('Noch eine', 'x@y.test', true)$$,
  'P0001', 'Du bist bereits Mitglied einer Firma', 'Eine zweite Firma ist gesperrt');

-- ---------- Fehlerfälle (anderer Nutzer ohne Firma) ----------
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.create_company('Ohne AVV', 'x@y.test', false)$$,
  'P0001', 'AVV muss akzeptiert werden', 'Ohne AVV keine Firma');
select throws_ok(
  $$select public.create_company('Österreich', 'x@y.test', true, 'AT')$$,
  'P0001', 'Land noch nicht verfügbar', 'AT und CH sind noch nicht freigegeben');
select throws_ok(
  $$insert into public.companies (name, contact_email) values ('Direkt', 'd@e.test')$$,
  '42501', null, 'Direktes Anlegen einer Firma ist gesperrt');

reset role;
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  $$select public.create_company('Anonym', 'x@y.test', true)$$,
  '42501', null, 'anon darf keine Firma anlegen');

-- ---------- Admin A ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.tax_rates), 6, 'admin A sieht nur die eigenen Steuersätze');
select is((select count(*)::int from public.tax_rates
            where company_id = 'b1000000-0000-4000-8000-000000000001'), 0,
          'admin A sieht nichts von Firma B');
select is((select count(*)::int from public.company_members), 3, 'admin A sieht das ganze Team');
select lives_ok(
  $$update public.companies set accent_color = '#112233'$$,
  'admin A darf die Akzentfarbe ändern');
select is((select accent_color from public.companies), '#112233', 'Die Akzentfarbe ist gespeichert');
select throws_ok(
  $$update public.companies set quote_number_seq = 99$$,
  '42501', null, 'Systemfelder (Zähler) sind nicht schreibbar');
select throws_ok(
  $$insert into public.company_members (company_id, role, display_name)
    values ('a1000000-0000-4000-8000-000000000001', 'admin', 'Eingeschleust')$$,
  '42501', null, 'Mitglieder entstehen nur über RPCs, nicht direkt');
select throws_ok(
  $$update public.company_members set role = 'admin' where display_name = 'Aushilfe'$$,
  '42501', null, 'Rollen ändern nur per RPC');
select lives_ok(
  $$update public.tax_rates set reviewed_at = now() where category = 'food'$$,
  'admin A darf Steuersätze als geprüft markieren');

-- ---------- Koch (kitchen A) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is((select count(*)::int from public.companies), 0, 'kitchen liest die Firmenbasis nicht (nur company_profile)');
select is((select count(*)::int from public.subscriptions), 0, 'kitchen sieht das Abo nicht');
select is((select count(*)::int from public.tax_rates), 0, 'kitchen sieht keine Steuersätze');
select is((select count(*)::int from public.qualifications), 6, 'kitchen liest die Qualifikationen');
select is((select count(*)::int from public.company_members), 1, 'kitchen sieht nur die eigene Zeile');
select is((select count(*)::int from public.team_directory), 3, 'kitchen liest die Teamliste (Name, Rolle, Telefon)');
select is((select count(*)::int from public.company_profile), 1, 'kitchen liest das Firmenprofil');
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'company_profile'
      and column_name in ('vat_id', 'tax_number', 'default_markup_bp', 'quote_terms_text')),
  0, 'Das Firmenprofil enthält keine Steuer-IDs und keine Kalkulationswerte');
update public.companies set name = 'Gekapert';
select is((select name from public.company_profile), 'Firma A',
          'kitchen ändert keine Firmendaten (die Zeile bleibt unverändert)');

-- ---------- Aushilfe (staff A) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.team_directory), 0, 'staff sieht die Teamliste nicht');
select is((select count(*)::int from public.qualifications), 6, 'staff liest die Qualifikationen');
select lives_ok(
  $$update public.company_members set phone = '0151 1234567' where user_id = auth.uid()$$,
  'Jedes Mitglied pflegt die eigene Telefonnummer');

-- ---------- Admin B im Lesemodus (Testphase abgelaufen) ----------
reset role;
update public.subscriptions set writable_until = now() - interval '1 day'
 where company_id = 'b1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$update public.companies set accent_color = '#000000'$$,
  '42501', null, 'Im Lesemodus ist Schreiben gesperrt');

reset role;
select * from finish();
rollback;
