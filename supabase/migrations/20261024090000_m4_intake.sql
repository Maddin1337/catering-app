-- =====================================================================
-- M4 (vorgezogen) · Angebots-Chat: Fragenkatalog und Abschluss (docs/02 §11, docs/03 §3.7, §4.7)
-- intake_questions mit Standardkatalog (16 Fragen), create_event_from_intake(), reset_intake_questions().
-- Der Angebotsentwurf (quotes) entsteht erst mit dem Angebots-Editor; der Chat legt bis dahin Kunde,
-- Auftrag (Anfrage), Sonderessen, Notizen und die Antworten an. Die Referenz („Ihre Referenz“) steht
-- vorläufig in den internen Notizen.
-- =====================================================================
create table public.intake_questions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  sort_order    integer not null,
  prompt        text not null check (char_length(btrim(prompt)) between 1 and 200),
  help_text     text,
  answer_type   public.intake_answer_type not null,
  options       jsonb not null default '[]'::jsonb,
  is_required   boolean not null default false,
  target        public.intake_target,
  target_config jsonb,
  show_if       jsonb,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, id)
);
create index intake_questions_active_idx on public.intake_questions (company_id, sort_order)
  where archived_at is null;
create trigger intake_questions_set_updated_at
  before update on public.intake_questions for each row execute function public.set_updated_at();
alter table public.intake_questions enable row level security;
revoke all on public.intake_questions from anon, authenticated;

grant select on public.intake_questions to authenticated;
grant insert (company_id, sort_order, prompt, help_text, answer_type, options, is_required, target,
              target_config, show_if)
  on public.intake_questions to authenticated;
grant update (sort_order, prompt, help_text, answer_type, options, is_required, target, target_config,
              show_if, archived_at)
  on public.intake_questions to authenticated;
create policy intake_admin_select on public.intake_questions for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy intake_admin_insert on public.intake_questions for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy intake_admin_update on public.intake_questions for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()))
  with check (company_id = (select public.auth_company_id()) and (select public.company_is_writable()));

-- ---------- Standardkatalog (docs/03 §3.7) ----------
create or replace function private.seed_intake_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q2 uuid := gen_random_uuid();
  q3 uuid := gen_random_uuid();
  q10 uuid := gen_random_uuid();
  ev jsonb := jsonb_build_object('question_id', q2, 'operator', 'equals', 'value', 'event_catering');
begin
  insert into public.intake_questions
    (id, company_id, sort_order, prompt, answer_type, options, is_required, target, target_config, show_if) values
    (gen_random_uuid(), p_company_id, 10, 'Für wen ist die Anfrage?', 'customer', '[]', true, 'customer', null, null),
    (q2, p_company_id, 20, 'Was ist es?', 'single_choice',
       '[{"value":"event_catering","label":"Event-Catering"},{"value":"business_lunch","label":"Business-Lunch"}]',
       true, 'event_kind', null, null),
    (q3, p_company_id, 30, 'Welcher Anlass?', 'single_choice',
       '[{"value":"Hochzeit","label":"Hochzeit"},{"value":"Geburtstag","label":"Geburtstag"},{"value":"Firmenfeier","label":"Firmenfeier"},{"value":"Trauerfeier","label":"Trauerfeier"},{"value":"Sonstiges","label":"Sonstiges"}]',
       false, 'occasion', null, ev),
    (gen_random_uuid(), p_company_id, 40, 'An welchem Tag?', 'date', '[]', true, 'starts_at', null, null),
    (gen_random_uuid(), p_company_id, 50, 'Von wann bis wann?', 'time_range', '[]', true, 'starts_at', null, null),
    (gen_random_uuid(), p_company_id, 60, 'Wie viele Gäste?', 'number', '[]', false, 'guest_count', null, null),
    (gen_random_uuid(), p_company_id, 70, 'Wo findet es statt?', 'text', '[]', false, 'venue', null, null),
    (gen_random_uuid(), p_company_id, 80, 'Gibt es vor Ort eine Küche?', 'boolean', '[]', false, 'kitchen_notes', null, ev),
    (gen_random_uuid(), p_company_id, 90, 'Wird Service-Personal gewünscht?', 'boolean', '[]', false, null, null, ev),
    (q10, p_company_id, 100, 'Sind Sonderessen bekannt?', 'boolean', '[]', false, null, null, null),
    (gen_random_uuid(), p_company_id, 110, 'Wie viele vegetarisch?', 'number', '[]', false, 'dietary_requirements',
       '{"diet":"vegetarian"}', jsonb_build_object('question_id', q10, 'operator', 'is_true')),
    (gen_random_uuid(), p_company_id, 120, 'Wie viele vegan?', 'number', '[]', false, 'dietary_requirements',
       '{"diet":"vegan"}', jsonb_build_object('question_id', q10, 'operator', 'is_true')),
    (gen_random_uuid(), p_company_id, 130, 'Allergien oder Unverträglichkeiten?', 'text', '[]', false, 'kitchen_notes',
       null, jsonb_build_object('question_id', q10, 'operator', 'is_true')),
    (gen_random_uuid(), p_company_id, 140, 'Sektempfang oder Mitternachtssnack?', 'multi_choice',
       '[{"value":"Sektempfang","label":"Sektempfang"},{"value":"Mitternachtssnack","label":"Mitternachtssnack"}]',
       false, null, null, jsonb_build_object('question_id', q3, 'operator', 'equals', 'value', 'Hochzeit')),
    (gen_random_uuid(), p_company_id, 150, 'Budget pro Person (€)?', 'number', '[]', false, null, null, null),
    (gen_random_uuid(), p_company_id, 160, 'Ihre Referenz (Bestellnummer, Kostenstelle)?', 'text', '[]', false,
       'customer_reference', null,
       jsonb_build_object('question_id', q2, 'operator', 'equals', 'value', 'business_lunch'));
