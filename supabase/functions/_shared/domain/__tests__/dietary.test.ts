import { packageAllergens, packageDiets, veganConflicts } from '../dietary';

describe('Pakete: Allergene und Diätformen', () => {
  const braten = { allergens: ['celery', 'sulphites'] as const, diets: [] as never[] };
  const gratin = { allergens: ['milk', 'eggs'] as const, diets: ['vegetarian'] as const };
  const gemuese = { allergens: [] as never[], diets: ['vegetarian', 'vegan'] as const };
  const mk = (d: { allergens: readonly string[]; diets: readonly string[] }) =>
    ({ allergens: [...d.allergens], diets: [...d.diets] }) as Parameters<
      typeof packageAllergens
    >[0][number];

  it('vereinigt Allergene in der Reihenfolge der Pflichtallergene', () => {
    expect(packageAllergens([mk(braten), mk(gratin), mk(gemuese)])).toEqual([
      'eggs',
      'milk',
      'celery',
      'sulphites',
    ]);
  });

  it('bildet die Schnittmenge der Diätformen', () => {
    expect(packageDiets([mk(gratin), mk(gemuese)])).toEqual(['vegetarian']);
    expect(packageDiets([mk(gemuese), mk(gemuese)])).toEqual(['vegetarian', 'vegan']);
    expect(packageDiets([mk(braten), mk(gemuese)])).toEqual([]);
    expect(packageDiets([])).toEqual([]);
  });

  it('warnt bei „vegan“ mit Milch oder Ei', () => {
    expect(
      veganConflicts({ allergens: ['milk', 'celery'], diets: ['vegan', 'vegetarian'] }),
    ).toEqual(['milk']);
    expect(veganConflicts({ allergens: ['milk'], diets: ['vegetarian'] })).toEqual([]);
  });
});
