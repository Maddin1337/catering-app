-- =====================================================================
-- Korrekturen aus der Sicherheitsprüfung der Migrationen M5–M8
-- 1  Sonderessen: Schreiben nur admin/kitchen (nicht staff mit zugesagter Schicht), Update-Prüfung auf den Auftrag
-- 2  Annahme: Summe aus dem Snapshot der angenommenen Fassung, nicht aus dem Entwurf
-- 3  Küche: Menüwahl bleibt nach der Annahme erhalten (`acceptance_selection`)
-- 4  verbindliche Fassung als Spalte (`binding_revision`), nicht aus dem aktuellen Auftragsstatus abgeleitet
-- 5  Portal: `events.portal_locked` wirkt; Löschen von Sonderessen nur bei offenem Auftrag
-- 6  Portal-Links laufen nach Eventende + `portal_token_ttl_days` ab
-- 7  veraltete Fassung: NULL umgeht die Prüfung nicht mehr (`is distinct from`)
-- 8  späte Absage lässt sich nicht durch erneutes Bewerben löschen
-- 10 Sonderessen-Summe: Zeilensperre auf den Auftrag
-- 11 „kein Änderungsschluss“ (`changes_until` leer) bleibt ohne Frist; neue Aufträge bekommen die Vorbelegung
-- =====================================================================
alter table public.quotes
  add column acceptance_selection jsonb,
  add column binding_revision     integer,
  add constraint quotes_binding_revision_ok check (binding_revision is null or binding_revision between 1 and revision);
update public.quotes set binding_revision = acceptance_revision, acceptance_selection = '{}'::jsonb
 where acceptance_revision is not null;

-- 1 Sonderessen: nur admin und Küche schreiben (docs/03 §4.4)
drop policy dietary_insert on public.event_dietary_requirements;
drop policy dietary_update on public.event_dietary_requirements;
drop policy dietary_delete on public.event_dietary_requirements;
create policy dietary_insert on public.event_dietary_requirements for insert to authenticated
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) in ('admin', 'kitchen')
              and (select public.can_read_event(event_id)) and (select public.company_is_writable()));
create policy dietary_update on public.event_dietary_requirements for update to authenticated
  using      (company_id = (select public.auth_company_id()) and (select public.auth_role()) in ('admin', 'kitchen')
              and (select public.can_read_event(event_id)) and (select public.company_is_writable()))
  with check (company_id = (select public.auth_company_id()) and (select public.auth_role()) in ('admin', 'kitchen')
              and (select public.can_read_event(event_id)) and (select public.company_is_writable()));
create policy dietary_delete on public.event_dietary_requirements for delete to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) in ('admin', 'kitchen')
         and (select public.can_read_event(event_id)) and (select public.company_is_writable()));

-- 10 Summe der Sonderessen: Auftrag sperren, damit zwei gleichzeitige Eingaben die Gästezahl nicht überschreiten

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
  select * into v_event from public.events where id = new.event_id for update;
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

