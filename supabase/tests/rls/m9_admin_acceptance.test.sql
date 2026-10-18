-- Annahme durch den Admin macht die Fassung verbindlich
begin;
select plan(5);
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna');
insert into public.customers (id, company_id, type, name) values ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Familie');
insert into public.events (id, company_id, customer_id, title, starts_at, status, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Gala', now() + interval '60 days', 'inquiry', 50);
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into ids select 'q', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q'), 'header', '{}'::jsonb, 'items', jsonb_build_array(
  jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'custom', 'name', 'P', 'unit_price_cents', 100, 'line_net_cents', 100, 'line_tax_cents', 19, 'line_gross_cents', 119))));
select public.send_quote((select id from ids where name = 'q'), 0, jsonb_build_object('schema_version', 1, 'revision', 1,
  'quote', jsonb_build_object('number', (select number from public.quotes where id = (select id from ids where name = 'q'))),
  'items', jsonb_build_array(jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'is_selected', true, 'is_heading', false, 'line_net_cents', 100)),
  'totals', jsonb_build_object('net_cents', 100, 'gross_cents', 119, 'tax', jsonb_build_array(jsonb_build_object('tax_cents', 19)))), 'link');
select is((select binding_revision from public.quotes where id = (select id from ids where name = 'q')), null, 'Versendet, aber nicht angenommen: nicht verbindlich');
select lives_ok($$select public.set_event_status('e1000000-0000-4000-8000-000000000001', 'confirmed', null, 'phone')$$, 'Annahme per Telefon erfassen');
select is((select binding_revision from public.quotes where id = (select id from ids where name = 'q')), 1, 'Die Fassung ist verbindlich');
select is((select status::text from public.quotes where id = (select id from ids where name = 'q')), 'accepted', 'Das Angebot ist angenommen');
select is((select acceptance_log -> 0 ->> 'channel' from public.quotes where id = (select id from ids where name = 'q')), 'phone', 'Der Bestätigungsweg steht im Annahmeprotokoll');
reset role;
select * from finish();
rollback;
