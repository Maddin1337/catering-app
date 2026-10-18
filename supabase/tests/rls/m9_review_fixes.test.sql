-- Korrekturen aus der Sicherheitsprüfung
begin;
select plan(12);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'sven@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff', 'Sven');
insert into public.qualifications (id, company_id, name) values ('9a000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Service');
insert into public.member_qualifications (company_id, member_id, qualification_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-000000000001');
insert into public.customers (id, company_id, type, name) values ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Familie');
insert into public.dishes (id, company_id, name) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Klassik'),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Mediterran');
insert into public.events (id, company_id, customer_id, title, starts_at, status, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Gala', now() + interval '60 days', 'inquiry', 50),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Alt', now() + interval '60 days', 'inquiry', 10);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;
create temp table res (name text primary key, r jsonb);
grant all on res to authenticated, anon;

create function pg_temp.snap(p_number text, p_rev int, p_id1 text, p_id2 text, p_guests int, p_gross int) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', p_rev,
    'quote', jsonb_build_object('number', p_number, 'price_display', 'gross'),
    'event', jsonb_build_object('guest_count', p_guests),
    'items', jsonb_build_array(
      jsonb_build_object('id', p_id1, 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Klassik', 'quantity', p_guests, 'choice_group', 'menu',
        'line_net_cents', 1000, 'line_tax_cents', p_gross - 1000, 'line_gross_cents', p_gross, 'is_selected', true, 'is_heading', false),
      jsonb_build_object('id', p_id2, 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000002', 'name', 'Mediterran', 'quantity', p_guests, 'choice_group', 'menu',
        'line_net_cents', 0, 'line_tax_cents', 0, 'line_gross_cents', 0, 'is_selected', false, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', 1000, 'gross_cents', p_gross, 'tax', jsonb_build_array(jsonb_build_object('rate_bp', 700, 'base_cents', 1000, 'tax_cents', p_gross - 1000))))
$$;
grant execute on function pg_temp.snap(text, int, text, text, int, int) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into ids select 'q1', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', '{}'::jsonb, 'items', jsonb_build_array(
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Klassik', 'unit_price_cents', 200,
    'quantity', 50, 'choice_group', 'menu', 'is_selected', true, 'line_net_cents', 1000, 'line_tax_cents', 70, 'line_gross_cents', 1070),
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000002', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000002', 'name', 'Mediterran', 'unit_price_cents', 300,
    'quantity', 50, 'choice_group', 'menu', 'is_selected', false, 'line_net_cents', 0, 'line_tax_cents', 0, 'line_gross_cents', 0))));
insert into res select 'r1', public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 50, 1070), 'link');
select public.set_event_status('e1000000-0000-4000-8000-000000000001', 'optioned', null, null, now() + interval '5 days');
-- Entwurf wird nach dem Versand verändert (Summe 1.500 €)
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', jsonb_build_object('totals', jsonb_build_object('net', 1, 'tax', 0, 'gross', 150000)),
  'items', jsonb_build_array(jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000001', 'name', 'Klassik',
    'unit_price_cents', 99999, 'quantity', 50, 'choice_group', 'menu', 'is_selected', true, 'line_net_cents', 1, 'line_tax_cents', 0, 'line_gross_cents', 150000),
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000002', 'type', 'dish', 'dish_id', 'd1000000-0000-4000-8000-000000000002', 'name', 'Mediterran', 'unit_price_cents', 300,
    'quantity', 50, 'choice_group', 'menu', 'is_selected', false))));

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), null, 'Frau Familie')$$,
                 'P0001', 'Das Angebot wurde aktualisiert', 'Eine fehlende Fassung umgeht die Prüfung nicht');
select lives_ok($$select public.portal_select_choice((select r ->> 'token' from res where name = 'r1'), 1, 'menu', 'f1000000-0000-4000-8000-000000000002')$$, 'Menüwahl');
select lives_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Familie')$$, 'Annahme');

reset role;
select is((select acceptance_total_gross_cents from public.quotes where id = (select id from ids where name = 'q1')), 1070,
          'Die Annahme speichert die Summe der angenommenen Fassung, nicht die des Entwurfs');

-- Küche behält die Wahl, auch nachdem der Admin sie in den Entwurf übernommen hat
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.apply_portal_selection((select id from ids where name = 'q1'));
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select array_agg(dish_id::text) from public.kitchen_event_lines where event_id = 'e1000000-0000-4000-8000-000000000001'),
          array['d1000000-0000-4000-8000-000000000002'], 'Die Küche behält die angenommene Menüwahl');

-- verbindliche Fassung bleibt, auch wenn der Auftrag später abgeschlossen wird
reset role;
select is((select binding_revision from public.quotes where id = (select id from ids where name = 'q1')), 1, 'Die verbindliche Fassung steht am Angebot');
update public.events set status = 'completed' where id = 'e1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select basis from public.kitchen_events where id = 'e1000000-0000-4000-8000-000000000001'), 'binding', 'Auch abgeschlossen: weiter die verbindliche Fassung');

-- Sonderessen: Küche darf schreiben, staff mit Zusage nicht
reset role;
update public.events set status = 'confirmed' where id = 'e1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
create temp table slot (id uuid);
grant all on slot to authenticated;
insert into slot select public.save_slot(jsonb_build_object('event_id', 'e1000000-0000-4000-8000-000000000001', 'qualification_id', '9a000000-0000-4000-8000-000000000001',
  'title', 'Service', 'seats', 1, 'starts_at', now() + interval '60 days', 'ends_at', now() + interval '60 days 5 hours'));
select public.publish_slots(array[(select id from slot)]);
select public.assign_member((select id from slot), 'a2000000-0000-4000-8000-000000000003');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet) values
  ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1, 'vegan')$$, '42501', null, 'staff darf keine Sonderessen schreiben');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet) values
  ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1, 'vegan')$$, 'Die Küche darf Sonderessen schreiben');

-- späte Absage bleibt erhalten
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.record_late_cancellation((select id from public.shift_applications limit 1), 'telefonisch');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.apply_for_slot((select id from slot))$$, 'P0001', 'Bewerbung existiert bereits', 'Eine späte Absage lässt sich nicht durch erneutes Bewerben löschen');

-- Portal gesperrt und Link-Ablauf
reset role;
update public.events set portal_locked = true where id = 'e1000000-0000-4000-8000-000000000001';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), null, 1, 'vegan', '{}', null, null, null, null)$$,
                 'P0001', 'Der Änderungsschluss ist vorbei', 'portal_locked sperrt Änderungen');
reset role;
update public.events set starts_at = now() - interval '90 days' where id = 'e1000000-0000-4000-8000-000000000001';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(public.portal_get((select r ->> 'token' from res where name = 'r1')) ->> 'state', 'revoked', 'Der Link läuft nach Eventende plus 60 Tage ab');

reset role;
select * from finish();
rollback;
