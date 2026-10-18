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
