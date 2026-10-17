-- ============================================================================
-- Update: Migrationen ab 20261022090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261022090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261022090000_m2_catalog.sql
-- =====================================================================
-- M2 · Katalog: Gerichte, Zutaten, Pakete (docs/03-datenmodell.md §3.4, §4.3, §4.6, §7.3)
-- dishes, dish_allergens, ingredients, dish_ingredients, menu_packages, menu_package_dishes;
-- RPCs save_dish, save_ingredient, save_menu_package; preisfreie Views für die Küche.
--
-- Abweichungen von der Planung (docs/07):
-- - `dish_ingredients.quantity_per_person` ist numeric(10,2) statt (10,1): 0,25 Stück Ei kommt im
--   Rechenbeispiel (docs/02 §3.3) selbst vor.
-- - Geschrieben wird nur über die RPCs (auch vom admin), damit Prüfstatus der Allergene,
--   Preisfelder und Zutatenlisten atomar und einheitlich behandelt werden.
-- =====================================================================
-- ---------- Tabellen ----------
create table public.dishes (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  description           text,
  category              public.dish_category not null default 'main',
  portion_label         text not null default 'Portion' check (char_length(btrim(portion_label)) between 1 and 30),
  price_cents           integer check (price_cents >= 0),                 -- nur admin
  tax_rate_id           uuid,                                              -- nur admin
  markup_bp             integer check (markup_bp between 0 and 100000),   -- nur admin
  diets                 public.diet_type[] not null default '{}',
  allergens_reviewed_at timestamptz,
  allergens_reviewed_by uuid,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id),
  foreign key (company_id, allergens_reviewed_by)
    references public.company_members (company_id, id) on delete set null (allergens_reviewed_by),
  constraint dishes_vegan_is_vegetarian
    check (not ('vegan' = any (diets)) or 'vegetarian' = any (diets))
);
create index dishes_list_idx on public.dishes (company_id, category, name) where archived_at is null;
create index dishes_diets_idx on public.dishes using gin (diets);
create index dishes_name_trgm_idx on public.dishes using gin (name extensions.gin_trgm_ops);

create table public.dish_allergens (
  company_id uuid not null references public.companies (id) on delete cascade,
  dish_id    uuid not null,
  allergen   public.allergen not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dish_id, allergen),
  foreign key (company_id, dish_id) references public.dishes (company_id, id) on delete cascade
);
create index dish_allergens_allergen_idx on public.dish_allergens (company_id, allergen);

create table public.ingredients (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  unit          public.ingredient_unit not null,
  price_cents   integer check (price_cents >= 0),                         -- je kg, l bzw. Stück; nur admin
  product_group text check (product_group is null or char_length(btrim(product_group)) between 1 and 60),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, id)
);
create index ingredients_name_idx on public.ingredients (company_id, lower(name));
create index ingredients_name_trgm_idx on public.ingredients using gin (name extensions.gin_trgm_ops);

create table public.dish_ingredients (
  company_id          uuid not null references public.companies (id) on delete cascade,
  dish_id             uuid not null,
  ingredient_id       uuid not null,
  -- Menge pro Person in der Basiseinheit = Einkaufsmenge der Rohware vor dem Garen (R2-7)
  quantity_per_person numeric(10, 2) not null check (quantity_per_person > 0),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (dish_id, ingredient_id),
  foreign key (company_id, dish_id) references public.dishes (company_id, id) on delete cascade,
  foreign key (company_id, ingredient_id) references public.ingredients (company_id, id)  -- NO ACTION
);
create index dish_ingredients_ingredient_idx on public.dish_ingredients (ingredient_id);

create table public.menu_packages (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  name                   text not null check (char_length(btrim(name)) between 1 and 120),
  description            text,
  price_per_person_cents integer check (price_per_person_cents >= 0),     -- nur admin
  tax_rate_id            uuid,
  markup_bp              integer check (markup_bp between 0 and 100000),
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id)
);

create table public.menu_package_dishes (
  company_id      uuid not null references public.companies (id) on delete cascade,
  menu_package_id uuid not null,
  dish_id         uuid not null,
  portion_factor  numeric(4, 2) not null default 1.00 check (portion_factor > 0),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (menu_package_id, dish_id),
  foreign key (company_id, menu_package_id)
    references public.menu_packages (company_id, id) on delete cascade,
  foreign key (company_id, dish_id) references public.dishes (company_id, id)   -- NO ACTION
);
create index menu_package_dishes_dish_idx on public.menu_package_dishes (dish_id);

