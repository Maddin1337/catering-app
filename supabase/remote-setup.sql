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
