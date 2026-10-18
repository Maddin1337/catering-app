-- ============================================================================
-- Update: Migrationen ab 20261028090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261028090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261028090000_m6_portal.sql
-- =====================================================================
-- M6 · Kundenportal: Ansehen, Annehmen, Ablehnen, Änderungswunsch (docs/02 §4, docs/03 §3.3, §5)
--
-- Abweichung von der Planung (docs/07 A-28): Es gibt keine Edge Function `portal-api`. Die Portal-RPCs sind
-- für `anon` ausführbar; das Geheimnis ist der Token (244 Bit, nur als Hash gespeichert). Jede Funktion
-- prüft den Token selbst und gibt ausschließlich eine feste Auswahl an Feldern zurück (Snapshot ohne
-- Kalkulationsdaten, Firmenkontakt). Ohne Rate-Limit: bei 244 Bit ist Raten aussichtslos.
-- Umfang dieses Schritts: Ansehen, Annehmen, Ablehnen, Änderungswunsch als Nachricht. Wahlgruppen, Sonderessen
-- im Portal und Benachrichtigungen folgen später.
-- =====================================================================
alter table public.quotes
  add column first_viewed_at            timestamptz,
  add column last_viewed_at             timestamptz,
  add column accepted_at                timestamptz,
  add column acceptance_revision        integer,
  add column acceptance_name            text,
  add column acceptance_email          text,
  add column acceptance_comment         text,
  add column acceptance_snapshot_hash   text,
  add column acceptance_total_gross_cents integer,
  add column acceptance_log             jsonb not null default '[]'::jsonb,
  add column declined_at                timestamptz,
  add column decline_reason             text,
  add column decline_comment            text,
  add column pending_change             jsonb,
  add constraint quotes_acceptance_complete
    check ((accepted_at is null) = (acceptance_revision is null)
           and (acceptance_revision is null or acceptance_revision <= revision));

-- Token → Angebot (nur gültige, nicht gesperrte Links); NULL bei unbekanntem Token
create or replace function private.portal_quote_id(p_token text, out o_quote uuid, out o_revoked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.quote_id, t.revoked_at is not null
    from public.portal_tokens t
   where t.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- Spätester Termin für Änderungen (Änderungsschluss, R2-6)
create or replace function private.portal_changes_until(p_event public.events, p_company public.companies)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(p_event.changes_until,
                  p_event.starts_at - make_interval(hours => case p_event.kind
                    when 'business_lunch' then coalesce(p_company.portal_change_lead_hours_business_lunch, 24)
                    else coalesce(p_company.portal_change_lead_hours, 72) end))
$$;

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
    'event', jsonb_build_object('status', v_e.status, 'changes_until', v_until, 'changes_locked', now() > v_until),
    'snapshot', v_q.snapshot,
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
  if v_q.revision <> p_revision then
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
    acceptance_snapshot_hash = snapshot_hash, acceptance_total_gross_cents = total_gross_cents,
    acceptance_log = acceptance_log || jsonb_build_array(jsonb_build_object(
      'at', now(), 'revision', revision, 'channel', 'portal', 'name', v_name, 'email', v_email,
      'snapshot_hash', snapshot_hash, 'total_gross_cents', total_gross_cents)),
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
  if v_q.revision <> p_revision then
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

-- Änderungswunsch als Nachricht an den Caterer; ersetzt einen offenen
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
  if v_q.revision <> p_revision then
    raise exception 'Das Angebot wurde aktualisiert' using errcode = 'P0001', hint = 'revision_outdated';
  end if;
  if v_e.status not in ('quoted', 'optioned', 'confirmed') then
    raise exception 'Änderungen sind nicht mehr möglich' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
  if now() > private.portal_changes_until(v_e, v_c) then
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

-- Admin: Änderungswunsch als erledigt markieren (die Änderung selbst macht er im Angebot)
create or replace function public.resolve_pending_change(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.quotes set pending_change = null
   where id = p_quote_id and company_id = public.auth_company_id();
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
end;
$$;

revoke execute on function private.portal_quote_id(text), private.portal_changes_until(public.events, public.companies)
  from public, anon, authenticated;
revoke execute on function public.portal_get(text), public.portal_accept_quote(text, integer, text, text, text),
  public.portal_decline_quote(text, integer, text, text), public.portal_request_change(text, integer, text, text, integer),
  public.resolve_pending_change(uuid) from public, anon, authenticated;
grant execute on function public.portal_get(text), public.portal_accept_quote(text, integer, text, text, text),
  public.portal_decline_quote(text, integer, text, text), public.portal_request_change(text, integer, text, text, integer)
  to anon, authenticated;
grant execute on function public.resolve_pending_change(uuid) to authenticated;