end;
$$;
revoke execute on function private.seed_intake_defaults(uuid) from public, anon, authenticated;

-- bestehende Firmen bekommen den Standardkatalog
do $$
declare c record;
begin
  for c in select id from public.companies x
            where not exists (select 1 from public.intake_questions i where i.company_id = x.id)
  loop
    perform private.seed_intake_defaults(c.id);
  end loop;
end;
$$;

-- neue Firmen bekommen ihn bei der Anlage
create or replace function public.create_company(
  p_name text, p_contact_email text, p_accept_avv boolean,
  p_country public.country_code default 'DE')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_company_id uuid;
  v_trial_end  timestamptz;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if not coalesce(p_accept_avv, false) then
    raise exception 'AVV muss akzeptiert werden' using errcode = 'P0001', hint = 'avv_required';
  end if;
  if p_country <> 'DE' then
    raise exception 'Land noch nicht verfügbar' using errcode = 'P0001', hint = 'country_unavailable';
  end if;
  if exists (select 1 from public.company_members m where m.user_id = v_uid) then
    raise exception 'Du bist bereits Mitglied einer Firma' using errcode = 'P0001', hint = 'already_member';
  end if;

  -- Testphase endet am 14. Tag um 23:59:59 Europe/Berlin
  v_trial_end := ((((now() at time zone 'Europe/Berlin')::date + 14)::timestamp
                   + interval '23:59:59') at time zone 'Europe/Berlin');

  insert into public.companies (name, contact_email, country, created_by,
                                avv_accepted_at, avv_accepted_by, avv_version)
  values (btrim(p_name), btrim(p_contact_email), p_country, v_uid, now(), v_uid, '2026-10')
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role, display_name, login_email)
  select v_company_id, u.id, 'admin',
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
         u.email
    from auth.users u where u.id = v_uid;

  insert into public.subscriptions (company_id, plan, status, trial_ends_at, writable_until)
  values (v_company_id, 'profi', 'trialing', v_trial_end, v_trial_end);

  perform private.seed_company_defaults(v_company_id);
  perform private.seed_intake_defaults(v_company_id);
  return v_company_id;
end;
$$;

-- „Standard wiederherstellen“: bisherige Fragen werden archiviert (Verweise in Aufträgen bleiben gültig)
create or replace function public.reset_intake_questions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_company uuid := public.auth_company_id();
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.intake_questions set archived_at = now() where company_id = v_company and archived_at is null;
  perform private.seed_intake_defaults(v_company);
end;
$$;