-- 6 Portal-Links: gültig bis Eventende + Tage der Firma (60); danach wie gesperrt
create or replace function private.portal_quote_id(p_token text, out o_quote uuid, out o_revoked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.quote_id,
         t.revoked_at is not null
         or now() > coalesce(e.ends_at, e.starts_at) + make_interval(days => c.portal_token_ttl_days)
    from public.portal_tokens t
    join public.quotes q on q.id = t.quote_id
    join public.events e on e.id = q.event_id
    join public.companies c on c.id = q.company_id
   where t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- 11 Änderungsschluss = events.changes_until; leer heißt: kein Änderungsschluss
create or replace function private.portal_changes_until(p_event public.events, p_company public.companies)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_event.changes_until
$$;

-- neue Aufträge bekommen den Änderungsschluss aus den Firmeneinstellungen vorbelegt (R2-6)
create or replace function private.prefill_changes_until()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer;
begin
  if new.changes_until is null then
    select case new.kind when 'business_lunch' then c.portal_change_lead_hours_business_lunch
                         else c.portal_change_lead_hours end
      into v_hours from public.companies c where c.id = new.company_id;
    if v_hours is not null then
      new.changes_until := new.starts_at - make_interval(hours => v_hours);
    end if;
  end if;
  return new;
end;
$$;
create trigger events_prefill_changes_until before insert on public.events
  for each row execute function private.prefill_changes_until();
update public.events e set changes_until = e.starts_at - make_interval(hours =>
    case e.kind when 'business_lunch' then c.portal_change_lead_hours_business_lunch else c.portal_change_lead_hours end)
  from public.companies c
 where c.id = e.company_id and e.changes_until is null
   and (case e.kind when 'business_lunch' then c.portal_change_lead_hours_business_lunch else c.portal_change_lead_hours end) is not null;


create or replace function public.portal_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_revoked boolean;
  v_q       public.quotes;
  v_e       public.events;
  v_c       public.companies;
  v_until   timestamptz;
  v_company jsonb;
begin
  select o_quote, o_revoked into v_id, v_revoked from private.portal_quote_id(p_token);
  if v_id is null then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  v_company := jsonb_build_object('name', v_c.name, 'accent_color', v_c.accent_color, 'phone', v_c.phone,
                                  'contact_email', v_c.contact_email, 'website', v_c.website,
                                  'imprint_url', v_c.imprint_url, 'privacy_policy_url', v_c.privacy_policy_url);
  if v_revoked or v_q.snapshot is null then
    return jsonb_build_object('state', 'revoked',
                              'company', jsonb_build_object('name', v_c.name, 'phone', v_c.phone,
                                                            'contact_email', v_c.contact_email));
  end if;

  update public.quotes set first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
   where id = v_q.id;
  v_until := private.portal_changes_until(v_e, v_c);
  return jsonb_build_object(
    'state', 'ok',
    'company', v_company,
    'quote', jsonb_build_object(
      'number', v_q.number, 'revision', v_q.revision, 'status', v_q.status, 'valid_until', v_q.valid_until,
      'expired', v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date,
      'sent_at', v_q.sent_at, 'send_mode', v_q.send_mode,
      'accepted_at', v_q.accepted_at, 'acceptance_revision', v_q.acceptance_revision,
      'acceptance_name', v_q.acceptance_name, 'declined_at', v_q.declined_at),
    'event', jsonb_build_object('status', v_e.status, 'changes_until', v_until,
                                'changes_locked', v_e.portal_locked or (v_until is not null and now() > v_until)),
    'snapshot', v_q.snapshot,
    'selection', coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb),
    'dietary', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'person_count', d.person_count, 'diet', d.diet,
                          'avoid_allergens', d.avoid_allergens, 'guest_name', d.guest_name, 'table_label', d.table_label,
                          'note', d.note) order by d.created_at)
                           from public.event_dietary_requirements d
                          where d.event_id = v_e.id and d.source = 'customer'), '[]'::jsonb),
    'has_pending_change', v_q.pending_change is not null);
end;
$$;

create or replace function public.portal_accept_quote(
  p_token text, p_revision integer, p_name text, p_email text default null, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id for update;
  if v_q.revision is distinct from p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'name_required';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-Mail ungültig' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if v_q.valid_until is not null and v_q.valid_until < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Angebot ist abgelaufen' using errcode = 'P0001', hint = 'quote_expired';
  end if;

  if v_e.status in ('quoted', 'optioned') and v_q.status = 'sent' then
    update public.events set status = 'confirmed', option_expires_at = null where id = v_e.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, reason)
    values (v_e.company_id, v_e.id, v_e.status, 'confirmed', 'portal', 'Angebot im Portal angenommen von ' || v_name);
  elsif v_e.status = 'confirmed' and v_q.send_mode = 'confirm_required'
        and (v_q.acceptance_revision is null or v_q.acceptance_revision < v_q.revision) then
    null; -- neue Fassung eines bestätigten Auftrags bestätigen
  else
    raise exception 'Das Angebot lässt sich nicht mehr annehmen' using errcode = 'P0001', hint = 'not_acceptable';
  end if;

  update public.quotes set
    status = 'accepted', accepted_at = now(), acceptance_revision = revision, acceptance_name = v_name,
    acceptance_email = v_email, acceptance_comment = nullif(btrim(coalesce(p_comment, '')), ''),
    acceptance_snapshot_hash = snapshot_hash,
    acceptance_total_gross_cents = (snapshot -> 'totals' ->> 'gross_cents')::integer,
    binding_revision = revision,
    acceptance_selection = coalesce(portal_selection -> 'choices', '{}'::jsonb),
    acceptance_log = acceptance_log || jsonb_build_array(jsonb_build_object(
      'at', now(), 'revision', revision, 'channel', 'portal', 'name', v_name, 'email', v_email,
      'snapshot_hash', snapshot_hash, 'total_gross_cents', (snapshot -> 'totals' ->> 'gross_cents')::integer,
      'selection', coalesce(portal_selection -> 'choices', '{}'::jsonb))),
    pending_change = null
  where id = v_q.id;
  return jsonb_build_object('accepted_at', now(), 'revision', v_q.revision);
