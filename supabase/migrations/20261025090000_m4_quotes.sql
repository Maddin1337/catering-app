-- =====================================================================
-- M4 · Angebote: Entwurf und Positionen (docs/03-datenmodell.md §3.3, §7.4; docs/02 §2, §3)
-- quotes, quote_items, Angebotsnummer A-JJJJ-NNNN, RPCs ensure_quote() und save_quote().
--
-- Abweichung von der Planung (docs/07): Diese Migration legt nur den Entwurfsstand an. Die Spalten für
-- Snapshot, Versand, Portal und Annahme (snapshot, send_log, binding_*, portal_selection, acceptance_*,
-- pending_change …) kommen mit dem Versand (M5) per `alter table`; `revision` ist bis dahin immer 0.
-- =====================================================================
create table public.quotes (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  event_id            uuid not null unique,
  number              text not null,
  status              public.quote_status not null default 'draft',
  revision            integer not null default 0 check (revision >= 0),
  pricing_mode        public.pricing_mode not null default 'flat',
  markup_bp           integer not null default 20000 check (markup_bp between 0 and 100000),
  price_display       public.price_basis not null default 'gross',
  discount_bp         integer not null default 0 check (discount_bp between 0 and 10000),
  discount_cents      integer not null default 0 check (discount_cents >= 0),
  deposit_bp          integer check (deposit_bp between 0 and 10000),
  deposit_cents       integer check (deposit_cents >= 0),
  deposit_due_on      date,
  customer_reference  text,
  intro_text          text,
  terms_text          text,
  closing_text        text,
  valid_until         date,
  total_net_cents     integer not null default 0,
  total_tax_cents     integer not null default 0,
  total_gross_cents   integer not null default 0,
  cost_total_cents    integer,
  cost_incomplete     boolean not null default false,
  has_unsent_changes  boolean not null default false,
  editor_active_seconds integer not null default 0 check (editor_active_seconds >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, number),
  foreign key (company_id, event_id) references public.events (company_id, id) on delete cascade,
  constraint quotes_one_discount check (discount_bp = 0 or discount_cents = 0),
  constraint quotes_one_deposit check (deposit_bp is null or deposit_cents is null)
);

create table public.quote_items (
  id                         uuid primary key default gen_random_uuid(),
  company_id                 uuid not null references public.companies (id) on delete cascade,
  quote_id                   uuid not null,
  type                       public.quote_item_type not null,
  sort_order                 integer not null default 0,
  menu_package_id            uuid,
  dish_id                    uuid,
  name                       text not null check (char_length(btrim(name)) between 1 and 200),
  description                text,
  unit_label                 text not null default 'Person',
  quantity_mode              public.quantity_mode not null default 'fixed',
  quantity                   numeric(10, 2) not null default 1 check (quantity >= 0),
  hours                      numeric(5, 2) check (hours > 0 and (hours * 4) = trunc(hours * 4)),
  unit_price_cents           integer check (unit_price_cents >= 0),
  price_is_manual            boolean not null default false,
  markup_bp                  integer check (markup_bp between 0 and 100000),
  unit_cost                  numeric(12, 4) check (unit_cost >= 0),
  discount_bp                integer not null default 0 check (discount_bp between 0 and 10000),
  tax_rate_id                uuid,
  line_net_cents             integer,
  line_tax_cents             integer,
  line_gross_cents           integer,
  choice_group               text,
  is_selected                boolean not null default true,
  customer_can_edit_quantity boolean not null default false,
  is_heading                 boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  foreign key (company_id, quote_id) references public.quotes (company_id, id) on delete cascade,
  foreign key (company_id, menu_package_id) references public.menu_packages (company_id, id),
  foreign key (company_id, dish_id) references public.dishes (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id),
  constraint quote_items_package check ((type = 'package') = (menu_package_id is not null)),
  constraint quote_items_dish check ((type = 'dish') = (dish_id is not null)),
  constraint quote_items_hours check (hours is null or type = 'service'),
  constraint quote_items_heading check (not is_heading or (type = 'custom' and unit_price_cents is null)),
  constraint quote_items_price check (unit_price_cents is not null or is_heading)
);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);
create index quote_items_dish_idx on public.quote_items (dish_id) where dish_id is not null;
create index quote_items_package_idx on public.quote_items (menu_package_id) where menu_package_id is not null;
create index quote_items_tax_idx on public.quote_items (tax_rate_id) where tax_rate_id is not null;

