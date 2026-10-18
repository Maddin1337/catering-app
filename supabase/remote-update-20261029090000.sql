-- ============================================================================
-- Update: Migrationen ab 20261029090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261029090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

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
