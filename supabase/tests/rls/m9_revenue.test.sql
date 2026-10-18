-- Monatsübersicht für die Startseite: nur Admin, Werte aus der gültigen Angebotsfassung
begin;
select plan(8);
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'sven@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bob@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff', 'Sven'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bob');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Kundin A'),
  ('c2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'private', 'Kundin B');

-- Aufträge im aktuellen Monat (Tag 15, Mittag) bzw. im Folgemonat
create temp table d as select (date_trunc('month', now() at time zone 'Europe/Berlin') + interval '14 days 12 hours') at time zone 'Europe/Berlin' as cur,
                              (date_trunc('month', now() at time zone 'Europe/Berlin') + interval '1 month 14 days 12 hours') at time zone 'Europe/Berlin' as nxt;
insert into public.events (id, company_id, customer_id, title, starts_at, status) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Bestätigt', (select cur from d), 'confirmed'),
  ('e1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Anfrage', (select cur from d), 'inquiry'),
  ('e1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Später', (select nxt from d), 'confirmed'),
  ('e1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Ohne Angebot', (select cur from d), 'confirmed'),
  ('e2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Fremd', (select cur from d), 'confirmed');
insert into public.events (id, company_id, customer_id, title, starts_at, status, option_expires_at) values
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Optioniert', (select cur from d), 'optioned', now() + interval '3 days');
insert into public.quotes (id, company_id, event_id, revision, binding_revision, snapshot, snapshot_hash, sent_at, sent_via) values
  ('91000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 2, 1, '{}'::jsonb, 'x', now(), 'link'),
  ('91000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 1, null, '{}'::jsonb, 'x', now(), 'link'),
  ('91000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 1, null, '{}'::jsonb, 'x', now(), 'link'),
  ('91000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000004', 1, 1, '{}'::jsonb, 'x', now(), 'link'),
  ('91000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000005', 0, null, null, null, null, null),
  ('92000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 1, 1, '{}'::jsonb, 'x', now(), 'link');
insert into public.quote_revisions (company_id, quote_id, revision, snapshot, snapshot_hash, sent_via) values
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 1, '{"totals":{"net_cents":100000}}', 'h1', 'link'),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 2, '{"totals":{"net_cents":999999}}', 'h2', 'link'),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 1, '{"totals":{"net_cents":50000}}', 'h3', 'link'),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 1, '{"totals":{"net_cents":77777}}', 'h4', 'link'),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 1, '{"totals":{"net_cents":25000}}', 'h5', 'link'),
  ('b1000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 1, '{"totals":{"net_cents":424242}}', 'h6', 'link');

create temp table res (name text primary key, j jsonb);
grant all on res to authenticated, anon;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into res select 'admin', public.revenue_overview();
select is(jsonb_array_length((select j -> 'months' from res where name = 'admin')), 6, 'Sechs Monate: zwei zurück, drei voraus');
select is((select j -> 'months' -> 2 ->> 'booked_cents' from res where name = 'admin'), '100000', 'Aktueller Monat: verbindliche Fassung zählt, nicht die neuere Revision');
select is((select j -> 'months' -> 2 ->> 'booked_count' from res where name = 'admin'), '1', 'Nur Aufträge mit Angebot und Zusage zählen');
select is((select j -> 'months' -> 2 ->> 'open_cents' from res where name = 'admin'), '50000', 'Optionierte Angebote sind offen, Anfragen zählen nicht');
select is((select j -> 'months' -> 3 ->> 'booked_cents' from res where name = 'admin'), '25000', 'Folgemonat getrennt');
select is((select (j -> 'months' -> 2 ->> 'booked_cents')::bigint + (j -> 'months' -> 3 ->> 'booked_cents')::bigint
             from res where name = 'admin'), 125000::bigint, 'Keine Daten der anderen Firma');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.revenue_overview()$$, '42501', null, 'Personal darf die Übersicht nicht lesen');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.revenue_overview()$$, '42501', null, 'anon darf die Übersicht nicht ausführen');
reset role;
select * from finish();
rollback;
