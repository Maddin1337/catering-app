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
