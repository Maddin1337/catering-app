-- copy_event kopiert das Angebot als neuen Entwurf
begin;
select plan(9);

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test');
insert into public.companies (id, name, contact_email, quote_validity_days) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test', 10);
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'business', 'Müller GmbH');
insert into public.events (id, company_id, customer_id, title, starts_at, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Lunch', now() + interval '30 days', 20),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Ohne Angebot', now() + interval '40 days', 20);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'q', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q'),
  'header', jsonb_build_object('customer_reference', 'BEST-77', 'discount_bp', 500, 'total_net_cents', 1000),
  'items', jsonb_build_array(
    jsonb_build_object('type', 'custom', 'name', 'Überschrift', 'is_heading', true),
    jsonb_build_object('type', 'custom', 'name', 'Pauschale', 'unit_price_cents', 1000, 'line_net_cents', 1000))));

select lives_ok($$select public.copy_event('e1000000-0000-4000-8000-000000000001', array[now() + interval '90 days'])$$,
                'Kopieren mit Angebot funktioniert');
select is((select count(*)::int from public.quotes), 2, 'Die Kopie hat ein eigenes Angebot');
select is((select count(*)::int from public.quotes where revision = 0 and status = 'draft'), 2, 'Das neue Angebot ist ein Entwurf mit Revision 0');
select is((select count(distinct number)::int from public.quotes), 2, 'Die Kopie bekommt eine neue Nummer');
select is((select discount_bp from public.quotes where event_id <> 'e1000000-0000-4000-8000-000000000001'), 500, 'Rabatt wird übernommen');
select is((select customer_reference from public.quotes where event_id <> 'e1000000-0000-4000-8000-000000000001'), null,
          'Die Referenz des Kunden wird nicht übernommen');
select is((select valid_until - (now() at time zone 'Europe/Berlin')::date from public.quotes
            where event_id <> 'e1000000-0000-4000-8000-000000000001'), 10, 'Die Gültigkeit beginnt neu');
select is((select count(*)::int from public.quote_items i join public.quotes q on q.id = i.quote_id
            where q.event_id <> 'e1000000-0000-4000-8000-000000000001'), 2, 'Alle Positionen werden kopiert');
select lives_ok($$select public.copy_event('e1000000-0000-4000-8000-000000000002', array[now() + interval '95 days'])$$,
                'Ein Auftrag ohne Angebot lässt sich weiter kopieren');

reset role;
select * from finish();
rollback;
