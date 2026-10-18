-- =====================================================================
-- Benachrichtigungen in der App (docs/01 §3.6, docs/02 §9; Abweichung docs/07 A-40)
-- Kein Push und keine E-Mail (braucht ein natives Build bzw. einen Mail-Dienst, A-34/E-3): Auslöser legen
-- je Empfänger eine Zeile an, die App zeigt sie als Liste mit Zähler an der Glocke. Wer etwas selbst
-- auslöst, bekommt keine Meldung darüber. Die Texte baut die App aus `kind` und `payload` (Duzen/Siezen
-- und Übersetzung bleiben in der App); `payload` enthält keine Gesundheitsdaten und keine Preise.
-- =====================================================================
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  member_id     uuid not null,
  kind          text not null check (kind in (
                  'application_new', 'application_withdrawn', 'shift_cancelled_by_staff',
                  'shift_confirmed', 'shift_rejected', 'shift_new', 'shift_slot_cancelled',
                  'quote_accepted', 'quote_declined', 'change_requested', 'dietary_added')),
  event_id      uuid references public.events (id) on delete cascade,
  shift_slot_id uuid references public.shift_slots (id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  foreign key (company_id, member_id) references public.company_members (company_id, id) on delete cascade
);
create index notifications_member_created_idx on public.notifications (member_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (member_id = (select public.auth_member_id()));

-- Legt die Meldung für alle Empfänger an, außer für den Auslöser selbst.
create or replace function private.notify(
  p_company uuid, p_members uuid[], p_kind text, p_event uuid, p_slot uuid, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (company_id, member_id, kind, event_id, shift_slot_id, payload)
  select p_company, m.id, p_kind, p_event, p_slot, coalesce(p_payload, '{}'::jsonb)
    from public.company_members m
   where m.company_id = p_company and m.id = any (p_members) and m.removed_at is null
     and m.id is distinct from public.auth_member_id();
$$;

-- Aktive Mitglieder der Firma mit einer der Rollen
create or replace function private.members_with_role(p_company uuid, p_roles text[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.id), '{}')
    from public.company_members m
   where m.company_id = p_company and m.removed_at is null and m.role::text = any (p_roles);
$$;

-- Bewerbungen: neue Bewerbung, Rückzug und Absage an den Admin; Zusage und Absage an das Mitglied
create or replace function private.notify_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot   public.shift_slots;
  v_event  public.events;
  v_name   text;
  v_admins uuid[];
  v_info   jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return null;
  end if;
  select * into v_slot from public.shift_slots where id = new.shift_slot_id;
  select * into v_event from public.events where id = v_slot.event_id;
  select display_name into v_name from public.company_members where id = new.member_id;
  v_admins := private.members_with_role(new.company_id, array['admin']);
  v_info := jsonb_build_object('slot_title', v_slot.title, 'starts_at', v_slot.starts_at);

  if new.status = 'applied' then
    perform private.notify(new.company_id, v_admins, 'application_new', v_event.id, v_slot.id,
      v_info || jsonb_build_object('member_name', v_name, 'event_title', v_event.title));
  elsif new.status = 'withdrawn' then
    perform private.notify(new.company_id, v_admins, 'application_withdrawn', v_event.id, v_slot.id,
      v_info || jsonb_build_object('member_name', v_name, 'event_title', v_event.title));
  elsif new.status = 'cancelled_by_staff' and not new.late_cancellation then
    perform private.notify(new.company_id, v_admins, 'shift_cancelled_by_staff', v_event.id, v_slot.id,
      v_info || jsonb_build_object('member_name', v_name, 'event_title', v_event.title));
  elsif new.status in ('accepted', 'assigned') and (tg_op = 'INSERT' or old.status not in ('accepted', 'assigned')) then
    perform private.notify(new.company_id, array[new.member_id], 'shift_confirmed', null, v_slot.id, v_info);
  elsif new.status = 'rejected' then
    perform private.notify(new.company_id, array[new.member_id], 'shift_rejected', null, v_slot.id, v_info);
  end if;
  return null;
end;
$$;

create trigger shift_applications_notify
  after insert or update of status on public.shift_applications
  for each row execute function private.notify_application();

-- Schichten: veröffentlicht (an passende Mitarbeitende), abgesagt (an Beworbene und Eingeplante)
create or replace function private.notify_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_info    jsonb;
  v_members uuid[];
begin
  v_info := jsonb_build_object('slot_title', new.title, 'starts_at', new.starts_at);
  if old.published_at is null and new.published_at is not null and new.cancelled_at is null then
    select coalesce(array_agg(m.id), '{}') into v_members
      from public.company_members m
      join public.member_qualifications mq on mq.member_id = m.id and mq.qualification_id = new.qualification_id
     where m.company_id = new.company_id and m.removed_at is null and m.role in ('kitchen', 'staff');
    perform private.notify(new.company_id, v_members, 'shift_new', null, new.id,
      v_info || jsonb_build_object('city', (select city from public.events where id = new.event_id)));
  elsif old.cancelled_at is null and new.cancelled_at is not null then
    select coalesce(array_agg(a.member_id), '{}') into v_members
      from public.shift_applications a
     where a.shift_slot_id = new.id and a.status in ('applied', 'accepted', 'assigned');
    perform private.notify(new.company_id, v_members, 'shift_slot_cancelled', null, new.id, v_info);
  end if;
  return null;
end;
$$;

create trigger shift_slots_notify
  after update of published_at, cancelled_at on public.shift_slots
  for each row execute function private.notify_slot();

-- Angebot: angenommen, abgelehnt, Änderungswunsch (an die Admins)
create or replace function private.notify_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind  text;
  v_event public.events;
begin
  if old.accepted_at is null and new.accepted_at is not null then
    v_kind := 'quote_accepted';
  elsif old.declined_at is null and new.declined_at is not null then
    v_kind := 'quote_declined';
  elsif new.pending_change is not null and new.pending_change is distinct from old.pending_change then
    v_kind := 'change_requested';
  else
    return null;
  end if;
  select * into v_event from public.events where id = new.event_id;
  perform private.notify(new.company_id, private.members_with_role(new.company_id, array['admin']), v_kind,
    v_event.id, null, jsonb_build_object(
      'event_title', v_event.title, 'starts_at', v_event.starts_at, 'number', new.number,
      'customer_name', (select name from public.customers where id = v_event.customer_id)));
  return null;
end;
$$;

create trigger quotes_notify
  after update of accepted_at, declined_at, pending_change on public.quotes
  for each row execute function private.notify_quote();

-- Sonderessen vom Kunden (Portal): an Admin und Küche, nur Anzahl und „kurzfristig“
create or replace function private.notify_dietary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = new.event_id;
  perform private.notify(new.company_id, private.members_with_role(new.company_id, array['admin', 'kitchen']),
    'dietary_added', v_event.id, null, jsonb_build_object(
      'event_title', v_event.title, 'starts_at', v_event.starts_at,
      'person_count', new.person_count, 'short_notice', new.is_short_notice));
  return null;
end;
$$;

create trigger event_dietary_requirements_notify
  after insert on public.event_dietary_requirements
  for each row when (new.source = 'customer')
  execute function private.notify_dietary();

-- Gelesen markieren (ohne Liste: alle eigenen). Die App zeigt nur die letzten 50 Meldungen.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := public.auth_member_id();
  v_n      integer;
begin
  if v_member is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
   where member_id = v_member and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function private.notify(uuid, uuid[], text, uuid, uuid, jsonb),
  private.members_with_role(uuid, text[]), private.notify_application(), private.notify_slot(),
  private.notify_quote(), private.notify_dietary(), public.mark_notifications_read(uuid[])
  from public, anon, authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