end;
$$;

create or replace function public.portal_decline_quote(
  p_token text, p_revision integer, p_reason text default null, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_rev    boolean;
  v_q      public.quotes;
  v_e      public.events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to     public.event_status;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id for update;
  if v_q.revision is distinct from p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  -- quoted → declined, optioned → cancelled; beides endgültig (R2-4); ein bestätigter Auftrag lässt sich nicht ablehnen
  if v_e.status not in ('quoted', 'optioned') or v_q.status <> 'sent' then
    raise exception 'Das Angebot lässt sich nicht mehr ablehnen' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  v_to := case v_e.status when 'quoted' then 'declined' else 'cancelled' end;
  update public.events set status = v_to, option_expires_at = null where id = v_e.id;
  insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, reason)
  values (v_e.company_id, v_e.id, v_e.status, v_to, 'portal',
          'Im Portal abgelehnt' || coalesce(': ' || v_reason, ''));
  update public.quotes set status = 'declined', declined_at = now(), decline_reason = v_reason,
         decline_comment = nullif(btrim(coalesce(p_comment, '')), ''), pending_change = null
   where id = v_q.id;
end;
$$;

create or replace function public.portal_request_change(
  p_token text, p_revision integer, p_name text, p_comment text, p_guest_count integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
  v_c     public.companies;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_text  text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if v_q.revision is distinct from p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if v_e.portal_locked or (private.portal_changes_until(v_e, v_c) is not null and now() > private.portal_changes_until(v_e, v_c)) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  if v_name is null or (v_text is null and p_guest_count is null) then
    raise exception 'Name und Nachricht fehlen' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_guest_count is not null and p_guest_count not between 1 and 10000 then
    raise exception 'Gästezahl ungültig' using errcode = 'P0001', hint = 'invalid_dates';
  end if;
  update public.quotes set pending_change = jsonb_build_object(
    'requested_at', now(), 'revision', v_q.revision, 'name', v_name, 'comment', v_text, 'guest_count', p_guest_count)
   where id = v_q.id;
end;
$$;

create or replace function public.portal_select_choice(p_token text, p_revision integer, p_group text, p_item_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_rev   boolean;
  v_q     public.quotes;
  v_e     public.events;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id for update;
  select * into v_e from public.events where id = v_q.event_id;
  if v_e.portal_locked then
    raise exception 'Änderungen sind gesperrt' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  if v_q.revision is distinct from p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_e.status not in ('quoted', 'optioned') or v_q.status <> 'sent' then
    raise exception 'Die Auswahl lässt sich nicht mehr ändern' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  -- das Element muss zur Wahlgruppe der versendeten Fassung gehören
  if not exists (select 1 from jsonb_array_elements(v_q.snapshot -> 'items') x
                  where x ->> 'id' = p_item_id and x ->> 'choice_group' = p_group
                    and not coalesce((x ->> 'is_heading')::boolean, false)) then
    raise exception 'Ungültige Auswahl' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  update public.quotes set
    portal_selection = jsonb_set(coalesce(portal_selection, '{"choices": {}}'::jsonb), array['choices', p_group], to_jsonb(p_item_id), true),
    selection_updated_at = now()
   where id = v_q.id;
end;
$$;

create or replace function public.portal_save_dietary(
  p_token text, p_id uuid, p_person_count integer, p_diet public.diet_type, p_avoid public.allergen[],
  p_note text, p_guest_name text, p_table text, p_author text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_rev    boolean;
  v_q      public.quotes;
  v_e      public.events;
  v_c      public.companies;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_out    uuid;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if v_e.portal_locked or (private.portal_changes_until(v_e, v_c) is not null and now() > private.portal_changes_until(v_e, v_c)) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  if coalesce(p_person_count, 0) < 1 then
    raise exception 'Anzahl fehlt' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_diet is null and coalesce(cardinality(p_avoid), 0) = 0 and v_note is null then
    raise exception 'Bitte Diätform, Allergen oder Hinweis angeben' using errcode = 'P0001', hint = 'name_required';
  end if;
  if p_id is null then
    insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens, note,
                                                   guest_name, table_label, source, portal_author_name, created_by_member_id)
    values (v_e.company_id, v_e.id, p_person_count, p_diet, coalesce(p_avoid, '{}'), v_note,
            nullif(btrim(coalesce(p_guest_name, '')), ''), nullif(btrim(coalesce(p_table, '')), ''), 'customer',
            nullif(btrim(coalesce(p_author, '')), ''), null)
    returning id into v_out;
  else
    update public.event_dietary_requirements set
      person_count = p_person_count, diet = p_diet, avoid_allergens = coalesce(p_avoid, '{}'), note = v_note,
      guest_name = nullif(btrim(coalesce(p_guest_name, '')), ''), table_label = nullif(btrim(coalesce(p_table, '')), ''),
      portal_author_name = coalesce(nullif(btrim(coalesce(p_author, '')), ''), portal_author_name)
     where id = p_id and event_id = v_e.id and source = 'customer'
    returning id into v_out;
    if v_out is null then
      raise exception 'Eintrag nicht gefunden' using errcode = 'P0001', hint = 'not_acceptable';
    end if;
  end if;
  return v_out;
end;
$$;

create or replace function public.portal_delete_dietary(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
  v_rev boolean;
  v_q   public.quotes;
  v_e   public.events;
  v_c   public.companies;
begin
  select o_quote, o_revoked into v_id, v_rev from private.portal_quote_id(p_token);
  if v_id is null or v_rev then
    raise exception 'Link ungültig' using errcode = 'P0001', hint = 'portal_invalid';
  end if;
  select * into v_q from public.quotes where id = v_id;
  select * into v_e from public.events where id = v_q.event_id;
  select * into v_c from public.companies where id = v_q.company_id;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if v_e.portal_locked or (private.portal_changes_until(v_e, v_c) is not null and now() > private.portal_changes_until(v_e, v_c)) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  delete from public.event_dietary_requirements where id = p_id and event_id = v_e.id and source = 'customer';
  if not found then
    raise exception 'Eintrag nicht gefunden' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
end;
$$;

create or replace function public.send_quote(
  p_quote_id uuid,
  p_expected_revision integer,
  p_snapshot jsonb,
  p_via text,
  p_send_mode text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  uuid := public.auth_company_id();
  v_member   uuid;
  v_q        public.quotes;
  v_event    public.events;
  v_rev      integer;
  v_hash     text;
  v_token    text;
  v_live     text[];
  v_snap     text[];
  v_sum_net  bigint;
  v_sum_tax  bigint;
  v_items    jsonb := coalesce(p_snapshot -> 'items', '[]'::jsonb);
begin
  v_member := private.require_admin();
  perform public.assert_writable();
  if p_via not in ('email', 'link') then
    raise exception 'Versandweg ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision <> p_expected_revision then
    raise exception 'Das Angebot wurde inzwischen geändert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  select * into v_event from public.events where id = v_q.event_id and company_id = v_company for update;
  -- aus declined/cancelled/completed/invoiced nie wieder ein Angebot versenden (Endzustände, R2-3/R2-4)
  if v_event.status not in ('inquiry', 'quoted', 'optioned', 'confirmed') then
    raise exception 'Für diesen Auftrag kann kein Angebot mehr versendet werden'
      using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if v_event.status = 'confirmed' and p_send_mode is null then
    raise exception 'Versandart fehlt' using errcode = 'P0001', hint = 'send_mode_required';
  end if;
  if p_send_mode is not null and (p_send_mode not in ('confirm_required', 'info_only') or v_event.status <> 'confirmed') then
    raise exception 'Versandart ungültig' using errcode = 'P0001', hint = 'invalid_send';
  end if;

  -- Konsistenz des Snapshots mit dem Live-Stand
  if (p_snapshot ->> 'schema_version') is distinct from '1'
     or (p_snapshot ->> 'revision')::integer is distinct from p_expected_revision + 1
     or (p_snapshot -> 'quote' ->> 'number') is distinct from v_q.number then
    raise exception 'Snapshot passt nicht zum Angebot' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  select coalesce(array_agg(id::text order by id::text), '{}') into v_live
    from public.quote_items where quote_id = v_q.id;
  select coalesce(array_agg(x ->> 'id' order by x ->> 'id'), '{}') into v_snap
    from jsonb_array_elements(v_items) x;
  if v_live is distinct from v_snap then
    raise exception 'Positionen des Snapshots weichen vom Angebot ab' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = v_q.id and not is_heading) then
    raise exception 'Das Angebot hat keine Position' using errcode = 'P0001', hint = 'quote_empty';
  end if;
  select coalesce(sum((x ->> 'line_net_cents')::bigint), 0) into v_sum_net
    from jsonb_array_elements(v_items) x
   where coalesce((x ->> 'is_selected')::boolean, true) and not coalesce((x ->> 'is_heading')::boolean, false);
  select coalesce(sum((x ->> 'tax_cents')::bigint), 0) into v_sum_tax
    from jsonb_array_elements(coalesce(p_snapshot -> 'totals' -> 'tax', '[]'::jsonb)) x;
  if v_sum_net <> (p_snapshot -> 'totals' ->> 'net_cents')::bigint
     or (p_snapshot -> 'totals' ->> 'gross_cents')::bigint - (p_snapshot -> 'totals' ->> 'net_cents')::bigint <> v_sum_tax then
    raise exception 'Summen im Snapshot stimmen nicht' using errcode = 'P0001', hint = 'snapshot_invalid';
  end if;

  v_rev  := p_expected_revision + 1;
  v_hash := encode(sha256(convert_to(p_snapshot::text, 'UTF8')), 'hex');

  update public.quotes set
    revision = v_rev, status = 'sent', snapshot = p_snapshot, snapshot_hash = v_hash,
    sent_at = now(), sent_via = p_via, send_mode = p_send_mode, has_unsent_changes = false,
    portal_selection = null, selection_updated_at = null,
    binding_revision = case when v_event.status = 'confirmed' and p_send_mode = 'info_only' then v_rev else binding_revision end,
    total_net_cents = (p_snapshot -> 'totals' ->> 'net_cents')::integer,
    total_gross_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer,
    total_tax_cents = (p_snapshot -> 'totals' ->> 'gross_cents')::integer - (p_snapshot -> 'totals' ->> 'net_cents')::integer
  where id = v_q.id;
  insert into public.quote_revisions (company_id, quote_id, revision, snapshot, snapshot_hash, sent_via, send_mode, member_id)
  values (v_company, v_q.id, v_rev, p_snapshot, v_hash, p_via, p_send_mode, v_member);

  if v_event.status = 'inquiry' then
    update public.events set status = 'quoted' where id = v_event.id;
    insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind, actor_member_id)
    values (v_company, v_event.id, 'inquiry', 'quoted', 'member', v_member);
  end if;

  v_token := private.new_portal_token(v_company, v_q.id);
  return jsonb_build_object('revision', v_rev, 'token', v_token, 'snapshot_hash', v_hash);
end;
$$;

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
   where a.status in ('withdrawn', 'cancelled_by_staff') and not a.late_cancellation
  returning a.* into v_app;
  if v_app.id is null then
    raise exception 'Bewerbung existiert bereits' using errcode = 'P0001', hint = 'application_exists';
  end if;
  return v_app;
end;
$$;

-- 4 Küche: verbindliche Fassung = binding_revision (angenommen oder „Zur Info“ gesendet), sonst die neueste
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
  left join lateral (select case when q.revision = 0 then null else coalesce(q.binding_revision, q.revision) end as rev,
                            case when q.revision = 0 then 'live'
                                 when q.binding_revision is not null then 'binding' else 'snapshot' end as basis) b on true
  left join public.quote_revisions r on r.quote_id = q.id and r.revision = b.rev
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced', 'cancelled');

create or replace view public.kitchen_event_lines
  with (security_invoker = false, security_barrier = true) as
select e.id as event_id, e.company_id, b.basis, b.rev as revision,
       (x.item ->> 'type') as item_type,
       nullif(x.item ->> 'dish_id', '')::uuid as dish_id,
       nullif(x.item ->> 'menu_package_id', '')::uuid as menu_package_id,
       (x.item ->> 'quantity')::numeric as quantity
  from public.events e
  join public.quotes q on q.event_id = e.id and q.revision > 0
  cross join lateral (select coalesce(q.binding_revision, q.revision) as rev,
                            case when q.binding_revision is not null then 'binding' else 'snapshot' end as basis) b
  join public.quote_revisions r on r.quote_id = q.id and r.revision = b.rev
  cross join lateral jsonb_array_elements(r.snapshot -> 'items') as x(item)
  cross join lateral (select case
            when b.rev = q.acceptance_revision then q.acceptance_selection
            when b.rev = q.revision then q.portal_selection -> 'choices' end as choices) sel
 where e.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
   and e.status in ('optioned', 'confirmed', 'completed', 'invoiced')
   and (x.item ->> 'type') in ('package', 'dish')
   and not coalesce((x.item ->> 'is_heading')::boolean, false)
   and case
         when (x.item ->> 'choice_group') is not null and sel.choices ? (x.item ->> 'choice_group')
           then (sel.choices ->> (x.item ->> 'choice_group')) = (x.item ->> 'id')
         else coalesce((x.item ->> 'is_selected')::boolean, true)
       end
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


revoke execute on function private.prefill_changes_until() from public, anon, authenticated;
