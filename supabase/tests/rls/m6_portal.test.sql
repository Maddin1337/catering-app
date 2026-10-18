-- Kundenportal: Token, Ansehen, Annehmen, Ablehnen, Änderungswunsch
begin;
select plan(33);

insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test');
insert into public.companies (id, name, contact_email, phone, accent_color) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test', '030 123', '#1F6F5C');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna');
insert into public.customers (id, company_id, type, name) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'business', 'Müller GmbH');
insert into public.events (id, company_id, customer_id, title, starts_at, status) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Annehmen', now() + interval '30 days', 'inquiry'),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Ablehnen', now() + interval '30 days', 'inquiry'),
  ('e1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Kurzfristig', now() + interval '1 day', 'inquiry');

create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;
create temp table res (name text primary key, r jsonb);
grant all on res to anon, authenticated;

create function pg_temp.snap(p_number text, p_rev int, p_id text) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', p_rev,
    'quote', jsonb_build_object('number', p_number, 'price_display', 'net'),
    'items', jsonb_build_array(jsonb_build_object('id', p_id, 'type', 'custom', 'name', 'Pauschale',
      'unit_price_cents', 10000, 'line_net_cents', 10000, 'line_tax_cents', 1900, 'line_gross_cents', 11900,
      'is_selected', true, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', 10000, 'gross_cents', 11900,
      'tax', jsonb_build_array(jsonb_build_object('rate_bp', 1900, 'base_cents', 10000, 'tax_cents', 1900))))
$$;
grant execute on function pg_temp.snap(text, int, text) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  n int := 0;
  e text;
  q uuid;
begin
  foreach e in array array['e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003'] loop
    n := n + 1;
    q := public.ensure_quote(e::uuid);
    insert into ids values ('q' || n, q);
    perform public.save_quote(jsonb_build_object('quote_id', q, 'header', jsonb_build_object('internal', 1),
      'items', jsonb_build_array(jsonb_build_object('id', ('f' || n || '000000-0000-4000-8000-000000000001'), 'type', 'custom',
        'name', 'Pauschale', 'unit_price_cents', 10000, 'line_net_cents', 10000, 'line_tax_cents', 1900, 'line_gross_cents', 11900,
        'unit_cost', 5, 'markup_bp', 20000))));
    insert into res values ('r' || n, public.send_quote(q, 0,
      pg_temp.snap((select number from public.quotes where id = q), 1, 'f' || n || '000000-0000-4000-8000-000000000001'), 'link'));
  end loop;
end $$;

-- als Kunde ohne Anmeldung
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((public.portal_get('falsch')) ->> 'state', 'invalid', 'Ein unbekannter Token ist ungültig');
select is(public.portal_get('falsch') -> 'company', null, 'Ein unbekannter Token zeigt keine Firmendaten');
select is((public.portal_get((select r ->> 'token' from res where name = 'r1'))) ->> 'state', 'ok', 'Der gültige Token zeigt das Angebot');
select is((public.portal_get((select r ->> 'token' from res where name = 'r1'))) -> 'company' ->> 'name', 'Firma A', 'Die Firma erscheint');
select ok(not (public.portal_get((select r ->> 'token' from res where name = 'r1')))::text ~ 'unit_cost|markup_bp|cost_total|internal_notes',
          'Die Antwort enthält keine internen Felder');
select throws_ok($$select * from public.quotes$$, '42501', null, 'anon liest keine Tabellen');
select throws_ok($$select * from public.portal_tokens$$, '42501', null, 'anon liest keine Tokens');

-- Annahme
select throws_ok($$select public.portal_accept_quote('falsch', 1, 'Frau Müller')$$, 'P0001', 'Link ungültig', 'Falscher Token wird abgelehnt');
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 5, 'Frau Müller')$$,
                 'P0001', 'Das Angebot wurde aktualisiert', 'Eine veraltete Fassung wird abgelehnt');
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, ' ')$$,
                 'P0001', 'Name fehlt', 'Ohne Namen keine Annahme');
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Müller', 'kaputt')$$,
                 'P0001', 'E-Mail ungültig', 'Eine ungültige E-Mail wird abgelehnt');
