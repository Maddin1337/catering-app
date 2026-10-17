-- ============================================================================
-- Update: Migrationen ab 20261021090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261021090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

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
