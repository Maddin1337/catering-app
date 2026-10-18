-- ============================================================================
-- Update: Migrationen ab 20261105090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261105090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261105090000_ical.sql
-- =====================================================================
-- Kalender-Abo (iCal, docs/02, SC-70): persönlicher Link je Mitglied
-- Abweichung (docs/07 A-37): kein Edge-Function-Deployment; eine Vercel-Funktion (`api/ical.ts`) ruft `ical_feed()`
-- mit dem Token auf. Der Token steht im Klartext in `calendar_tokens`, nur das Mitglied selbst liest ihn
-- (der Link soll sich jederzeit wieder anzeigen lassen) und kann ihn zurücksetzen.
-- Inhalt: Admin und Küche: bestätigte und optionierte Aufträge ohne Kundendaten; Personal: eigene zugesagte Schichten.
-- =====================================================================
create table public.calendar_tokens (
  member_id  uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now(),
  foreign key (company_id, member_id) references public.company_members (company_id, id) on delete cascade
);
alter table public.calendar_tokens enable row level security;
revoke all on public.calendar_tokens from anon, authenticated;
grant select on public.calendar_tokens to authenticated;
create policy calendar_tokens_own on public.calendar_tokens for select to authenticated
  using (member_id = (select public.auth_member_id()));

-- Link holen (legt ihn beim ersten Mal an) bzw. zurücksetzen
create or replace function public.get_ical_token(p_reset boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  uuid := public.auth_member_id();
  v_company uuid := public.auth_company_id();
  v_token   text;
begin
  if v_member is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if not p_reset then
    select token into v_token from public.calendar_tokens where member_id = v_member;
    if v_token is not null then
      return v_token;
    end if;
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.calendar_tokens (member_id, company_id, token) values (v_member, v_company, v_token)
  on conflict (member_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;

-- Einträge für den Feed (anon: der Token ist das Geheimnis). Rückgabe: {name, entries: [...]} oder NULL
create or replace function public.ical_feed(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m       public.company_members;
  v_company text;
  v_entries jsonb;
begin
  select m.* into v_m
    from public.calendar_tokens t join public.company_members m on m.id = t.member_id
   where t.token = p_token and m.removed_at is null;
  if not found then
    return null;
  end if;
  select name into v_company from public.companies where id = v_m.company_id;
  if v_m.role in ('admin', 'kitchen') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'uid', 'event-' || e.id, 'title', e.title, 'starts_at', e.starts_at,
             'ends_at', coalesce(e.ends_at, e.starts_at + interval '3 hours'),
             'location', nullif(concat_ws(', ', e.venue_name, e.street, concat_ws(' ', e.postal_code, e.city)), ''),
             'description', concat_ws(E'\n', case when e.guest_count is not null then e.guest_count || ' Gäste' end,
                                      case when e.status = 'optioned' then 'Vorläufig (optioniert)' end),
             'tentative', e.status = 'optioned', 'updated_at', e.updated_at) order by e.starts_at), '[]'::jsonb)
      into v_entries
      from public.events e
     where e.company_id = v_m.company_id and e.status in ('optioned', 'confirmed')
       and e.starts_at > now() - interval '30 days';
  else
    select coalesce(jsonb_agg(jsonb_build_object(
             'uid', 'shift-' || s.id, 'title', s.title || ' · ' || e.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
             'location', nullif(concat_ws(', ', e.venue_name, e.street, concat_ws(' ', e.postal_code, e.city)), ''),
             'description', concat_ws(E'\n', 'Treffpunkt: ' || coalesce(s.meeting_point, e.meeting_point),
                                      'Dresscode: ' || coalesce(s.dress_code, e.dress_code)),
             'tentative', e.status = 'optioned', 'updated_at', s.updated_at) order by s.starts_at), '[]'::jsonb)
      into v_entries
      from public.shift_applications a
      join public.shift_slots s on s.id = a.shift_slot_id
      join public.events e on e.id = s.event_id
     where a.member_id = v_m.id and a.status in ('accepted', 'assigned') and s.cancelled_at is null
       and e.status in ('optioned', 'confirmed') and s.starts_at > now() - interval '30 days';
  end if;
  return jsonb_build_object('name', v_company, 'entries', v_entries);
end;
$$;

revoke execute on function public.get_ical_token(boolean), public.ical_feed(text) from public, anon, authenticated;
grant execute on function public.get_ical_token(boolean) to authenticated;
grant execute on function public.ical_feed(text) to anon, authenticated;
