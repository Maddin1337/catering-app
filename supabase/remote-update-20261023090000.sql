-- ============================================================================
-- Update: Migrationen ab 20261023090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261023090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261023090000_m3_events.sql
-- =====================================================================
-- M3 · Kunden und Aufträge (docs/03-datenmodell.md §3.2, §4.4, §7.4, §7.8; docs/02 §1.1)
-- customers, events, event_schedule_items, event_dietary_requirements, event_status_changes;
-- private.is_allowed_event_transition(), set_event_status(), set_invoice_details(), copy_event();
-- View kitchen_events (ohne Angebote: Live-Stand; M4 ergänzt den Snapshot per create or replace).
--
-- Abweichungen von der Planung (docs/07):
-- - set_event_status() hat zusätzliche Parameter (option_expires_at, Rechnungsdaten); `quoted` setzt
--   erst commit_quote_send() in M5, dort gilt dieselbe Übergangstabelle.
-- - Abgelehnte, abgesagte und abgerechnete Aufträge sind nicht mehr änderbar (Policy).
-- =====================================================================

-- ---------- Tabellen ----------
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  type                public.customer_type not null default 'private',
  name                text not null check (char_length(btrim(name)) between 1 and 120),
  contact_person      text,
  email               text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone               text,
  billing_street      text,
  billing_postal_code text,
  billing_city        text,
  billing_country     public.country_code,
  vat_id              text,
  notes               text,
  anonymized_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, id)
);
create index customers_email_idx on public.customers (company_id, lower(email)) where email is not null;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);

create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  customer_id            uuid not null,
  kind                   public.event_kind not null default 'event_catering',
  title                  text not null check (char_length(btrim(title)) between 1 and 120),
  occasion               text,
  status                 public.event_status not null default 'inquiry',
  starts_at              timestamptz not null,
  ends_at                timestamptz,
  event_date             date generated always as (((starts_at at time zone 'Europe/Berlin')::date)) stored,
  guest_count            integer check (guest_count >= 1),
  venue_name             text,
  street                 text,
  postal_code            text,
  city                   text,
  country                public.country_code not null default 'DE',
  is_pickup              boolean not null default false,
  onsite_contact_name    text,
  onsite_contact_phone   text,
  meeting_point          text,
  dress_code             text,
  staff_notes            text,
  kitchen_notes          text,
  internal_notes         text,
  option_expires_at      timestamptz,
  changes_until          timestamptz,
  portal_locked          boolean not null default false,
  cancellation_agreement text,
  invoice_reference      text,
  invoiced_on            date,
  intake_answers         jsonb not null default '[]'::jsonb,
  copied_from_event_id   uuid,
  created_by_member_id   uuid default public.auth_member_id(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, customer_id) references public.customers (company_id, id),
  foreign key (company_id, copied_from_event_id)
    references public.events (company_id, id) on delete set null (copied_from_event_id),
  foreign key (company_id, created_by_member_id)
    references public.company_members (company_id, id) on delete set null (created_by_member_id),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint events_option_matches_status check ((status = 'optioned') = (option_expires_at is not null))
);
create index events_calendar_idx on public.events (company_id, starts_at);
create index events_list_idx on public.events (company_id, status, event_date);
create index events_customer_idx on public.events (customer_id);
create index events_title_trgm_idx on public.events using gin (title extensions.gin_trgm_ops);

create table public.event_schedule_items (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_id   uuid not null,
  kind       public.schedule_item_kind not null,
  label      text,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  constraint schedule_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index event_schedule_items_event_idx on public.event_schedule_items (event_id, starts_at);

create table public.event_dietary_requirements (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id) on delete cascade,
  event_id                uuid not null,
  person_count            integer not null check (person_count >= 1),
  diet                    public.diet_type,
  avoid_allergens         public.allergen[] not null default '{}',
  guest_name              text,
  table_label             text,
  note                    text,
  substitutions           jsonb not null default '[]'::jsonb,
  source                  public.dietary_source not null default 'internal',
  is_short_notice         boolean not null default false,
  created_by_member_id    uuid default public.auth_member_id(),
  portal_author_name      text,
  personal_data_purged_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  foreign key (company_id, created_by_member_id)
    references public.company_members (company_id, id) on delete set null (created_by_member_id),
  constraint dietary_has_content check (
    diet is not null or cardinality(avoid_allergens) > 0 or note is not null)
);
create index event_dietary_requirements_event_idx on public.event_dietary_requirements (event_id);

