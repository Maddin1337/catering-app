-- =====================================================================
-- Referenzdaten: allergens, plan_limits (docs/03-datenmodell.md §3.7)
-- Kommen per Migration statt per Seed, weil sie auch in Produktion gebraucht werden (§9.3 Nr. 4).
-- =====================================================================
create table public.allergens (
  code        public.allergen primary key,
  letter      char(1)  not null unique,
  label_de    text     not null,
  sort_order  integer  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Die 14 Pflichtallergene (LMIV Anhang II); Kurzcodes nach dem österreichischen Schema.
insert into public.allergens (code, letter, label_de, sort_order) values
  ('gluten',      'A', 'Glutenhaltiges Getreide',      1),
  ('crustaceans', 'B', 'Krebstiere',                   2),
  ('eggs',        'C', 'Eier',                         3),
  ('fish',        'D', 'Fisch',                        4),
  ('peanuts',     'E', 'Erdnüsse',                     5),
  ('soybeans',    'F', 'Soja',                         6),
  ('milk',        'G', 'Milch (einschließlich Laktose)', 7),
  ('nuts',        'H', 'Schalenfrüchte',               8),
  ('celery',      'L', 'Sellerie',                     9),
  ('mustard',     'M', 'Senf',                        10),
  ('sesame',      'N', 'Sesamsamen',                  11),
  ('sulphites',   'O', 'Schwefeldioxid und Sulfite',  12),
  ('lupin',       'P', 'Lupinen',                     13),
  ('molluscs',    'R', 'Weichtiere',                  14);

-- Grenzen je Stufe als Konfiguration statt im Code (Werte = Vorschlag aus docs/01-produkt.md §6.1).
create table public.plan_limits (
  plan            public.subscription_plan primary key,
  max_members     integer check (max_members is null or max_members > 0),  -- null = unbegrenzt
  max_admins      integer check (max_admins is null or max_admins > 0),
  shift_board     boolean not null,
  branding_footer boolean not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

insert into public.plan_limits (plan, max_members, max_admins, shift_board, branding_footer) values
  ('start', 3,    1,    false, true),
  ('team',  15,   2,    true,  false),
  ('profi', 40,   5,    true,  false),
  ('pilot', null, null, true,  false);

create trigger allergens_set_updated_at
  before update on public.allergens
  for each row execute function public.set_updated_at();
create trigger plan_limits_set_updated_at
  before update on public.plan_limits
  for each row execute function public.set_updated_at();