do $$
declare t text;
begin
  foreach t in array array['dishes', 'dish_allergens', 'ingredients', 'dish_ingredients',
                           'menu_packages', 'menu_package_dishes']
  loop
    execute format('create trigger %1$s_set_updated_at before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------- Rechte: Basistabellen mit Preisen nur lesbar für admin, Schreiben nur per RPC ----------
grant select on public.dishes, public.ingredients, public.menu_packages to authenticated;
create policy dishes_admin_select on public.dishes for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy ingredients_admin_select on public.ingredients for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');
create policy menu_packages_admin_select on public.menu_packages for select to authenticated
  using (company_id = (select public.auth_company_id()) and (select public.auth_role()) = 'admin');

-- preisfreie Tabellen: admin und Küche lesen direkt
grant select on public.dish_allergens, public.dish_ingredients, public.menu_package_dishes to authenticated;
do $$
declare t text;
begin
  foreach t in array array['dish_allergens', 'dish_ingredients', 'menu_package_dishes']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (company_id = (select public.auth_company_id())
               and (select public.auth_role()) in ('admin', 'kitchen'))
    $f$, t);
  end loop;
end;
$$;

-- ---------- Views für die Küche: keine Preis-, Kosten- oder Aufschlagspalte ----------
create view public.kitchen_dishes
  with (security_invoker = false, security_barrier = true) as
select d.id, d.company_id, d.name, d.description, d.category, d.portion_label, d.diets,
       d.allergens_reviewed_at, d.allergens_reviewed_by, d.archived_at, d.created_at, d.updated_at,
       coalesce(array_agg(da.allergen order by da.allergen)
                  filter (where da.allergen is not null), '{}') as allergens
  from public.dishes d
  left join public.dish_allergens da on da.dish_id = d.id
 where d.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen')
 group by d.id;

create view public.kitchen_ingredients
  with (security_invoker = false, security_barrier = true) as
select i.id, i.company_id, i.name, i.unit, i.product_group, i.archived_at, i.created_at, i.updated_at
  from public.ingredients i
 where i.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen');

-- Allergene eines Pakets = Vereinigung, Diätformen = Schnittmenge über seine Gerichte (docs/03 §3.4)
create view public.kitchen_menu_packages
  with (security_invoker = false, security_barrier = true) as
select p.id, p.company_id, p.name, p.description, p.archived_at, p.created_at, p.updated_at,
       (select count(*)::int from public.menu_package_dishes m where m.menu_package_id = p.id) as dish_count,
       coalesce((select array_agg(distinct da.allergen order by da.allergen)
                   from public.menu_package_dishes m
                   join public.dish_allergens da on da.dish_id = m.dish_id
                  where m.menu_package_id = p.id), '{}') as allergens,
       coalesce((select array_agg(d order by d)
                   from unnest(enum_range(null::public.diet_type)) as d
                  where exists (select 1 from public.menu_package_dishes m
                                 where m.menu_package_id = p.id)
                    and not exists (select 1 from public.menu_package_dishes m
                                      join public.dishes x on x.id = m.dish_id
                                     where m.menu_package_id = p.id and not (d = any (x.diets)))),
                '{}') as diets
  from public.menu_packages p
 where p.company_id = (select public.auth_company_id())
   and (select public.auth_role()) in ('admin', 'kitchen');

revoke all on public.kitchen_dishes, public.kitchen_ingredients, public.kitchen_menu_packages
  from anon, authenticated;
grant select on public.kitchen_dishes, public.kitchen_ingredients, public.kitchen_menu_packages
  to authenticated;

-- ---------- RPCs ----------
create or replace function private.require_catalog_role()
returns public.member_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role public.member_role := public.auth_role();
begin
  if v_role is null or v_role not in ('admin', 'kitchen') then
    raise exception 'Keine Berechtigung für den Katalog' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

