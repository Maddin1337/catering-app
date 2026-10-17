import type { Dish, PackageDishLine } from './types';

/** „Allergene ungeprüft“: mindestens ein Gericht des Pakets hat keine bestätigten Allergene. */
export function packageUnreviewed(
  packageId: string,
  lines: PackageDishLine[],
  dishes: Dish[],
): boolean {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  return lines
    .filter((l) => l.menu_package_id === packageId)
    .some((l) => byId.get(l.dish_id)?.allergens_reviewed_at == null);
}
