-- Angebots-Chat: Fragenkatalog, Standardkatalog, Abschluss in einer Transaktion
begin;
select plan(27);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test'),
  ('c0000000-0000-4000-8000-000000000001', 'neu@gruender.test');
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
select private.seed_intake_defaults('a1000000-0000-4000-8000-000000000001');
select private.seed_intake_defaults('b1000000-0000-4000-8000-000000000001');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ---------- Standardkatalog ----------
select is((select count(*)::int from public.intake_questions where company_id = 'a1000000-0000-4000-8000-000000000001'), 16,
          'Der Standardkatalog hat 16 Fragen');
select is((select count(*)::int from public.intake_questions where is_required and company_id = 'a1000000-0000-4000-8000-000000000001'), 4,
          'Pflicht sind Kunde, Art, Datum und Beginn');
select is((select count(*)::int from public.intake_questions q
            where q.company_id = 'a1000000-0000-4000-8000-000000000001' and q.show_if is not null
              and not exists (select 1 from public.intake_questions r
                               where r.id = (q.show_if ->> 'question_id')::uuid and r.sort_order < q.sort_order)),
          0, 'Jede Bedingung verweist auf eine frühere Frage');

-- neue Firma bekommt den Katalog
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_company('Neu GmbH', 'neu@neu.test', true)$$, 'Firma anlegen');
select is((select count(*)::int from public.intake_questions), 16, 'Eine neue Firma erhält den Standardkatalog');

-- ---------- admin pflegt den Katalog ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.intake_questions), 16, 'admin A sieht nur die eigenen Fragen');
select lives_ok($$insert into public.intake_questions (company_id, sort_order, prompt, answer_type, options)
                  values ('a1000000-0000-4000-8000-000000000001', 175, 'Wie hast du von uns gehört?', 'single_choice',
                          '[{"value":"web","label":"Internet"},{"value":"empf","label":"Empfehlung"}]')$$,
                'Eigene Frage anlegen');
select lives_ok($$update public.intake_questions set prompt = 'Wie viele Gäste kommen?' where prompt = 'Wie viele Gäste?'$$, 'Frage umformulieren');
select throws_ok($$update public.intake_questions set company_id = 'b1000000-0000-4000-8000-000000000001' where prompt = 'Wo findet es statt?'$$,
                 '42501', null, 'Die Firma einer Frage ist nicht änderbar');
select throws_ok($$delete from public.intake_questions$$, '42501', null, 'Fragen werden archiviert, nicht gelöscht');

-- ---------- Abschluss ----------
insert into ids select 'event', public.create_event_from_intake(jsonb_build_object(
  'customer', jsonb_build_object('name', 'Familie Schmidt', 'type', 'private', 'email', 'schmidt@mail.test'),
  'event', jsonb_build_object('kind', 'event_catering', 'title', 'Hochzeit Schmidt', 'occasion', 'Hochzeit',
                              'starts_at', '2026-11-14T17:00:00Z', 'ends_at', '2026-11-15T01:00:00Z', 'guest_count', 80,
                              'venue_name', 'Gutshof', 'kitchen_notes', 'Gibt es vor Ort eine Küche?: Nein'),
  'dietary', jsonb_build_array(jsonb_build_object('person_count', 12, 'diet', 'vegetarian', 'avoid_allergens', '[]'::jsonb, 'note', 'aus Anfrage')),
  'intake_answers', jsonb_build_array(jsonb_build_object('question_id', 'x', 'prompt', 'Wie viele Gäste?', 'answer', 80))));
select is((select status from public.events where id = (select id from ids where name = 'event')), 'inquiry'::public.event_status,
          'Der Chat legt eine Anfrage an');
select is((select name from public.customers where id = (select customer_id from public.events where id = (select id from ids where name = 'event'))),
          'Familie Schmidt', 'Ein neuer Kunde wird angelegt');
select is((select count(*)::int from public.event_dietary_requirements where event_id = (select id from ids where name = 'event')), 1,
          'Das Sonderessen aus dem Chat ist angelegt');
select is((select jsonb_array_length(intake_answers) from public.events where id = (select id from ids where name = 'event')), 1,
          'Die Antworten stehen am Auftrag');
select ok((select changes_until is not null from public.events where id = (select id from ids where name = 'event')),
          'Der Änderungsschluss ist aus der Firmeneinstellung vorbelegt (72 h)');
select is((select event_date from public.events where id = (select id from ids where name = 'event')), '2026-11-14'::date,
          'Das Datum steht in Berliner Ortszeit');

-- Bestehenden Kunden verwenden, bestehende Anfrage ergänzen (Notizen werden angehängt)
select lives_ok($$select public.create_event_from_intake(jsonb_build_object(
  'event_id', (select id from ids where name = 'event'),
  'customer', jsonb_build_object('id', (select customer_id from public.events where id = (select id from ids where name = 'event'))),
  'event', jsonb_build_object('kind', 'event_catering', 'title', 'Hochzeit Schmidt', 'starts_at', '2026-11-14T17:00:00Z',
                              'kitchen_notes', 'Ohne Nüsse'),
  'dietary', jsonb_build_array(jsonb_build_object('person_count', 5, 'diet', 'vegan', 'avoid_allergens', '[]'::jsonb, 'note', 'aus Anfrage'))))$$,
  'Anfrage mit dem Chat ergänzen');
select is((select kitchen_notes from public.events where id = (select id from ids where name = 'event')),
          E'Gibt es vor Ort eine Küche?: Nein\nOhne Nüsse', 'Notizen werden angehängt');
select is((select count(*)::int from public.event_dietary_requirements where event_id = (select id from ids where name = 'event')), 1,
          'Sonderessen aus dem Chat werden ersetzt, nicht verdoppelt');
select is((select count(*)::int from public.customers), 1, 'Der Kunde wird nicht doppelt angelegt');

-- alles oder nichts: zu viele Sonderessen → kein Auftrag, kein Kunde
select throws_ok($$select public.create_event_from_intake(jsonb_build_object(
  'customer', jsonb_build_object('name', 'Nie angelegt', 'type', 'private'),
  'event', jsonb_build_object('kind', 'event_catering', 'title', 'Zu viele', 'starts_at', '2026-12-01T10:00:00Z', 'guest_count', 10),
  'dietary', jsonb_build_array(jsonb_build_object('person_count', 11, 'diet', 'vegan', 'avoid_allergens', '[]'::jsonb))))$$,
  'P0001', 'Mehr Sonderessen als Gäste', 'Mehr Sonderessen als Gäste wird abgelehnt');
select is((select count(*)::int from public.customers where name = 'Nie angelegt'), 0, 'Nichts bleibt halb angelegt');

-- ---------- Standard wiederherstellen ----------
select lives_ok($$select public.reset_intake_questions()$$, 'Standard wiederherstellen');
select is((select count(*)::int from public.intake_questions where archived_at is null), 16, 'Danach gibt es wieder 16 aktive Fragen');

-- ---------- Rollen und Firmen ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.intake_questions), 0, 'kitchen sieht den Fragenkatalog nicht');
select throws_ok($$select public.create_event_from_intake('{}')$$, '42501', null, 'kitchen darf keine Anfrage erfassen');
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.intake_questions where prompt like 'Wie viele Gäste kommen%'), 0, 'admin B sieht keine Fragen von A');

reset role;
select * from finish();
rollback;
