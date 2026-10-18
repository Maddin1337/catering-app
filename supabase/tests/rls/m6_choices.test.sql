-- Menüwahl im Portal: Wahlgruppen, Annahmeprotokoll, Übernahme, Küche
begin;
select plan(13);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch');
insert into public.customers (id, company_id, type, name) values ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Familie');
insert into public.dishes (id, company_id, name) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Klassik'),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Mediterran');
insert into public.events (id, company_id, customer_id, title, starts_at, status, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Hochzeit', now() + interval '60 days', 'inquiry', 50);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create temp table res (name text primary key, r jsonb);
grant all on res to authenticated, anon;

create function pg_temp.snap(p_number text, p_rev int) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', p_rev,
    'quote', jsonb_build_object('number', p_number, 'price_display', 'gross'),
    'event', jsonb_build_object('guest_count', 50),
    'items', jsonb_build_array(
      jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Klassik',
        'quantity', 50, 'choice_group', 'menu', 'line_net_cents', 10000, 'line_tax_cents', 700, 'line_gross_cents', 10700, 'is_selected', true, 'is_heading', false),
      jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000002', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000002', 'name', 'Mediterran',
        'quantity', 50, 'choice_group', 'menu', 'line_net_cents', 0, 'line_tax_cents', 0, 'line_gross_cents', 0, 'is_selected', false, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', 10000, 'gross_cents', 10700,
      'tax', jsonb_build_array(jsonb_build_object('rate_bp', 700, 'base_cents', 10000, 'tax_cents', 700))))
$$;
grant execute on function pg_temp.snap(text, int) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into ids select 'q', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q'), 'header', '{}'::jsonb, 'items', jsonb_build_array(
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Klassik',
    'unit_price_cents', 200, 'quantity', 50, 'choice_group', 'menu', 'is_selected', true, 'line_net_cents', 10000, 'line_tax_cents', 700, 'line_gross_cents', 10700),
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000002', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000002', 'name', 'Mediterran',
    'unit_price_cents', 300, 'quantity', 50, 'choice_group', 'menu', 'is_selected', false, 'line_net_cents', 0, 'line_tax_cents', 0, 'line_gross_cents', 0))));
insert into res select 'r1', public.send_quote((select id from ids where name = 'q'), 0, pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q')), 1), 'link');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(public.portal_get((select r ->> 'token' from res where name = 'r1')) -> 'selection', '{}'::jsonb, 'Ohne Wahl ist die Auswahl leer');
select throws_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 1, 'menu', 'f1000000-0000-4000-8000-0000000000ff')$$,
                 'P0001', 'Ungültige Auswahl', 'Ein fremdes Element ist keine gültige Wahl');
select throws_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 1, 'andere', 'f1000000-0000-4000-8000-000000000002')$$,
                 'P0001', 'Ungültige Auswahl', 'Das Element muss zur Wahlgruppe passen');
select throws_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 3, 'menu', 'f1000000-0000-4000-8000-000000000002')$$,
                 'P0001', 'Das Angebot wurde aktualisiert', 'Eine veraltete Fassung wird abgelehnt');
select lives_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 1, 'menu', 'f1000000-0000-4000-8000-000000000002')$$, 'Die Wahl klappt');
select is(public.portal_get((select r ->> 'token' from res where name = 'r1')) -> 'selection' ->> 'menu', 'f1000000-0000-4000-8000-000000000002', 'Das Portal zeigt die Wahl');

-- Küche: vorläufig mit Wahl des Kunden
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.set_event_status('e1000000-0000-4000-8000-000000000001', 'optioned', null, null, now() + interval '5 days');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select array_agg(dish_id::text) from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'),
          array['d1000000-0000-4000-8000-000000000002'], 'Die Küche sieht die gewählte Alternative');

-- Annahme
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select lives_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Familie')$$, 'Annahme mit Wahl');
select throws_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 1, 'menu', 'f1000000-0000-4000-8000-000000000001')$$,
                 'P0001', 'Die Auswahl lässt sich nicht mehr ändern', 'Nach der Annahme ist die Wahl fest');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select acceptance_log -> 0 -> 'selection' ->> 'menu' from public.quotes where id = (select id from ids where name = 'q')),
          'f1000000-0000-4000-8000-000000000002', 'Das Annahmeprotokoll enthält die Wahl');
select is(public.apply_portal_selection((select id from ids where name = 'q')), 1, 'Die Wahl wird in den Entwurf übernommen');
select is((select name from public.quote_items where quote_id = (select id from ids where name = 'q') and is_selected), 'Mediterran', 'Im Entwurf ist die gewählte Alternative aktiv');
select is((select portal_selection from public.quotes where id = (select id from ids where name = 'q')), null, 'Danach ist die Wahl zurückgesetzt');

reset role;
select * from finish();
rollback;
