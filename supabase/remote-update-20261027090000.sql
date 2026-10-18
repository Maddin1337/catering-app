-- ============================================================================
-- Update: Migrationen ab 20261027090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261027090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261027090000_m5_send.sql
-- =====================================================================
-- M5 · Angebot versenden: Revisionen mit eingefrorenem Stand, Portal-Links (docs/03 §3.3, §4.7; docs/02 §2.4)
--
-- Abweichung von der Planung (docs/07 A-25): Es gibt keine Edge Function für den Versand. `send_quote()` ist ein
-- RPC für Admins; die App baut den Snapshot mit dem TS-Rechenmodul, die Datenbank prüft ihn auf Konsistenz,
-- berechnet den Hash und legt Revision, Portal-Link und Statuswechsel in EINER Transaktion an. Das PDF entsteht
-- auf dem Gerät aus dem Snapshot; die Datenbank speichert jede Revision (`quote_revisions`), nicht das PDF.
-- =====================================================================
alter table public.quotes
  add column snapshot       jsonb,
  add column snapshot_hash  text,
  add column sent_at        timestamptz,
  add column sent_via       text check (sent_via in ('email', 'link')),
  add column send_mode      text check (send_mode in ('confirm_required', 'info_only')),
  add constraint quotes_snapshot_iff_sent check ((revision = 0) = (snapshot is null));

-- Jede versendete Revision bleibt abrufbar (US-28.2); nur anhängen
create table public.quote_revisions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  quote_id      uuid not null,
  revision      integer not null check (revision > 0),
  snapshot      jsonb not null,
  snapshot_hash text not null,
  sent_at       timestamptz not null default now(),
  sent_via      text not null check (sent_via in ('email', 'link')),
  send_mode     text check (send_mode in ('confirm_required', 'info_only')),
  member_id     uuid,
  unique (quote_id, revision),
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade
);
alter table public.quote_revisions enable row level security;
revoke all on public.quote_revisions from anon, authenticated;
grant select on public.quote_revisions to authenticated;
create policy quote_revisions_admin_select on public.quote_revisions for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- Portal-Links: gespeichert wird nur der Hash, der Klartext erscheint genau einmal bei der Ausgabe
create table public.portal_tokens (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  quote_id    uuid not null,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade
);
create index portal_tokens_quote_idx on public.portal_tokens (quote_id);
alter table public.portal_tokens enable row level security;
revoke all on public.portal_tokens from anon, authenticated;