create table public.event_status_changes (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  event_id             uuid not null,
  from_status          public.event_status,
  to_status            public.event_status not null,
  actor_kind           text not null check (actor_kind in ('member', 'portal', 'system')),
  actor_member_id      uuid,
  reason               text,
  confirmation_channel text check (confirmation_channel in ('phone', 'email', 'in_person')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  foreign key (company_id, actor_member_id)
    references public.company_members (company_id, id) on delete set null (actor_member_id)
);
create index event_status_changes_event_idx on public.event_status_changes (event_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['customers', 'events', 'event_schedule_items', 'event_dietary_requirements',
                           'event_status_changes']
  loop
    execute format('create trigger %1$s_set_updated_at before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------- Statusübergänge (02 §1.1: einzige Quelle) ----------
create or replace function private.is_allowed_event_transition(
  p_from public.event_status, p_to public.event_status)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from (values
              ('inquiry',   'quoted'),
              ('inquiry',   'optioned'),
              ('inquiry',   'confirmed'),
              ('inquiry',   'declined'),
              ('quoted',    'optioned'),
              ('quoted',    'confirmed'),
              ('quoted',    'declined'),
              ('optioned',  'confirmed'),
              ('optioned',  'cancelled'),
              ('confirmed', 'completed'),
              ('confirmed', 'cancelled'),
              ('completed', 'invoiced')
           ) as t(from_status, to_status)
     where t.from_status::public.event_status = p_from
       and t.to_status::public.event_status   = p_to)
$$;

-- Lesen eines Auftrags: admin immer, kitchen ab optioned (ohne Kundendaten, die Tabellen sind getrennt);
-- der staff-Zweig kommt mit M7 (Schichtbörse) per create or replace.
create or replace function public.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.auth_role()
    when 'admin' then exists (select 1 from public.events e
                               where e.id = p_event_id and e.company_id = public.auth_company_id())
    when 'kitchen' then exists (select 1 from public.events e
                                 where e.id = p_event_id and e.company_id = public.auth_company_id()
                                   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced', 'cancelled'))
    else false
  end
$$;

-- Statushistorie: Anlage ist der erste Eintrag (from null)
create or replace function private.log_event_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, actor_member_id)
  values (new.company_id, new.id, null, new.status, 'member', public.auth_member_id());
  return new;
end;
$$;
create trigger events_log_created after insert on public.events
  for each row execute function private.log_event_created();

-- Sonderessen: Kurzfristigkeit und Summe der Personen
create or replace function private.check_dietary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_sum   integer;
begin
  select * into v_event from public.events where id = new.event_id;
  new.is_short_notice := v_event.changes_until is not null and now() > v_event.changes_until;
  select coalesce(sum(d.person_count), 0) into v_sum
    from public.event_dietary_requirements d
   where d.event_id = new.event_id and d.id is distinct from new.id;
  if v_event.guest_count is not null and v_sum + new.person_count > v_event.guest_count then
    raise exception 'Mehr Sonderessen als Gäste' using errcode = 'P0001', hint = 'guest_sum_exceeded';
  end if;
  return new;
end;
$$;
create trigger event_dietary_check before insert or update of person_count on public.event_dietary_requirements
  for each row execute function private.check_dietary();

-- ---------- Rechte und Policies ----------
-- customers: nur admin; Löschen nur ohne Aufträge, sonst Anonymisierung (folgt mit M10)
grant select, insert, update, delete on public.customers to authenticated;
create policy customers_admin_select on public.customers for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy customers_admin_insert on public.customers for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy customers_admin_update on public.customers for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()))
  with check (company_id = (select public.auth_company_id()) and (select public.company_is_writable()));
