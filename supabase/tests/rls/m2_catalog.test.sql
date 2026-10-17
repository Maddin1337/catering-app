-- M2: Katalog – Mandantentrennung, Preise vor der Küche, Prüfstatus der Allergene, Pakete
begin;
select plan(43);

-- ---------- Fixtures (als Eigentümer) ----------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000003', 'aushilfe@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin',   'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'staff',   'Aushilfe'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin',   'Bernd');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');
select private.seed_company_defaults('b1000000-0000-4000-8000-000000000001');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ---------- admin legt Zutaten, Gericht und Paket an ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into ids select 'rind', public.save_ingredient('{"name":"Rinderschulter","unit":"g","price_cents":1490,"product_group":"Fleisch"}');
insert into ids select 'ei',   public.save_ingredient('{"name":"Eier","unit":"piece","price_cents":30}');
select is((select price_cents from public.ingredients where id = (select id from ids where name = 'rind')),
          1490, 'admin speichert den Einkaufspreis einer Zutat');

insert into ids select 'braten', public.save_dish(jsonb_build_object(
  'name', 'Rinderschmorbraten', 'category', 'main', 'diets', '[]'::jsonb,
  'allergens', '["celery","sulphites"]'::jsonb, 'allergens_confirmed', true,
  'price_cents', 1170, 'markup_bp', 22000,
  'ingredients', jsonb_build_array(jsonb_build_object(
      'ingredient_id', (select id from ids where name = 'rind'), 'quantity_per_person', 180))));
select is((select price_cents from public.dishes where id = (select id from ids where name = 'braten')), 1170,
          'admin speichert den Preis des Gerichts');
select is((select count(*)::int from public.dish_allergens), 2, 'Allergene sind gespeichert');
select isnt((select allergens_reviewed_at from public.dishes where id = (select id from ids where name = 'braten')),
            null, 'Bestätigung setzt den Prüfstatus');
select is((select quantity_per_person from public.dish_ingredients), 180.00::numeric, 'Zutatenmenge pro Person gespeichert');

insert into ids select 'gemuese', public.save_dish('{"name":"Ofengemüse","category":"side","diets":["vegan"],"allergens":[]}');
select is((select diets from public.dishes where id = (select id from ids where name = 'gemuese')),
          array['vegan','vegetarian']::public.diet_type[], 'vegan schließt vegetarisch automatisch ein');
select is((select allergens_reviewed_at from public.dishes where id = (select id from ids where name = 'gemuese')),
          null, 'Ohne Bestätigung bleibt das Gericht ungeprüft');

-- Allergene ändern ohne Bestätigung setzt den Prüfstatus zurück
select lives_ok($$select public.save_dish(jsonb_build_object('id', (select id from ids where name = 'braten'),
                  'allergens', '["celery","sulphites","mustard"]'::jsonb))$$, 'Allergene ändern');
select is((select allergens_reviewed_at from public.dishes where id = (select id from ids where name = 'braten')),
          null, 'Geänderte Allergene setzen den Prüfstatus zurück');
-- unveränderte Allergene lassen ihn stehen
select lives_ok($$select public.save_dish(jsonb_build_object('id', (select id from ids where name = 'braten'),
                  'allergens_confirmed', true))$$, 'Bestätigen ohne Änderung');
select lives_ok($$select public.save_dish(jsonb_build_object('id', (select id from ids where name = 'braten'),
                  'description', 'Zart geschmort', 'allergens', '["celery","sulphites","mustard"]'::jsonb))$$,
                'Gleiche Allergene erneut senden');
select isnt((select allergens_reviewed_at from public.dishes where id = (select id from ids where name = 'braten')),
            null, 'Gleiche Allergene lassen den Prüfstatus bestehen');

insert into ids select 'paket', public.save_menu_package(jsonb_build_object(
  'name', 'Herbstbuffet', 'price_per_person_cents', 2490,
  'dishes', jsonb_build_array(
     jsonb_build_object('dish_id', (select id from ids where name = 'braten'),  'portion_factor', 1),
     jsonb_build_object('dish_id', (select id from ids where name = 'gemuese'), 'portion_factor', 0.5))));
select is((select count(*)::int from public.menu_package_dishes), 2, 'Paket enthält zwei Gerichte');
select is((select allergens from public.kitchen_menu_packages),
          array['celery','mustard','sulphites']::public.allergen[], 'Paket-Allergene = Vereinigung der Gerichte');
select is((select diets from public.kitchen_menu_packages), '{}'::public.diet_type[],
          'Paket-Diätformen = Schnittmenge (Braten ist nicht vegetarisch)');

select throws_ok($$select public.save_ingredient(jsonb_build_object('id', (select id from ids where name = 'rind'), 'unit', 'ml'))$$,
                 'P0001', 'Einheit in Verwendung', 'Die Einheit einer genutzten Zutat bleibt gesperrt');
