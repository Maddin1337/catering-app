// Abgeleitete Allergene und Diätformen für Pakete (docs/03 §3.4 `dish_allergens`).

export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETS = [
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
  'lactose_free',
] as const;
export type Diet = (typeof DIETS)[number];

type DishLike = { allergens: Allergen[]; diets: Diet[] };

/** Allergene eines Pakets = Vereinigung über die Gerichte, in der Reihenfolge der 14 Pflichtallergene. */
export function packageAllergens(dishes: DishLike[]): Allergen[] {
  const found = new Set<Allergen>();
  for (const d of dishes) for (const a of d.allergens) found.add(a);
  return ALLERGENS.filter((a) => found.has(a));
}

/** Diätformen eines Pakets = Schnittmenge: nur was für jedes Gericht gilt. Ohne Gerichte leer. */
export function packageDiets(dishes: DishLike[]): Diet[] {
  if (dishes.length === 0) return [];
  return DIETS.filter((diet) => dishes.every((d) => d.diets.includes(diet)));
}

/** Widerspruch „vegan, aber enthält Milch oder Eier“ (US-18.4): Warnung, kein Fehler. */
export function veganConflicts(dish: DishLike): Allergen[] {
  if (!dish.diets.includes('vegan')) return [];
  return dish.allergens.filter(
    (a) => a === 'milk' || a === 'eggs' || a === 'fish' || a === 'crustaceans' || a === 'molluscs',
  );
}
