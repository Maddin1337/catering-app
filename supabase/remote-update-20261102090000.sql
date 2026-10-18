-- ============================================================================
-- Update: Migrationen ab 20261102090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261102090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261102090000_m6_dietary.sql
-- =====================================================================
-- M6 · Sonderessen und Allergien im Portal (docs/02 §4.2, R2-1: gelten sofort)
-- Der Kunde trägt Sonderessen ein, ändert und löscht nur seine eigenen Einträge (`source = 'customer'`), solange
-- der Änderungsschluss nicht erreicht ist. Die Summe darf die Gästezahl nicht übersteigen (Trigger aus M3).
-- Interne Einträge der Firma und die Namen anderer Gäste bleiben unsichtbar.
-- =====================================================================
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
    'selection', coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb),
    'dietary', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'person_count', d.person_count, 'diet', d.diet,
                          'avoid_allergens', d.avoid_allergens, 'guest_name', d.guest_name, 'table_label', d.table_label,
                          'note', d.note) order by d.created_at)
                           from public.event_dietary_requirements d
                          where d.event_id = v_e.id and d.source = 'customer'), '[]'::jsonb),
    'has_pending_change', v_q.pending_change is not null);
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
  if now() > private.portal_changes_until(v_e, v_c) then
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
  if now() > private.portal_changes_until(v_e, v_c) then
    raise exception 'Der Änderungsschluss ist vorbei' using errcode = 'P0001', hint = 'changes_locked';
  end if;
  delete from public.event_dietary_requirements where id = p_id and event_id = v_e.id and source = 'customer';
  if not found then
    raise exception 'Eintrag nicht gefunden' using errcode = 'P0001', hint = 'not_acceptable';
  end if;
end;
$$;

revoke execute on function public.portal_save_dietary(text, uuid, integer, public.diet_type, public.allergen[], text, text, text, text),
  public.portal_delete_dietary(text, uuid) from public, anon, authenticated;
grant execute on function public.portal_save_dietary(text, uuid, integer, public.diet_type, public.allergen[], text, text, text, text),
  public.portal_delete_dietary(text, uuid) to anon, authenticated;
