-- =====================================================================
-- M4 · copy_event() kopiert jetzt auch das Angebot (docs/06 §1.7)
-- Das Angebot der Kopie ist ein neuer Entwurf (Revision 0, neue Nummer, Gültigkeit ab heute).
-- Die Referenz des Kunden wird nicht übernommen. Rechte und Signatur bleiben wie in M3.
-- =====================================================================
create or replace function public.copy_event(
  p_event_id uuid,
  p_new_starts_at timestamptz[],
  p_copy_dietary boolean default false,
  p_start_status public.event_status default 'inquiry',
  p_confirmation_channel text default null)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_src     public.events;
  v_start   timestamptz;
  v_delta   interval;
  v_new     uuid;
  v_ids     uuid[] := '{}';
  v_q       public.quotes;
  v_c       public.companies;
  v_newq    uuid;
begin
  perform private.require_admin();
  perform public.assert_writable();
  if coalesce(cardinality(p_new_starts_at), 0) not between 1 and 10 then
    raise exception 'Ein bis zehn Termine' using errcode = 'P0001', hint = 'invalid_dates';
  end if;
  if p_start_status not in ('inquiry', 'confirmed') then
    raise exception 'Startstatus ungültig' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if p_start_status = 'confirmed' and p_confirmation_channel is null then
    raise exception 'Bestätigungsweg fehlt' using errcode = 'P0001', hint = 'channel_required';
  end if;

  select * into v_src from public.events where id = p_event_id and company_id = v_company;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;

  select * into v_q from public.quotes where event_id = v_src.id and company_id = v_company;
  select * into v_c from public.companies where id = v_company;

  foreach v_start in array p_new_starts_at loop
    v_delta := (v_start at time zone 'Europe/Berlin') - (v_src.starts_at at time zone 'Europe/Berlin');

    insert into public.events (company_id, customer_id, kind, title, occasion, status, starts_at, ends_at,
                               guest_count, venue_name, street, postal_code, city, country, is_pickup,
                               onsite_contact_name, onsite_contact_phone, meeting_point, dress_code,
                               staff_notes, kitchen_notes, internal_notes, changes_until,
                               cancellation_agreement, copied_from_event_id)
    values (v_company, v_src.customer_id, v_src.kind, v_src.title, v_src.occasion, p_start_status,
            v_start,
            case when v_src.ends_at is null then null
                 else ((v_src.ends_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
            v_src.guest_count, v_src.venue_name, v_src.street, v_src.postal_code, v_src.city,
            v_src.country, v_src.is_pickup, v_src.onsite_contact_name, v_src.onsite_contact_phone,
            v_src.meeting_point, v_src.dress_code, v_src.staff_notes, v_src.kitchen_notes,
            v_src.internal_notes,
            case when v_src.changes_until is null then null
                 else ((v_src.changes_until at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
            v_src.cancellation_agreement, v_src.id)
    returning id into v_new;
    if p_start_status = 'confirmed' then
      update public.event_status_changes set confirmation_channel = p_confirmation_channel
       where event_id = v_new and from_status is null;
    end if;

    insert into public.event_schedule_items (company_id, event_id, kind, label, starts_at, ends_at, notes)
    select v_company, v_new, s.kind, s.label,
           ((s.starts_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin',
           case when s.ends_at is null then null
                else ((s.ends_at at time zone 'Europe/Berlin') + v_delta) at time zone 'Europe/Berlin' end,
           s.notes
      from public.event_schedule_items s where s.event_id = v_src.id;

    -- Sonderessen ohne Gastnamen und Tische (personenbezogen)
    if p_copy_dietary then
      insert into public.event_dietary_requirements (company_id, event_id, person_count, diet, avoid_allergens,
                                                     note, substitutions, source)
      select v_company, v_new, d.person_count, d.diet, d.avoid_allergens, d.note, d.substitutions, 'internal'
        from public.event_dietary_requirements d where d.event_id = v_src.id;
    end if;

    -- Angebot als neuer Entwurf: Revision 0, neue Nummer, ohne Referenz des Kunden und ohne Anzahlungstermin
    if v_q.id is not null then
      insert into public.quotes (company_id, event_id, pricing_mode, markup_bp, price_display, discount_bp,
                                 discount_cents, deposit_bp, deposit_cents, intro_text, terms_text, closing_text,
                                 valid_until, total_net_cents, total_tax_cents, total_gross_cents,
                                 cost_total_cents, cost_incomplete)
      values (v_company, v_new, v_q.pricing_mode, v_q.markup_bp, v_q.price_display, v_q.discount_bp,
              v_q.discount_cents, v_q.deposit_bp, v_q.deposit_cents, v_q.intro_text, v_q.terms_text,
              v_q.closing_text, (now() at time zone 'Europe/Berlin')::date + v_c.quote_validity_days,
              v_q.total_net_cents, v_q.total_tax_cents, v_q.total_gross_cents, v_q.cost_total_cents,
              v_q.cost_incomplete)
      returning id into v_newq;
      insert into public.quote_items (company_id, quote_id, type, sort_order, menu_package_id, dish_id, name,
                                      description, unit_label, quantity_mode, quantity, hours, unit_price_cents,
                                      price_is_manual, markup_bp, unit_cost, discount_bp, tax_rate_id,
                                      line_net_cents, line_tax_cents, line_gross_cents, choice_group,
                                      is_selected, customer_can_edit_quantity, is_heading)
      select v_company, v_newq, i.type, i.sort_order, i.menu_package_id, i.dish_id, i.name, i.description,
             i.unit_label, i.quantity_mode, i.quantity, i.hours, i.unit_price_cents, i.price_is_manual,
             i.markup_bp, i.unit_cost, i.discount_bp, i.tax_rate_id, i.line_net_cents, i.line_tax_cents,
             i.line_gross_cents, i.choice_group, i.is_selected, i.customer_can_edit_quantity, i.is_heading
        from public.quote_items i where i.quote_id = v_q.id;
    end if;
    v_ids := v_ids || v_new;
  end loop;
  return v_ids;
end;
$$;
