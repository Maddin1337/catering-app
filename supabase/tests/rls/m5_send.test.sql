-- Angebotsversand: Revisionen, Snapshot-Prüfung, Portal-Links, Verwerfen
begin;
select plan(31);

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
insert into public.events (id, company_id, customer_id, title, starts_at, status) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Anfrage', now() + interval '30 days', 'inquiry'),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Bestätigt', now() + interval '40 days', 'confirmed'),
  ('e1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Abgelehnt', now() + interval '50 days', 'declined');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create temp table res (name text primary key, r jsonb);
grant all on res to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into ids select 'q1', public.ensure_quote('e1000000-0000-4000-8000-000000000001');
insert into ids select 'q2', public.ensure_quote('e1000000-0000-4000-8000-000000000002');
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', jsonb_build_object('total_net', 0),
  'items', jsonb_build_array(
    jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'custom', 'name', 'Pauschale', 'unit_price_cents', 10000,
                       'line_net_cents', 10000, 'line_tax_cents', 1900, 'line_gross_cents', 11900, 'markup_bp', 15000, 'unit_cost', 40.5))));
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q2'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(
    jsonb_build_object('id', 'f2000000-0000-4000-8000-000000000001', 'type', 'custom', 'name', 'Pauschale', 'unit_price_cents', 5000,
                       'line_net_cents', 5000, 'line_tax_cents', 950, 'line_gross_cents', 5950))));

-- gültiger Snapshot für q1, Revision 1
create function pg_temp.snap(p_number text, p_rev int, p_id text, p_net int, p_tax int) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', 1, 'revision', p_rev,
    'quote', jsonb_build_object('number', p_number, 'price_display', 'net', 'discount_bp', 0, 'discount_cents', 0,
                                'intro_text', 'Hallo', 'deposit', jsonb_build_object('bp', null, 'cents', null, 'due_on', null)),
    'items', jsonb_build_array(jsonb_build_object('id', p_id, 'type', 'custom', 'name', 'Pauschale', 'unit_label', 'Stück',
      'quantity', 1, 'quantity_mode', 'fixed', 'unit_price_cents', p_net, 'line_net_cents', p_net, 'line_tax_cents', p_tax,
      'line_gross_cents', p_net + p_tax, 'is_selected', true, 'is_heading', false)),
    'totals', jsonb_build_object('net_cents', p_net, 'gross_cents', p_net + p_tax,
      'tax', jsonb_build_array(jsonb_build_object('rate_bp', 1900, 'base_cents', p_net, 'tax_cents', p_tax))))
$$;
grant execute on function pg_temp.snap(text, int, text, int, int) to authenticated;

select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 1,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 2, 'f1000000-0000-4000-8000-000000000001', 10000, 1900), 'link')$$,
  'P0001', 'Das Angebot wurde inzwischen geändert', 'Eine falsche erwartete Revision wird abgelehnt');
select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap('A-0000-0000', 1, 'f1000000-0000-4000-8000-000000000001', 10000, 1900), 'link')$$,
  'P0001', 'Snapshot passt nicht zum Angebot', 'Eine fremde Angebotsnummer im Snapshot wird abgelehnt');
select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-0000000000ff', 10000, 1900), 'link')$$,
  'P0001', 'Positionen des Snapshots weichen vom Angebot ab', 'Andere Positions-IDs werden abgelehnt');
select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-000000000001', 10000, 1900) #- '{totals,tax}', 'link')$$,
  'P0001', 'Summen im Snapshot stimmen nicht', 'Falsche Steuersummen werden abgelehnt');
select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-000000000001', 10000, 1900), 'fax')$$,
  'P0001', 'Versandweg ungültig', 'Unbekannter Versandweg');
select is((select revision from public.quotes where id = (select id from ids where name = 'q1')), 0, 'Fehlgeschlagene Versuche erzeugen keine Revision');
select is((select status::text from public.events where id = 'e1000000-0000-4000-8000-000000000001'), 'inquiry', 'Fehlgeschlagene Versuche ändern den Status nicht');

insert into res select 'r1', public.send_quote((select id from ids where name = 'q1'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 1, 'f1000000-0000-4000-8000-000000000001', 10000, 1900), 'email');
select is((select (r ->> 'revision')::int from res where name = 'r1'), 1, 'Der Versand liefert Revision 1');
select is(length((select r ->> 'token' from res where name = 'r1')), 64, 'Der Portal-Token hat 64 Zeichen');
select is((select snapshot_hash from public.quotes where id = (select id from ids where name = 'q1')),
          (select r ->> 'snapshot_hash' from res where name = 'r1'), 'Der Hash steht am Angebot');
