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
