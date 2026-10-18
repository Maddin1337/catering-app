-- =====================================================================
-- M6 · Menüwahl im Portal (Wahlgruppen, docs/02 §4.1, docs/03 §3.3 `portal_selection`)
--
-- Der Kunde wählt vor der Annahme je Wahlgruppe eine Alternative; die Wahl ändert weder Snapshot noch Hash und
-- erzeugt keine neue Fassung (R2-1). Sie liegt in `quotes.portal_selection` und fließt in das Annahmeprotokoll
-- und in die Küchenlisten ein. Der Admin übernimmt sie mit `apply_portal_selection()` in den Entwurf; jede neue
-- Fassung setzt die Wahl zurück. Die Summen mit Wahl rechnet das Portal mit dem gemeinsamen TypeScript-Modul.
-- =====================================================================
alter table public.quotes
  add column portal_selection     jsonb,
  add column selection_updated_at timestamptz;

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
    'has_pending_change', v_q.pending_change is not null);
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
  if v_q.revision <> p_revision then
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
      'snapshot_hash', snapshot_hash, 'total_gross_cents', total_gross_cents,
      'selection', coalesce(portal_selection -> 'choices', '{}'::jsonb))),
    pending_change = null
  where id = v_q.id;
  return jsonb_build_object('accepted_at', now(), 'revision', v_q.revision);
end;
$$;

-- Admin: Wahl des Kunden in den Entwurf übernehmen (is_selected je Wahlgruppe); die Summen rechnet der Editor neu
create or replace function public.apply_portal_selection(p_quote_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes;
  v_n integer := 0;
  c   record;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = public.auth_company_id() for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  for c in select key as grp, value #>> '{}' as item_id from jsonb_each(coalesce(v_q.portal_selection -> 'choices', '{}'::jsonb)) loop
    update public.quote_items set is_selected = (id::text = c.item_id)
     where quote_id = v_q.id and choice_group = c.grp;
    v_n := v_n + 1;
  end loop;
  update public.quotes set portal_selection = null, selection_updated_at = null,
         has_unsent_changes = revision > 0 where id = v_q.id;
  return v_n;
end;
$$;

-- send_quote: jede neue Fassung setzt die Wahl zurück
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
  if p_send_mode is not null and p_send_mode not in ('confirm_required', 'info_only') then
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

-- Küche: Wahl des Kunden wirkt auf die Positionen, solange sie nicht in den Entwurf übernommen ist
create or replace view public.kitchen_event_lines
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
   and not coalesce((x.item ->> 'is_heading')::boolean, false)
   and case
         when b.rev = q.revision and (x.item ->> 'choice_group') is not null
              and (q.portal_selection -> 'choices') ? (x.item ->> 'choice_group')
           then (q.portal_selection -> 'choices' ->> (x.item ->> 'choice_group')) = (x.item ->> 'id')
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

revoke execute on function public.portal_select_choice(text, integer, text, text),
  public.apply_portal_selection(uuid) from public, anon, authenticated;
grant execute on function public.portal_select_choice(text, integer, text, text) to anon, authenticated;
grant execute on function public.apply_portal_selection(uuid) to authenticated;
