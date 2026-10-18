-- ============================================================================
-- Alle Migrationen in einer Datei, zum Einfügen in den Supabase SQL Editor.
-- Erzeugt mit: bash scripts/db/bundle.sh   (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261019090000_types.sql
-- =====================================================================
-- Typen, Funktionsrechte, Schema private (docs/03-datenmodell.md §7.1)
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- Funktionsrechte zuerst festlegen (§4.1 Nr. 1): EXECUTE nie an PUBLIC, anon oder
-- authenticated per Default. Globale Default-Rechte lassen sich nicht pro Schema
-- widerrufen, deshalb die erste Zeile ohne IN SCHEMA. Die zweite Zeile hebt die
-- Supabase-Default-Grants in public für anon und authenticated auf.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Nicht über PostgREST veröffentlichtes Schema für rein interne Funktionen
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.member_role         as enum ('admin', 'kitchen', 'staff');
create type public.event_status        as enum ('inquiry', 'quoted', 'optioned', 'confirmed',
                                                'completed', 'invoiced', 'declined', 'cancelled');
create type public.event_kind          as enum ('event_catering', 'business_lunch');
create type public.quote_status        as enum ('draft', 'sent', 'accepted', 'declined');
create type public.quote_item_type     as enum ('package', 'dish', 'service', 'equipment',
                                                'travel', 'beverage', 'custom');
create type public.quantity_mode       as enum ('per_guest', 'fixed');
create type public.pricing_mode        as enum ('flat', 'cost_based');
create type public.price_basis         as enum ('net', 'gross');
create type public.acceptance_channel  as enum ('portal', 'portal_confirmation', 'admin', 'info_only');
create type public.application_status  as enum ('applied', 'accepted', 'rejected', 'withdrawn',
                                                'cancelled_by_staff', 'assigned');
create type public.allergen            as enum ('gluten', 'crustaceans', 'eggs', 'fish', 'peanuts',
                                                'soybeans', 'milk', 'nuts', 'celery', 'mustard',
                                                'sesame', 'sulphites', 'lupin', 'molluscs');
create type public.diet_type           as enum ('vegetarian', 'vegan', 'halal', 'kosher',
                                                'gluten_free', 'lactose_free');
create type public.dish_category       as enum ('starter', 'soup', 'main', 'side', 'dessert',
                                                'finger_food', 'beverage', 'other');
create type public.tax_category        as enum ('food', 'beverage', 'service', 'equipment',
                                                'travel', 'other');
create type public.country_code        as enum ('DE', 'AT', 'CH');
create type public.customer_type       as enum ('business', 'private');
create type public.subscription_plan   as enum ('start', 'team', 'profi', 'pilot');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled',
                                                'unpaid', 'incomplete', 'incomplete_expired',
                                                'paused');
create type public.ingredient_unit     as enum ('g', 'ml', 'piece');
create type public.schedule_item_kind  as enum ('departure', 'setup', 'service', 'teardown',
                                                'delivery', 'other');
create type public.dietary_source      as enum ('customer', 'internal');
create type public.push_platform       as enum ('ios', 'android');
create type public.push_status         as enum ('pending', 'sending', 'sent', 'failed', 'skipped');
create type public.notification_category as enum (
  'application_received', 'application_decided', 'assignment_created', 'assignment_cancelled',
  'slots_published', 'shift_changed', 'shift_called_off', 'shift_reminder', 'quote_accepted',
  'quote_declined', 'quote_viewed', 'quote_delivery_failed', 'revision_confirmation_pending',
  'portal_change', 'dietary_changed', 'event_confirmed', 'event_cancelled', 'guest_count_changed',
  'option_expiring', 'quote_expired', 'completion_due', 'slots_unfilled', 'member_joined', 'billing');
create type public.intake_answer_type  as enum ('single_choice', 'multi_choice', 'number', 'date',
                                                'time', 'time_range', 'datetime', 'text',
                                                'boolean', 'customer');
create type public.intake_target       as enum ('customer', 'event_kind', 'occasion', 'starts_at',
                                                'ends_at', 'guest_count', 'venue',
                                                'dietary_requirements', 'kitchen_notes',
                                                'staff_notes', 'customer_reference');

-- Gemeinsamer Trigger für updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- Trigger-Funktionen brauchen kein EXECUTE für App-Rollen (gilt für alle Trigger-Funktionen)
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- >>>>>>>>>> 20261019090100_tenancy.sql
-- =====================================================================
-- Mandant, Team, Abo und Hilfsfunktionen (docs/03-datenmodell.md §7.2)
-- companies, company_members, subscriptions
-- =====================================================================
create table public.companies (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null check (char_length(btrim(name)) between 1 and 120),
  street                      text,
  postal_code                 text,
  city                        text,
  country                     public.country_code not null default 'DE',
  phone                       text,
  contact_email               text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website                     text,
  vat_id                      text,
  tax_number                  text,
  footer_text                 text,
  privacy_policy_url          text,
  imprint_url                 text,
  logo_path                   text,
  accent_color                text check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Einstellungen (docs/01-produkt.md §4.2.6)
  price_entry_mode            public.price_basis  not null default 'net',
  default_pricing_mode        public.pricing_mode not null default 'flat',
  default_markup_bp           integer not null default 20000
                              check (default_markup_bp between 0 and 100000),
  price_rounding_cents        integer not null default 10
                              check (price_rounding_cents in (1, 10, 50, 100)),
  is_small_business           boolean not null default false,
  quote_validity_days         integer not null default 14 check (quote_validity_days between 1 and 365),
  portal_change_lead_hours    integer default 72 check (portal_change_lead_hours between 0 and 720),
  portal_change_lead_hours_business_lunch
                              integer default 24
                              check (portal_change_lead_hours_business_lunch between 0 and 720),
  portal_token_ttl_days       integer not null default 60 check (portal_token_ttl_days between 1 and 365),
  shift_cancel_deadline_hours integer not null default 48
                              check (shift_cancel_deadline_hours between 0 and 168),
  shopping_buffer_bp          integer not null default 500 check (shopping_buffer_bp between 0 and 5000),
  quote_intro_text            text,
  quote_terms_text            text,
  quote_closing_text          text,
  quote_item_templates        jsonb not null default '[]'::jsonb,
  quote_number_year           integer,
  quote_number_seq            integer not null default 0,
  avv_accepted_at             timestamptz,
  avv_accepted_by             uuid references auth.users (id) on delete set null,
  avv_version                 text,
  onboarding_completed_at     timestamptz,
  created_by                  uuid references auth.users (id) on delete set null,
  deletion_requested_at       timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.company_members (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  user_id            uuid unique references auth.users (id) on delete set null,  -- 1 Nutzer = 1 Firma
  role               public.member_role not null,
  display_name       text not null check (char_length(btrim(display_name)) between 1 and 80),
  phone              text,
  login_email        text,
  notification_prefs jsonb not null default '{}'::jsonb,
  ical_token_hash    bytea unique,
  joined_at          timestamptz not null default now(),
  removed_at         timestamptz,
  removed_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_id, id)
);
create index company_members_active_idx
  on public.company_members (company_id, role) where removed_at is null;

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null unique references public.companies (id) on delete cascade,
  plan                   public.subscription_plan   not null default 'profi',
  status                 public.subscription_status not null default 'trialing',
  billing_interval       text check (billing_interval in ('month', 'year')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  payment_failed_at      timestamptz,
  writable_until         timestamptz not null,   -- einzige Quelle für company_is_writable()
  stripe_synced_at       timestamptz,            -- Abrufzeitpunkt des geschriebenen Stripe-Stands
  last_stripe_event_id   text,
  last_stripe_event_at   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();
create trigger company_members_set_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Hilfsfunktionen für RLS (SECURITY DEFINER, STABLE, leerer search_path)
-- Lesen company_members direkt -> Rollenwechsel/Entfernen wirken sofort,
-- unabhängig von der Laufzeit des JWT.
-- ---------------------------------------------------------------------
create or replace function public.auth_member_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
    from public.company_members m
    join public.companies c on c.id = m.company_id
   where m.user_id = auth.uid()
     and m.removed_at is null
     and c.deletion_requested_at is null
$$;

create or replace function public.auth_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.company_id
    from public.company_members m
    join public.companies c on c.id = m.company_id
   where m.user_id = auth.uid()
     and m.removed_at is null
     and c.deletion_requested_at is null
$$;

create or replace function public.auth_role()
returns public.member_role
language sql stable security definer set search_path = ''
as $$
  select m.role
    from public.company_members m
    join public.companies c on c.id = m.company_id
   where m.user_id = auth.uid()
     and m.removed_at is null
     and c.deletion_requested_at is null
$$;

-- Schreibrecht nur bei aktivem Abo / laufender Testphase
create or replace function public.company_is_writable(p_company_id uuid default public.auth_company_id())
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select s.writable_until > now() and c.deletion_requested_at is null
      from public.subscriptions s
      join public.companies c on c.id = s.company_id
     where s.company_id = p_company_id), false)
$$;

-- Für RPCs: bricht im Lesemodus mit eindeutigem Fehlercode ab
create or replace function public.assert_writable()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.company_is_writable() then
    raise exception 'Nur-Lesen-Modus: Änderungen sind derzeit nicht möglich'
      using errcode = 'P0001', hint = 'read_only';
  end if;
end;
$$;

-- >>>>>>>>>> 20261019090200_reference.sql
-- =====================================================================
-- Referenzdaten: allergens, plan_limits (docs/03-datenmodell.md §3.7)
-- Kommen per Migration statt per Seed, weil sie auch in Produktion gebraucht werden (§9.3 Nr. 4).
-- =====================================================================
create table public.allergens (
  code        public.allergen primary key,
  letter      char(1)  not null unique,
  label_de    text     not null,
  sort_order  integer  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Die 14 Pflichtallergene (LMIV Anhang II); Kurzcodes nach dem österreichischen Schema.
insert into public.allergens (code, letter, label_de, sort_order) values
  ('gluten',      'A', 'Glutenhaltiges Getreide',      1),
  ('crustaceans', 'B', 'Krebstiere',                   2),
  ('eggs',        'C', 'Eier',                         3),
  ('fish',        'D', 'Fisch',                        4),
  ('peanuts',     'E', 'Erdnüsse',                     5),
  ('soybeans',    'F', 'Soja',                         6),
  ('milk',        'G', 'Milch (einschließlich Laktose)', 7),
  ('nuts',        'H', 'Schalenfrüchte',               8),
  ('celery',      'L', 'Sellerie',                     9),
  ('mustard',     'M', 'Senf',                        10),
  ('sesame',      'N', 'Sesamsamen',                  11),
  ('sulphites',   'O', 'Schwefeldioxid und Sulfite',  12),
  ('lupin',       'P', 'Lupinen',                     13),
  ('molluscs',    'R', 'Weichtiere',                  14);

-- Grenzen je Stufe als Konfiguration statt im Code (Werte = Vorschlag aus docs/01-produkt.md §6.1).
create table public.plan_limits (
  plan            public.subscription_plan primary key,
  max_members     integer check (max_members is null or max_members > 0),  -- null = unbegrenzt
  max_admins      integer check (max_admins is null or max_admins > 0),
  shift_board     boolean not null,
  branding_footer boolean not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

insert into public.plan_limits (plan, max_members, max_admins, shift_board, branding_footer) values
  ('start', 3,    1,    false, true),
  ('team',  15,   2,    true,  false),
  ('profi', 40,   5,    true,  false),
  ('pilot', null, null, true,  false);

create trigger allergens_set_updated_at
  before update on public.allergens
  for each row execute function public.set_updated_at();
create trigger plan_limits_set_updated_at
  before update on public.plan_limits
  for each row execute function public.set_updated_at();

-- >>>>>>>>>> 20261019090300_rls.sql
-- =====================================================================
-- Rechte und Row-Level-Security für den Stand von M0 (docs/03-datenmodell.md §4.1, §7.6)
-- Grundsatz: anon hat keinerlei Rechte; authenticated nur über Policies und ausdrücklich
-- freigegebene Funktionen. Spätere Meilensteine ergänzen Policies je Tabelle (M1: companies,
-- company_members, subscriptions).
-- =====================================================================
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;

grant execute on function public.auth_member_id(), public.auth_company_id(), public.auth_role(),
                          public.company_is_writable(uuid), public.assert_writable()
  to authenticated;

alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.allergens       enable row level security;
alter table public.plan_limits     enable row level security;

-- Default deny für die Mandanten-Tabellen: Supabase vergibt Tabellenrechte per Default auch an
-- authenticated; ohne Policy sieht und ändert niemand etwas. Die Rechte entziehen wir zusätzlich,
-- damit M1 sie bewusst Spalte für Spalte wieder vergibt (§7.6).
revoke all on public.companies, public.company_members, public.subscriptions from authenticated;

-- Referenzdaten: lesen alle angemeldeten Nutzer, schreiben nur Migrationen.
revoke all on public.allergens, public.plan_limits from authenticated;
grant select on public.allergens, public.plan_limits to authenticated;
create policy allergens_select   on public.allergens   for select to authenticated using (true);
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);

-- >>>>>>>>>> 20261020090000_m1_company.sql
-- =====================================================================
-- M1 · Firma anlegen (docs/03-datenmodell.md §3.1, §4.5, §7.3, §7.6–§7.8)
-- tax_rates, qualifications, member_qualifications, Rechte und Policies für companies,
-- company_members, subscriptions, Views company_profile und team_directory,
-- create_company() mit private.seed_company_defaults()
-- Einladungen, Rollenwechsel und Entfernen folgen in einer eigenen Migration.
-- =====================================================================

-- ---------- Tabellen ----------
create table public.tax_rates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  rate_bp     integer not null check (rate_bp between 0 and 10000),   -- 700 = 7,00 %
  category    public.tax_category not null,
  country     public.country_code not null default 'DE',
  valid_from  date not null default date '2000-01-01',
  is_default  boolean not null default false,
  reviewed_at timestamptz,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, id)
);
create unique index tax_rates_one_default_idx
  on public.tax_rates (company_id, country, category, valid_from)
  where is_default and archived_at is null;

create table public.qualifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, id)
);
create unique index qualifications_name_idx
  on public.qualifications (company_id, lower(name)) where archived_at is null;

create table public.member_qualifications (
  company_id       uuid not null references public.companies (id) on delete cascade,
  member_id        uuid not null,
  qualification_id uuid not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (member_id, qualification_id),
  foreign key (company_id, member_id)
    references public.company_members (company_id, id) on delete cascade,
  foreign key (company_id, qualification_id)
    references public.qualifications (company_id, id) on delete cascade
);
create index member_qualifications_qual_idx on public.member_qualifications (qualification_id);

create trigger tax_rates_set_updated_at
  before update on public.tax_rates for each row execute function public.set_updated_at();
create trigger qualifications_set_updated_at
  before update on public.qualifications for each row execute function public.set_updated_at();
create trigger member_qualifications_set_updated_at
  before update on public.member_qualifications for each row execute function public.set_updated_at();

alter table public.tax_rates            enable row level security;
alter table public.qualifications       enable row level security;
alter table public.member_qualifications enable row level security;

-- ---------- Rechte: Standard der Supabase-Voreinstellung entziehen, dann gezielt vergeben ----------
revoke all on public.tax_rates, public.qualifications, public.member_qualifications
  from anon, authenticated;