create policy customers_admin_delete on public.customers for delete to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
         and (select public.company_is_writable())
         and not exists (select 1 from public.events e where e.customer_id = customers.id));

-- events: nur admin direkt; die Küche liest kitchen_events. Systemfelder (Status, Option) nur per RPC.
grant select on public.events to authenticated;
grant insert (company_id, customer_id, kind, title, occasion, starts_at, ends_at, guest_count,
              venue_name, street, postal_code, city, country, is_pickup, onsite_contact_name,
              onsite_contact_phone, meeting_point, dress_code, staff_notes, kitchen_notes,
              internal_notes, changes_until, cancellation_agreement, intake_answers)
  on public.events to authenticated;
grant update (customer_id, kind, title, occasion, starts_at, ends_at, guest_count, venue_name, street,
              postal_code, city, country, is_pickup, onsite_contact_name, onsite_contact_phone,
              meeting_point, dress_code, staff_notes, kitchen_notes, internal_notes, changes_until,
              cancellation_agreement, portal_locked)
  on public.events to authenticated;
grant delete on public.events to authenticated;
create policy events_admin_select on public.events for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy events_admin_insert on public.events for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
-- abgelehnte, abgesagte und abgerechnete Aufträge sind schreibgeschützt
create policy events_admin_update on public.events for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable())
              and status not in ('declined', 'cancelled', 'invoiced'))
  with check (company_id = (select public.auth_company_id()) and (select public.company_is_writable()));
-- „Fehleingabe löschen“: nur Anfragen (Angebote kommen mit M4: dann zusätzlich ohne versendete Revision)
create policy events_admin_delete on public.events for delete to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
         and (select public.company_is_writable()) and status = 'inquiry');

-- Zeitplan: admin schreibt; kitchen liest ab optioned
grant select, insert, update, delete on public.event_schedule_items to authenticated;
create policy schedule_select on public.event_schedule_items for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.can_read_event(event_id)));
create policy schedule_admin_insert on public.event_schedule_items for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable())
              and exists (select 1 from public.events e where e.id = event_id
                           and e.status not in ('declined', 'cancelled', 'invoiced')));
create policy schedule_admin_update on public.event_schedule_items for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()))
  with check (company_id = (select public.auth_company_id()) and (select public.company_is_writable()));
create policy schedule_admin_delete on public.event_schedule_items for delete to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin'
         and (select public.company_is_writable()));

-- Sonderessen: admin und kitchen (ab optioned) lesen und schreiben
grant select, insert, update, delete on public.event_dietary_requirements to authenticated;
create policy dietary_select on public.event_dietary_requirements for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.can_read_event(event_id)));
create policy dietary_insert on public.event_dietary_requirements for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.can_read_event(event_id))
              and (select public.company_is_writable()));
create policy dietary_update on public.event_dietary_requirements for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.can_read_event(event_id))
              and (select public.company_is_writable()))
  with check (company_id = (select public.auth_company_id()) and (select public.company_is_writable()));
create policy dietary_delete on public.event_dietary_requirements for delete to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.can_read_event(event_id))
         and (select public.company_is_writable()));

-- Statushistorie: nur lesen (admin); geschrieben von RPCs und Trigger
grant select on public.event_status_changes to authenticated;
create policy status_changes_admin_select on public.event_status_changes for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- ---------- View für die Küche: ohne Kundendaten, Preise und interne Notizen ----------
create view public.kitchen_events
  with (security_invoker = false, security_barrier = true) as
select e.id, e.company_id, e.kind, e.title, e.status, e.starts_at, e.ends_at, e.event_date,
       e.guest_count, e.guest_count as draft_guest_count, 'live'::text as basis,
       e.venue_name, e.street, e.postal_code, e.city, e.is_pickup,
       e.onsite_contact_name, e.onsite_contact_phone, e.meeting_point, e.dress_code,
       e.kitchen_notes, e.staff_notes, e.updated_at,
       false as has_open_change
  from public.events e
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced', 'cancelled');
revoke all on public.kitchen_events from anon, authenticated;
grant select on public.kitchen_events to authenticated;