select throws_ok($$select public.save_dish('{"name":""}')$$, 'P0001', 'Name fehlt', 'Ohne Namen kein Gericht');
select throws_ok($$insert into public.dishes (company_id, name) values ('a1000000-0000-4000-8000-000000000001', 'Direkt')$$,
                 '42501', null, 'Direktes Schreiben in dishes ist gesperrt');
select throws_ok($$delete from public.dishes$$, '42501', null, 'Direktes Löschen ist gesperrt');
select throws_ok($$select public.save_dish(jsonb_build_object('name', 'X',
                  'ingredients', jsonb_build_array(jsonb_build_object('ingredient_id', gen_random_uuid(), 'quantity_per_person', 1))))$$,
                 '23503', null, 'Unbekannte Zutaten werden abgelehnt');

-- ---------- Koch (kitchen) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.dishes), 0, 'kitchen liest die Basistabelle dishes nicht');
select is((select count(*)::int from public.ingredients), 0, 'kitchen liest die Basistabelle ingredients nicht');
select is((select count(*)::int from public.menu_packages), 0, 'kitchen liest die Basistabelle menu_packages nicht');
select is((select count(*)::int from public.kitchen_dishes), 2, 'kitchen liest kitchen_dishes');
select is((select allergens from public.kitchen_dishes where name = 'Rinderschmorbraten'),
          array['celery','mustard','sulphites']::public.allergen[], 'Die View liefert die Allergene als Array');
select is((select count(*)::int from public.kitchen_ingredients), 2, 'kitchen liest kitchen_ingredients');
select is((select count(*)::int from public.kitchen_menu_packages), 1, 'kitchen liest kitchen_menu_packages');
select is((select count(*)::int from public.dish_ingredients), 1, 'kitchen liest Zutatenmengen (preisfrei)');

-- Preise bleiben unberührt, wenn die Küche speichert
select lives_ok($$select public.save_dish(jsonb_build_object('id', (select id from ids where name = 'braten'),
                  'price_cents', 1, 'markup_bp', 0, 'archived', true, 'description', 'Vom Koch'))$$,
                'kitchen darf ein Gericht bearbeiten');
select is((select description from public.kitchen_dishes where name = 'Rinderschmorbraten'), 'Vom Koch',
          'Die Änderung der Küche ist gespeichert');
select is((select archived_at from public.kitchen_dishes where name = 'Rinderschmorbraten'), null,
          'kitchen kann nicht archivieren');
select lives_ok($$select public.save_ingredient('{"name":"Sahne","unit":"ml","price_cents":999}')$$,
                'kitchen darf Zutaten anlegen');
select throws_ok($$select public.save_menu_package('{"name":"Nein"}')$$, '42501', null, 'kitchen darf keine Pakete speichern');

-- ---------- Aushilfe (staff) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.kitchen_dishes), 0, 'staff sieht den Katalog nicht');
select throws_ok($$select public.save_dish('{"name":"Y"}')$$, '42501', null, 'staff darf keinen Katalog schreiben');

-- ---------- Preise sind für die Küche nirgends sichtbar ----------
reset role;
select is((select count(*)::int
             from information_schema.columns
            where table_schema = 'public' and table_name like 'kitchen\_%'
              and (column_name ~* 'price|cost|markup')),
          0, 'Keine kitchen_*-View enthält Spalten mit price, cost oder markup');
select is((select price_cents from public.ingredients where name = 'Sahne'), null,
          'Die Küche hat keinen Preis gesetzt (nur admin)');
select is((select price_cents from public.dishes where name = 'Rinderschmorbraten'), 1170,
          'Der Preis des Gerichts blieb unverändert');

-- ---------- Firma B sieht nichts von Firma A ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.dishes), 0, 'admin B sieht keine Gerichte von A');
select is((select count(*)::int from public.kitchen_dishes), 0, 'admin B sieht keine Küchensicht von A');
select throws_ok($$select public.save_dish(jsonb_build_object('id', (select id from ids where name = 'braten'), 'name', 'Gekapert'))$$,
                 'P0001', 'Gericht nicht gefunden', 'admin B kann Gerichte von A nicht ändern');

-- ---------- Lesemodus ----------
reset role;
update public.subscriptions set writable_until = now() - interval '1 day'
 where company_id = 'a1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.save_dish('{"name":"Z"}')$$, 'P0001', 'Nur-Lesen-Modus: Änderungen sind derzeit nicht möglich',
                 'Im Lesemodus ist Speichern gesperrt');
select is((select count(*)::int from public.dishes), 2, 'Lesen funktioniert im Lesemodus weiter');

reset role;
select * from finish();
rollback;