-- Neuer Link: 2 × UUID v4 aus dem kryptografischen Zufallsgenerator = 244 Bit
create or replace function private.new_portal_token(p_company uuid, p_quote uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into public.portal_tokens (company_id, quote_id, token_hash)
  values (p_company, p_quote, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end;
$$;

-- ---------- Versand ----------
-- p_snapshot: Format siehe docs/03 §3.3 (schema_version 1). Rückgabe: {revision, token, snapshot_hash}
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

-- Neuen Link ausgeben („Link kopieren“); frühere Links bleiben gültig und zeigen immer die aktuelle Revision
create or replace function public.issue_portal_token(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision = 0 then
    raise exception 'Das Angebot wurde noch nicht versendet' using errcode = 'P0001', hint = 'not_sent';
  end if;
  return private.new_portal_token(v_company, v_q.id);
end;
$$;

-- Alle Links sperren (z. B. bei falschem Empfänger)
create or replace function public.revoke_portal_tokens(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform public.assert_writable();
  update public.portal_tokens set revoked_at = now()
   where quote_id = p_quote_id and company_id = public.auth_company_id() and revoked_at is null;
end;
$$;

-- Änderungen seit dem letzten Versand verwerfen: Entwurf = letzter versendeter Stand
create or replace function public.discard_quote_changes(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
  v_s       jsonb;
  v_old     jsonb;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes where id = p_quote_id and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if v_q.revision = 0 or v_q.snapshot is null then
    raise exception 'Es gibt keinen versendeten Stand' using errcode = 'P0001', hint = 'not_sent';
  end if;
  if exists (select 1 from public.events e where e.id = v_q.event_id and e.status in ('declined', 'cancelled', 'invoiced')) then
    raise exception 'Das Angebot ist schreibgeschützt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  v_s := v_q.snapshot;

  -- Kalkulationsdaten stehen nicht im Snapshot: für Positionen, die es noch gibt, bleiben sie erhalten
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'markup_bp', markup_bp, 'unit_cost', unit_cost)), '[]'::jsonb)
    into v_old from public.quote_items where quote_id = v_q.id;
  delete from public.quote_items where quote_id = v_q.id;
  insert into public.quote_items (
    id, company_id, quote_id, type, sort_order, menu_package_id, dish_id, name, description, unit_label,
    quantity_mode, quantity, hours, unit_price_cents, price_is_manual, markup_bp, unit_cost, discount_bp,
    tax_rate_id, line_net_cents, line_tax_cents, line_gross_cents, choice_group, is_selected,
    customer_can_edit_quantity, is_heading)
  select (x.item ->> 'id')::uuid, v_company, v_q.id, (x.item ->> 'type')::public.quote_item_type, x.ord::integer - 1,
         nullif(x.item ->> 'menu_package_id', '')::uuid, nullif(x.item ->> 'dish_id', '')::uuid,
         x.item ->> 'name', nullif(x.item ->> 'description', ''), coalesce(x.item ->> 'unit_label', 'Person'),
         coalesce((x.item ->> 'quantity_mode')::public.quantity_mode, 'fixed'),
         coalesce((x.item ->> 'quantity')::numeric, 1), (x.item ->> 'hours')::numeric,
         (x.item ->> 'unit_price_cents')::integer, coalesce((x.item ->> 'price_is_manual')::boolean, false),
         (o ->> 'markup_bp')::integer, (o ->> 'unit_cost')::numeric, coalesce((x.item ->> 'discount_bp')::integer, 0),
         nullif(x.item ->> 'tax_rate_id', '')::uuid, (x.item ->> 'line_net_cents')::integer,
         (x.item ->> 'line_tax_cents')::integer, (x.item ->> 'line_gross_cents')::integer,
         nullif(x.item ->> 'choice_group', ''), coalesce((x.item ->> 'is_selected')::boolean, true),
         coalesce((x.item ->> 'customer_can_edit_quantity')::boolean, false),
         coalesce((x.item ->> 'is_heading')::boolean, false)
    from jsonb_array_elements(v_s -> 'items') with ordinality as x(item, ord)
    left join lateral (select e as o from jsonb_array_elements(v_old) e where e ->> 'id' = x.item ->> 'id' limit 1) m on true;

  update public.quotes set
    price_display      = (v_s -> 'quote' ->> 'price_display')::public.price_basis,
    discount_bp        = coalesce((v_s -> 'quote' ->> 'discount_bp')::integer, 0),
    discount_cents     = coalesce((v_s -> 'quote' ->> 'discount_cents')::integer, 0),
    deposit_bp         = (v_s -> 'quote' -> 'deposit' ->> 'bp')::integer,
    deposit_cents      = (v_s -> 'quote' -> 'deposit' ->> 'cents')::integer,
    deposit_due_on     = nullif(v_s -> 'quote' -> 'deposit' ->> 'due_on', '')::date,
    customer_reference = nullif(v_s -> 'quote' ->> 'customer_reference', ''),
    intro_text         = nullif(v_s -> 'quote' ->> 'intro_text', ''),
    terms_text         = nullif(v_s -> 'quote' ->> 'terms_text', ''),
    closing_text       = nullif(v_s -> 'quote' ->> 'closing_text', ''),
    total_net_cents    = (v_s -> 'totals' ->> 'net_cents')::integer,
    total_gross_cents  = (v_s -> 'totals' ->> 'gross_cents')::integer,
    total_tax_cents    = (v_s -> 'totals' ->> 'gross_cents')::integer - (v_s -> 'totals' ->> 'net_cents')::integer,
    has_unsent_changes = false
  where id = v_q.id;
end;
$$;

revoke execute on function private.new_portal_token(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.send_quote(uuid, integer, jsonb, text, text), public.issue_portal_token(uuid),
  public.revoke_portal_tokens(uuid), public.discard_quote_changes(uuid) from public, anon, authenticated;
grant execute on function public.send_quote(uuid, integer, jsonb, text, text), public.issue_portal_token(uuid),
  public.revoke_portal_tokens(uuid), public.discard_quote_changes(uuid) to authenticated;
