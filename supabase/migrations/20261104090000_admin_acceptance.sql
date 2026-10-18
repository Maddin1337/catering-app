-- =====================================================================
-- Annahme durch den Admin macht die versendete Fassung verbindlich (Küche, docs/02 §8)
-- Bisher blieb die Küche bei einer telefonisch erfassten Annahme auf „vorläufig“.
-- =====================================================================
create or replace function public.set_event_status(
  p_event_id uuid,
  p_new_status public.event_status,
  p_reason text default null,
  p_confirmation_channel text default null,
  p_option_expires_at timestamptz default null,
  p_invoice_reference text default null,
  p_invoiced_on date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  uuid;
  v_event   public.events;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  -- kein Aufruf ohne angemeldetes Mitglied (insbesondere nicht aus pg_cron): kein Job ändert den Status (R2-3)
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  v_member := private.require_admin();
  perform public.assert_writable();

  select * into v_event from public.events
   where id = p_event_id and company_id = public.auth_company_id() for update;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;

  if p_new_status = 'quoted' then
    raise exception 'Der Status „Angebot versendet“ entsteht nur durch den Angebotsversand'
      using errcode = 'P0001', hint = 'use_quote_send';
  end if;
  -- Option verlängern: optioned -> optioned mit neuem Datum (02 §1.1)
  if not (v_event.status = 'optioned' and p_new_status = 'optioned')
     and not private.is_allowed_event_transition(v_event.status, p_new_status) then
    raise exception 'Dieser Statuswechsel ist nicht erlaubt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  if p_new_status = 'optioned' and (p_option_expires_at is null or p_option_expires_at < now()) then
    raise exception '„Optioniert bis“ fehlt oder liegt in der Vergangenheit'
      using errcode = 'P0001', hint = 'option_required';
  end if;
  if p_new_status = 'confirmed' and v_event.status in ('inquiry', 'optioned')
     and p_confirmation_channel is null then
    raise exception 'Bestätigungsweg fehlt' using errcode = 'P0001', hint = 'channel_required';
  end if;
  if p_new_status in ('declined', 'cancelled') and v_reason is null then
    raise exception 'Grund fehlt' using errcode = 'P0001', hint = 'reason_required';
  end if;
  if p_confirmation_channel is not null and p_confirmation_channel not in ('phone', 'email', 'in_person') then
    raise exception 'Bestätigungsweg ungültig' using errcode = 'P0001', hint = 'channel_required';
  end if;

  update public.events set
    status            = p_new_status,
    option_expires_at = case when p_new_status = 'optioned' then p_option_expires_at else null end,
    invoice_reference = case when p_new_status = 'invoiced' then nullif(btrim(coalesce(p_invoice_reference, '')), '') else invoice_reference end,
    invoiced_on       = case when p_new_status = 'invoiced' then p_invoiced_on else invoiced_on end
  where id = v_event.id;

  -- Annahme durch den Admin (Telefon, E-Mail, persönlich): die versendete Fassung wird verbindlich (docs/03 `record_acceptance`)
  if p_new_status = 'confirmed' then
    update public.quotes set
      status = 'accepted', accepted_at = now(), acceptance_revision = revision, binding_revision = revision,
      acceptance_name = coalesce(acceptance_name, 'vom Team erfasst'),
      acceptance_snapshot_hash = snapshot_hash,
      acceptance_total_gross_cents = (snapshot -> 'totals' ->> 'gross_cents')::integer,
      acceptance_selection = coalesce(portal_selection -> 'choices', '{}'::jsonb),
      acceptance_log = acceptance_log || jsonb_build_array(jsonb_build_object(
        'at', now(), 'revision', revision, 'channel', coalesce(p_confirmation_channel, 'admin'), 'name', 'vom Team erfasst',
        'snapshot_hash', snapshot_hash, 'total_gross_cents', (snapshot -> 'totals' ->> 'gross_cents')::integer,
        'selection', coalesce(portal_selection -> 'choices', '{}'::jsonb), 'member_id', v_member))
     where event_id = v_event.id and revision > 0 and v_event.status in ('quoted', 'optioned');
  end if;

  insert into public.event_status_changes (company_id, event_id, from_status, to_status, actor_kind,
                                           actor_member_id, reason, confirmation_channel)
  values (v_event.company_id, v_event.id, v_event.status, p_new_status, 'member', v_member, v_reason,
          case when p_new_status = 'confirmed' then p_confirmation_channel else null end);
end;
$$;