select lives_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Müller', 'm@mueller.test', 'Danke')$$,
                'Die Annahme klappt');
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Müller')$$,
                 'P0001', 'Das Angebot lässt sich nicht mehr annehmen', 'Eine zweite Annahme wird abgelehnt');
select throws_ok($$select public.portal_decline_quote((select r ->> 'token' from res where name = 'r1'), 1, 'zu teuer')$$,
                 'P0001', 'Das Angebot lässt sich nicht mehr ablehnen', 'Ein angenommenes Angebot lässt sich nicht ablehnen');
select is((public.portal_get((select r ->> 'token' from res where name = 'r1'))) -> 'quote' ->> 'acceptance_name', 'Frau Müller', 'Das Portal zeigt die Annahme');

-- Ablehnen
select lives_ok($$select public.portal_decline_quote((select r ->> 'token' from res where name = 'r2'), 1, 'zu teuer', 'Leider')$$, 'Die Ablehnung klappt');
select throws_ok($$select public.portal_accept_quote((select r ->> 'token' from res where name = 'r2'), 1, 'Frau Müller')$$,
                 'P0001', 'Das Angebot lässt sich nicht mehr annehmen', 'Nach der Ablehnung gibt es keine Annahme (Endzustand)');

-- Änderungswunsch und Änderungsschluss
select lives_ok($$select public.portal_request_change((select r ->> 'token' from res where name = 'r1'), 1, 'Frau Müller', 'Wir sind 20 mehr', 90)$$,
                'Ein Änderungswunsch lässt sich senden');
select throws_ok($$select public.portal_request_change((select r ->> 'token' from res where name = 'r3'), 1, 'Frau Müller', 'Mehr Gäste', 5)$$,
                 'P0001', 'Der Änderungsschluss ist vorbei', 'Nach dem Änderungsschluss sind Änderungen gesperrt');
select is((public.portal_get((select r ->> 'token' from res where name = 'r3'))) -> 'event' ->> 'changes_locked', 'true', 'Das Portal meldet die Sperre');
select throws_ok($$select public.portal_request_change((select r ->> 'token' from res where name = 'r1'), 1, ' ', 'x')$$, 'P0001', null, 'Ohne Namen kein Wunsch');

-- Admin sieht das Ergebnis
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select status::text from public.events where id = 'e1000000-0000-4000-8000-000000000001'), 'confirmed', 'Die Annahme bestätigt den Auftrag');
select is((select status::text from public.events where id = 'e1000000-0000-4000-8000-000000000002'), 'declined', 'Die Ablehnung beendet den Auftrag (declined)');
select is((select count(*)::int from public.event_status_changes where actor_kind = 'portal'), 2, 'Die Statushistorie hält Portal-Aktionen fest');
select is((select acceptance_name from public.quotes where id = (select id from ids where name = 'q1')), 'Frau Müller', 'Die Annahme ist am Angebot gespeichert');
select is((select jsonb_array_length(acceptance_log) from public.quotes where id = (select id from ids where name = 'q1')), 1, 'Das Annahmeprotokoll hat einen Eintrag');
select is((select pending_change ->> 'guest_count' from public.quotes where id = (select id from ids where name = 'q1')), '90', 'Der Änderungswunsch liegt vor');
select isnt((select first_viewed_at from public.quotes where id = (select id from ids where name = 'q1')), null, 'Der erste Aufruf ist vermerkt');
select lives_ok($$select public.resolve_pending_change((select id from ids where name = 'q1'))$$, 'Der Wunsch lässt sich als erledigt markieren');
select is((select pending_change from public.quotes where id = (select id from ids where name = 'q1')), null, 'Danach ist kein Wunsch offen');

-- gesperrter Link
select lives_ok($$select public.revoke_portal_tokens((select id from ids where name = 'q3'))$$, 'Links lassen sich sperren');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((public.portal_get((select r ->> 'token' from res where name = 'r3'))) ->> 'state', 'revoked', 'Ein gesperrter Link zeigt „gesperrt“');
select is(public.portal_get((select r ->> 'token' from res where name = 'r3')) -> 'snapshot', null, 'Ein gesperrter Link zeigt kein Angebot');

reset role;
select * from finish();
rollback;