create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger quote_items_set_updated_at before update on public.quote_items
  for each row execute function public.set_updated_at();
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
revoke all on public.quotes, public.quote_items from anon, authenticated;

-- Lesen nur admin; Schreiben nur über die RPCs (Systemfelder wie number und status nie direkt)
grant select on public.quotes, public.quote_items to authenticated;
create policy quotes_admin_select on public.quotes for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy quote_items_admin_select on public.quote_items for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- Angebotsnummer A-JJJJ-NNNN je Firma, fortlaufend und race-sicher (Zeilensperre auf companies)
create or replace function private.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Berlin'))::integer;
  v_c    record;
  v_seq  integer;
begin
  select quote_number_year, quote_number_seq into v_c
    from public.companies where id = new.company_id for update;
  v_seq := case when v_c.quote_number_year is distinct from v_year then 1 else v_c.quote_number_seq + 1 end;
  update public.companies set quote_number_year = v_year, quote_number_seq = v_seq where id = new.company_id;
  new.number := 'A-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;
create trigger quotes_assign_number before insert on public.quotes
  for each row execute function private.assign_quote_number();

-- ---------- RPCs ----------
-- Entwurf zum Auftrag holen oder anlegen (Standardwerte aus Firma und Kundentyp)
create or replace function public.ensure_quote(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_id      uuid;
  v_event   public.events;
  v_c       public.companies;
  v_type    public.customer_type;
begin
  perform private.require_admin();
  select id into v_id from public.quotes where event_id = p_event_id and company_id = v_company;
  if v_id is not null then
    return v_id;
  end if;
  perform public.assert_writable();
  select * into v_event from public.events where id = p_event_id and company_id = v_company;
  if not found then
    raise exception 'Auftrag nicht gefunden' using errcode = 'P0001', hint = 'event_not_found';
  end if;
  if v_event.status in ('declined', 'cancelled', 'invoiced') then
    raise exception 'Für diesen Auftrag gibt es kein Angebot mehr' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  select * into v_c from public.companies where id = v_company;
  select type into v_type from public.customers where id = v_event.customer_id;
  insert into public.quotes (company_id, event_id, pricing_mode, markup_bp, price_display, intro_text, terms_text,
                             closing_text, valid_until)
  values (v_company, p_event_id, v_c.default_pricing_mode, v_c.default_markup_bp,
          case when v_type = 'business' then 'net' else 'gross' end::public.price_basis,
          v_c.quote_intro_text, v_c.quote_terms_text, v_c.quote_closing_text,
          ((now() at time zone 'Europe/Berlin')::date + v_c.quote_validity_days))
  returning id into v_id;
  return v_id;
end;
$$;

-- Entwurf speichern: Kopf und alle Positionen in einer Transaktion (die App rechnet mit dem TS-Modul)
-- payload: { quote_id, header: {…}, items: [{id, type, …}], editor_seconds }
create or replace function public.save_quote(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_q       public.quotes;
  v_h       jsonb := p -> 'header';
  v_t       jsonb := v_h -> 'totals';
  i         jsonb;
  n         integer := 0;
begin
  perform private.require_admin();
  perform public.assert_writable();
  select * into v_q from public.quotes
   where id = (p ->> 'quote_id')::uuid and company_id = v_company for update;
  if not found then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0001', hint = 'quote_not_found';
  end if;
  if exists (select 1 from public.events e where e.id = v_q.event_id and e.status in ('declined', 'cancelled', 'invoiced')) then
    raise exception 'Das Angebot ist schreibgeschützt' using errcode = 'P0001', hint = 'invalid_transition';
  end if;

  update public.quotes set
    pricing_mode       = coalesce((v_h ->> 'pricing_mode')::public.pricing_mode, pricing_mode),
    markup_bp          = coalesce((v_h ->> 'markup_bp')::integer, markup_bp),
    price_display      = coalesce((v_h ->> 'price_display')::public.price_basis, price_display),
    discount_bp        = coalesce((v_h ->> 'discount_bp')::integer, 0),
    discount_cents     = coalesce((v_h ->> 'discount_cents')::integer, 0),
    deposit_bp         = (v_h ->> 'deposit_bp')::integer,
    deposit_cents      = (v_h ->> 'deposit_cents')::integer,
    deposit_due_on     = nullif(v_h ->> 'deposit_due_on', '')::date,
    customer_reference = nullif(btrim(coalesce(v_h ->> 'customer_reference', '')), ''),
    intro_text         = nullif(btrim(coalesce(v_h ->> 'intro_text', '')), ''),
    terms_text         = nullif(btrim(coalesce(v_h ->> 'terms_text', '')), ''),
    closing_text       = nullif(btrim(coalesce(v_h ->> 'closing_text', '')), ''),
    valid_until        = nullif(v_h ->> 'valid_until', '')::date,
    total_net_cents    = coalesce((v_t ->> 'net')::integer, 0),
    total_tax_cents    = coalesce((v_t ->> 'tax')::integer, 0),
    total_gross_cents  = coalesce((v_t ->> 'gross')::integer, 0),
    cost_total_cents   = (v_h ->> 'cost_total_cents')::integer,
    cost_incomplete    = coalesce((v_h ->> 'cost_incomplete')::boolean, false),
    has_unsent_changes = v_q.revision > 0,
    editor_active_seconds = editor_active_seconds + greatest(coalesce((p ->> 'editor_seconds')::integer, 0), 0)
  where id = v_q.id;

  delete from public.quote_items where quote_id = v_q.id;
  for i in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    insert into public.quote_items (
      id, company_id, quote_id, type, sort_order, menu_package_id, dish_id, name, description, unit_label,
      quantity_mode, quantity, hours, unit_price_cents, price_is_manual, markup_bp, unit_cost, discount_bp,
      tax_rate_id, line_net_cents, line_tax_cents, line_gross_cents, choice_group, is_selected,
      customer_can_edit_quantity, is_heading)
    values (
      coalesce((i ->> 'id')::uuid, gen_random_uuid()), v_company, v_q.id, (i ->> 'type')::public.quote_item_type, n,
      nullif(i ->> 'menu_package_id', '')::uuid, nullif(i ->> 'dish_id', '')::uuid, btrim(i ->> 'name'),
      nullif(btrim(coalesce(i ->> 'description', '')), ''), coalesce(nullif(i ->> 'unit_label', ''), 'Person'),
      coalesce((i ->> 'quantity_mode')::public.quantity_mode, 'fixed'), coalesce((i ->> 'quantity')::numeric, 1),
      (i ->> 'hours')::numeric, (i ->> 'unit_price_cents')::integer, coalesce((i ->> 'price_is_manual')::boolean, false),
      (i ->> 'markup_bp')::integer, (i ->> 'unit_cost')::numeric, coalesce((i ->> 'discount_bp')::integer, 0),
      nullif(i ->> 'tax_rate_id', '')::uuid, (i ->> 'line_net_cents')::integer, (i ->> 'line_tax_cents')::integer,
      (i ->> 'line_gross_cents')::integer, nullif(i ->> 'choice_group', ''), coalesce((i ->> 'is_selected')::boolean, true),
      coalesce((i ->> 'customer_can_edit_quantity')::boolean, false), coalesce((i ->> 'is_heading')::boolean, false));
    n := n + 1;
  end loop;
end;
$$;

revoke execute on function private.assign_quote_number() from public, anon, authenticated;
revoke execute on function public.ensure_quote(uuid), public.save_quote(jsonb) from public, anon, authenticated;
grant execute on function public.ensure_quote(uuid), public.save_quote(jsonb) to authenticated;
