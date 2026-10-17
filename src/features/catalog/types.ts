import type { Allergen, Diet } from '@/lib/dietary';

export type DishCategory =
  'starter' | 'soup' | 'main' | 'side' | 'dessert' | 'finger_food' | 'beverage' | 'other';

export const DISH_CATEGORIES: DishCategory[] = [
  'starter',
  'soup',
  'main',
  'side',
  'dessert',
  'finger_food',
  'beverage',
  'other',
];

export type IngredientUnit = 'g' | 'ml' | 'piece';

/** Zeile aus `kitchen_dishes`: für alle erlaubten Rollen ohne Preise. */
export type Dish = {
  id: string;
  name: string;
  description: string | null;
  category: DishCategory;
  portion_label: string;
  diets: Diet[];
  allergens: Allergen[];
  allergens_reviewed_at: string | null;
  allergens_reviewed_by: string | null;
  archived_at: string | null;
};

/** Preisfelder aus der Basistabelle `dishes` (nur admin). */
export type DishPrice = {
  id: string;
  price_cents: number | null;
  tax_rate_id: string | null;
  markup_bp: number | null;
};

export type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  product_group: string | null;
  archived_at: string | null;
};

export type IngredientPrice = { id: string; price_cents: number | null };

export type DishIngredientLine = {
  dish_id: string;
  ingredient_id: string;
  quantity_per_person: number;
};

export type MenuPackage = {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  dish_count: number;
  allergens: Allergen[];
  diets: Diet[];
};

export type PackagePrice = {
  id: string;
  price_per_person_cents: number | null;
  tax_rate_id: string | null;
  markup_bp: number | null;
};

export type PackageDishLine = {
  menu_package_id: string;
  dish_id: string;
  portion_factor: number;
  sort_order: number;
};

export const ALLERGEN_LETTER: Record<Allergen, string> = {
  gluten: 'A',
  crustaceans: 'B',
  eggs: 'C',
  fish: 'D',
  peanuts: 'E',
  soybeans: 'F',
  milk: 'G',
  nuts: 'H',
  celery: 'L',
  mustard: 'M',
  sesame: 'N',
  sulphites: 'O',
  lupin: 'P',
  molluscs: 'R',
};
