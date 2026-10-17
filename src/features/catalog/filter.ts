import type { Allergen, Diet } from '@/lib/dietary';

import type { Dish, DishCategory } from './types';

export type DishFilters = {
  query: string;
  category: DishCategory | null;
  /** Nur Gerichte, die alle diese Diätformen tragen. */
  diets: Diet[];
  /** Nur Gerichte ohne diese Allergene („ohne Gluten“). */
  without: Allergen[];
  unreviewedOnly: boolean;
  showArchived: boolean;
};

export const NO_FILTERS: DishFilters = {
  query: '',
  category: null,
  diets: [],
  without: [],
  unreviewedOnly: false,
  showArchived: false,
};

/** „ohne Gluten“ schließt nur geprüfte Gerichte ein: ungeprüfte Angaben sind keine Garantie. */
export function filterDishes(dishes: Dish[], f: DishFilters): Dish[] {
  const q = f.query.trim().toLowerCase();
  return dishes.filter((d) => {
    if (!f.showArchived && d.archived_at) return false;
    if (f.showArchived && !d.archived_at) return false;
    if (q && !d.name.toLowerCase().includes(q)) return false;
    if (f.category && d.category !== f.category) return false;
    if (!f.diets.every((diet) => d.diets.includes(diet))) return false;
    if (f.without.length > 0) {
      if (d.allergens_reviewed_at === null) return false;
      if (f.without.some((a) => d.allergens.includes(a))) return false;
    }
    if (f.unreviewedOnly && d.allergens_reviewed_at !== null) return false;
    return true;
  });
}