select is((select status::text from public.quotes where id = (select id from ids where name = 'q1')), 'sent', 'Das Angebot ist versendet');
select is((select status::text from public.events where id = 'e1000000-0000-4000-8000-000000000001'), 'quoted', 'Der Auftrag wechselt von inquiry zu quoted');
select is((select count(*)::int from public.event_status_changes where event_id = 'e1000000-0000-4000-8000-000000000001' and to_status = 'quoted'), 1,
          'Die Statushistorie hat den Eintrag');
select is((select count(*)::int from public.quote_revisions where quote_id = (select id from ids where name = 'q1')), 1, 'Die Revision ist gespeichert');
select throws_ok($$select * from public.portal_tokens$$, '42501', null, 'portal_tokens ist für Admins nicht direkt lesbar');
select throws_ok($$update public.quotes set revision = 5$$, '42501', null, 'Die Revision ist nicht direkt änderbar');

-- Änderung nach dem Versand, Verwerfen
select public.save_quote(jsonb_build_object('quote_id', (select id from ids where name = 'q1'), 'header', '{}'::jsonb,
  'items', jsonb_build_array(
    jsonb_build_object('id', 'f1000000-0000-4000-8000-000000000001', 'type', 'custom', 'name', 'Geändert', 'unit_price_cents', 99,
                       'markup_bp', 15000, 'unit_cost', 40.5, 'line_net_cents', 99, 'line_tax_cents', 19, 'line_gross_cents', 118))));
select is((select has_unsent_changes from public.quotes where id = (select id from ids where name = 'q1')), true, 'Eine Änderung nach dem Versand ist „nicht versendet“');
select lives_ok($$select public.discard_quote_changes((select id from ids where name = 'q1'))$$, 'Änderungen lassen sich verwerfen');
select is((select name from public.quote_items where quote_id = (select id from ids where name = 'q1')), 'Pauschale', 'Der versendete Stand ist wiederhergestellt');
select is((select unit_cost from public.quote_items where quote_id = (select id from ids where name = 'q1')), 40.5, 'Die Kalkulation der Position bleibt erhalten');
select is((select has_unsent_changes from public.quotes where id = (select id from ids where name = 'q1')), false, 'Danach gibt es keine offenen Änderungen');

-- zweite Revision
insert into res select 'r2', public.send_quote((select id from ids where name = 'q1'), 1,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q1')), 2, 'f1000000-0000-4000-8000-000000000001', 10000, 1900), 'link');
select is((select count(*)::int from public.quote_revisions where quote_id = (select id from ids where name = 'q1')), 2, 'Revision 1 bleibt abrufbar');

-- bestätigter Auftrag braucht eine Versandart; Endzustände sperren
select throws_ok($$select public.send_quote((select id from ids where name = 'q2'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q2')), 1, 'f2000000-0000-4000-8000-000000000001', 5000, 950), 'link')$$,
  'P0001', 'Versandart fehlt', 'Bei bestätigten Aufträgen ist die Versandart Pflicht');
select lives_ok($$select public.send_quote((select id from ids where name = 'q2'), 0,
  pg_temp.snap((select number from public.quotes where id = (select id from ids where name = 'q2')), 1, 'f2000000-0000-4000-8000-000000000001', 5000, 950), 'link', 'confirm_required')$$,
  'Mit Versandart geht der Versand');
select is((select status::text from public.events where id = 'e1000000-0000-4000-8000-000000000002'), 'confirmed', 'Ein bestätigter Auftrag bleibt bestätigt');
select throws_ok($$select public.ensure_quote('e1000000-0000-4000-8000-000000000003')$$, 'P0001', null, 'Für abgelehnte Aufträge gibt es kein Angebot');

-- Links
select lives_ok($$select public.issue_portal_token((select id from ids where name = 'q1'))$$, 'Ein neuer Link lässt sich ausgeben');

-- Rollen und Firmen
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.send_quote((select id from ids where name = 'q1'), 2, '{}'::jsonb, 'link')$$, '42501', null, 'kitchen darf nicht versenden');
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.issue_portal_token((select id from ids where name = 'q1'))$$, 'P0001', 'Angebot nicht gefunden', 'Fremde Firmen erreichen das Angebot nicht');

reset role;
select is((select count(*)::int from public.portal_tokens where quote_id = (select id from ids where name = 'q1')), 3,
          'Jeder Versand und jede Ausgabe legt einen Link an');
select is((select count(*)::int from public.portal_tokens where token_hash = (select r ->> 'token' from res where name = 'r1')), 0,
          'Im Klartext steht der Token nicht in der Datenbank');
select * from finish();
rollback;
