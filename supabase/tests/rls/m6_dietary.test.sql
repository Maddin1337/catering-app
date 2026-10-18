-- Sonderessen im Portal
begin;
select plan(12);

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna');
insert into public.customers (id, company_id, type, name) values ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'private', 'Familie');
insert into public.events (id, company_id, customer_id, title, starts_at, status, guest_count) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Hochzeit', now() + interval '60 days', 'inquiry', 10),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Kurzfristig', now() + interval '1 day', 'inquiry', 10);
insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, source, guest_name) values
  ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1, 'halal', 'internal', 'Intern Name');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;
create temp table res (name text primary key, r jsonb);
grant all on res to authenticated, anon;

create function pg_temp.snap(p_number text, p_id text) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', 1, 'quote', jsonb_build_object('number', p_number, 'price_display', 'net'),
    'items', jsonb_build_array(jsonb_build_object('id', p_id, 'type', 'custom', 'name', 'P', 'line_net_cents', 100, 'line_tax_cents', 19, 'line_gross_cents', 119, 'is_selected', true, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', 100, 'gross_cents', 119, 'tax', jsonb_build_array(jsonb_build_object('rate_bp', 1900, 'base_cents', 100, 'tax_cents', 19))))
$$;
grant execute on function pg_temp.snap(text, text) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  n int := 0; e text; q uuid;
begin
  foreach e in array array['e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002'] loop
    n := n + 1;
    q := public.ensure_quote(e::uuid);
    perform public.save_quote(jsonb_build_object('quote_id', q, 'header', '{}'::jsonb, 'items', jsonb_build_array(
      jsonb_build_object('id', 'f' || n || '000000-0000-4000-8000-000000000001', 'type', 'custom', 'name', 'P', 'unit_price_cents', 100,
        'line_net_cents', 100, 'line_tax_cents', 19, 'line_gross_cents', 119))));
    insert into res values ('r' || n, public.send_quote(q, 0, pg_temp.snap((select number from public.quotes where id = q), 'f' || n || '000000-0000-4000-8000-000000000001'), 'link'));
  end loop;
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(jsonb_array_length(public.portal_get((select r ->> 'token' from res where name = 'r1')) -> 'dietary'), 0,
          'Interne Sonderessen erscheinen nicht im Portal');
select lives_ok($$insert into ids select 'd1', public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), null, 2, 'vegan', '{}', null, 'Tante Erna', 'Tisch 3', 'Frau Familie')$$,
                'Der Kunde trägt ein Sonderessen ein');
select lives_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), null, 1, null, array['gluten']::public.allergen[], 'Zöliakie', null, null, 'Frau Familie')$$,
                'Ein Allergiker ohne Diätform ist möglich');
select is(jsonb_array_length(public.portal_get((select r ->> 'token' from res where name = 'r1')) -> 'dietary'), 2, 'Das Portal zeigt die eigenen zwei Einträge');
select throws_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), null, 9, 'vegan', '{}', null, null, null, null)$$,
                 'P0001', 'Mehr Sonderessen als Gäste', 'Mehr Sonderessen als Gäste geht nicht');
select throws_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), null, 1, null, '{}', null, null, null, null)$$,
                 'P0001', 'Bitte Diätform, Allergen oder Hinweis angeben', 'Ein leerer Eintrag wird abgelehnt');
select lives_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r1'), (select id from ids where name = 'd1'), 3, 'vegan', '{}', 'ändern', null, null, null)$$,
                'Der Kunde ändert seinen Eintrag');
select lives_ok($$select public.portal_delete_dietary((select r ->> 'token' from res where name = 'r1'), (select id from ids where name = 'd1'))$$, 'Der Kunde löscht seinen Eintrag');
select throws_ok($$select public.portal_save_dietary((select r ->> 'token' from res where name = 'r2'), null, 1, 'vegan', '{}', null, null, null, null)$$,
                 'P0001', 'Der Änderungsschluss ist vorbei', 'Nach dem Änderungsschluss gesperrt');
select throws_ok($$select public.portal_save_dietary('falsch', null, 1, 'vegan', '{}', null, null, null, null)$$, 'P0001', 'Link ungültig', 'Falscher Token');

reset role;
select is((select count(*)::int from public.event_dietary_requirements where event_id = 'e1000000-0000-4000-8000-000000000001' and source = 'internal'), 1,
          'Der interne Eintrag bleibt unberührt');
select is((select portal_author_name from public.event_dietary_requirements where note = 'Zöliakie'), 'Frau Familie', 'Der Name des Kunden ist am Eintrag vermerkt');
select * from finish();
rollback;
