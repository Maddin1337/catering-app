-- Direkte Schreibzugriffe, die die App so ausführt (Spaltenrechte und Richtlinien passen zum Code)
begin;
select plan(22);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test');
insert into public.companies (id, name, contact_email) values ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test');
insert into public.subscriptions (company_id, writable_until) values ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- Einstellungen (useUpdateCompanySettings: alle Spalten aus settings/api.ts COLUMNS)
select lives_ok($$update public.companies set name = 'X', phone = '1', contact_email = 'a@b.de', website = 'w', street = 's', postal_code = '1', city = 'c',
  vat_id = 'v', tax_number = 't', footer_text = 'f', privacy_policy_url = 'p', imprint_url = 'i', accent_color = '#112233', price_entry_mode = 'gross',
  default_pricing_mode = 'cost_based', default_markup_bp = 15000, price_rounding_cents = 10, quote_validity_days = 14, portal_change_lead_hours = 72,
  portal_change_lead_hours_business_lunch = 24, shift_cancel_deadline_hours = 48, shopping_buffer_bp = 500, quote_intro_text = 'a', quote_terms_text = 'b',
  quote_closing_text = 'c', quote_item_templates = '[{"type":"service"}]', logo_path = 'a1000000-0000-4000-8000-000000000001/logo-00000000-0000-4000-8000-000000000001.png'
  where id = 'a1000000-0000-4000-8000-000000000001'$$, 'Einstellungen und Logo speichern');
select is((select quote_item_templates -> 0 ->> 'type' from public.companies where id = 'a1000000-0000-4000-8000-000000000001'), 'service', 'Vorlagen wurden geschrieben');

-- Kunden
select lives_ok($$insert into public.customers (company_id, type, name, contact_person, email, phone, billing_street, billing_postal_code, billing_city, vat_id, notes)
  values ('a1000000-0000-4000-8000-000000000001', 'business', 'Müller', 'Frau M', 'm@m.de', '1', 's', '1', 'c', 'v', 'n')$$, 'Kunde anlegen');
select lives_ok($$update public.customers set name = 'Müller 2', notes = null where name = 'Müller'$$, 'Kunde ändern');

-- Aufträge (EventInput)
select lives_ok($$insert into public.events (company_id, customer_id, kind, title, occasion, starts_at, ends_at, guest_count, venue_name, street, postal_code, city, is_pickup,
  onsite_contact_name, onsite_contact_phone, meeting_point, dress_code, staff_notes, kitchen_notes, internal_notes, changes_until, cancellation_agreement)
  select 'a1000000-0000-4000-8000-000000000001', id, 'event_catering', 'Gala', 'Hochzeit', now() + interval '30 days', now() + interval '31 days', 50, 'v', 's', '1', 'c', false,
  'n', 'p', 'm', 'd', 'sn', 'kn', 'in', now() + interval '20 days', 'ca' from public.customers limit 1$$, 'Auftrag anlegen');
select lives_ok($$update public.events set title = 'Gala 2', guest_count = 60, kitchen_notes = null, is_pickup = true where title = 'Gala'$$, 'Auftrag ändern');

-- Zeitplan
select lives_ok($$insert into public.event_schedule_items (company_id, event_id, kind, label, starts_at, ends_at, notes)
  select company_id, id, 'setup', null, starts_at - interval '2 hours', null, null from public.events limit 1$$, 'Zeitplan-Eintrag anlegen');
select lives_ok($$update public.event_schedule_items set label = 'L', notes = 'n' where kind = 'setup'$$, 'Zeitplan-Eintrag ändern');
select lives_ok($$delete from public.event_schedule_items where kind = 'setup'$$, 'Zeitplan-Eintrag löschen');

-- Sonderessen als admin und Küche (inkl. Ersatzgericht und Quelle)
select lives_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens, guest_name, table_label, note, source, substitutions)
  select company_id, id, 2, 'vegan', array['gluten']::public.allergen[], 'g', 't', 'n', 'internal', '[]'::jsonb from public.events limit 1$$, 'Admin legt Sonderessen an');
select public.set_event_status((select id from public.events limit 1), 'confirmed', null, 'phone');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, source)
  select company_id, id, 1, 'halal', 'customer' from public.events limit 1$$, 'Küche legt Sonderessen an');
select lives_ok($$update public.event_dietary_requirements set person_count = 3, substitutions = '[{"from_dish_id":"d1000000-0000-4000-8000-000000000001","to_dish_id":"d1000000-0000-4000-8000-000000000002"}]'::jsonb
  where diet = 'halal'$$, 'Küche ändert Sonderessen mit Ersatzgericht');
select lives_ok($$delete from public.event_dietary_requirements where diet = 'halal'$$, 'Küche löscht Sonderessen');

-- Fragenkatalog, Qualifikationen, Steuersätze (Admin)
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.intake_questions (company_id, sort_order, prompt, help_text, answer_type, options, is_required, target, target_config, show_if)
  values ('a1000000-0000-4000-8000-000000000001', 999, 'Frage?', null, 'text', '[]', false, null, null, null)$$, 'Frage anlegen');
select lives_ok($$update public.intake_questions set prompt = 'Frage 2', sort_order = 1000, archived_at = now() where prompt = 'Frage?'$$, 'Frage ändern und archivieren');
select lives_ok($$insert into public.qualifications (company_id, name, sort_order) values ('a1000000-0000-4000-8000-000000000001', 'Sommelier', 100)$$, 'Qualifikation anlegen');
select lives_ok($$update public.qualifications set name = 'Sommelier 2' where name = 'Sommelier'$$, 'Qualifikation umbenennen');
select lives_ok($$update public.qualifications set archived_at = now() where name = 'Sommelier 2'$$, 'Qualifikation archivieren');
select lives_ok($$insert into public.tax_rates (company_id, name, rate_bp, category, country, reviewed_at) values ('a1000000-0000-4000-8000-000000000001', 'Test 5 %', 500, 'other', 'DE', now())$$, 'Steuersatz anlegen');
select lives_ok($$update public.tax_rates set name = 'Test 6 %', rate_bp = 600, reviewed_at = now() where rate_bp = 500$$, 'Steuersatz ändern');
select lives_ok($$update public.tax_rates set archived_at = now() where rate_bp = 600$$, 'Steuersatz archivieren');

-- eigenes Profil
select lives_ok($$update public.company_members set display_name = 'Anna A', phone = '123' where user_id = 'a0000000-0000-4000-8000-000000000001'$$, 'Profil ändern');

-- Auftrag löschen (nur Anfrage ohne Versand): dieser Auftrag ist bestätigt, also zählt der Weg über den Status; hier nur die Berechtigung am Rest
reset role;
select * from finish();
rollback;