-- ---------- RPCs ----------
-- Statuswechsel (nur admin). Die Übergangstabelle gilt unabhängig vom Bestätigungsdialog der App.
create or replace function public.set_event_status(
  p_event_id uuid,
  p_new_status public.event_status,
  p_reason text default null,
  p_confirmation_channel text default null,
  p_option_expires_at timestamptz default null,
  p_invoice_reference text default null,
  p_invoiced_on date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  uuid;
  v_event   public.events;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  -- kein Aufruf ohne angemeldetes Mitglied (insbesondere nicht aus pg_cron): kein Job ändert den Status (R2-3)
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  v_member := private.require_admin();
  perform public.assert_writable();

  select * into v_event from public.events
   where id = p_event_id and company_id = public.auth_company_id() for update;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;

  if p_new_status = 'quoted' then
    raise exception 'Der Status „Angebot versendet“ entsteht nur durch den Angebotsversand'
      using errcode = 'P0001', hint = 'use_quote_send';
  end if;
  -- Option verlängern: optioned -> optioned mit neuem Datum (02 §1.1)
  if not (v_event.status = 'optioned' and p_new_status = 'optioned')
     and not private.is_allowed_event_transition(v_event.status, p_new_status) then
    raise exception 'Dieser Statuswechsel ist nicht erlaubt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  if p_new_status = 'optioned' and (p_option_expires_at is null or p_option_expires_at < now()) then
    raise exception '„Optioniert bis“ fehlt oder liegt in der Vergangenheit'
      using errcode = 'P0001', hint = 'option_required';
  end if;
  if p_new_status = 'confirmed' and v_event.status in ('inquiry', 'optioned')
     and p_confirmation_channel is null then
    raise exception 'Bestätigungsweg fehlt' using errcode = 'P0001', hint = 'channel_required';
  end if;
  if p_new_status in ('declined', 'cancelled') and v_reason is null then
    raise exception 'Grund fehlt' using errcode = 'P0001', hint = 'reason_required';
  end if;
  if p_confirmation_channel is not null and p_confirmation_channel not in ('phone', 'email', 'in_person') then
    raise exception 'Bestätigungsweg ungültig' using errcode = 'P0001', hint = 'channel_required';
  end if;

  update public.events set
    status            = p_new_status,
    option_expires_at = case when p_new_status = 'optioned' then p_option_expires_at else null end,
    invoice_reference = case when p_new_status = 'invoiced' then nullif(btrim(coalesce(p_invoice_reference, '')), '') else invoice_reference end,
    invoiced_on       = case when p_new_status = 'invoiced' then p_invoiced_on else invoiced_on end
  where id = v_event.id;

  insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind,
                                           actor_member_id, reason, confirmation_channel)
  values (v_event.company_id, v_event.id, v_event.status, p_new_status, 'member', v_member, v_reason,
          case when p_new_status = 'confirmed' then p_confirmation_channel else null end);
end;
$$;