-- ---------- companies: Basistabelle nur admin; alle anderen lesen company_profile ----------
grant select on public.companies to authenticated;
create policy companies_select_admin on public.companies
  for select to authenticated
  using (id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy companies_update_admin on public.companies
  for update to authenticated
  using      (id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin')
  with check (id = (select public.auth_company_id()) and (select public.company_is_writable()));
-- INSERT nur über create_company(), DELETE nur über request_company_deletion()
grant update (name, street, postal_code, city, phone, contact_email, website, vat_id, tax_number,
              footer_text, privacy_policy_url, imprint_url, logo_path, accent_color,
              price_entry_mode, default_pricing_mode, default_markup_bp, price_rounding_cents,
              is_small_business, quote_validity_days, portal_change_lead_hours,
              portal_change_lead_hours_business_lunch, portal_token_ttl_days,
              shift_cancel_deadline_hours, shopping_buffer_bp, quote_intro_text, quote_terms_text,
              quote_closing_text, quote_item_templates, onboarding_completed_at)
  on public.companies to authenticated;

-- ---------- company_members: admin alle Zeilen der Firma, andere nur die eigene ----------
grant select on public.company_members to authenticated;
create policy members_select on public.company_members
  for select to authenticated
  using (
    company_id = (select public.auth_company_id())
    and (
      (select public.auth_role()) = 'admin'
      or user_id = (select auth.uid())
    )
  );
grant update (display_name, phone, notification_prefs) on public.company_members to authenticated;
create policy members_update_self on public.company_members
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Rollen, Entfernen, Beitritt: eigene RPCs bzw. accept-invitation (folgen)

-- ---------- subscriptions: lesen admin, schreiben nur service_role ----------
grant select on public.subscriptions to authenticated;
create policy subscriptions_select_admin on public.subscriptions
  for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- ---------- tax_rates: nur admin ----------
grant select, insert, update on public.tax_rates to authenticated;
create policy tax_rates_admin_select on public.tax_rates for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy tax_rates_admin_insert on public.tax_rates for insert to authenticated
  with check (company_id = (select public.auth_company_id())
              and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy tax_rates_admin_update on public.tax_rates for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin')
  with check (company_id = (select public.auth_company_id())
              and (select public.company_is_writable()));

-- ---------- qualifications: alle Mitglieder lesen, admin schreibt ----------
grant select, insert, update on public.qualifications to authenticated;
create policy qualifications_select on public.qualifications for select to authenticated
  using (company_id = (select public.auth_company_id()));
create policy qualifications_admin_insert on public.qualifications for insert to authenticated
  with check (company_id = (select public.auth_company_id())
              and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy qualifications_admin_update on public.qualifications for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin')
  with check (company_id = (select public.auth_company_id())
              and (select public.company_is_writable()));

-- ---------- member_qualifications: lesen admin alle, andere die eigenen; Schreiben nur per RPC ----------
grant select on public.member_qualifications to authenticated;
create policy member_qualifications_select on public.member_qualifications for select to authenticated
  using (
    company_id = (select public.auth_company_id())
    and ((select public.auth_role()) = 'admin' or member_id = (select public.auth_member_id()))
  );

-- ---------- Views: rollenbezogene Projektionen (security_invoker = false, Filter in der View) ----------
create view public.company_profile
  with (security_invoker = false, security_barrier = true) as
select c.id, c.name, c.phone, c.contact_email, c.logo_path, c.accent_color, c.country,
       c.shift_cancel_deadline_hours, c.onboarding_completed_at,
       public.company_is_writable(c.id) as is_writable,
       case when s.status = 'trialing' then 'profi'::public.subscription_plan else s.plan end
         as effective_plan
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
 where c.id = (select public.auth_company_id());

-- Teamliste für die Küche: nur Name, Rolle, Telefon (docs/01 §3.2)
create view public.team_directory
  with (security_invoker = false, security_barrier = true) as
select m.id, m.company_id, m.display_name, m.role, m.phone, m.joined_at
  from public.company_members m
 where m.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and m.removed_at is null
   and m.user_id is not null;

revoke all on public.company_profile, public.team_directory from anon, authenticated;
grant select on public.company_profile, public.team_directory to authenticated;

-- ---------- create_company() und Standardwerte ----------
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
  return v_company_id;
end;
$$;

-- Interne Funktion im nicht veröffentlichten Schema private: über PostgREST nicht erreichbar,
-- kein EXECUTE für anon/authenticated (sonst könnte jeder mit einer fremden company_id
-- Steuersätze in fremde Firmen schreiben).
create or replace function private.seed_company_defaults(p_company_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tax_rates (company_id, name, rate_bp, category, country, is_default) values
    (p_company_id, 'Speisen 7 %',     700, 'food',      'DE', true),
    (p_company_id, 'Getränke 19 %',  1900, 'beverage',  'DE', true),
    (p_company_id, 'Personal 19 %',  1900, 'service',   'DE', true),
    (p_company_id, 'Equipment 19 %', 1900, 'equipment', 'DE', true),
    (p_company_id, 'Anfahrt 19 %',   1900, 'travel',    'DE', true),
    (p_company_id, 'Sonstiges 19 %', 1900, 'other',     'DE', true);
  insert into public.qualifications (company_id, name, sort_order) values
    (p_company_id, 'Service', 1), (p_company_id, 'Bar', 2), (p_company_id, 'Küche vor Ort', 3),
    (p_company_id, 'Spülküche', 4), (p_company_id, 'Fahrer', 5), (p_company_id, 'Auf-/Abbau', 6);
$$;
revoke execute on function private.seed_company_defaults(uuid) from public, anon, authenticated;

revoke execute on function public.create_company(text, text, boolean, public.country_code)
  from public, anon, authenticated;
grant execute on function public.create_company(text, text, boolean, public.country_code)
  to authenticated;

-- >>>>>>>>>> 20261021090000_m1_team.sql
-- =====================================================================
-- M1 · Team: Einladungen, Rollen, Qualifikationen, Entfernen (docs/03-datenmodell.md §3.1, §4.7)
-- invitations; RPCs create/resend/revoke_invitation, invitation_preview, accept_invitation,
-- set_member_role, set_member_qualifications, remove_member, leave_company, delete_my_account.
--
-- Abweichung von der Planung (docs/07 A-16): Annehmen und Konto löschen laufen als RPC statt als
-- Edge Function. Beide brauchen nur Datenbankzugriff; so entfällt das Deployment der Functions.
-- Der Einladungstoken wird nur als SHA-256-Hash gespeichert.
-- =====================================================================

create table public.invitations (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  email                text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name         text not null check (char_length(btrim(display_name)) between 1 and 80),
  role                 public.member_role not null,
  qualification_ids    uuid[] not null default '{}',
  token_hash           bytea not null unique,
  expires_at           timestamptz not null,
  invited_by_member_id uuid,
  last_sent_at         timestamptz,
  accepted_at          timestamptz,
  accepted_member_id   uuid,
  revoked_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, invited_by_member_id)
    references public.company_members (company_id, id) on delete set null (invited_by_member_id),
  foreign key (company_id, accepted_member_id)
    references public.company_members (company_id, id) on delete set null (accepted_member_id)
);
-- keine zwei offenen Einladungen an dieselbe Adresse
create unique index invitations_open_email_idx
  on public.invitations (company_id, lower(email))
  where accepted_at is null and revoked_at is null and email is not null;
create index invitations_company_idx on public.invitations (company_id, created_at desc);

create trigger invitations_set_updated_at
  before update on public.invitations for each row execute function public.set_updated_at();

alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
-- Der Hash bleibt unlesbar; geschrieben wird nur über RPCs.
grant select (id, company_id, email, display_name, role, qualification_ids, expires_at,
              invited_by_member_id, last_sent_at, accepted_at, accepted_member_id, revoked_at,
              created_at)
  on public.invitations to authenticated;
create policy invitations_select_admin on public.invitations
  for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- ---------- Sicherung: der letzte aktive Admin bleibt ----------
create or replace function private.keep_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.removed_at is null
     and (new.role <> 'admin' or new.removed_at is not null)
     and not exists (select 1 from public.company_members m
                      where m.company_id = old.company_id and m.id <> old.id
                        and m.role = 'admin' and m.removed_at is null) then
    raise exception 'Der letzte Admin kann nicht herabgestuft oder entfernt werden'
      using errcode = 'P0001', hint = 'last_admin';
  end if;
  return new;
end;
$$;
create trigger company_members_keep_last_admin
  before update of role, removed_at on public.company_members
  for each row execute function private.keep_last_admin();

-- ---------- Hilfsfunktionen (nur intern) ----------
create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_member uuid := public.auth_member_id();
begin
  if v_member is null or public.auth_role() <> 'admin' then
    raise exception 'Nur für Admins' using errcode = '42501';
  end if;
  return v_member;
end;
$$;

-- Wirksame Stufe: in der Testphase gilt profi (docs/03 §3.7)
create or replace function private.plan_limit(p_company_id uuid, out max_members integer, out max_admins integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.max_members, l.max_admins
    from public.subscriptions s
    join public.plan_limits l
      on l.plan = case when s.status = 'trialing' then 'profi'::public.subscription_plan else s.plan end
   where s.company_id = p_company_id
$$;

-- Aktive Mitglieder plus offene, nicht abgelaufene Einladungen (ohne die angegebene Einladung)
create or replace function private.seats_used(p_company_id uuid, p_except_invitation uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.company_members m
           where m.company_id = p_company_id and m.removed_at is null)::int
       + (select count(*) from public.invitations i
           where i.company_id = p_company_id and i.accepted_at is null and i.revoked_at is null
             and i.expires_at > now() and i.id is distinct from p_except_invitation)::int
$$;

create or replace function private.admin_seats_used(p_company_id uuid, p_except_invitation uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.company_members m
           where m.company_id = p_company_id and m.removed_at is null and m.role = 'admin')::int
       + (select count(*) from public.invitations i
           where i.company_id = p_company_id and i.role = 'admin' and i.accepted_at is null
             and i.revoked_at is null and i.expires_at > now()
             and i.id is distinct from p_except_invitation)::int
$$;

create or replace function private.assert_seat_available(
  p_company_id uuid, p_role public.member_role, p_except_invitation uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit record;
begin
  select * into v_limit from private.plan_limit(p_company_id);
  if v_limit.max_members is not null
     and private.seats_used(p_company_id, p_except_invitation) + 1 > v_limit.max_members then
    raise exception 'Mitgliederlimit der Stufe erreicht' using errcode = 'P0001', hint = 'member_limit';
  end if;
  if p_role = 'admin' and v_limit.max_admins is not null
     and private.admin_seats_used(p_company_id, p_except_invitation) + 1 > v_limit.max_admins then
    raise exception 'Adminlimit der Stufe erreicht' using errcode = 'P0001', hint = 'admin_limit';
  end if;
end;
$$;

create or replace function private.new_token()
returns text
language sql
volatile
set search_path = ''
as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

create or replace function private.token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$ select sha256(convert_to(coalesce(p_token, ''), 'UTF8')) $$;

create or replace function private.assert_qualifications(p_company_id uuid, p_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(coalesce(p_ids, '{}')) as q(id)
     where not exists (select 1 from public.qualifications x
                        where x.id = q.id and x.company_id = p_company_id and x.archived_at is null)
  ) then
    raise exception 'Unbekannte Qualifikation' using errcode = 'P0001', hint = 'invalid_qualification';
  end if;
end;
$$;

-- Mitglied deaktivieren: Zugang, Kalender-Token und Qualifikationen entfernen (docs/03 §3.1).
-- Push-Tokens und Bewerbungen kommen mit M7 hinzu.
create or replace function private.deactivate_member(p_member_id uuid, p_reason text, p_anonymize boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.company_members
     set removed_at = now(), removed_reason = p_reason, user_id = null, ical_token_hash = null,
         display_name = case when p_anonymize then 'Ehemaliges Mitglied' else display_name end,
         phone        = case when p_anonymize then null else phone end,
         login_email  = case when p_anonymize then null else login_email end
   where id = p_member_id;
  delete from public.member_qualifications where member_id = p_member_id;
end;
$$;

-- ---------- Einladung anlegen / erneut senden / widerrufen ----------
create or replace function public.create_invitation(
  p_display_name text,
  p_role public.member_role,
  p_email text default null,
  p_qualification_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  uuid := private.require_admin();
  v_company uuid := public.auth_company_id();
  v_email   text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_token   text := private.new_token();
  v_exp     timestamptz := now() + interval '7 days';
  v_id      uuid;
begin
  perform public.assert_writable();
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 80 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-Mail ungültig' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if v_email is not null and exists (
       select 1 from public.company_members m
        where m.company_id = v_company and m.removed_at is null and lower(m.login_email) = v_email) then
    raise exception 'Bereits Mitglied' using errcode = 'P0001', hint = 'already_member';
  end if;
  perform private.assert_qualifications(v_company, p_qualification_ids);

  -- eine abgelaufene offene Einladung an dieselbe Adresse blockiert nicht
  if v_email is not null then
    update public.invitations set revoked_at = now()
     where company_id = v_company and lower(email) = v_email
       and accepted_at is null and revoked_at is null and expires_at <= now();
  end if;
  perform private.assert_seat_available(v_company, p_role);

  begin
    insert into public.invitations (company_id, email, display_name, role, qualification_ids,
                                    token_hash, expires_at, invited_by_member_id)
    values (v_company, v_email, btrim(p_display_name), p_role, coalesce(p_qualification_ids, '{}'),
            private.token_hash(v_token), v_exp, v_member)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Es gibt schon eine offene Einladung für diese Adresse'
      using errcode = 'P0001', hint = 'invitation_exists';
  end;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_exp);
end;
$$;

create or replace function public.resend_invitation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_inv     public.invitations;
  v_token   text := private.new_token();
  v_exp     timestamptz := now() + interval '7 days';
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_inv from public.invitations
   where id = p_id and company_id = v_company for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    raise exception 'Einladung nicht mehr offen' using errcode = 'P0001', hint = 'invitation_closed';
  end if;
  perform private.assert_seat_available(v_company, v_inv.role, v_inv.id);
  update public.invitations
     set token_hash = private.token_hash(v_token), expires_at = v_exp, last_sent_at = now()
   where id = v_inv.id;
  return jsonb_build_object('id', v_inv.id, 'token', v_token, 'expires_at', v_exp);
end;
$$;

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.invitations set revoked_at = now()
   where id = p_id and company_id = public.auth_company_id()
     and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Einladung nicht mehr offen' using errcode = 'P0001', hint = 'invitation_closed';
  end if;
end;
$$;

-- ---------- Einladung ansehen (ohne Anmeldung) und annehmen ----------
create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv  public.invitations;
  v_comp public.companies;
begin
  select * into v_inv from public.invitations where token_hash = private.token_hash(p_token);
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_comp from public.companies where id = v_inv.company_id;
  return jsonb_build_object(
    'status', case when v_inv.revoked_at is not null then 'revoked'
                   when v_inv.accepted_at is not null then 'accepted'
                   when v_inv.expires_at <= now() or v_comp.deletion_requested_at is not null then 'expired'
                   else 'open' end,
    'company_name', v_comp.name,
    'accent_color', v_comp.accent_color,
    'role', v_inv.role,
    'display_name', v_inv.display_name,
    'email', v_inv.email,
    'expires_at', v_inv.expires_at,
    'qualifications', coalesce((
      select jsonb_agg(q.name order by q.sort_order)
        from public.qualifications q where q.id = any (v_inv.qualification_ids)), '[]'::jsonb));
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_inv    public.invitations;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;

  select * into v_inv from public.invitations
   where token_hash = private.token_hash(p_token) for update;
  if not found then
    raise exception 'Einladung ungültig' using errcode = 'P0001', hint = 'invitation_invalid';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Einladung widerrufen' using errcode = 'P0001', hint = 'invitation_revoked';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Einladung schon verwendet' using errcode = 'P0001', hint = 'invitation_accepted';
  end if;
  if v_inv.expires_at <= now() or exists (
       select 1 from public.companies c where c.id = v_inv.company_id and c.deletion_requested_at is not null) then
    raise exception 'Einladung abgelaufen' using errcode = 'P0001', hint = 'invitation_expired';
  end if;
  if exists (select 1 from public.company_members m where m.user_id = v_uid) then
    raise exception 'Du bist bereits Mitglied einer Firma' using errcode = 'P0001', hint = 'already_member';
  end if;
  if v_inv.email is not null and lower(coalesce(v_email, '')) <> lower(v_inv.email) then
    raise exception 'Die Einladung gilt für eine andere E-Mail-Adresse'
      using errcode = 'P0001', hint = 'email_mismatch';
  end if;
  -- Die Einladung selbst zählt schon als belegter Platz.
  perform private.assert_seat_available(v_inv.company_id, v_inv.role, v_inv.id);

  insert into public.company_members (company_id, user_id, role, display_name, login_email)
  values (v_inv.company_id, v_uid, v_inv.role, v_inv.display_name, v_email)
  returning id into v_member;

  insert into public.member_qualifications (company_id, member_id, qualification_id)
  select v_inv.company_id, v_member, q.id
    from public.qualifications q
   where q.id = any (v_inv.qualification_ids) and q.company_id = v_inv.company_id
     and q.archived_at is null;

  update public.invitations set accepted_at = now(), accepted_member_id = v_member where id = v_inv.id;
  return v_member;
end;
$$;

-- ---------- Rollen, Qualifikationen, Entfernen ----------
create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_target  public.company_members;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_target from public.company_members
   where id = p_member_id and company_id = v_company and removed_at is null for update;
  if not found then
    raise exception 'Mitglied nicht gefunden' using errcode = 'P0001', hint = 'member_not_found';
  end if;
  if v_target.role = p_role then
    return;
  end if;
  -- Das Mitglied belegt schon einen Platz; geprüft wird nur das Adminlimit.
  if p_role = 'admin' and exists (
       select 1 from private.plan_limit(v_company) l
        where l.max_admins is not null and private.admin_seats_used(v_company) + 1 > l.max_admins) then
    raise exception 'Adminlimit der Stufe erreicht' using errcode = 'P0001', hint = 'admin_limit';
  end if;
  update public.company_members set role = p_role where id = v_target.id;  -- Trigger schützt den letzten Admin
end;
$$;

create or replace function public.set_member_qualifications(p_member_id uuid, p_qualification_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
begin
  perform private.require_admin();
  perform public.assert_writable();
  if not exists (select 1 from public.company_members m
                  where m.id = p_member_id and m.company_id = v_company and m.removed_at is null) then
    raise exception 'Mitglied nicht gefunden' using errcode = 'P0001', hint = 'member_not_found';
  end if;
  perform private.assert_qualifications(v_company, p_qualification_ids);
  delete from public.member_qualifications
   where member_id = p_member_id and not (qualification_id = any (coalesce(p_qualification_ids, '{}')));
  insert into public.member_qualifications (company_id, member_id, qualification_id)
  select v_company, p_member_id, q from unnest(coalesce(p_qualification_ids, '{}')) as q
  on conflict do nothing;
end;
$$;

-- Entfernen ist auch im Lesemodus erlaubt (docs/03 §7.7)
create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self uuid := private.require_admin();
begin
  if p_member_id = v_self then
    raise exception 'Zum Verlassen der Firma gibt es leave_company()' using errcode = 'P0001', hint = 'use_leave';
  end if;
  if not exists (select 1 from public.company_members m
                  where m.id = p_member_id and m.company_id = public.auth_company_id()
                    and m.removed_at is null) then
    raise exception 'Mitglied nicht gefunden' using errcode = 'P0001', hint = 'member_not_found';
  end if;
  perform private.deactivate_member(p_member_id, 'removed_by_admin', false);
end;
$$;

create or replace function public.leave_company()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := public.auth_member_id();
begin
  if v_member is null then
    raise exception 'Kein Mitglied' using errcode = '42501';
  end if;
  perform private.deactivate_member(v_member, 'left', false);  -- Trigger schützt den letzten Admin
end;
$$;

-- Konto endgültig löschen (US-08, App-Store-Pflicht). Die Datenbankzeile des Mitglieds bleibt
-- anonymisiert erhalten, damit spätere Auswertungen und Verlaufseinträge nicht brechen.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_member uuid := public.auth_member_id();
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if v_member is not null then
    perform private.deactivate_member(v_member, 'account_deleted', true);  -- Trigger schützt den letzten Admin
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------- Rechte ----------
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.create_invitation(text, public.member_role, text, uuid[]),
  public.resend_invitation(uuid), public.revoke_invitation(uuid),
  public.invitation_preview(text), public.accept_invitation(text),
  public.set_member_role(uuid, public.member_role),
  public.set_member_qualifications(uuid, uuid[]),
  public.remove_member(uuid), public.leave_company(), public.delete_my_account()
  from public, anon, authenticated;
grant execute on function
  public.create_invitation(text, public.member_role, text, uuid[]),
  public.resend_invitation(uuid), public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.set_member_role(uuid, public.member_role),
  public.set_member_qualifications(uuid, uuid[]),
  public.remove_member(uuid), public.leave_company(), public.delete_my_account()
  to authenticated;
-- Die Vorschau ist vor der Anmeldung nötig; der Token (244 Bit Zufall) ist das Geheimnis.
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- >>>>>>>>>> 20261022090000_m2_catalog.sql
-- =====================================================================
-- M2 · Katalog: Gerichte, Zutaten, Pakete (docs/03-datenmodell.md §3.4, §4.3, §4.6, §7.3)
-- dishes, dish_allergens, ingredients, dish_ingredients, menu_packages, menu_package_dishes;
-- RPCs save_dish, save_ingredient, save_menu_package; preisfreie Views für die Küche.
--
-- Abweichungen von der Planung (docs/07):
-- - `dish_ingredients.quantity_per_person` ist numeric(10,2) statt (10,1): 0,25 Stück Ei kommt im
--   Rechenbeispiel (docs/02 §3.3) selbst vor.
-- - Geschrieben wird nur über die RPCs (auch vom admin), damit Prüfstatus der Allergene,
--   Preisfelder und Zutatenlisten atomar und einheitlich behandelt werden.
-- =====================================================================
-- ---------- Tabellen ----------
create table public.dishes (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  description           text,
  category              public.dish_category not null default 'main',
  portion_label         text not null default 'Portion' check (char_length(btrim(portion_label)) between 1 and 30),
  price_cents           integer check (price_cents >= 0),                 -- nur admin
  tax_rate_id           uuid,                                              -- nur admin
  markup_bp             integer check (markup_bp between 0 and 100000),   -- nur admin
  diets                 public.diet_type[] not null default '{}',
  allergens_reviewed_at timestamptz,
  allergens_reviewed_by uuid,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id),
  foreign key (company_id, allergens_reviewed_by)
    references public.company_members (company_id, id) on delete set null (allergens_reviewed_by),
  constraint dishes_vegan_is_vegetarian
    check (not ('vegan' = any (diets)) or 'vegetarian' = any (diets))
);
create index dishes_list_idx on public.dishes (company_id, category, name) where archived_at is null;
create index dishes_diets_idx on public.dishes using gin (diets);
create index dishes_name_trgm_idx on public.dishes using gin (name extensions.gin_trgm_ops);

create table public.dish_allergens (
  company_id uuid not null references public.companies (id) on delete cascade,
  dish_id    uuid not null,
  allergen   public.allergen not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dish_id, allergen),
  foreign key (company_id, dish_id) references public.dishes (company_id, id) on delete cascade
);
create index dish_allergens_allergen_idx on public.dish_allergens (company_id, allergen);

create table public.ingredients (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  unit          public.ingredient_unit not null,
  price_cents   integer check (price_cents >= 0),                         -- je kg, l bzw. Stück; nur admin
  product_group text check (product_group is null or char_length(btrim(product_group)) between 1 and 60),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, id)
);
create index ingredients_name_idx on public.ingredients (company_id, lower(name));
create index ingredients_name_trgm_idx on public.ingredients using gin (name extensions.gin_trgm_ops);

create table public.dish_ingredients (
  company_id          uuid not null references public.companies (id) on delete cascade,
  dish_id             uuid not null,
  ingredient_id       uuid not null,
  -- Menge pro Person in der Basiseinheit = Einkaufsmenge der Rohware vor dem Garen (R2-7)
  quantity_per_person numeric(10, 2) not null check (quantity_per_person > 0),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (dish_id, ingredient_id),
  foreign key (company_id, dish_id) references public.dishes (company_id, id) on delete cascade,
  foreign key (company_id, ingredient_id) references public.ingredients (company_id, id)  -- NO ACTION
);
create index dish_ingredients_ingredient_idx on public.dish_ingredients (ingredient_id);

create table public.menu_packages (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  name                   text not null check (char_length(btrim(name)) between 1 and 120),
  description            text,
  price_per_person_cents integer check (price_per_person_cents >= 0),     -- nur admin
  tax_rate_id            uuid,
  markup_bp              integer check (markup_bp between 0 and 100000),
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id)
);

create table public.menu_package_dishes (
  company_id      uuid not null references public.companies (id) on delete cascade,
  menu_package_id uuid not null,
  dish_id         uuid not null,
  portion_factor  numeric(4, 2) not null default 1.00 check (portion_factor > 0),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (menu_package_id, dish_id),
  foreign key (company_id, menu_package_id)
    references public.menu_packages (company_id, id) on delete cascade,
  foreign key (company_id, dish_id) references public.dishes (company_id, id)   -- NO ACTION
);
create index menu_package_dishes_dish_idx on public.menu_package_dishes (dish_id);

do $$
declare t text;
begin
  foreach t in array array['dishes', 'dish_allergens', 'ingredients', 'dish_ingredients',
                           'menu_packages', 'menu_package_dishes']
  loop
    execute format('create trigger %1$s_set_updated_at before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------- Rechte: Basistabellen mit Preisen nur lesbar für admin, Schreiben nur per RPC ----------
grant select on public.dishes, public.ingredients, public.menu_packages to authenticated;
create policy dishes_admin_select on public.dishes for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy ingredients_admin_select on public.ingredients for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy menu_packages_admin_select on public.menu_packages for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- preisfreie Tabellen: admin und Küche lesen direkt
grant select on public.dish_allergens, public.dish_ingredients, public.menu_package_dishes to authenticated;
do $$
declare t text;
begin
  foreach t in array array['dish_allergens', 'dish_ingredients', 'menu_package_dishes']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (company_id = (select public.auth_company_id())
               and (select public.auth_role()) in ('admin', 'kitchen'))
    $f$, t);
  end loop;
end;
$$;

-- ---------- Views für die Küche: keine Preis-, Kosten- oder Aufschlagspalte ----------
create view public.kitchen_dishes
  with (security_invoker = false, security_barrier = true) as
select d.id, d.company_id, d.name, d.description, d.category, d.portion_label, d.diets,
       d.allergens_reviewed_at, d.allergens_reviewed_by, d.archived_at, d.created_at, d.updated_at,
       coalesce(array_agg(da.allergen order by da.allergen)
                  filter (where da.allergen is not null), '{}') as allergens
  from public.dishes d
  left join public.dish_allergens da on da.dish_id = d.id
 where d.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
 group by d.id;

create view public.kitchen_ingredients
  with (security_invoker = false, security_barrier = true) as
select i.id, i.company_id, i.name, i.unit, i.product_group, i.archived_at, i.created_at, i.updated_at
  from public.ingredients i
 where i.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen');

-- Allergene eines Pakets = Vereinigung, Diätformen = Schnittmenge über seine Gerichte (docs/03 §3.4)
create view public.kitchen_menu_packages
  with (security_invoker = false, security_barrier = true) as
select p.id, p.company_id, p.name, p.description, p.archived_at, p.created_at, p.updated_at,
       (select count(*)::int from public.menu_package_dishes m where m.menu_package_id = p.id) as dish_count,
       coalesce((select array_agg(distinct da.allergen order by da.allergen)
                   from public.menu_package_dishes m
                   join public.dish_allergens da on da.dish_id = m.dish_id
                  where m.menu_package_id = p.id), '{}') as allergens,
       coalesce((select array_agg(d order by d)
                   from unnest(enum_range(null::public.diet_type)) as d
                  where exists (select 1 from public.menu_package_dishes m
                                 where m.menu_package_id = p.id)
                    and not exists (select 1 from public.menu_package_dishes m
                                      join public.dishes x on x.id = m.dish_id
                                     where m.menu_package_id = p.id and not (d = any (x.diets)))),
                '{}') as diets
  from public.menu_packages p
 where p.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen');

revoke all on public.kitchen_dishes, public.kitchen_ingredients, public.kitchen_menu_packages
  from anon, authenticated;
grant select on public.kitchen_dishes, public.kitchen_ingredients, public.kitchen_menu_packages
  to authenticated;

-- ---------- RPCs ----------
create or replace function private.require_catalog_role()
returns public.member_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role public.member_role := public.auth_role();
begin
  if v_role is null or v_role not in ('admin', 'kitchen') then
    raise exception 'Keine Berechtigung für den Katalog' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

-- Gericht samt Allergenen und Zutaten in einer Transaktion speichern.
-- payload: id?, name, description, category, portion_label, diets[], allergens[], allergens_confirmed,
--          ingredients[{ingredient_id, quantity_per_person}], archived (admin),
--          price_cents, tax_rate_id, markup_bp (nur admin)
-- Felder, die im payload fehlen, bleiben bei einer Änderung unverändert.
create or replace function public.save_dish(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.member_role := private.require_catalog_role();
  v_company  uuid := public.auth_company_id();
  v_member   uuid := public.auth_member_id();
  v_id       uuid := nullif(p ->> 'id', '')::uuid;
  v_old      public.dishes;
  v_diets    public.diet_type[];
  v_new_all  public.allergen[];
  v_old_all  public.allergen[];
  v_confirm  boolean := coalesce((p ->> 'allergens_confirmed')::boolean, false);
  v_reviewed_at timestamptz;
  v_reviewed_by uuid;
begin
  perform public.assert_writable();

  if v_id is not null then
    select * into v_old from public.dishes where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Gericht nicht gefunden' using errcode = 'P0001', hint = 'dish_not_found';
    end if;
  end if;

  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  v_diets := case when p ? 'diets'
                  then coalesce(array(select jsonb_array_elements_text(p -> 'diets'))::public.diet_type[], '{}')
                  else coalesce(v_old.diets, '{}') end;
  -- vegan schließt vegetarisch ein
  if 'vegan' = any (v_diets) and not 'vegetarian' = any (v_diets) then
    v_diets := array_append(v_diets, 'vegetarian'::public.diet_type);
  end if;

  if v_id is null then
    insert into public.dishes (company_id, name, description, category, portion_label, diets)
    values (v_company, btrim(p ->> 'name'), nullif(btrim(coalesce(p ->> 'description', '')), ''),
            coalesce((p ->> 'category')::public.dish_category, 'main'),
            coalesce(nullif(btrim(p ->> 'portion_label'), ''), 'Portion'), v_diets)
    returning id into v_id;
    v_old_all := '{}';
  else
    select coalesce(array_agg(allergen order by allergen), '{}') into v_old_all
      from public.dish_allergens where dish_id = v_id;
    update public.dishes set
      name          = btrim(coalesce(p ->> 'name', name)),
      description   = case when p ? 'description' then nullif(btrim(coalesce(p ->> 'description', '')), '') else description end,
      category      = coalesce((p ->> 'category')::public.dish_category, category),
      portion_label = coalesce(nullif(btrim(p ->> 'portion_label'), ''), portion_label),
      diets         = v_diets
    where id = v_id;
  end if;

  -- Allergene: Prüfstatus fällt, sobald sich die Menge ändert und nicht gleichzeitig bestätigt wird
  if p ? 'allergens' then
    v_new_all := coalesce(array(select distinct a from jsonb_array_elements_text(p -> 'allergens') as a
                                 order by 1)::public.allergen[], '{}');
    if v_new_all is distinct from v_old_all then
      delete from public.dish_allergens where dish_id = v_id;
      insert into public.dish_allergens (company_id, dish_id, allergen)
      select v_company, v_id, a from unnest(v_new_all) as a;
      if not v_confirm then
        update public.dishes set allergens_reviewed_at = null, allergens_reviewed_by = null where id = v_id;
      end if;
    end if;
  end if;
  if v_confirm then
    update public.dishes set allergens_reviewed_at = now(), allergens_reviewed_by = v_member where id = v_id;
  end if;

  if p ? 'ingredients' then
    delete from public.dish_ingredients where dish_id = v_id;
    insert into public.dish_ingredients (company_id, dish_id, ingredient_id, quantity_per_person, sort_order)
    select v_company, v_id, (e.value ->> 'ingredient_id')::uuid,
           (e.value ->> 'quantity_per_person')::numeric, (e.ordinality - 1)::int
      from jsonb_array_elements(p -> 'ingredients') with ordinality as e;
  end if;

  -- Preisfelder und Archiv nur für admin
  if v_role = 'admin' then
    update public.dishes set
      price_cents = case when p ? 'price_cents' then (p ->> 'price_cents')::integer else price_cents end,
      tax_rate_id = case when p ? 'tax_rate_id' then nullif(p ->> 'tax_rate_id', '')::uuid else tax_rate_id end,
      markup_bp   = case when p ? 'markup_bp' then (p ->> 'markup_bp')::integer else markup_bp end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.save_ingredient(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    public.member_role := private.require_catalog_role();
  v_company uuid := public.auth_company_id();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_old     public.ingredients;
begin
  perform public.assert_writable();
  if v_id is not null then
    select * into v_old from public.ingredients where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Zutat nicht gefunden' using errcode = 'P0001', hint = 'ingredient_not_found';
    end if;
  end if;
  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  if v_id is null then
    insert into public.ingredients (company_id, name, unit, product_group)
    values (v_company, btrim(p ->> 'name'), (p ->> 'unit')::public.ingredient_unit,
            nullif(btrim(coalesce(p ->> 'product_group', '')), ''))
    returning id into v_id;
  else
    -- Die Einheit ändern, obwohl Gerichte die Zutat nutzen, würde alle Mengen verfälschen.
    if p ? 'unit' and (p ->> 'unit')::public.ingredient_unit <> v_old.unit
       and exists (select 1 from public.dish_ingredients where ingredient_id = v_id) then
      raise exception 'Einheit in Verwendung' using errcode = 'P0001', hint = 'unit_in_use';
    end if;
    update public.ingredients set
      name          = btrim(coalesce(p ->> 'name', name)),
      unit          = coalesce((p ->> 'unit')::public.ingredient_unit, unit),
      product_group = case when p ? 'product_group' then nullif(btrim(coalesce(p ->> 'product_group', '')), '') else product_group end
    where id = v_id;
  end if;

  if v_role = 'admin' then
    update public.ingredients set
      price_cents = case when p ? 'price_cents' then (p ->> 'price_cents')::integer else price_cents end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Paket speichern (nur admin; die Küche liest über kitchen_menu_packages)
create or replace function public.save_menu_package(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_old     public.menu_packages;
begin
  perform private.require_admin();
  perform public.assert_writable();
  if v_id is not null then
    select * into v_old from public.menu_packages where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Paket nicht gefunden' using errcode = 'P0001', hint = 'package_not_found';
    end if;
  end if;
  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  if v_id is null then
    insert into public.menu_packages (company_id, name, description, price_per_person_cents, tax_rate_id, markup_bp)
    values (v_company, btrim(p ->> 'name'), nullif(btrim(coalesce(p ->> 'description', '')), ''),
            (p ->> 'price_per_person_cents')::integer, nullif(p ->> 'tax_rate_id', '')::uuid,
            (p ->> 'markup_bp')::integer)
    returning id into v_id;
  else
    update public.menu_packages set
      name        = btrim(coalesce(p ->> 'name', name)),
      description = case when p ? 'description' then nullif(btrim(coalesce(p ->> 'description', '')), '') else description end,
      price_per_person_cents = case when p ? 'price_per_person_cents' then (p ->> 'price_per_person_cents')::integer else price_per_person_cents end,
      tax_rate_id = case when p ? 'tax_rate_id' then nullif(p ->> 'tax_rate_id', '')::uuid else tax_rate_id end,
      markup_bp   = case when p ? 'markup_bp' then (p ->> 'markup_bp')::integer else markup_bp end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;

  if p ? 'dishes' then
    delete from public.menu_package_dishes where menu_package_id = v_id;
    insert into public.menu_package_dishes (company_id, menu_package_id, dish_id, portion_factor, sort_order)
    select v_company, v_id, (e.value ->> 'dish_id')::uuid,
           coalesce((e.value ->> 'portion_factor')::numeric, 1), (e.ordinality - 1)::int
      from jsonb_array_elements(p -> 'dishes') with ordinality as e;
  end if;
  return v_id;
end;
$$;

revoke execute on function private.require_catalog_role() from public, anon, authenticated;
revoke execute on function public.save_dish(jsonb), public.save_ingredient(jsonb),
                           public.save_menu_package(jsonb) from public, anon, authenticated;
grant execute on function public.save_dish(jsonb), public.save_ingredient(jsonb),
                          public.save_menu_package(jsonb) to authenticated;

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

-- >>>>>>>>>> 20261024090000_m4_intake.sql
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

-- >>>>>>>>>> 20261025090000_m4_quotes.sql
-- =====================================================================
-- M4 · Angebote: Entwurf und Positionen (docs/03-datenmodell.md §3.3, §7.4; docs/02 §2, §3)
-- quotes, quote_items, Angebotsnummer A-JJJJ-NNNN, RPCs ensure_quote() und save_quote().
--
-- Abweichung von der Planung (docs/07): Diese Migration legt nur den Entwurfsstand an. Die Spalten für
-- Snapshot, Versand, Portal und Annahme (snapshot, send_log, binding_*, portal_selection, acceptance_*,
-- pending_change …) kommen mit dem Versand (M5) per `alter table`; `revision` ist bis dahin immer 0.
-- =====================================================================
create table public.quotes (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  event_id            uuid not null unique,
  number              text not null,
  status              public.quote_status not null default 'draft',
  revision            integer not null default 0 check (revision >= 0),
  pricing_mode        public.pricing_mode not null default 'flat',
  markup_bp           integer not null default 20000 check (markup_bp between 0 and 100000),
  price_display       public.price_basis not null default 'gross',
  discount_bp         integer not null default 0 check (discount_bp between 0 and 10000),
  discount_cents      integer not null default 0 check (discount_cents >= 0),
  deposit_bp          integer check (deposit_bp between 0 and 10000),
  deposit_cents       integer check (deposit_cents >= 0),
  deposit_due_on      date,
  customer_reference  text,
  intro_text          text,
  terms_text          text,
  closing_text        text,
  valid_until         date,
  total_net_cents     integer not null default 0,
  total_tax_cents     integer not null default 0,
  total_gross_cents   integer not null default 0,
  cost_total_cents    integer,
  cost_incomplete     boolean not null default false,
  has_unsent_changes  boolean not null default false,
  editor_active_seconds integer not null default 0 check (editor_active_seconds >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, number),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  constraint quotes_one_discount check (discount_bp = 0 or discount_cents = 0),
  constraint quotes_one_deposit check (deposit_bp is null or deposit_cents is null)
);

create table public.quote_items (
  id                         uuid primary key default gen_random_uuid(),
  company_id                 uuid not null references public.companies (id) on delete cascade,
  quote_id                   uuid not null,
  type                       public.quote_item_type not null,
  sort_order                 integer not null default 0,
  menu_package_id            uuid,
  dish_id                    uuid,
  name                       text not null check (char_length(btrim(name)) between 1 and 200),
  description                text,
  unit_label                 text not null default 'Person',
  quantity_mode              public.quantity_mode not null default 'fixed',
  quantity                   numeric(10, 2) not null default 1 check (quantity >= 0),
  hours                      numeric(5, 2) check (hours > 0 and (hours * 4) = trunc(hours * 4)),
  unit_price_cents           integer check (unit_price_cents >= 0),
  price_is_manual            boolean not null default false,
  markup_bp                  integer check (markup_bp between 0 and 100000),
  unit_cost                  numeric(12, 4) check (unit_cost >= 0),
  discount_bp                integer not null default 0 check (discount_bp between 0 and 10000),
  tax_rate_id                uuid,
  line_net_cents             integer,
  line_tax_cents             integer,
  line_gross_cents           integer,
  choice_group               text,
  is_selected                boolean not null default true,
  customer_can_edit_quantity boolean not null default false,
  is_heading                 boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade,
  foreign key (company_id, menu_package_id) references public.menu_packages (company_id, id),
  foreign key (company_id, dish_id) references public.dishes (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id),
  constraint quote_items_package check ((type = 'package') = (menu_package_id is not null)),
  constraint quote_items_dish check ((type = 'dish') = (dish_id is not null)),
  constraint quote_items_hours check (hours is null or type = 'service'),
  constraint quote_items_heading check (not is_heading or (type = 'custom' and unit_price_cents is null)),
  constraint quote_items_price check (unit_price_cents is not null or is_heading)
);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);
create index quote_items_dish_idx on public.quote_items (dish_id) where dish_id is not null;
create index quote_items_package_idx on public.quote_items (menu_package_id) where menu_package_id is not null;
create index quote_items_tax_idx on public.quote_items (tax_rate_id) where tax_rate_id is not null;

create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger quote_items_set_updated_at before update on public.quote_items
  for each row execute function public.set_updated_at();
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
revoke all on public.quotes, public.quote_items from anon, authenticated;

-- Lesen nur admin; Schreiben nur über die RPCs (Systemfelder wie number und status nie direkt)
grant select on public.quotes, public.quote_items to authenticated;
create policy quotes_admin_select on public.quotes for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy quote_items_admin_select on public.quote_items for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- Angebotsnummer A-JJJJ-NNNN je Firma, fortlaufend und race-sicher (Zeilensperre auf companies)
create or replace function private.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Berlin'))::integer;
  v_c    record;
  v_seq  integer;
begin
  select quote_number_year, quote_number_seq into v_c
    from public.companies where id = new.company_id for update;
  v_seq := case when v_c.quote_number_year is distinct from v_year then 1 else v_c.quote_number_seq + 1 end;
  update public.companies set quote_number_year = v_year, quote_number_seq = v_seq where id = new.company_id;
  new.number := 'A-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;
create trigger quotes_assign_number before insert on public.quotes
  for each row execute function private.assign_quote_number();

-- ---------- RPCs ----------
-- Entwurf zum Auftrag holen oder anlegen (Standardwerte aus Firma und Kundentyp)
create or replace function public.ensure_quote(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_id      uuid;
  v_event   public.events;
  v_c       public.companies;
  v_type    public.customer_type;
begin
  perform private.require_admin();
  select id into v_id from public.quotes where event_id = p_event_id and company_id = v_company;
  if v_id is not null then
    return v_id;
  end if;
  perform public.assert_writable();
  select * into v_event from public.events where id = p_event_id and company_id = v_company;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;
  if v_event.status in ('declined', 'cancelled', 'invoiced') then
    raise exception 'Für diesen Auftrag gibt es kein Angebot mehr' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  select * into v_c from public.companies where id = v_company;
  select type into v_type from public.customers where id = v_event.customer_id;
  insert into public.quotes (company_id, event_id, pricing_mode, markup_bp, price_display, intro_text, terms_text,
                             closing_text, valid_until)
  values (v_company, p_event_id, v_c.default_pricing_mode, v_c.default_markup_bp,
          case when v_type = 'business' then 'net' else 'gross' end::public.price_basis,
          v_c.quote_intro_text, v_c.quote_terms_text, v_c.quote_closing_text,
          ((now() at time zone 'Europe/Berlin')::date + v_c.quote_validity_days))
  returning id into v_id;
  return v_id;
end;
$$;

-- Entwurf speichern: Kopf und alle Positionen in einer Transaktion (die App rechnet mit dem TS-Modul)
-- payload: { quote_id, header: {…}, items: [{id, type, …}], editor_seconds }
create or replace function public.save_quote(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
  v_h       jsonb := p -> 'header';
  v_t       jsonb := v_h -> 'totals';
  i         jsonb;
  n         integer := 0;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes
   where id = (p ->> 'quote_id')::uuid and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if exists (select 1 from public.events e where e.id = v_q.event_id and e.status in ('declined', 'cancelled', 'invoiced')) then
    raise exception 'Das Angebot ist schreibgeschützt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  update public.quotes set
    pricing_mode       = coalesce((v_h ->> 'pricing_mode')::public.pricing_mode, pricing_mode),
    markup_bp          = coalesce((v_h ->> 'markup_bp')::integer, markup_bp),
    price_display      = coalesce((v_h ->> 'price_display')::public.price_basis, price_display),
    discount_bp        = coalesce((v_h ->> 'discount_bp')::integer, 0),
    discount_cents     = coalesce((v_h ->> 'discount_cents')::integer, 0),
    deposit_bp         = (v_h ->> 'deposit_bp')::integer,
    deposit_cents      = (v_h ->> 'deposit_cents')::integer,
    deposit_due_on     = nullif(v_h ->> 'deposit_due_on', '')::date,
    customer_reference = nullif(btrim(coalesce(v_h ->> 'customer_reference', '')), ''),
    intro_text         = nullif(btrim(coalesce(v_h ->> 'intro_text', '')), ''),
    terms_text         = nullif(btrim(coalesce(v_h ->> 'terms_text', '')), ''),
    closing_text       = nullif(btrim(coalesce(v_h ->> 'closing_text', '')), ''),
    valid_until        = nullif(v_h ->> 'valid_until', '')::date,
    total_net_cents    = coalesce((v_t ->> 'net')::integer, 0),
    total_tax_cents    = coalesce((v_t ->> 'tax')::integer, 0),
    total_gross_cents  = coalesce((v_t ->> 'gross')::integer, 0),
    cost_total_cents   = (v_h ->> 'cost_total_cents')::integer,
    cost_incomplete    = coalesce((v_h ->> 'cost_incomplete')::boolean, false),
    has_unsent_changes = v_q.revision > 0,
    editor_active_seconds = editor_active_seconds + greatest(coalesce((p ->> 'editor_seconds')::integer, 0), 0)
  where id = v_q.id;

  delete from public.quote_items where quote_id = v_q.id;
  for i in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    insert into public.quote_items (
      id, company_id, quote_id, type, sort_order, menu_package_id, dish_id, name, description, unit_label,
      quantity_mode, quantity, hours, unit_price_cents, price_is_manual, markup_bp, unit_cost, discount_bp,
      tax_rate_id, line_net_cents, line_tax_cents, line_gross_cents, choice_group, is_selected,
      customer_can_edit_quantity, is_heading)
    values (
      coalesce((i ->> 'id')::uuid, gen_random_uuid()), v_company, v_q.id, (i ->> 'type')::public.quote_item_type, n,
      nullif(i ->> 'menu_package_id', '')::uuid, nullif(i ->> 'dish_id', '')::uuid, btrim(i ->> 'name'),
      nullif(btrim(coalesce(i ->> 'description', '')), ''), coalesce(nullif(i ->> 'unit_label', ''), 'Person'),
      coalesce((i ->> 'quantity_mode')::public.quantity_mode, 'fixed'), coalesce((i ->> 'quantity')::numeric, 1),
      (i ->> 'hours')::numeric, (i ->> 'unit_price_cents')::integer, coalesce((i ->> 'price_is_manual')::boolean, false),
      (i ->> 'markup_bp')::integer, (i ->> 'unit_cost')::numeric, coalesce((i ->> 'discount_bp')::integer, 0),
      nullif(i ->> 'tax_rate_id', '')::uuid, (i ->> 'line_net_cents')::integer, (i ->> 'line_tax_cents')::integer,
      (i ->> 'line_gross_cents')::integer, nullif(i ->> 'choice_group', ''), coalesce((i ->> 'is_selected')::boolean, true),
      coalesce((i ->> 'customer_can_edit_quantity')::boolean, false), coalesce((i ->> 'is_heading')::boolean, false));
    n := n + 1;
  end loop;
end;
$$;

revoke execute on function private.assign_quote_number() from public, anon, authenticated;
revoke execute on function public.ensure_quote(uuid), public.save_quote(jsonb) from public, anon, authenticated;
grant execute on function public.ensure_quote(uuid), public.save_quote(jsonb) to authenticated;

-- >>>>>>>>>> 20261026090000_m4_copy_quote.sql
-- =====================================================================
-- M4 · copy_event() kopiert jetzt auch das Angebot (docs/06 §1.7)
-- Das Angebot der Kopie ist ein neuer Entwurf (Revision 0, neue Nummer, Gültigkeit ab heute).
-- Die Referenz des Kunden wird nicht übernommen. Rechte und Signatur bleiben wie in M3.
-- =====================================================================
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
  v_q       public.quotes;
  v_c       public.companies;
  v_newq    uuid;
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

  select * into v_q from public.quotes where event_id = v_src.id and company_id = v_company;
  select * into v_c from public.companies where id = v_company;

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

    -- Angebot als neuer Entwurf: Revision 0, neue Nummer, ohne Referenz des Kunden und ohne Anzahlungstermin
    if v_q.id is not null then
      insert into public.quotes (company_id, event_id, pricing_mode, markup_bp, price_display, discount_bp,
                                 discount_cents, deposit_bp, deposit_cents, intro_text, terms_text, closing_text,
                                 valid_until, total_net_cents, total_tax_cents, total_gross_cents,
                                 cost_total_cents, cost_incomplete)
      values (v_company, v_new, v_q.pricing_mode, v_q.markup_bp, v_q.price_display, v_q.discount_bp,
              v_q.discount_cents, v_q.deposit_bp, v_q.deposit_cents, v_q.intro_text, v_q.terms_text,
              v_q.closing_text, (now() at time zone 'Europe/Berlin')::date + v_c.quote_validity_days,
              v_q.total_net_cents, v_q.total_tax_cents, v_q.total_gross_cents, v_q.cost_total_cents,
              v_q.cost_incomplete)
      returning id into v_newq;
      insert into public.quote_items (company_id, quote_id, type, sort_order, menu_package_id, dish_id, name,
                                      description, unit_label, quantity_mode, quantity, hours, unit_price_cents,
                                      price_is_manual, markup_bp, unit_cost, discount_bp, tax_rate_id,
                                      line_net_cents, line_tax_cents, line_gross_cents, choice_group,
                                      is_selected, customer_can_edit_quantity, is_heading)
      select v_company, v_newq, i.type, i.sort_order, i.menu_package_id, i.dish_id, i.name, i.description,
             i.unit_label, i.quantity_mode, i.quantity, i.hours, i.unit_price_cents, i.price_is_manual,
             i.markup_bp, i.unit_cost, i.discount_bp, i.tax_rate_id, i.line_net_cents, i.line_tax_cents,
             i.line_gross_cents, i.choice_group, i.is_selected, i.customer_can_edit_quantity, i.is_heading
        from public.quote_items i where i.quote_id = v_q.id;
    end if;
    v_ids := v_ids || v_new;
  end loop;
  return v_ids;
end;
$$;

-- >>>>>>>>>> 20261027090000_m5_send.sql
-- =====================================================================
-- M5 · Angebot versenden: Revisionen mit eingefrorenem Stand, Portal-Links (docs/03 §3.3, §4.7; docs/02 §2.4)
--
-- Abweichung von der Planung (docs/07 A-25): Es gibt keine Edge Function für den Versand. `send_quote()` ist ein
-- RPC für Admins; die App baut den Snapshot mit dem TS-Rechenmodul, die Datenbank prüft ihn auf Konsistenz,
-- berechnet den Hash und legt Revision, Portal-Link und Statuswechsel in EINER Transaktion an. Das PDF entsteht
-- auf dem Gerät aus dem Snapshot; die Datenbank speichert jede Revision (`quote_revisions`), nicht das PDF.
-- =====================================================================
alter table public.quotes
  add column snapshot       jsonb,
  add column snapshot_hash  text,
  add column sent_at        timestamptz,
  add column sent_via       text check (sent_via in ('email', 'link')),
  add column send_mode      text check (send_mode in ('confirm_required', 'info_only')),
  add constraint quotes_snapshot_iff_sent check ((revision = 0) = (snapshot is null));

-- Jede versendete Revision bleibt abrufbar (US-28.2); nur anhängen
create table public.quote_revisions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  quote_id      uuid not null,
  revision      integer not null check (revision > 0),
  snapshot      jsonb not null,
  snapshot_hash text not null,
  sent_at       timestamptz not null default now(),
  sent_via      text not null check (sent_via in ('email', 'link')),
  send_mode     text check (send_mode in ('confirm_required', 'info_only')),
  member_id     uuid,
  unique (quote_id, revision),
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade
);
alter table public.quote_revisions enable row level security;
revoke all on public.quote_revisions from anon, authenticated;
grant select on public.quote_revisions to authenticated;
create policy quote_revisions_admin_select on public.quote_revisions for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- Portal-Links: gespeichert wird nur der Hash, der Klartext erscheint genau einmal bei der Ausgabe
create table public.portal_tokens (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  quote_id    uuid not null,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade
);
create index portal_tokens_quote_idx on public.portal_tokens (quote_id);
alter table public.portal_tokens enable row level security;
revoke all on public.portal_tokens from anon, authenticated;

-- Neuer Link: 2 × UUID v4 aus dem kryptografischen Zufallsgenerator = 244 Bit
create or replace function private.new_portal_token(p_company uuid, p_quote uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into public.portal_tokens (company_id, quote_id, token_hash)
  values (p_company, p_quote, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end;
$$;

-- ---------- Versand ----------
-- p_snapshot: Format siehe docs/03 §3.3 (schema_version 1). Rückgabe: {revision, token, snapshot_hash}
create or replace function public.send_quote(
  p_quote_id uuid,
  p_expected_revision integer,
  p_snapshot jsonb,
  p_via text,
  p_send_mode text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  uuid := public.auth_company_id();
  v_member   uuid;
  v_q        public.quotes;
  v_event    public.events;
  v_rev      integer;
  v_hash     text;
  v_token    text;
  v_live     text[];
  v_snap     text[];
  v_sum_net  bigint;
  v_sum_tax  bigint;
  v_items    jsonb := coalesce(p_snapshot -> 'items', '[]'::jsonb);
begin
  v_member := private.require_admin();
  perform public.assert_writable();
  if p_via not in ('email', 'link') then
    raise exception 'Versandweg ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision <> p_expected_revision then
    raise exception 'Das Angebot wurde inzwischen geändert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  select * into v_event from public.events where id = v_q.event_id and company_id = v_company for update;
  -- aus declined/cancelled/completed/invoiced nie wieder ein Angebot versenden (Endzustände, R2-3/R2-4)
  if v_event.status not in ('inquiry', 'quoted', 'optioned', 'confirmed') then
    raise exception 'Für diesen Auftrag kann kein Angebot mehr versendet werden'
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if v_event.status = 'confirmed' and p_send_mode is null then
    raise exception 'Versandart fehlt' using errcode = 'P0001', hint = 'send_mode_required';
  end if;
  if p_send_mode is not null and p_send_mode not in ('confirm_required', 'info_only') then
    raise exception 'Versandart ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  -- Konsistenz des Snapshots mit dem Live-Stand
  if (p_snapshot ->> 'schema_version') is distinct from '1'
     or (p_snapshot ->> 'revision')::integer is distinct from p_expected_revision + 1
     or (p_snapshot -> 'quote' ->> 'number') is distinct from v_q.number then
    raise exception 'Snapshot passt nicht zum Angebot' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  select coalesce(array_agg(id::text order by id::text), '{}') into v_live
    from public.quote_items where quote_id = v_q.id;
  select coalesce(array_agg(x ->> 'id' order by x ->> 'id'), '{}') into v_snap
    from jsonb_array_elements(v_items) x;
  if v_live is distinct from v_snap then
    raise exception 'Positionen des Snapshots weichen vom Angebot ab' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = v_q.id and not is_heading) then
    raise exception 'Das Angebot hat keine Position' using errcode = 'P0001', hint = 'quote_empty';
  end if;
  select coalesce(sum((x ->> 'line_net_cents')::bigint), 0) into v_sum_net
    from jsonb_array_elements(v_items) x
   where coalesce((x ->> 'is_selected')::boolean, true) and not coalesce((x ->> 'is_heading')::boolean, false);
  select coalesce(sum((x ->> 'tax_cents')::bigint), 0) into v_sum_tax
    from jsonb_array_elements(coalesce(p_snapshot -> 'totals' -> 'tax', '[]'::jsonb)) x;
  if v_sum_net <> (p_snapshot -> 'totals' ->> 'net_cents')::bigint
     or (p_snapshot -> 'totals' ->> 'gross_cents')::bigint - (p_snapshot -> 'totals' ->> 'net_cents')::bigint <> v_sum_tax then
    raise exception 'Summen im Snapshot stimmen nicht' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;

  v_rev  := p_expected_revision + 1;
  v_hash := encode(sha256(convert_to(p_snapshot::text, 'UTF8')), 'hex');

  update public.quotes set
    revision = v_rev, status = 'sent', snapshot = p_snapshot, snapshot_hash = v_hash,
    sent_at = now(), sent_via = p_via, send_mode = p_send_mode, has_unsent_changes = false,
    total_net_cents = (p_snapshot -> 'totals' ->> 'net_cents')::integer,
    total_gross_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer,
    total_tax_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer - (p_snapshot -> 'totals' ->> 'net_cents')::integer
  where id = v_q.id;
  insert into public.quote_revisions (company_id, quote_id, revision, snapshot, snapshot_hash, sent_via, send_mode, member_id)
  values (v_company, v_q.id, v_rev, p_snapshot, v_hash, p_via, p_send_mode, v_member);

  if v_event.status = 'inquiry' then
    update public.events set status = 'quoted' where id = v_event.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, actor_member_id)
    values (v_company, v_event.id, 'inquiry', 'quoted', 'member', v_member);
  end if;

  v_token := private.new_portal_token(v_company, v_q.id);
  return jsonb_build_object('revision', v_rev, 'token', v_token, 'snapshot_hash', v_hash);
end;
$$;

-- Neuen Link ausgeben („Link kopieren“); frühere Links bleiben gültig und zeigen immer die aktuelle Revision
create or replace function public.issue_portal_token(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision = 0 then
    raise exception 'Das Angebot wurde noch nicht versendet' using errcode = 'P0001', hint = 'not_sent';
  end if;
  return private.new_portal_token(v_company, v_q.id);
end;
$$;

-- Alle Links sperren (z. B. bei falschem Empfänger)
create or replace function public.revoke_portal_tokens(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.portal_tokens set revoked_at = now()
   where quote_id = p_quote_id and company_id = public.auth_company_id() and revoked_at is null;
end;
$$;

-- Änderungen seit dem letzten Versand verwerfen: Entwurf = letzter versendeter Stand
create or replace function public.discard_quote_changes(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
  v_s       jsonb;
  v_old     jsonb;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision = 0 or v_q.snapshot is null then
    raise exception 'Es gibt keinen versendeten Stand' using errcode = 'P0001', hint = 'not_sent';
  end if;
  if exists (select 1 from public.events e where e.id = v_q.event_id and e.status in ('declined', 'cancelled', 'invoiced')) then
    raise exception 'Das Angebot ist schreibgeschützt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  v_s := v_q.snapshot;

  -- Kalkulationsdaten stehen nicht im Snapshot: für Positionen, die es noch gibt, bleiben sie erhalten
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'markup_bp', markup_bp, 'unit_cost', unit_cost)), '[]'::jsonb)
    into v_old from public.quote_items where quote_id = v_q.id;
  delete from public.quote_items where quote_id = v_q.id;
  insert into public.quote_items (
    id, company_id, quote_id, type, sort_order, menu_package_id, dish_id, name, description, unit_label,
    quantity_mode, quantity, hours, unit_price_cents, price_is_manual, markup_bp, unit_cost, discount_bp,
    tax_rate_id, line_net_cents, line_tax_cents, line_gross_cents, choice_group, is_selected,
    customer_can_edit_quantity, is_heading)
  select (x.item ->> 'id')::uuid, v_company, v_q.id, (x.item ->> 'type')::public.quote_item_type, x.ord::integer - 1,
         nullif(x.item ->> 'menu_package_id', '')::uuid, nullif(x.item ->> 'dish_id', '')::uuid,
         x.item ->> 'name', nullif(x.item ->> 'description', ''), coalesce(x.item ->> 'unit_label', 'Person'),
         coalesce((x.item ->> 'quantity_mode')::public.quantity_mode, 'fixed'),
         coalesce((x.item ->> 'quantity')::numeric, 1), (x.item ->> 'hours')::numeric,
         (x.item ->> 'unit_price_cents')::integer, coalesce((x.item ->> 'price_is_manual')::boolean, false),
         (o ->> 'markup_bp')::integer, (o ->> 'unit_cost')::numeric, coalesce((x.item ->> 'discount_bp')::integer, 0),
         nullif(x.item ->> 'tax_rate_id', '')::uuid, (x.item ->> 'line_net_cents')::integer,
         (x.item ->> 'line_tax_cents')::integer, (x.item ->> 'line_gross_cents')::integer,
         nullif(x.item ->> 'choice_group', ''), coalesce((x.item ->> 'is_selected')::boolean, true),
         coalesce((x.item ->> 'customer_can_edit_quantity')::boolean, false),
         coalesce((x.item ->> 'is_heading')::boolean, false)
    from jsonb_array_elements(v_s -> 'items') with ordinality as x(item, ord)
    left join lateral (select e as o from jsonb_array_elements(v_old) e where e ->> 'id' = x.item ->> 'id' limit 1) m on true;

  update public.quotes set
    price_display      = (v_s -> 'quote' ->> 'price_display')::public.price_basis,
    discount_bp        = coalesce((v_s -> 'quote' ->> 'discount_bp')::integer, 0),
    discount_cents     = coalesce((v_s -> 'quote' ->> 'discount_cents')::integer, 0),
    deposit_bp         = (v_s -> 'quote' -> 'deposit' ->> 'bp')::integer,
    deposit_cents      = (v_s -> 'quote' -> 'deposit' ->> 'cents')::integer,
    deposit_due_on     = nullif(v_s -> 'quote' -> 'deposit' ->> 'due_on', '')::date,
    customer_reference = nullif(v_s -> 'quote' ->> 'customer_reference', ''),
    intro_text         = nullif(v_s -> 'quote' ->> 'intro_text', ''),
    terms_text         = nullif(v_s -> 'quote' ->> 'terms_text', ''),
    closing_text       = nullif(v_s -> 'quote' ->> 'closing_text', ''),
    total_net_cents    = (v_s -> 'totals' ->> 'net_cents')::integer,
    total_gross_cents  = (v_s -> 'totals' ->> 'gross_cents')::integer,
    total_tax_cents    = (v_s -> 'totals' ->> 'gross_cents')::integer - (v_s -> 'totals' ->> 'net_cents')::integer,
    has_unsent_changes = false
  where id = v_q.id;
end;
$$;

revoke execute on function private.new_portal_token(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.send_quote(uuid, integer, jsonb, text, text), public.issue_portal_token(uuid),
  public.revoke_portal_tokens(uuid), public.discard_quote_changes(uuid) from public, anon, authenticated;
grant execute on function public.send_quote(uuid, integer, jsonb, text, text), public.issue_portal_token(uuid),
  public.revoke_portal_tokens(uuid), public.discard_quote_changes(uuid) to authenticated;

-- >>>>>>>>>> 20261028090000_m6_portal.sql
-- =====================================================================
-- M6 · Kundenportal: Ansehen, Annehmen, Ablehnen, Änderungswunsch (docs/02 §4, docs/03 §3.3, §5)
--
-- Abweichung von der Planung (docs/07 A-28): Es gibt keine Edge Function `portal-api`. Die Portal-RPCs sind
-- für `anon` ausführbar; das Geheimnis ist der Token (244 Bit, nur als Hash gespeichert). Jede Funktion
-- prüft den Token selbst und gibt ausschließlich eine feste Auswahl an Feldern zurück (Snapshot ohne
-- Kalkulationsdaten, Firmenkontakt). Ohne Rate-Limit: bei 244 Bit ist Raten aussichtslos.
-- Umfang dieses Schritts: Ansehen, Annehmen, Ablehnen, Änderungswunsch als Nachricht. Wahlgruppen, Sonderessen
-- im Portal und Benachrichtigungen folgen später.
-- =====================================================================
alter table public.quotes
  add column first_viewed_at            timestamptz,
  add column last_viewed_at             timestamptz,
  add column accepted_at                timestamptz,
  add column acceptance_revision        integer,
  add column acceptance_name            text,
  add column acceptance_email          text,
  add column acceptance_comment         text,
  add column acceptance_snapshot_hash   text,
  add column acceptance_total_gross_cents integer,
  add column acceptance_log             jsonb not null default '[]'::jsonb,
  add column declined_at                timestamptz,
  add column decline_reason             text,
  add column decline_comment            text,
  add column pending_change             jsonb,
  add constraint quotes_acceptance_complete
    check ((accepted_at is null) = (acceptance_revision is null)
           and (acceptance_revision is null or acceptance_revision <= revision));

-- Token → Angebot (nur gültige, nicht gesperrte Links); NULL bei unbekanntem Token
create or replace function private.portal_quote_id(p_token text, out o_quote uuid, out o_revoked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.quote_id, t.revoked_at is not null
    from public.portal_tokens t
   where t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- Spätester Termin für Änderungen (Änderungsschluss, R2-6)
create or replace function private.portal_changes_until(p_event public.events, p_company public.companies)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(p_event.changes_until,
                  p_event.starts_at - make_interval(hours => case p_event.kind
                    when 'business_lunch' then coalesce(p_company.portal_change_lead_hours_business_lunch, 24)
                    else coalesce(p_company.portal_change_lead_hours, 72) end))
$$;

create or replace function public.portal_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_revoked boolean;
  v_q       public.quotes;
  v_e       public.events;
  v_c       public.companies;
  v_until   timestamptz;
  v_company jsonb;
begin
  select o_quote, o_revoked into v_id, v_revoked from private.portal_quote_id(p_token);
  if v_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  v_company := jsonb_build_object('name', v_c.name, 'accent_color', v_c.accent_color, 'phone', v_c.phone,
                                  'contact_email', v_c.contact_email, 'website', v_c.website,
                                  'imprint_url', v_c.imprint_url, 'privacy_policy_url', v_c.privacy_policy_url);
  if v_revoked or v_q.snapshot is null then
    return jsonb_build_object('state', 'revoked',
                              'company', jsonb_build_object('name', v_c.name, 'phone', v_c.phone,
                                                            'contact_email', v_c.contact_email));
  end if;

  update public.quotes set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
   where id = v_q.id;
  v_until := private.portal_changes_until(v_e, v_c);
  return jsonb_build_object(
    'state', 'ok',
    'company', v_company,
    'quote', jsonb_build_object(
      'number', v_q.number, 'revision', v_q.revision, 'status', v_q.status, 'valid_until', v_q.valid_until,
      'expired', v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date,
      'sent_at', v_q.sent_at, 'send_mode', v_q.send_mode,
      'accepted_at', v_q.accepted_at, 'acceptance_revision', v_q.acceptance_revision,
      'acceptance_name', v_q.acceptance_name, 'declined_at', v_q.declined_at),
    'event', jsonb_build_object('status', v_e.status, 'changes_until', v_until, 'changes_locked', now() > v_until),
    'snapshot', v_q.snapshot,
    'has_pending_change', v_q.pending_change is not null);
end;
$$;

create or replace function public.portal_accept_quote(
  p_token text, p_revision integer, p_name text, p_email text default null, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id for update;
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'name_required';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-Mail ungültig' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Angebot ist abgelaufen' using errcode = 'P0001', hint = 'quote_expired';
  end if;

  if v_e.status in ('quoted', 'optioned') and v_q.status = 'sent' then
    update public.events set status = 'confirmed', option_expires_at = null where id = v_e.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, reason)
    values (v_e.company_id, v_e.id, v_e.status, 'confirmed', 'portal', 'Angebot im Portal angenommen von ' || v_name);
  elsif v_e.status = 'confirmed' and v_q.send_mode = 'confirm_required'
        and (v_q.acceptance_revision is null or v_q.acceptance_revision < v_q.revision) then
    null; -- neue Fassung eines bestätigten Auftrags bestätigen
  else
    raise exception 'Das Angebot lässt sich nicht mehr annehmen' using errcode = 'P0001', hint = 'not_acceptable';
  end if;

  update public.quotes set
    status = 'accepted', accepted_at = now(), acceptance_revision = revision, acceptance_name = v_name,
    acceptance_email = v_email, acceptance_comment = nullif(btrim(coalesce(p_comment, '')), ''),
    acceptance_snapshot_hash = snapshot_hash, acceptance_total_gross_cents = total_gross_cents,
    acceptance_log = acceptance_log || jsonb_build_array(jsonb_build_object(
      'at', now(), 'revision', revision, 'channel', 'portal', 'name', v_name, 'email', v_email,
      'snapshot_hash', snapshot_hash, 'total_gross_cents', total_gross_cents)),
    pending_change = null
  where id = v_q.id;
  return jsonb_build_object('accepted_at', now(), 'revision', v_q.revision);
end;
$$;

create or replace function public.portal_decline_quote(
  p_token text, p_revision integer, p_reason text default null, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_rev    boolean;
  v_q      public.quotes;
  v_e      public.events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to     public.event_status;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id for update;
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  -- quoted → declined, optioned → cancelled; beides endgültig (R2-4); ein bestätigter Auftrag lässt sich nicht ablehnen
  if v_e.status not in ('quoted', 'optioned') or v_q.status <> 'sent' then
    raise exception 'Das Angebot lässt sich nicht mehr ablehnen' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  v_to := case v_e.status when 'quoted' then 'declined' else 'cancelled' end;
  update public.events set status = v_to, option_expires_at = null where id = v_e.id;
  insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, reason)
  values (v_e.company_id, v_e.id, v_e.status, v_to, 'portal',
          'Im Portal abgelehnt' || coalesce(': ' || v_reason, ''));
  update public.quotes set status = 'declined', declined_at = now(), decline_reason = v_reason,
         decline_comment = nullif(btrim(coalesce(p_comment, '')), ''), pending_change = null
   where id = v_q.id;
end;
$$;

-- Änderungswunsch als Nachricht an den Caterer; ersetzt einen offenen
create or replace function public.portal_request_change(
  p_token text, p_revision integer, p_name text, p_comment text, p_guest_count integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
  v_c     public.companies;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_text  text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if now() > private.portal_changes_until(v_e, v_c) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  if v_name is null or (v_text is null and p_guest_count is null) then
    raise exception 'Name und Nachricht fehlen' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_guest_count is not null and p_guest_count not between 1 and 10000 then
    raise exception 'Gästezahl ungültig' using errcode = 'P0001', hint = 'invalid_dates';
  end if;
  update public.quotes set pending_change = jsonb_build_object(
    'requested_at', now(), 'revision', v_q.revision, 'name', v_name, 'comment', v_text, 'guest_count', p_guest_count)
   where id = v_q.id;
end;
$$;

-- Admin: Änderungswunsch als erledigt markieren (die Änderung selbst macht er im Angebot)
create or replace function public.resolve_pending_change(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.quotes set pending_change = null
   where id = p_quote_id and company_id = public.auth_company_id();
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
end;
$$;

revoke execute on function private.portal_quote_id(text), private.portal_changes_until(public.events, public.companies)
  from public, anon, authenticated;
revoke execute on function public.portal_get(text), public.portal_accept_quote(text, integer, text, text, text),
  public.portal_decline_quote(text, integer, text, text), public.portal_request_change(text, integer, text, text, integer),
  public.resolve_pending_change(uuid) from public, anon, authenticated;
grant execute on function public.portal_get(text), public.portal_accept_quote(text, integer, text, text, text),
  public.portal_decline_quote(text, integer, text, text), public.portal_request_change(text, integer, text, text, integer)
  to anon, authenticated;
grant execute on function public.resolve_pending_change(uuid) to authenticated;

-- >>>>>>>>>> 20261029090000_m8_kitchen_lines.sql
-- =====================================================================
-- M8 · Küche: Datenbasis aus dem verbindlichen Stand (docs/02 §8, docs/03 §4.6)
--
-- Abweichung von der Planung (docs/07 A-32): Es gibt keine Spalte `binding_snapshot`. Der verbindliche Stand
-- ergibt sich aus den Revisionen: zuletzt angenommene Fassung (`acceptance_revision`), bei einem „Zur Info“-
-- Versand an einen bestätigten Auftrag die neueste Fassung; sonst die neueste Fassung (vorläufig); ohne Angebot
-- der Live-Stand. Die Küche sieht weder Preise noch Kunden: die Views liefern nur Mengen und Gerichte.
-- =====================================================================

-- Hinweis: Die Regel steht in beiden Views (b.rev / b.basis), nicht in einer Funktion: Funktionen in Views laufen mit
-- den Rechten des Aufrufers, und die Küche darf keine Hilfsfunktionen ausführen (docs/03 §4.1).
--   b.rev   = Revision, die für die Küche gilt (NULL = Live-Stand, kein versendetes Angebot)
--   b.basis = 'binding' (angenommen bzw. „Zur Info“ an einen bestätigten Auftrag), 'snapshot' (versendet, Annahme
--             steht aus, vorläufig) oder 'live' (Entwurf)

create or replace view public.kitchen_events
  with (security_invoker = false, security_barrier = true) as
select e.id, e.company_id, e.kind, e.title, e.status, e.starts_at, e.ends_at, e.event_date,
       coalesce((r.snapshot -> 'event' ->> 'guest_count')::integer, e.guest_count) as guest_count,
       e.guest_count as draft_guest_count,
       coalesce(b.basis, 'live') as basis,
       e.venue_name, e.street, e.postal_code, e.city, e.is_pickup,
       e.onsite_contact_name, e.onsite_contact_phone, e.meeting_point, e.dress_code,
       e.kitchen_notes, e.staff_notes, e.updated_at,
       coalesce(q.pending_change is not null
                or q.revision > b.rev
                or (r.snapshot is not null
                    and e.guest_count is distinct from (r.snapshot -> 'event' ->> 'guest_count')::integer), false) as has_open_change
  from public.events e
  left join public.quotes q on q.event_id = e.id
  left join lateral (select case
            when q.revision = 0 then null
            when q.send_mode = 'info_only' and e.status = 'confirmed' then q.revision
            when q.acceptance_revision is not null then q.acceptance_revision
            else q.revision end as rev,
          case
            when q.revision = 0 then 'live'
            when q.send_mode = 'info_only' and e.status = 'confirmed' then 'binding'
            when q.acceptance_revision is not null then 'binding'
            else 'snapshot' end as basis) b on true
  left join public.quote_revisions r on r.quote_id = q.id and r.revision = b.rev
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced', 'cancelled');

-- Gerichte und Pakete je Auftrag aus dem verbindlichen Stand: nur gewählte Positionen, ohne Preise
create view public.kitchen_event_lines
  with (security_invoker = false, security_barrier = true) as
select e.id as event_id, e.company_id, b.basis, b.rev as revision,
       (x.item ->> 'type') as item_type,
       nullif(x.item ->> 'dish_id', '')::uuid as dish_id,
       nullif(x.item ->> 'menu_package_id', '')::uuid as menu_package_id,
       (x.item ->> 'quantity')::numeric as quantity
  from public.events e
  join public.quotes q on q.event_id = e.id and q.revision > 0
  cross join lateral (select case
            when q.send_mode = 'info_only' and e.status = 'confirmed' then q.revision
            when q.acceptance_revision is not null then q.acceptance_revision
            else q.revision end as rev,
          case
            when q.send_mode = 'info_only' and e.status = 'confirmed' then 'binding'
            when q.acceptance_revision is not null then 'binding'
            else 'snapshot' end as basis) b
  join public.quote_revisions r on r.quote_id = q.id and r.revision = b.rev
  cross join lateral jsonb_array_elements(r.snapshot -> 'items') as x(item)
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and (x.item ->> 'type') in ('package', 'dish')
   and coalesce((x.item ->> 'is_selected')::boolean, true)
   and not coalesce((x.item ->> 'is_heading')::boolean, false)
union all
select e.id, e.company_id, 'live', null::integer, i.type::text, i.dish_id, i.menu_package_id,
       case when i.quantity_mode = 'per_guest' then coalesce(e.guest_count, 0)::numeric else i.quantity end
  from public.events e
  join public.quotes q on q.event_id = e.id and q.revision = 0
  join public.quote_items i on i.quote_id = q.id
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and i.type in ('package', 'dish') and i.is_selected and not i.is_heading;

revoke all on public.kitchen_event_lines from anon, authenticated;
grant select on public.kitchen_event_lines to authenticated;

-- >>>>>>>>>> 20261030090000_m7_shifts.sql
-- =====================================================================
-- M7 · Schichtbörse: Slots, Bewerbungen, Einplanen (docs/03 §3.5, §7.5, §7.7; docs/02 §5)
--
-- Abweichung von der Planung (docs/07 A-34): Ohne Push und Benachrichtigungstabelle. Die RPCs ändern nur den
-- Stand; wer sich beworben hat, sieht Zu- und Absagen in „Meine Einsätze“. Neu gegenüber docs/03: `save_slot()`
-- (Slot anlegen und ändern, eine Qualifikation Pflicht, R2-9) und `record_late_cancellation()`.
-- =====================================================================
create table public.shift_slots (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  event_id             uuid not null,
  qualification_id     uuid not null,
  title                text not null check (char_length(btrim(title)) between 1 and 80),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  seats                integer not null check (seats between 1 and 100),
  taken_seats          integer not null default 0,
  meeting_point        text,
  dress_code           text,
  notes                text,
  published_at         timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  foreign key (company_id, qualification_id) references public.qualifications (company_id, id),
  constraint shift_slots_end_after_start check (ends_at > starts_at),
  constraint shift_slots_taken_le_seats check (taken_seats between 0 and seats)
);
create index shift_slots_board_idx on public.shift_slots (company_id, starts_at)
  where published_at is not null and cancelled_at is null;
create index shift_slots_event_idx on public.shift_slots (event_id);
create index shift_slots_qualification_idx on public.shift_slots (qualification_id);

create table public.shift_applications (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  shift_slot_id     uuid not null,
  member_id         uuid not null,
  status            public.application_status not null,
  comment           text,
  applied_at        timestamptz,
  decided_at        timestamptz,
  decided_by        uuid,
  cancelled_at      timestamptz,
  cancel_reason     text,
  late_cancellation boolean not null default false,
  status_note       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shift_slot_id, member_id),
  foreign key (company_id, shift_slot_id) references public.shift_slots (company_id, id),
  foreign key (company_id, member_id)     references public.company_members (company_id, id),
  foreign key (company_id, decided_by)
    references public.company_members (company_id, id) on delete set null (decided_by)
);
create index shift_applications_member_idx on public.shift_applications (member_id, status);
create index shift_applications_occupied_idx on public.shift_applications (shift_slot_id)
  where status in ('accepted', 'assigned');

create trigger shift_slots_set_updated_at before update on public.shift_slots
  for each row execute function public.set_updated_at();
create trigger shift_applications_set_updated_at before update on public.shift_applications
  for each row execute function public.set_updated_at();
alter table public.shift_slots enable row level security;
alter table public.shift_applications enable row level security;
revoke all on public.shift_slots, public.shift_applications from anon, authenticated;
-- Lesen: nur admin; kitchen und staff über die Views. Schreiben ausschließlich über RPCs.
grant select on public.shift_slots, public.shift_applications to authenticated;
create policy shift_slots_admin_select on public.shift_slots for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy shift_applications_admin_select on public.shift_applications for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- Überbuchungsschutz: jede neue Belegung ist eine bedingte Schreiboperation auf dem Slot (docs/03 §7.5)
create or replace function private.track_slot_occupancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was boolean := false;
  v_is  boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_was := old.status in ('accepted', 'assigned');
  end if;
  if tg_op <> 'DELETE' then
    v_is := new.status in ('accepted', 'assigned');
  end if;
  if v_is and not v_was then
    update public.shift_slots s set taken_seats = s.taken_seats + 1
     where s.id = new.shift_slot_id and s.taken_seats < s.seats;
    if not found then
      raise exception 'Alle Plätze sind bereits vergeben' using errcode = 'P0001', hint = 'slot_full';
    end if;
  elsif v_was and not v_is then
    update public.shift_slots s set taken_seats = s.taken_seats - 1 where s.id = old.shift_slot_id;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger shift_applications_occupancy
  before insert or update of status or delete on public.shift_applications
  for each row execute function private.track_slot_occupancy();

-- Lesbarkeit eines Auftrags je Rolle: jetzt mit dem staff-Zweig (zugesagt oder eingeplant, Slot nicht abgesagt)
create or replace function public.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.company_id = public.auth_company_id()
       and case public.auth_role()
             when 'admin' then true
             when 'kitchen' then e.status in ('optioned', 'confirmed', 'completed', 'invoiced', 'cancelled')
             when 'staff' then e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
                               and exists (
                                 select 1 from public.shift_applications a
                                   join public.shift_slots s on s.id = a.shift_slot_id
                                  where s.event_id = e.id and s.cancelled_at is null
                                    and a.member_id = public.auth_member_id()
                                    and a.status in ('accepted', 'assigned'))
             else false
           end)
$$;

-- ---------- Views ----------
create view public.event_staffing
  with (security_invoker = false, security_barrier = true) as
select s.id as shift_slot_id, s.company_id, s.event_id, e.title as event_title, e.event_date,
       s.title, q.name as qualification_name, s.starts_at, s.ends_at, s.seats, s.taken_seats,
       (s.published_at is not null) as is_published,
       coalesce(array_agg(split_part(m.display_name, ' ', 1) order by m.display_name)
                  filter (where m.id is not null), '{}') as assigned_first_names
  from public.shift_slots s
  join public.events e         on e.id = s.event_id
  join public.qualifications q on q.id = s.qualification_id
  left join public.shift_applications a on a.shift_slot_id = s.id and a.status in ('accepted', 'assigned')
  left join public.company_members m on m.id = a.member_id
 where s.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and s.cancelled_at is null
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
 group by s.id, e.id, q.id;

create view public.event_colleagues
  with (security_invoker = false, security_barrier = true) as
select s.event_id, s.company_id, s.id as shift_slot_id, q.name as qualification_name,
       split_part(m.display_name, ' ', 1) as first_name
  from public.shift_applications a
  join public.shift_slots s     on s.id = a.shift_slot_id
  join public.events e          on e.id = s.event_id
  join public.qualifications q  on q.id = s.qualification_id
  join public.company_members m on m.id = a.member_id
 where s.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('staff', 'kitchen')
   and a.status in ('accepted', 'assigned')
   and a.member_id <> (select public.auth_member_id())
   and s.cancelled_at is null
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and exists (select 1 from public.shift_applications mine
                 join public.shift_slots ms on ms.id = mine.shift_slot_id
                where ms.event_id = s.event_id and ms.cancelled_at is null
                  and mine.member_id = (select public.auth_member_id())
                  and mine.status in ('accepted', 'assigned'));

-- Schichtbörse: nur offene, passende Slots; keine Adresse, keine Kundendaten, keine Preise
create view public.shift_board
  with (security_invoker = false, security_barrier = true) as
select s.id as shift_slot_id, s.company_id, s.title, s.qualification_id,
       q.name as qualification_name, s.starts_at, s.ends_at, s.seats,
       s.seats - s.taken_seats as free_seats,
       coalesce(s.dress_code, e.dress_code) as dress_code,
       e.kind as event_kind, e.guest_count, e.postal_code, e.city,
       (e.status = 'optioned') as is_tentative,
       mine.status as my_application_status
  from public.shift_slots s
  join public.events e on e.id = s.event_id
  join public.qualifications q on q.id = s.qualification_id
  left join public.shift_applications mine
         on mine.shift_slot_id = s.id and mine.member_id = (select public.auth_member_id())
 where s.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('kitchen', 'staff')
   and s.published_at is not null
   and s.cancelled_at is null
   and s.starts_at > now()
   and e.status in ('optioned', 'confirmed')
   and (s.taken_seats < s.seats or mine.status is not null)
   and exists (select 1 from public.member_qualifications mq
                where mq.member_id = (select public.auth_member_id())
                  and mq.qualification_id = s.qualification_id);

-- Meine Einsätze: alle eigenen Bewerbungen; Einsatzinfos nur bei accepted/assigned
create view public.my_shifts
  with (security_invoker = false, security_barrier = true) as
select a.id as application_id, a.company_id, a.status, a.applied_at, a.decided_at,
       a.cancelled_at, a.late_cancellation, a.status_note,
       s.id as shift_slot_id, s.title, q.name as qualification_name, s.starts_at, s.ends_at,
       (s.cancelled_at is not null or e.status in ('cancelled', 'declined')) as is_called_off,
       (e.status = 'optioned') as is_tentative,
       s.starts_at - make_interval(hours => c.shift_cancel_deadline_hours) as cancel_deadline_at,
       e.postal_code, e.city,
       case when ok.active then e.id                                       end as event_id,
       case when ok.active then e.title                                    end as event_title,
       case when ok.active then e.venue_name                               end as venue_name,
       case when ok.active then e.street                                   end as street,
       case when ok.active then coalesce(s.meeting_point, e.meeting_point) end as meeting_point,
       case when ok.active then coalesce(s.dress_code, e.dress_code)       end as dress_code,
       case when ok.active then e.onsite_contact_name                      end as onsite_contact_name,
       case when ok.active then e.onsite_contact_phone                     end as onsite_contact_phone,
       case when ok.active then e.staff_notes                              end as staff_notes,
       case when ok.active then s.notes                                    end as slot_notes
  from public.shift_applications a
  join public.shift_slots s on s.id = a.shift_slot_id
  join public.events e      on e.id = s.event_id
  join public.companies c   on c.id = a.company_id
  join public.qualifications q on q.id = s.qualification_id
 cross join lateral (
         select a.status in ('accepted', 'assigned')
                and s.cancelled_at is null
                and e.status in ('optioned', 'confirmed', 'completed', 'invoiced') as active) ok
 where a.member_id = (select public.auth_member_id());

revoke all on public.event_staffing, public.event_colleagues, public.shift_board, public.my_shifts
  from anon, authenticated;
grant select on public.event_staffing, public.event_colleagues, public.shift_board, public.my_shifts
  to authenticated;

-- ---------- RPCs ----------
-- Admin: Slot anlegen oder ändern. p: {id?, event_id, qualification_id, title, starts_at, ends_at, seats,
--   meeting_point?, dress_code?, notes?}. Genau eine Qualifikation, Pflicht (R2-9).
create or replace function public.save_slot(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_event   public.events;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_event from public.events where id = (p ->> 'event_id')::uuid and company_id = v_company;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;
  if v_event.status in ('declined', 'cancelled', 'completed', 'invoiced') then
    raise exception 'Für diesen Auftrag lassen sich keine Schichten mehr planen'
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if nullif(p ->> 'qualification_id', '') is null then
    raise exception 'Qualifikation fehlt' using errcode = 'P0001', hint = 'qualification_required';
  end if;
  if v_id is null then
    insert into public.shift_slots (company_id, event_id, qualification_id, title, starts_at, ends_at, seats,
                                    meeting_point, dress_code, notes)
    values (v_company, v_event.id, (p ->> 'qualification_id')::uuid, btrim(p ->> 'title'),
            (p ->> 'starts_at')::timestamptz, (p ->> 'ends_at')::timestamptz, (p ->> 'seats')::integer,
            nullif(btrim(coalesce(p ->> 'meeting_point', '')), ''), nullif(btrim(coalesce(p ->> 'dress_code', '')), ''),
            nullif(btrim(coalesce(p ->> 'notes', '')), ''))
    returning id into v_id;
  else
    update public.shift_slots set
      qualification_id = (p ->> 'qualification_id')::uuid, title = btrim(p ->> 'title'),
      starts_at = (p ->> 'starts_at')::timestamptz, ends_at = (p ->> 'ends_at')::timestamptz,
      seats = (p ->> 'seats')::integer,
      meeting_point = nullif(btrim(coalesce(p ->> 'meeting_point', '')), ''),
      dress_code = nullif(btrim(coalesce(p ->> 'dress_code', '')), ''),
      notes = nullif(btrim(coalesce(p ->> 'notes', '')), '')
     where id = v_id and company_id = v_company and cancelled_at is null;
    if not found then
      raise exception 'Schicht nicht gefunden' using errcode = 'P0001', hint = 'slot_not_found';
    end if;
  end if;
  return v_id;
end;
$$;

-- Admin: Slots veröffentlichen (Auftrag mindestens optioniert) oder absagen
create or replace function public.publish_slots(p_slot_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform private.require_admin();
  perform public.assert_writable();
  if exists (select 1 from public.shift_slots s join public.events e on e.id = s.event_id
              where s.id = any (p_slot_ids) and s.company_id = public.auth_company_id()
                and e.status not in ('optioned', 'confirmed')) then
    raise exception 'Veröffentlichen geht erst ab „optioniert“' using errcode = 'P0001', hint = 'slot_not_open';
  end if;
  update public.shift_slots set published_at = coalesce(published_at, now())
   where id = any (p_slot_ids) and company_id = public.auth_company_id() and cancelled_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.cancel_slot(p_slot_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.shift_slots set cancelled_at = now(), cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_slot_id and company_id = public.auth_company_id() and cancelled_at is null;
  if not found then
    raise exception 'Schicht nicht gefunden' using errcode = 'P0001', hint = 'slot_not_found';
  end if;
end;
$$;

-- Mitarbeiter bewirbt sich (staff/kitchen)
create or replace function public.apply_for_slot(p_slot_id uuid, p_comment text default null)
returns public.shift_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := public.auth_member_id();
  v_slot      public.shift_slots;
  v_status    public.event_status;
  v_app       public.shift_applications;
begin
  if v_member_id is null or public.auth_role() not in ('staff', 'kitchen') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  perform public.assert_writable();
  select s.* into v_slot from public.shift_slots s where s.id = p_slot_id and s.company_id = public.auth_company_id();
  if not found then
    raise exception 'Schicht nicht gefunden' using errcode = 'P0001', hint = 'slot_not_found';
  end if;
  select e.status into v_status from public.events e where e.id = v_slot.event_id;
  if v_slot.published_at is null or v_slot.cancelled_at is not null or v_slot.starts_at <= now()
     or v_status not in ('optioned', 'confirmed') then
    raise exception 'Bewerbung nicht möglich' using errcode = 'P0001', hint = 'slot_not_open';
  end if;
  if not exists (select 1 from public.member_qualifications mq
                  where mq.member_id = v_member_id and mq.qualification_id = v_slot.qualification_id) then
    raise exception 'Qualifikation fehlt' using errcode = 'P0001', hint = 'missing_qualification';
  end if;
  if v_slot.taken_seats >= v_slot.seats then
    raise exception 'Alle Plätze sind bereits vergeben' using errcode = 'P0001', hint = 'slot_full';
  end if;
  insert into public.shift_applications as a (company_id, shift_slot_id, member_id, status, comment, applied_at)
  values (v_slot.company_id, p_slot_id, v_member_id, 'applied', nullif(btrim(coalesce(p_comment, '')), ''), now())
  on conflict (shift_slot_id, member_id) do update
     set status = 'applied', comment = excluded.comment, applied_at = now(), decided_at = null, decided_by = null,
         cancelled_at = null, cancel_reason = null, late_cancellation = false, status_note = null
   where a.status in ('withdrawn', 'cancelled_by_staff')
  returning a.* into v_app;
  if v_app.id is null then
    raise exception 'Bewerbung existiert bereits' using errcode = 'P0001', hint = 'application_exists';
  end if;
  return v_app;
end;
$$;

-- Admin sagt zu (true) oder ab bzw. plant aus (false)
create or replace function public.decide_application(p_application_id uuid, p_accept boolean, p_note text default null)
returns public.shift_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.shift_applications;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select a.* into v_app from public.shift_applications a
   where a.id = p_application_id and a.company_id = public.auth_company_id() for update;
  if not found then
    raise exception 'Bewerbung nicht gefunden' using errcode = 'P0001', hint = 'application_not_found';
  end if;
  if p_accept then
    if v_app.status not in ('applied', 'rejected') then
      raise exception 'Zusage nicht möglich' using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    update public.shift_applications set status = 'accepted', decided_at = now(), decided_by = public.auth_member_id(),
           status_note = p_note
     where id = v_app.id returning * into v_app;
  else
    if v_app.status not in ('applied', 'accepted', 'assigned') then
      raise exception 'Absage nicht möglich' using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    update public.shift_applications set status = 'rejected', decided_at = now(), decided_by = public.auth_member_id(),
           status_note = coalesce(p_note, case when v_app.status <> 'applied' then 'ausgeplant' end)
     where id = v_app.id returning * into v_app;
  end if;
  return v_app;
end;
$$;

-- Mitarbeiter zieht zurück (applied) oder sagt ab (accepted/assigned, bis zur Frist)
create or replace function public.cancel_my_application(p_application_id uuid, p_reason text default null)
returns public.shift_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app      public.shift_applications;
  v_starts   timestamptz;
  v_deadline timestamptz;
begin
  perform public.assert_writable();
  select a.* into v_app from public.shift_applications a
   where a.id = p_application_id and a.member_id = public.auth_member_id() for update;
  if not found then
    raise exception 'Einsatz nicht gefunden' using errcode = 'P0001', hint = 'application_not_found';
  end if;
  select s.starts_at, s.starts_at - make_interval(hours => c.shift_cancel_deadline_hours)
    into v_starts, v_deadline
    from public.shift_slots s join public.companies c on c.id = s.company_id where s.id = v_app.shift_slot_id;
  if v_app.status = 'applied' and now() < v_starts then
    update public.shift_applications set status = 'withdrawn', cancelled_at = now(), cancel_reason = p_reason
     where id = v_app.id returning * into v_app;
  elsif v_app.status in ('accepted', 'assigned') then
    if now() > v_deadline or now() >= v_starts then
      raise exception 'Absagefrist abgelaufen – bitte telefonisch absagen' using errcode = 'P0001', hint = 'deadline_passed';
    end if;
    update public.shift_applications set status = 'cancelled_by_staff', cancelled_at = now(), cancel_reason = p_reason
     where id = v_app.id returning * into v_app;
  else
    raise exception 'Absage nicht möglich' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  return v_app;
end;
$$;

-- Admin plant direkt ein; eine vorhandene Bewerbung applied -> accepted
create or replace function public.assign_member(p_slot_id uuid, p_member_id uuid, p_ignore_qualification boolean default false)
returns public.shift_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot   public.shift_slots;
  v_status public.event_status;
  v_app    public.shift_applications;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select s.* into v_slot from public.shift_slots s where s.id = p_slot_id and s.company_id = public.auth_company_id();
  select e.status into v_status from public.events e where e.id = v_slot.event_id;
  if v_slot.id is null or v_slot.cancelled_at is not null or v_status not in ('optioned', 'confirmed') then
    raise exception 'Einplanen nicht möglich' using errcode = 'P0001', hint = 'slot_not_open';
  end if;
  if not exists (select 1 from public.company_members m
                  where m.id = p_member_id and m.company_id = v_slot.company_id and m.removed_at is null and m.user_id is not null) then
    raise exception 'Mitglied nicht gefunden' using errcode = 'P0001', hint = 'member_not_found';
  end if;
  if not p_ignore_qualification and not exists (
       select 1 from public.member_qualifications mq
        where mq.member_id = p_member_id and mq.qualification_id = v_slot.qualification_id) then
    raise exception 'Mitglied hat die Qualifikation nicht' using errcode = 'P0001', hint = 'missing_qualification';
  end if;
  -- Kein INSERT ... ON CONFLICT: Das BEFORE-INSERT-Trigger-Ereignis würde den Platz schon zählen, bevor der Konflikt
  -- erkannt wird, und der anschließende UPDATE-Pfad ein zweites Mal (doppelte Belegung, falsches `slot_full`).
  select a.* into v_app from public.shift_applications a
   where a.shift_slot_id = p_slot_id and a.member_id = p_member_id for update;
  if found then
    if v_app.status in ('accepted', 'assigned') then
      raise exception 'Bereits eingeplant' using errcode = 'P0001', hint = 'already_assigned';
    end if;
    update public.shift_applications set
           status = case when v_app.status = 'applied' then 'accepted'::public.application_status
                         else 'assigned'::public.application_status end,
           decided_at = now(), decided_by = public.auth_member_id(), cancelled_at = null, cancel_reason = null,
           late_cancellation = false, status_note = null
     where id = v_app.id returning * into v_app;
  else
    insert into public.shift_applications (company_id, shift_slot_id, member_id, status, decided_at, decided_by)
    values (v_slot.company_id, p_slot_id, p_member_id, 'assigned', now(), public.auth_member_id())
    returning * into v_app;
  end if;
  return v_app;
end;
$$;

-- Admin trägt eine Absage nach Fristablauf ein (Kennzahl K-09)
create or replace function public.record_late_cancellation(p_application_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.shift_applications set status = 'cancelled_by_staff', cancelled_at = now(), late_cancellation = true,
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_application_id and company_id = public.auth_company_id() and status in ('accepted', 'assigned');
  if not found then
    raise exception 'Einsatz nicht gefunden' using errcode = 'P0001', hint = 'application_not_found';
  end if;
end;
$$;

revoke execute on function private.track_slot_occupancy() from public, anon, authenticated;
revoke execute on function public.save_slot(jsonb), public.publish_slots(uuid[]), public.cancel_slot(uuid, text),
  public.apply_for_slot(uuid, text), public.decide_application(uuid, boolean, text),
  public.cancel_my_application(uuid, text), public.assign_member(uuid, uuid, boolean),
  public.record_late_cancellation(uuid, text) from public, anon, authenticated;
grant execute on function public.save_slot(jsonb), public.publish_slots(uuid[]), public.cancel_slot(uuid, text),
  public.apply_for_slot(uuid, text), public.decide_application(uuid, boolean, text),
  public.cancel_my_application(uuid, text), public.assign_member(uuid, uuid, boolean),
  public.record_late_cancellation(uuid, text) to authenticated;

-- >>>>>>>>>> 20261031090000_m6_choices.sql
-- =====================================================================
-- M6 · Menüwahl im Portal (Wahlgruppen, docs/02 §4.1, docs/03 §3.3 `portal_selection`)
--
-- Der Kunde wählt vor der Annahme je Wahlgruppe eine Alternative; die Wahl ändert weder Snapshot noch Hash und
-- erzeugt keine neue Fassung (R2-1). Sie liegt in `quotes.portal_selection` und fließt in das Annahmeprotokoll
-- und in die Küchenlisten ein. Der Admin übernimmt sie mit `apply_portal_selection()` in den Entwurf; jede neue
-- Fassung setzt die Wahl zurück. Die Summen mit Wahl rechnet das Portal mit dem gemeinsamen TypeScript-Modul.
-- =====================================================================
alter table public.quotes
  add column portal_selection     jsonb,
  add column selection_updated_at timestamptz;

create or replace function public.portal_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_revoked boolean;
  v_q       public.quotes;
  v_e       public.events;
  v_c       public.companies;
  v_until   timestamptz;
  v_company jsonb;
begin
  select o_quote, o_revoked into v_id, v_revoked from private.portal_quote_id(p_token);
  if v_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  v_company := jsonb_build_object('name', v_c.name, 'accent_color', v_c.accent_color, 'phone', v_c.phone,
                                  'contact_email', v_c.contact_email, 'website', v_c.website,
                                  'imprint_url', v_c.imprint_url, 'privacy_policy_url', v_c.privacy_policy_url);
  if v_revoked or v_q.snapshot is null then
    return jsonb_build_object('state', 'revoked',
                              'company', jsonb_build_object('name', v_c.name, 'phone', v_c.phone,
                                                            'contact_email', v_c.contact_email));
  end if;

  update public.quotes set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
   where id = v_q.id;
  v_until := private.portal_changes_until(v_e, v_c);
  return jsonb_build_object(
    'state', 'ok',
    'company', v_company,
    'quote', jsonb_build_object(
      'number', v_q.number, 'revision', v_q.revision, 'status', v_q.status, 'valid_until', v_q.valid_until,
      'expired', v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date,
      'sent_at', v_q.sent_at, 'send_mode', v_q.send_mode,
      'accepted_at', v_q.accepted_at, 'acceptance_revision', v_q.acceptance_revision,
      'acceptance_name', v_q.acceptance_name, 'declined_at', v_q.declined_at),
    'event', jsonb_build_object('status', v_e.status, 'changes_until', v_until, 'changes_locked', now() > v_until),
    'snapshot', v_q.snapshot,
    'selection', coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb),
    'has_pending_change', v_q.pending_change is not null);
end;
$$;

create or replace function public.portal_select_choice(p_token text, p_revision integer, p_group text, p_item_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id;
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_e.status not in ('quoted', 'optioned') or v_q.status <> 'sent' then
    raise exception 'Die Auswahl lässt sich nicht mehr ändern' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  -- das Element muss zur Wahlgruppe der versendeten Fassung gehören
  if not exists (select 1 from jsonb_array_elements(v_q.snapshot -> 'items') x
                  where x ->> 'id' = p_item_id and x ->> 'choice_group' = p_group
                    and not coalesce((x ->> 'is_heading')::boolean, false)) then
    raise exception 'Ungültige Auswahl' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  update public.quotes set
    portal_selection = jsonb_set(coalesce(portal_selection, '{"choices": {}}'::jsonb), array['choices', p_group], to_jsonb(p_item_id), true),
    selection_updated_at = now()
   where id = v_q.id;
end;
$$;

create or replace function public.portal_accept_quote(
  p_token text, p_revision integer, p_name text, p_email text default null, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id for update;
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'name_required';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-Mail ungültig' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Angebot ist abgelaufen' using errcode = 'P0001', hint = 'quote_expired';
  end if;

  if v_e.status in ('quoted', 'optioned') and v_q.status = 'sent' then
    update public.events set status = 'confirmed', option_expires_at = null where id = v_e.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, reason)
    values (v_e.company_id, v_e.id, v_e.status, 'confirmed', 'portal', 'Angebot im Portal angenommen von ' || v_name);
  elsif v_e.status = 'confirmed' and v_q.send_mode = 'confirm_required'
        and (v_q.acceptance_revision is null or v_q.acceptance_revision < v_q.revision) then
    null; -- neue Fassung eines bestätigten Auftrags bestätigen
  else
    raise exception 'Das Angebot lässt sich nicht mehr annehmen' using errcode = 'P0001', hint = 'not_acceptable';
  end if;

  update public.quotes set
    status = 'accepted', accepted_at = now(), acceptance_revision = revision, acceptance_name = v_name,
    acceptance_email = v_email, acceptance_comment = nullif(btrim(coalesce(p_comment, '')), ''),
    acceptance_snapshot_hash = snapshot_hash, acceptance_total_gross_cents = total_gross_cents,
    acceptance_log = acceptance_log || jsonb_build_array(jsonb_build_object(
      'at', now(), 'revision', revision, 'channel', 'portal', 'name', v_name, 'email', v_email,
      'snapshot_hash', snapshot_hash, 'total_gross_cents', total_gross_cents,
      'selection', coalesce(portal_selection -> 'choices', '{}'::jsonb))),
    pending_change = null
  where id = v_q.id;
  return jsonb_build_object('accepted_at', now(), 'revision', v_q.revision);
end;
$$;

-- Admin: Wahl des Kunden in den Entwurf übernehmen (is_selected je Wahlgruppe); die Summen rechnet der Editor neu
create or replace function public.apply_portal_selection(p_quote_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes;
  v_n integer := 0;
  c   record;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = public.auth_company_id() for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  for c in select key as grp, value #>> '{}' as item_id from jsonb_each(coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb)) loop
    update public.quote_items set is_selected = (id::text = c.item_id)
     where quote_id = v_q.id and choice_group = c.grp;
    v_n := v_n + 1;
  end loop;
  update public.quotes set portal_selection = null, selection_updated_at = null,
         has_unsent_changes = revision > 0 where id = v_q.id;
  return v_n;
end;
$$;

-- send_quote: jede neue Fassung setzt die Wahl zurück
create or replace function public.send_quote(
  p_quote_id uuid,
  p_expected_revision integer,
  p_snapshot jsonb,
  p_via text,
  p_send_mode text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  uuid := public.auth_company_id();
  v_member   uuid;
  v_q        public.quotes;
  v_event    public.events;
  v_rev      integer;
  v_hash     text;
  v_token    text;
  v_live     text[];
  v_snap     text[];
  v_sum_net  bigint;
  v_sum_tax  bigint;
  v_items    jsonb := coalesce(p_snapshot -> 'items', '[]'::jsonb);
begin
  v_member := private.require_admin();
  perform public.assert_writable();
  if p_via not in ('email', 'link') then
    raise exception 'Versandweg ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision <> p_expected_revision then
    raise exception 'Das Angebot wurde inzwischen geändert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  select * into v_event from public.events where id = v_q.event_id and company_id = v_company for update;
  -- aus declined/cancelled/completed/invoiced nie wieder ein Angebot versenden (Endzustände, R2-3/R2-4)
  if v_event.status not in ('inquiry', 'quoted', 'optioned', 'confirmed') then
    raise exception 'Für diesen Auftrag kann kein Angebot mehr versendet werden'
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if v_event.status = 'confirmed' and p_send_mode is null then
    raise exception 'Versandart fehlt' using errcode = 'P0001', hint = 'send_mode_required';
  end if;
  if p_send_mode is not null and p_send_mode not in ('confirm_required', 'info_only') then
    raise exception 'Versandart ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  -- Konsistenz des Snapshots mit dem Live-Stand
  if (p_snapshot ->> 'schema_version') is distinct from '1'
     or (p_snapshot ->> 'revision')::integer is distinct from p_expected_revision + 1
     or (p_snapshot -> 'quote' ->> 'number') is distinct from v_q.number then
    raise exception 'Snapshot passt nicht zum Angebot' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  select coalesce(array_agg(id::text order by id::text), '{}') into v_live
    from public.quote_items where quote_id = v_q.id;
  select coalesce(array_agg(x ->> 'id' order by x ->> 'id'), '{}') into v_snap
    from jsonb_array_elements(v_items) x;
  if v_live is distinct from v_snap then
    raise exception 'Positionen des Snapshots weichen vom Angebot ab' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = v_q.id and not is_heading) then
    raise exception 'Das Angebot hat keine Position' using errcode = 'P0001', hint = 'quote_empty';
  end if;
  select coalesce(sum((x ->> 'line_net_cents')::bigint), 0) into v_sum_net
    from jsonb_array_elements(v_items) x
   where coalesce((x ->> 'is_selected')::boolean, true) and not coalesce((x ->> 'is_heading')::boolean, false);
  select coalesce(sum((x ->> 'tax_cents')::bigint), 0) into v_sum_tax
    from jsonb_array_elements(coalesce(p_snapshot -> 'totals' -> 'tax', '[]'::jsonb)) x;
  if v_sum_net <> (p_snapshot -> 'totals' ->> 'net_cents')::bigint
     or (p_snapshot -> 'totals' ->> 'gross_cents')::bigint - (p_snapshot -> 'totals' ->> 'net_cents')::bigint <> v_sum_tax then
    raise exception 'Summen im Snapshot stimmen nicht' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;

  v_rev  := p_expected_revision + 1;
  v_hash := encode(sha256(convert_to(p_snapshot::text, 'UTF8')), 'hex');

  update public.quotes set
    revision = v_rev, status = 'sent', snapshot = p_snapshot, snapshot_hash = v_hash,
    sent_at = now(), sent_via = p_via, send_mode = p_send_mode, has_unsent_changes = false,
    portal_selection = null, selection_updated_at = null,
    total_net_cents = (p_snapshot -> 'totals' ->> 'net_cents')::integer,
    total_gross_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer,
    total_tax_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer - (p_snapshot -> 'totals' ->> 'net_cents')::integer
  where id = v_q.id;
  insert into public.quote_revisions (company_id, quote_id, revision, snapshot, snapshot_hash, sent_via, send_mode, member_id)
  values (v_company, v_q.id, v_rev, p_snapshot, v_hash, p_via, p_send_mode, v_member);

  if v_event.status = 'inquiry' then
    update public.events set status = 'quoted' where id = v_event.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, actor_member_id)
    values (v_company, v_event.id, 'inquiry', 'quoted', 'member', v_member);
  end if;

  v_token := private.new_portal_token(v_company, v_q.id);
  return jsonb_build_object('revision', v_rev, 'token', v_token, 'snapshot_hash', v_hash);
end;
$$;

-- Küche: Wahl des Kunden wirkt auf die Positionen, solange sie nicht in den Entwurf übernommen ist
create or replace view public.kitchen_event_lines
  with (security_invoker = false, security_barrier = true) as
select e.id as event_id, e.company_id, b.basis, b.rev as revision,
       (x.item ->> 'type') as item_type,
       nullif(x.item ->> 'dish_id', '')::uuid as dish_id,
       nullif(x.item ->> 'menu_package_id', '')::uuid as menu_package_id,
       (x.item ->> 'quantity')::numeric as quantity
  from public.events e
  join public.quotes q on q.event_id = e.id and q.revision > 0
  cross join lateral (select case
            when q.send_mode = 'info_only' and e.status = 'confirmed' then q.revision
            when q.acceptance_revision is not null then q.acceptance_revision
            else q.revision end as rev,
          case
            when q.send_mode = 'info_only' and e.status = 'confirmed' then 'binding'
            when q.acceptance_revision is not null then 'binding'
            else 'snapshot' end as basis) b
  join public.quote_revisions r on r.quote_id = q.id and r.revision = b.rev
  cross join lateral jsonb_array_elements(r.snapshot -> 'items') as x(item)
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and (x.item ->> 'type') in ('package', 'dish')
   and not coalesce((x.item ->> 'is_heading')::boolean, false)
   and case
         when b.rev = q.revision and (x.item ->> 'choice_group') is not null
              and (q.portal_selection -> 'choices') ? (x.item ->> 'choice_group')
           then (q.portal_selection -> 'choices' ->> (x.item ->> 'choice_group')) = (x.item ->> 'id')
         else coalesce((x.item ->> 'is_selected')::boolean, true)
       end
union all
select e.id, e.company_id, 'live', null::integer, i.type::text, i.dish_id, i.menu_package_id,
       case when i.quantity_mode = 'per_guest' then coalesce(e.guest_count, 0)::numeric else i.quantity end
  from public.events e
  join public.quotes q on q.event_id = e.id and q.revision = 0
  join public.quote_items i on i.quote_id = q.id
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and i.type in ('package', 'dish') and i.is_selected and not i.is_heading;

revoke execute on function public.portal_select_choice(text, integer, text, text),
  public.apply_portal_selection(uuid) from public, anon, authenticated;
grant execute on function public.portal_select_choice(text, integer, text, text) to anon, authenticated;
grant execute on function public.apply_portal_selection(uuid) to authenticated;

-- >>>>>>>>>> 20261101090000_m1_logos.sql
-- =====================================================================
-- M1 · Firmenlogo: Storage-Bucket `logos` (docs/03 §8)
-- Öffentlicher Bucket (die Bilder erscheinen in Portal und PDF), 2 MB, nur PNG und JPEG.
-- Pfad: {company_id}/logo-{uuid}.{png|jpg}. Schreiben und Löschen nur der Admin der Firma im Schreibmodus;
-- jeder Upload bekommt einen neuen Dateinamen, danach wird die alte Datei gelöscht.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy logos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos'
              and (storage.foldername(name))[1] = (select public.auth_company_id())::text
              and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy logos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos'
         and (storage.foldername(name))[1] = (select public.auth_company_id())::text
         and (select public.auth_role()) = 'admin');

-- >>>>>>>>>> 20261102090000_m6_dietary.sql
-- =====================================================================
-- M6 · Sonderessen und Allergien im Portal (docs/02 §4.2, R2-1: gelten sofort)
-- Der Kunde trägt Sonderessen ein, ändert und löscht nur seine eigenen Einträge (`source = 'customer'`), solange
-- der Änderungsschluss nicht erreicht ist. Die Summe darf die Gästezahl nicht übersteigen (Trigger aus M3).
-- Interne Einträge der Firma und die Namen anderer Gäste bleiben unsichtbar.
-- =====================================================================
create or replace function public.portal_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_revoked boolean;
  v_q       public.quotes;
  v_e       public.events;
  v_c       public.companies;
  v_until   timestamptz;
  v_company jsonb;
begin
  select o_quote, o_revoked into v_id, v_revoked from private.portal_quote_id(p_token);
  if v_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  v_company := jsonb_build_object('name', v_c.name, 'accent_color', v_c.accent_color, 'phone', v_c.phone,
                                  'contact_email', v_c.contact_email, 'website', v_c.website,
                                  'imprint_url', v_c.imprint_url, 'privacy_policy_url', v_c.privacy_policy_url);
  if v_revoked or v_q.snapshot is null then
    return jsonb_build_object('state', 'revoked',
                              'company', jsonb_build_object('name', v_c.name, 'phone', v_c.phone,
                                                            'contact_email', v_c.contact_email));
  end if;

  update public.quotes set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
   where id = v_q.id;
  v_until := private.portal_changes_until(v_e, v_c);
  return jsonb_build_object(
    'state', 'ok',
    'company', v_company,
    'quote', jsonb_build_object(
      'number', v_q.number, 'revision', v_q.revision, 'status', v_q.status, 'valid_until', v_q.valid_until,
      'expired', v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date,
      'sent_at', v_q.sent_at, 'send_mode', v_q.send_mode,
      'accepted_at', v_q.accepted_at, 'acceptance_revision', v_q.acceptance_revision,
      'acceptance_name', v_q.acceptance_name, 'declined_at', v_q.declined_at),
    'event', jsonb_build_object('status', v_e.status, 'changes_until', v_until, 'changes_locked', now() > v_until),
    'snapshot', v_q.snapshot,
    'selection', coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb),
    'dietary', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'person_count', d.person_count, 'diet', d.diet,
                          'avoid_allergens', d.avoid_allergens, 'guest_name', d.guest_name, 'table_label', d.table_label,
                          'note', d.note) order by d.created_at)
                           from public.event_dietary_requirements d
                          where d.event_id = v_e.id and d.source = 'customer'), '[]'::jsonb),
    'has_pending_change', v_q.pending_change is not null);
end;
$$;

create or replace function public.portal_save_dietary(
  p_token text, p_id uuid, p_person_count integer, p_diet public.diet_type, p_avoid public.allergen[],
  p_note text, p_guest_name text, p_table text, p_author text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_rev    boolean;
  v_q      public.quotes;
  v_e      public.events;
  v_c      public.companies;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_out    uuid;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if now() > private.portal_changes_until(v_e, v_c) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  if coalesce(p_person_count, 0) < 1 then
    raise exception 'Anzahl fehlt' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_diet is null and coalesce(cardinality(p_avoid), 0) = 0 and v_note is null then
    raise exception 'Bitte Diätform, Allergen oder Hinweis angeben' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_id is null then
    insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens, note,
                                                   guest_name, table_label, source, portal_author_name, created_by_member_id)
    values (v_e.company_id, v_e.id, p_person_count, p_diet, coalesce(p_avoid, '{}'), v_note,
            nullif(btrim(coalesce(p_guest_name, '')), ''), nullif(btrim(coalesce(p_table, '')), ''), 'customer',
            nullif(btrim(coalesce(p_author, '')), ''), null)
    returning id into v_out;
  else
    update public.event_dietary_requirements set
      person_count = p_person_count, diet = p_diet, avoid_allergens = coalesce(p_avoid, '{}'), note = v_note,
      guest_name = nullif(btrim(coalesce(p_guest_name, '')), ''), table_label = nullif(btrim(coalesce(p_table, '')), ''),
      portal_author_name = coalesce(nullif(btrim(coalesce(p_author, '')), ''), portal_author_name)
     where id = p_id and event_id = v_e.id and source = 'customer'
    returning id into v_out;
    if v_out is null then
      raise exception 'Eintrag nicht gefunden' using errcode = 'P0001', hint = 'not_acceptable';
    end if;
  end if;
  return v_out;
end;
$$;

create or replace function public.portal_delete_dietary(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
  v_rev boolean;
  v_q   public.quotes;
  v_e   public.events;
  v_c   public.companies;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if now() > private.portal_changes_until(v_e, v_c) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  delete from public.event_dietary_requirements where id = p_id and event_id = v_e.id and source = 'customer';
  if not found then
    raise exception 'Eintrag nicht gefunden' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
end;
$$;

revoke execute on function public.portal_save_dietary(text, uuid, integer, public.diet_type, public.allergen[], text, text, text, text),
  public.portal_delete_dietary(text, uuid) from public, anon, authenticated;
grant execute on function public.portal_save_dietary(text, uuid, integer, public.diet_type, public.allergen[], text, text, text, text),
  public.portal_delete_dietary(text, uuid) to anon, authenticated;