-- ---------- Abschluss des Chats in einer Transaktion ----------
-- payload: { event_id?, customer: {id} | {name, type, email?},
--            event: {kind, title, occasion, starts_at, ends_at, guest_count, venue_name, kitchen_notes,
--                    staff_notes, internal_notes},
--            dietary: [{person_count, diet, avoid_allergens, note}], intake_answers: [...] }
create or replace function public.create_event_from_intake(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  uuid := public.auth_company_id();
  v_member   uuid := private.require_admin();
  v_cust     uuid;
  v_event    uuid := nullif(p ->> 'event_id', '')::uuid;
  v_e        jsonb := p -> 'event';
  v_kind     public.event_kind := coalesce((v_e ->> 'kind')::public.event_kind, 'event_catering');
  v_title    text := btrim(coalesce(v_e ->> 'title', ''));
  v_starts   timestamptz := (v_e ->> 'starts_at')::timestamptz;
  v_ends     timestamptz := nullif(v_e ->> 'ends_at', '')::timestamptz;
  v_lead     integer;
  v_changes  timestamptz;
  v_old      public.events;
  d          jsonb;
begin
  perform public.assert_writable();
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'Titel fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;
  if v_starts is null then
    raise exception 'Beginn fehlt' using errcode = 'P0001', hint = 'invalid_dates';
  end if;

  -- Kunde: bestehend oder neu
  if p -> 'customer' ? 'id' then
    select id into v_cust from public.customers
     where id = (p -> 'customer' ->> 'id')::uuid and company_id = v_company;
    if v_cust is null then
      raise exception 'Kunde nicht gefunden' using errcode = 'P0001', hint = 'customer_not_found';
    end if;
  else
    insert into public.customers (company_id, type, name, email)
    values (v_company, coalesce((p -> 'customer' ->> 'type')::public.customer_type, 'private'),
            btrim(p -> 'customer' ->> 'name'), nullif(btrim(coalesce(p -> 'customer' ->> 'email', '')), ''))
    returning id into v_cust;
  end if;

  -- Änderungsschluss aus der Firmeneinstellung der Auftragsart
  select case when v_kind = 'business_lunch' then c.portal_change_lead_hours_business_lunch
              else c.portal_change_lead_hours end
    into v_lead from public.companies c where c.id = v_company;
  v_changes := case when v_lead is null then null else v_starts - make_interval(hours => v_lead) end;

  if v_event is null then
    insert into public.events (company_id, customer_id, kind, title, occasion, starts_at, ends_at, guest_count,
                               venue_name, kitchen_notes, staff_notes, internal_notes, changes_until,
                               intake_answers)
    values (v_company, v_cust, v_kind, v_title, nullif(v_e ->> 'occasion', ''), v_starts, v_ends,
            nullif(v_e ->> 'guest_count', '')::integer, nullif(v_e ->> 'venue_name', ''),
            nullif(v_e ->> 'kitchen_notes', ''), nullif(v_e ->> 'staff_notes', ''),
            nullif(v_e ->> 'internal_notes', ''), v_changes, coalesce(p -> 'intake_answers', '[]'::jsonb))
    returning id into v_event;
  else
    select * into v_old from public.events where id = v_event and company_id = v_company for update;
    if not found then
      raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
    end if;
    if v_old.status <> 'inquiry' then
      raise exception 'Nur Anfragen lassen sich ergänzen' using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    update public.events set
      customer_id    = v_cust, kind = v_kind, title = v_title,
      occasion       = coalesce(nullif(v_e ->> 'occasion', ''), occasion),
      starts_at      = v_starts, ends_at = v_ends,
      guest_count    = coalesce(nullif(v_e ->> 'guest_count', '')::integer, guest_count),
      venue_name     = coalesce(nullif(v_e ->> 'venue_name', ''), venue_name),
      -- Notizen werden angehängt, nichts geht verloren
      kitchen_notes  = nullif(concat_ws(E'\n', kitchen_notes, nullif(v_e ->> 'kitchen_notes', '')), ''),
      staff_notes    = nullif(concat_ws(E'\n', staff_notes, nullif(v_e ->> 'staff_notes', '')), ''),
      internal_notes = nullif(concat_ws(E'\n', internal_notes, nullif(v_e ->> 'internal_notes', '')), ''),
      changes_until  = coalesce(changes_until, v_changes),
      intake_answers = coalesce(p -> 'intake_answers', intake_answers)
    where id = v_event;
    delete from public.event_dietary_requirements where event_id = v_event and note = 'aus Anfrage';
  end if;

  -- Sonderessen aus dem Chat (die Summe prüft der Trigger gegen die Gästezahl)
  for d in select * from jsonb_array_elements(coalesce(p -> 'dietary', '[]'::jsonb)) loop
    insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens,
                                                   note, source, created_by_member_id)
    values (v_company, v_event, (d ->> 'person_count')::integer, nullif(d ->> 'diet', '')::public.diet_type,
            coalesce(array(select jsonb_array_elements_text(d -> 'avoid_allergens'))::public.allergen[], '{}'),
            coalesce(d ->> 'note', 'aus Anfrage'), 'internal', v_member);
  end loop;
  return v_event;
end;
$$;

revoke execute on function public.reset_intake_questions(), public.create_event_from_intake(jsonb)
  from public, anon, authenticated;
grant execute on function public.reset_intake_questions(), public.create_event_from_intake(jsonb)
  to authenticated;