-- Gericht samt Allergenen und Zutaten in einer Transaktion speichern.
-- payload: id?, name, description, category, portion_label, diets[], allergens[], allergens_confirmed,
--          ingredients[{ingredient_id, quantity_per_person}], archived (admin),
--          price_cents, tax_rate_id, markup_bp (nur admin)
-- Felder, die im payload fehlen, bleiben bei einer Änderung unverändert.
create or replace function public.save_dish(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.member_role := private.require_catalog_role();
  v_company  uuid := public.auth_company_id();
  v_member   uuid := public.auth_member_id();
  v_id       uuid := nullif(p ->> 'id', '')::uuid;
  v_old      public.dishes;
  v_diets    public.diet_type[];
  v_new_all  public.allergen[];
  v_old_all  public.allergen[];
  v_confirm  boolean := coalesce((p ->> 'allergens_confirmed')::boolean, false);
  v_reviewed_at timestamptz;
  v_reviewed_by uuid;
begin
  perform public.assert_writable();

  if v_id is not null then
    select * into v_old from public.dishes where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Gericht nicht gefunden' using errcode = 'P0001', hint = 'dish_not_found';
    end if;
  end if;

  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  v_diets := case when p ? 'diets'
                  then coalesce(array(select jsonb_array_elements_text(p -> 'diets'))::public.diet_type[], '{}')
                  else coalesce(v_old.diets, '{}') end;
  -- vegan schließt vegetarisch ein
  if 'vegan' = any (v_diets) and not 'vegetarian' = any (v_diets) then
    v_diets := array_append(v_diets, 'vegetarian'::public.diet_type);
  end if;

  if v_id is null then
    insert into public.dishes (company_id, name, description, category, portion_label, diets)
    values (v_company, btrim(p ->> 'name'), nullif(btrim(coalesce(p ->> 'description', '')), ''),
            coalesce((p ->> 'category')::public.dish_category, 'main'),
            coalesce(nullif(btrim(p ->> 'portion_label'), ''), 'Portion'), v_diets)
    returning id into v_id;
    v_old_all := '{}';
  else
    select coalesce(array_agg(allergen order by allergen), '{}') into v_old_all
      from public.dish_allergens where dish_id = v_id;
    update public.dishes set
      name          = btrim(coalesce(p ->> 'name', name)),
      description   = case when p ? 'description' then nullif(btrim(coalesce(p ->> 'description', '')), '') else description end,
      category      = coalesce((p ->> 'category')::public.dish_category, category),
      portion_label = coalesce(nullif(btrim(p ->> 'portion_label'), ''), portion_label),
      diets         = v_diets
    where id = v_id;
  end if;

  -- Allergene: Prüfstatus fällt, sobald sich die Menge ändert und nicht gleichzeitig bestätigt wird
  if p ? 'allergens' then
    v_new_all := coalesce(array(select distinct a from jsonb_array_elements_text(p -> 'allergens') as a
                                 order by 1)::public.allergen[], '{}');
    if v_new_all is distinct from v_old_all then
      delete from public.dish_allergens where dish_id = v_id;
      insert into public.dish_allergens (company_id, dish_id, allergen)
      select v_company, v_id, a from unnest(v_new_all) as a;
      if not v_confirm then
        update public.dishes set allergens_reviewed_at = null, allergens_reviewed_by = null where id = v_id;
      end if;
    end if;
  end if;
  if v_confirm then
    update public.dishes set allergens_reviewed_at = now(), allergens_reviewed_by = v_member where id = v_id;
  end if;

  if p ? 'ingredients' then
    delete from public.dish_ingredients where dish_id = v_id;
    insert into public.dish_ingredients (company_id, dish_id, ingredient_id, quantity_per_person, sort_order)
    select v_company, v_id, (e.value ->> 'ingredient_id')::uuid,
           (e.value ->> 'quantity_per_person')::numeric, (e.ordinality - 1)::int
      from jsonb_array_elements(p -> 'ingredients') with ordinality as e;
  end if;

  -- Preisfelder und Archiv nur für admin
  if v_role = 'admin' then
    update public.dishes set
      price_cents = case when p ? 'price_cents' then (p ->> 'price_cents')::integer else price_cents end,
      tax_rate_id = case when p ? 'tax_rate_id' then nullif(p ->> 'tax_rate_id', '')::uuid else tax_rate_id end,
      markup_bp   = case when p ? 'markup_bp' then (p ->> 'markup_bp')::integer else markup_bp end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.save_ingredient(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    public.member_role := private.require_catalog_role();
  v_company uuid := public.auth_company_id();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_old     public.ingredients;
begin
  perform public.assert_writable();
  if v_id is not null then
    select * into v_old from public.ingredients where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Zutat nicht gefunden' using errcode = 'P0001', hint = 'ingredient_not_found';
    end if;
  end if;
  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  if v_id is null then
    insert into public.ingredients (company_id, name, unit, product_group)
    values (v_company, btrim(p ->> 'name'), (p ->> 'unit')::public.ingredient_unit,
            nullif(btrim(coalesce(p ->> 'product_group', '')), ''))
    returning id into v_id;
  else
    -- Die Einheit ändern, obwohl Gerichte die Zutat nutzen, würde alle Mengen verfälschen.
    if p ? 'unit' and (p ->> 'unit')::public.ingredient_unit <> v_old.unit
       and exists (select 1 from public.dish_ingredients where ingredient_id = v_id) then
      raise exception 'Einheit in Verwendung' using errcode = 'P0001', hint = 'unit_in_use';
    end if;
    update public.ingredients set
      name          = btrim(coalesce(p ->> 'name', name)),
      unit          = coalesce((p ->> 'unit')::public.ingredient_unit, unit),
      product_group = case when p ? 'product_group' then nullif(btrim(coalesce(p ->> 'product_group', '')), '') else product_group end
    where id = v_id;
  end if;

  if v_role = 'admin' then
    update public.ingredients set
      price_cents = case when p ? 'price_cents' then (p ->> 'price_cents')::integer else price_cents end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Paket speichern (nur admin; die Küche liest über kitchen_menu_packages)
create or replace function public.save_menu_package(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.auth_company_id();
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_old     public.menu_packages;
begin
  perform private.require_admin();
  perform public.assert_writable();
  if v_id is not null then
    select * into v_old from public.menu_packages where id = v_id and company_id = v_company for update;
    if not found then
      raise exception 'Paket nicht gefunden' using errcode = 'P0001', hint = 'package_not_found';
    end if;
  end if;
  if char_length(btrim(coalesce(p ->> 'name', v_old.name, ''))) not between 1 and 120 then
    raise exception 'Name fehlt' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  if v_id is null then
    insert into public.menu_packages (company_id, name, description, price_per_person_cents, tax_rate_id, markup_bp)
    values (v_company, btrim(p ->> 'name'), nullif(btrim(coalesce(p ->> 'description', '')), ''),
            (p ->> 'price_per_person_cents')::integer, nullif(p ->> 'tax_rate_id', '')::uuid,
            (p ->> 'markup_bp')::integer)
    returning id into v_id;
  else
    update public.menu_packages set
      name        = btrim(coalesce(p ->> 'name', name)),
      description = case when p ? 'description' then nullif(btrim(coalesce(p ->> 'description', '')), '') else description end,
      price_per_person_cents = case when p ? 'price_per_person_cents' then (p ->> 'price_per_person_cents')::integer else price_per_person_cents end,
      tax_rate_id = case when p ? 'tax_rate_id' then nullif(p ->> 'tax_rate_id', '')::uuid else tax_rate_id end,
      markup_bp   = case when p ? 'markup_bp' then (p ->> 'markup_bp')::integer else markup_bp end,
      archived_at = case when p ? 'archived'
                         then case when (p ->> 'archived')::boolean then coalesce(archived_at, now()) else null end
                         else archived_at end
    where id = v_id;
  end if;

  if p ? 'dishes' then
    delete from public.menu_package_dishes where menu_package_id = v_id;
    insert into public.menu_package_dishes (company_id, menu_package_id, dish_id, portion_factor, sort_order)
    select v_company, v_id, (e.value ->> 'dish_id')::uuid,
           coalesce((e.value ->> 'portion_factor')::numeric, 1), (e.ordinality - 1)::int
      from jsonb_array_elements(p -> 'dishes') with ordinality as e;
  end if;
  return v_id;
end;
$$;

revoke execute on function private.require_catalog_role() from public, anon, authenticated;
revoke execute on function public.save_dish(jsonb), public.save_ingredient(jsonb),
                           public.save_menu_package(jsonb) from public, anon, authenticated;
grant execute on function public.save_dish(jsonb), public.save_ingredient(jsonb),
                          public.save_menu_package(jsonb) to authenticated;