-- Rechnungsnummer und -datum bleiben auch nach „abgerechnet“ bearbeitbar (02 §1.1)
create or replace function public.set_invoice_details(p_event_id uuid, p_reference text, p_invoiced_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.events
     set invoice_reference = nullif(btrim(coalesce(p_reference, '')), ''), invoiced_on = p_invoiced_on
   where id = p_event_id and company_id = public.auth_company_id() and status = 'invoiced';
  if not found then
    raise exception 'Auftrag nicht abgerechnet' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
end;
$$;

-- Auftrag kopieren: ein oder mehrere neue Termine (höchstens 10); Zeitplan wird in Berliner Ortszeit
-- verschoben, damit „12:00 Uhr“ über die Zeitumstellung hinweg „12:00 Uhr“ bleibt.
create or replace function public.copy_event(
  p_event_id uuid,
  p_new_starts_at timestamptz[],
  p_copy_dietary boolean default false,
  p_start_status public.event_status default 'inquiry',
  p_confirmation_channel text default null)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_src     public.events;
  v_start   timestamptz;
  v_delta   interval;
  v_new     uuid;
  v_ids     uuid[] := '{}';
begin
  perform private.require_admin();
  perform public.assert_writable();
  if coalesce(cardinality(p_new_starts_at), 0) not between 1 and 10 then
    raise exception 'Ein bis zehn Termine' using errcode = 'P0001', hint = 'invalid_dates';
  end if;
  if p_start_status not in ('inquiry', 'confirmed') then
    raise exception 'Startstatus ungültig' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if p_start_status = 'confirmed' and p_confirmation_channel is null then
    raise exception 'Bestätigungsweg fehlt' using errcode = 'P0001', hint = 'channel_required';
  end if;

  select * into v_src from public.events where id = p_event_id and company_id = v_company;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;

  foreach v_start in array p_new_starts_at loop
    v_delta := (v_start at time zone 'Europe/Berlin') - (v_src.starts_at at time zone 'Europe/Berlin');

    insert into public.events (company_id, customer_id, kind, title, occasion, status, starts_at, ends_at,
                               guest_count, venue_name, street, postal_code, city, country, is_pickup,
                               onsite_contact_name, onsite_contact_phone, meeting_point, dress_code,
                               staff_notes, kitchen_notes, internal_notes, changes_until,
                               cancellation_agreement, copied_from_event_id)
    values (v_company, v_src.customer_id, v_src.kind, v_src.title, v_src.occasion, p_start_status,
            v_start,
            case when v_src.ends_at is null then null
                 else ((v_src.ends_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
            v_src.guest_count, v_src.venue_name, v_src.street, v_src.postal_code, v_src.city,
            v_src.country, v_src.is_pickup, v_src.onsite_contact_name, v_src.onsite_contact_phone,
            v_src.meeting_point, v_src.dress_code, v_src.staff_notes, v_src.kitchen_notes,
            v_src.internal_notes,
            case when v_src.changes_until is null then null
                 else ((v_src.changes_until at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
            v_src.cancellation_agreement, v_src.id)
    returning id into v_new;
    if p_start_status = 'confirmed' then
      update public.event_status_changes set confirmation_channel = p_confirmation_channel
       where event_id = v_new and from_status is null;
    end if;

    insert into public.event_schedule_items (company_id, event_id, kind, label, starts_at, ends_at, notes)
    select v_company, v_new, s.kind, s.label,
           ((s.starts_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin',
           case when s.ends_at is null then null
                else ((s.ends_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
           s.notes
      from public.event_schedule_items s where s.event_id = v_src.id;

    -- Sonderessen ohne Gastnamen und Tische (personenbezogen)
    if p_copy_dietary then
      insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens,
                                                     note, substitutions, source)
      select v_company, v_new, d.person_count, d.diet, d.avoid_allergens, d.note, d.substitutions, 'internal'
        from public.event_dietary_requirements d where d.event_id = v_src.id;
    end if;
    v_ids := v_ids || v_new;
  end loop;
  return v_ids;
end;
$$;

revoke execute on function private.is_allowed_event_transition(public.event_status, public.event_status),
                           private.log_event_created(), private.check_dietary()
  from public, anon, authenticated;
revoke execute on function public.can_read_event(uuid),
  public.set_event_status(uuid, public.event_status, text, text, timestamptz, text, date),
  public.set_invoice_details(uuid, text, date),
  public.copy_event(uuid, timestamptz[], boolean, public.event_status, text)
  from public, anon, authenticated;
grant execute on function public.can_read_event(uuid),
  public.set_event_status(uuid, public.event_status, text, text, timestamptz, text, date),
  public.set_invoice_details(uuid, text, date),
  public.copy_event(uuid, timestamptz[], boolean, public.event_status, text)
  to authenticated;
