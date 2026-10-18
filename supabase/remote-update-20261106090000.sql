-- ============================================================================
-- Update: Migrationen ab 20261106090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261106090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261106090000_revenue_overview.sql
-- =====================================================================
-- Monatsübersicht für die Startseite (nur Admin): Auftragswert nach Monat des Veranstaltungstags.
-- Wert = Nettosumme der gültigen Angebotsfassung (verbindliche Fassung, sonst die zuletzt gesendete).
--   booked: bestätigt, durchgeführt oder abgerechnet
--   open:   Angebot versendet oder optioniert, noch ohne Zusage
-- Nicht enthalten: spätere Auswahl-Änderungen des Kunden im Portal (die Summe stammt aus dem gesendeten Stand)
-- und Aufträge ohne versendetes Angebot. Zeitraum: 2 Monate zurück bis 3 Monate voraus (Europe/Berlin).
-- =====================================================================
create or replace function public.revenue_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_cur     date := date_trunc('month', now() at time zone 'Europe/Berlin')::date;
  v_result  jsonb;
begin
  if v_company is null or public.auth_role() is distinct from 'admin' then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  with m as (
    select (v_cur + make_interval(months => g))::date as month_start
      from generate_series(-2, 3) g
  ),
  v as (
    select e.event_date, e.status,
           coalesce((r.snapshot -> 'totals' ->> 'net_cents')::bigint, 0) as net
      from public.events e
      join public.quotes q on q.company_id = e.company_id and q.event_id = e.id and q.revision > 0
      join public.quote_revisions r on r.company_id = q.company_id and r.quote_id = q.id
                                   and r.revision = coalesce(q.binding_revision, q.revision)
     where e.company_id = v_company
       and e.status in ('quoted', 'optioned', 'confirmed', 'completed', 'invoiced')
  )
  select jsonb_build_object(
           'current_month', v_cur,
           'months', jsonb_agg(jsonb_build_object(
             'month', m.month_start,
             'booked_cents', coalesce((select sum(v.net) from v
                 where v.status in ('confirmed', 'completed', 'invoiced')
                   and v.event_date >= m.month_start and v.event_date < (m.month_start + interval '1 month')::date), 0),
             'booked_count', (select count(*) from v
                 where v.status in ('confirmed', 'completed', 'invoiced')
                   and v.event_date >= m.month_start and v.event_date < (m.month_start + interval '1 month')::date),
             'open_cents', coalesce((select sum(v.net) from v
                 where v.status in ('quoted', 'optioned')
                   and v.event_date >= m.month_start and v.event_date < (m.month_start + interval '1 month')::date), 0),
             'open_count', (select count(*) from v
                 where v.status in ('quoted', 'optioned')
                   and v.event_date >= m.month_start and v.event_date < (m.month_start + interval '1 month')::date)
           ) order by m.month_start))
    into v_result
    from m;
  return v_result;
end;
$$;
revoke execute on function public.revenue_overview() from public, anon, authenticated;
grant execute on function public.revenue_overview() to authenticated;
