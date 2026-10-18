import {
  displayPortions,
  productionList,
  shoppingList,
  unsuitableReasons,
  type DietaryEntry,
  type DishIngredient,
  type EventLine,
  type IngredientInfo,
  type PackageDish,
} from '../kitchen';

// Rechenbeispiel docs/02 §8.5
const braten = 'braten';
const gratin = 'gratin';
const gemuese = 'gemuese';
const lines: EventLine[] = [
  { eventId: 'A', dishId: null, packageId: 'buffet', quantity: 60 },
  { eventId: 'B', dishId: braten, packageId: null, quantity: 25 },
];
const pkg: PackageDish[] = [
  { packageId: 'buffet', dishId: braten, portionFactor: 1 },
  { packageId: 'buffet', dishId: gratin, portionFactor: 1 },
  { packageId: 'buffet', dishId: gemuese, portionFactor: 0.5 },
];
const dietary: DietaryEntry[] = [
  { eventId: 'B', personCount: 2, substitutions: [{ fromDishId: braten, toDishId: gemuese }] },
];
const di = (dishId: string, ingredientId: string, quantityPerPerson: number): DishIngredient => ({
  dishId,
  ingredientId,
  quantityPerPerson,
});
const dishIngredients: DishIngredient[] = [
  di(braten, 'rind', 180),
  di(braten, 'kartoffel', 200),
  di(braten, 'wein', 50),
  di(braten, 'wurzel', 120),
  di(gratin, 'kartoffel', 220),
  di(gratin, 'sahne', 60),
  di(gratin, 'ei', 0.25),
  di(gemuese, 'zucchini', 150),
  di(gemuese, 'wurzel', 100),
  di(gemuese, 'zitrone', 0.1),
];
const ingredients: IngredientInfo[] = [
  { id: 'rind', name: 'Rinderschulter', unit: 'g', group: 'Fleisch & Fisch' },
  { id: 'kartoffel', name: 'Kartoffeln', unit: 'g', group: 'Obst & Gemüse' },
  { id: 'wurzel', name: 'Wurzelgemüse', unit: 'g', group: 'Obst & Gemüse' },
  { id: 'zucchini', name: 'Zucchini', unit: 'g', group: 'Obst & Gemüse' },
  { id: 'wein', name: 'Rotwein', unit: 'ml', group: 'Getränke' },
  { id: 'sahne', name: 'Sahne', unit: 'ml', group: 'Molkerei' },
  { id: 'ei', name: 'Eier', unit: 'piece', group: 'Molkerei' },
  { id: 'zitrone', name: 'Zitronen', unit: 'piece', group: 'Obst & Gemüse' },
];

describe('Produktionsliste', () => {
  const list = productionList(lines, pkg, dietary);
  const p = (id: string) => displayPortions(list.find((x) => x.dishId === id)!.portions4);
  it('rechnet das Beispiel aus 02 §8.5', () => {
    expect(p(braten)).toBe(83);
    expect(p(gratin)).toBe(60);
    expect(p(gemuese)).toBe(32);
  });
  it('schlüsselt nach Auftrag auf', () => {
    const b = list.find((x) => x.dishId === braten)!;
    expect(b.byEvent.map((e) => [e.eventId, e.portions4 / 10000])).toEqual([
      ['A', 60],
      ['B', 23],
    ]);
  });
  it('begrenzt Ersatz auf die bestellten Portionen', () => {
    const l = productionList(
      [{ eventId: 'X', dishId: braten, packageId: null, quantity: 1 }],
      [],
      [
        {
          eventId: 'X',
          personCount: 3,
          substitutions: [{ fromDishId: braten, toDishId: gemuese }],
        },
      ],
    );
    expect(l.find((x) => x.dishId === braten)).toBeUndefined();
    expect(displayPortions(l.find((x) => x.dishId === gemuese)!.portions4)).toBe(3);
  });
});

describe('Einkaufsliste (Puffer 5 %)', () => {
  const s = shoppingList(productionList(lines, pkg, dietary), dishIngredients, ingredients, 500);
  const by = (id: string) => s.items.find((i) => i.ingredientId === id)!;
  it('stimmt mit der Handrechnung überein', () => {
    expect([by('rind').value, by('rind').displayUnit]).toEqual([15.7, 'kg']);
    expect([by('kartoffel').value, by('kartoffel').displayUnit]).toEqual([31.3, 'kg']);
    expect([by('wurzel').value, by('wurzel').displayUnit]).toEqual([13.9, 'kg']);
    expect([by('zucchini').value, by('zucchini').displayUnit]).toEqual([5.1, 'kg']);
    expect([by('wein').value, by('wein').displayUnit]).toEqual([4.4, 'l']);
    expect([by('sahne').value, by('sahne').displayUnit]).toEqual([3.8, 'l']);
    expect([by('ei').value, by('ei').displayUnit]).toEqual([16, 'piece']);
    expect([by('zitrone').value, by('zitrone').displayUnit]).toEqual([4, 'piece']);
  });
  it('liefert den ungerundeten Bedarf mit Puffer', () => {
    expect(by('rind').need).toBeCloseTo(15687, 6);
    expect(by('wein').need).toBeCloseTo(4357.5, 6);
  });
  it('gruppiert nach Warengruppe und sortiert nach Name', () => {
    expect(s.items.map((i) => i.group)).toEqual([
      'Fleisch & Fisch',
      'Getränke',
      'Molkerei',
      'Molkerei',
      'Obst & Gemüse',
      'Obst & Gemüse',
      'Obst & Gemüse',
      'Obst & Gemüse',
    ]);
  });
  it('zeigt kleine Mengen in g und rundet auf', () => {
    const l = shoppingList(
      [{ dishId: 'd', portions4: 3 * 10000, byEvent: [] }],
      [di('d', 'salz', 3.3)],
      [{ id: 'salz', name: 'Salz', unit: 'g', group: null }],
      0,
    );
    expect(l.items[0]).toMatchObject({ value: 10, displayUnit: 'g' }); // 9,9 g → 10 g
  });
  it('führt Gerichte ohne Zutaten getrennt auf', () => {
    const l = shoppingList(
      [{ dishId: 'x', portions4: 12 * 10000 + 5000, byEvent: [] }],
      [],
      [],
      500,
    );
    expect(l.items).toEqual([]);
    expect(l.withoutIngredients).toEqual([{ dishId: 'x', portions: 13 }]);
  });
});

describe('unsuitableReasons', () => {
  const dish = (allergens: string[], diets: string[]) =>
    ({ id: 'd', name: 'Gericht', allergens, diets }) as unknown as Parameters<
      typeof unsuitableReasons
    >[1];
  it('meldet zu meidende Allergene und fehlende Diätform', () => {
    expect(
      unsuitableReasons(
        { diet: 'vegan', avoidAllergens: ['celery', 'milk'] },
        dish(['celery'], []),
      ),
    ).toEqual({ allergens: ['celery'], diet: 'vegan' });
  });
  it('lässt geeignete Gerichte durch; vegan gilt auch als vegetarisch', () => {
    expect(
      unsuitableReasons({ diet: 'vegetarian', avoidAllergens: [] }, dish([], ['vegan'])),
    ).toEqual({ allergens: [], diet: null });
    expect(unsuitableReasons({ diet: null, avoidAllergens: [] }, dish(['milk'], []))).toEqual({
      allergens: [],
      diet: null,
    });
  });
});
