-- Angebote: Entwurf, Nummern, Positionen, Rechte
begin;
select plan(25);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email, quote_intro_text, quote_validity_days, default_markup_bp) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test', 'Vielen Dank für Ihre Anfrage.', 21, 22000),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test', null, 14, 20000);
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bernd');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'business', 'Müller GmbH'),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'private', 'Familie Schmidt'),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'private', 'Fremd');
insert into public.events (id, company_id, customer_id, title, starts_at) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Firmenfeier', now() + interval '30 days'),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'Hochzeit', now() + interval '60 days'),
  ('e1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'Fremdes Event', now() + interval '30 days');
insert into public.dishes (id, company_id, name) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Braten');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into ids select 'q1', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
insert into ids select 'q2', public.ensure_quote('e1000000-0000-4000-8000-000000000002');
select is((select number from public.quotes where id = (select id from ids where name = 'q1')),
          'A-' || extract(year from (now() at time zone 'Europe/Berlin'))::int || '-0001', 'Die erste Angebotsnummer ist A-JJJJ-0001');
select is((select number from public.quotes where id = (select id from ids where name = 'q2')),
          'A-' || extract(year from (now() at time zone 'Europe/Berlin'))::int || '-0002', 'Die Nummern zählen fortlaufend');
select is(public.ensure_quote('e1000000-0000-4000-8000-000000000001'), (select id from ids where name = 'q1'),
          'ensure_quote liefert den vorhandenen Entwurf');
select is((select price_display from public.quotes where id = (select id from ids where name = 'q1')), 'net'::public.price_basis,
          'Geschäftskunden starten mit Anzeige netto');
select is((select price_display from public.quotes where id = (select id from ids where name = 'q2')), 'gross'::public.price_basis,
          'Privatkunden starten mit Anzeige brutto');
select is((select markup_bp from public.quotes where id = (select id from ids where name = 'q1')), 22000, 'Der Aufschlag kommt aus der Firmeneinstellung');
select is((select intro_text from public.quotes where id = (select id from ids where name = 'q1')), 'Vielen Dank für Ihre Anfrage.',
          'Die Texte kommen aus der Firmeneinstellung');
select is((select valid_until - (now() at time zone 'Europe/Berlin')::date from public.quotes where id = (select id from ids where name = 'q1')),
          21, 'Die Gültigkeit kommt aus der Firmeneinstellung (21 Tage)');
select is((select status from public.quotes where id = (select id from ids where name = 'q1')), 'draft'::public.quote_status, 'Neue Angebote sind Entwürfe');

select throws_ok($$update public.quotes set number = 'X' where true$$, '42501', null, 'Die Nummer ist nicht direkt änderbar');
select throws_ok($$insert into public.quotes (company_id, event_id) values ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001')$$,
                 '42501', null, 'Angebote entstehen nur über ensure_quote');

-- Speichern
select lives_ok($$select public.save_quote(jsonb_build_object(
  'quote_id', (select id from ids where name = 'q1'),
  'header', jsonb_build_object('price_display', 'net', 'discount_bp', 500, 'customer_reference', 'KST 4711',
                               'totals', jsonb_build_object('net', 290415, 'tax', 35754, 'gross', 326169),
                               'cost_total_cents', 150000, 'cost_incomplete', false),
  'items', jsonb_build_array(
    jsonb_build_object('type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Braten', 'unit_price_cents', 1170,
                       'quantity', 20, 'unit_label', 'Portion', 'tax_rate_id', (select id from public.tax_rates where category = 'food'), 'line_net_cents', 22230),
    jsonb_build_object('type', 'service', 'name', 'Servicekräfte', 'quantity', 3, 'hours', 6.5, 'unit_price_cents', 3200),
    jsonb_build_object('type', 'custom', 'name', 'Getränke', 'is_heading', true)),
  'editor_seconds', 90))$$, 'Entwurf mit Positionen speichern');
select is((select count(*)::int from public.quote_items where quote_id = (select id from ids where name = 'q1')), 3, 'Alle Positionen sind gespeichert');
select is((select total_gross_cents from public.quotes where id = (select id from ids where name = 'q1')), 326169, 'Die Summen stehen am Angebot');
select is((select editor_active_seconds from public.quotes where id = (select id from ids where name = 'q1')), 90, 'Die Editorzeit wird summiert');
select is((select string_agg(name, ',' order by sort_order) from public.quote_items where quote_id = (select id from ids where name = 'q1')),
          'Braten,Servicekräfte,Getränke', 'Die Reihenfolge bleibt erhalten');
select lives_ok($$select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'),
  'header', '{}'::jsonb, 'items', jsonb_build_array(jsonb_build_object('type', 'custom', 'name', 'Nur eine', 'unit_price_cents', 100))))$$,
  'Erneutes Speichern ersetzt die Positionen');
select is((select count(*)::int from public.quote_items where quote_id = (select id from ids where name = 'q1')), 1, 'Es bleibt nur die neue Position');

select throws_ok($$select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('type', 'dish', 'name', 'Ohne Gericht', 'unit_price_cents', 100))))$$,
  '23514', null, 'Ein Gericht braucht seine dish_id');
select throws_ok($$select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('type', 'custom', 'name', 'Negativ', 'unit_price_cents', -5))))$$,
  '23514', null, 'Negative Preise sind nicht erlaubt (Rabatte nur über Rabattfelder)');
select throws_ok($$select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'),
  'header', jsonb_build_object('discount_bp', 500, 'discount_cents', 100), 'items', '[]'::jsonb))$$,
  '23514', null, 'Rabatt entweder in Prozent oder als Betrag');
select throws_ok($$select public.save_quote(jsonb_build_object('quote_id', gen_random_uuid(), 'header', '{}'::jsonb, 'items', '[]'::jsonb))$$,
                 'P0001', 'Angebot nicht gefunden', 'Unbekanntes Angebot');

-- Rollen und Firmen
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.quotes), 0, 'kitchen sieht keine Angebote');
select throws_ok($$select public.ensure_quote('e1000000-0000-4000-8000-000000000001')$$, '42501', null, 'kitchen darf keine Angebote anlegen');
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.ensure_quote('e1000000-0000-4000-8000-000000000001')$$, 'P0001', 'Auftrag nicht gefunden',
                 'admin B erreicht Aufträge von A nicht');

reset role;
select * from finish();
rollback;
