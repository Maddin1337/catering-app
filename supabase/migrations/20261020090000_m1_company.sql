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
