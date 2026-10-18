-- Küche: verbindlicher Stand, Positionen ohne Preise
begin;
select plan(13);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bernd');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'business', 'Müller GmbH');
insert into public.dishes (id, company_id, name) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Braten');
insert into public.events (id, company_id, customer_id, title, starts_at, status, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Mit Angebot', now() + interval '30 days', 'inquiry', 60),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Direkt bestätigt', now() + interval '31 days', 'confirmed', 20);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create temp table res (name text primary key, r jsonb);
grant all on res to authenticated, anon;

create function pg_temp.snap(p_number text, p_rev int, p_id text, p_guests int) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', p_rev,
    'quote', jsonb_build_object('number', p_number, 'price_display', 'net'),
    'event', jsonb_build_object('guest_count', p_guests),
    'items', jsonb_build_array(
      jsonb_build_object('id', p_id, 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Braten',
        'quantity', p_guests, 'unit_price_cents', 10000, 'line_net_cents', 10000, 'line_tax_cents', 700, 'line_gross_cents', 10700,
        'is_selected', true, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', 10000, 'gross_cents', 10700,
      'tax', jsonb_build_array(jsonb_build_object('rate_bp', 700, 'base_cents', 10000, 'tax_cents', 700))))
$$;
grant execute on function pg_temp.snap(text, int, text, int) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into ids select 'q1', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
insert into ids select 'q2', public.ensure_quote('e1000000-0000-4000-8000-000000000002');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001',
    'name', 'Braten', 'unit_price_cents', 10000, 'quantity', 60, 'quantity_mode', 'per_guest', 'line_net_cents', 10000, 'line_tax_cents', 700, 'line_gross_cents', 10700))));
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q2'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('id', 'f2000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001',
    'name', 'Braten', 'unit_price_cents', 10000, 'quantity', 5, 'quantity_mode', 'per_guest', 'line_net_cents', 10000, 'line_tax_cents', 700, 'line_gross_cents', 10700))));

-- Entwurf (Revision 0) bei bestätigtem Auftrag: Live-Stand, „pro Person“ folgt der Gästezahl
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select quantity from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000002'), 20::numeric,
          'Ohne versendetes Angebot zählt der Live-Stand mit der Gästezahl des Auftrags');
select is((select basis from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000002'), 'live', 'Basis: Live-Stand');

-- Versand mit 60 Gästen, dann Optionierung
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into res select 'r1', public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-000000000001', 60), 'link');
select public.set_event_status('e1000000-0000-4000-8000-000000000001', 'optioned', null, null, now() + interval '5 days');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select basis from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'), 'snapshot',
          'Versendet, aber noch nicht angenommen: vorläufig (Snapshot)');
select is((select quantity from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'), 60::numeric, 'Menge aus dem Snapshot');
select is((select guest_count from public.kitchen_events where id = 'e1000000-0000-4000-8000-000000000001'), 60, 'Die Gästezahl kommt aus dem Snapshot');

-- Kunde nimmt an; danach ändert der Admin die Gästezahl
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Müller');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
update public.events set guest_count = 95 where id = 'e1000000-0000-4000-8000-000000000001';

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select basis from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'), 'binding', 'Nach der Annahme ist der Stand verbindlich');
select is((select guest_count from public.kitchen_events where id = 'e1000000-0000-4000-8000-000000000001'), 60, 'Die Küche sieht weiter die verbindliche Gästezahl (60)');
select is((select draft_guest_count from public.kitchen_events where id = 'e1000000-0000-4000-8000-000000000001'), 95, 'Die Entwurfszahl steht daneben (95)');
select is((select has_open_change from public.kitchen_events where id = 'e1000000-0000-4000-8000-000000000001'), true, 'Die Änderung ist als offen gekennzeichnet');
select is((select quantity from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'), 60::numeric, 'Die Menge bleibt beim verbindlichen Stand');

-- keine Preise, keine fremden Firmen
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'kitchen_event_lines'
            and column_name ~ 'price|cost|net|gross|tax'), 0, 'kitchen_event_lines hat keine Preisspalte');
select is((select count(*)::int from public.quote_revisions), 0, 'Die Küche liest keine Revisionen');
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.kitchen_event_lines), 0, 'Eine fremde Firma sieht keine Zeilen');

reset role;
select * from finish();
rollback;
