// Küchenlisten (docs/02 §8): Produktionsliste und Einkaufsliste aus Positionen, Paketen und Sonderessen.
// Alles in ganzen Zahlen: Mengen in Hundertsteln, Portionen in Zehntausendsteln, damit Faktoren wie 0,5 und
// Puffer wie 5 % ohne Gleitkommafehler aufgehen (und „aufrunden“ exakt ist).

export type IngredientUnit = 'g' | 'ml' | 'piece';

export type EventLine = {
  eventId: string;
  dishId: string | null;
  packageId: string | null;
  /** Menge der Position (bei „pro Person“ die Gästezahl). */
  quantity: number;
};
export type PackageDish = { packageId: string; dishId: string; portionFactor: number };
export type Substitution = { fromDishId: string; toDishId: string };
export type DietaryEntry = { eventId: string; personCount: number; substitutions: Substitution[] };

export type DishNeed = {
  dishId: string;
  /** Portionen in Zehntausendsteln (ungerundet, Grundlage der Einkaufsliste). */
  portions4: number;
  byEvent: { eventId: string; portions4: number }[];
};

const h = (v: number) => Math.round(v * 100);

/** Anzeige: ganze Portionen, aufgerundet. */
export function displayPortions(portions4: number): number {
  return Math.ceil(portions4 / 10000);
}

/**
 * P(d) = Σ Pakete q × Faktor + Σ Einzelgerichte q − Σ ersetzt + Σ Ersatzgericht (02 §8.1).
 * Ohne Puffer. Negative Zwischenwerte (mehr Ersatz als Bestellung) werden auf 0 begrenzt.
 */
export function productionList(
  lines: EventLine[],
  packageDishes: PackageDish[],
  dietary: DietaryEntry[],
): DishNeed[] {
  const byPackage = new Map<string, PackageDish[]>();
  for (const pd of packageDishes) {
    const list = byPackage.get(pd.packageId) ?? [];
    list.push(pd);
    byPackage.set(pd.packageId, list);
  }
  // Schlüssel: dishId → eventId → Portionen (1/10000)
  const acc = new Map<string, Map<string, number>>();
  const add = (dishId: string, eventId: string, p4: number) => {
    const events = acc.get(dishId) ?? new Map<string, number>();
    events.set(eventId, (events.get(eventId) ?? 0) + p4);
    acc.set(dishId, events);
  };
  for (const l of lines) {
    const q100 = h(l.quantity);
    if (l.dishId) add(l.dishId, l.eventId, q100 * 100);
    else if (l.packageId)
      for (const pd of byPackage.get(l.packageId) ?? [])
        add(pd.dishId, l.eventId, q100 * h(pd.portionFactor));
  }
  for (const d of dietary) {
    for (const s of d.substitutions) {
      add(s.fromDishId, d.eventId, -d.personCount * 10000);
      add(s.toDishId, d.eventId, d.personCount * 10000);
    }
  }
  const out: DishNeed[] = [];
  for (const [dishId, events] of acc) {
    const byEvent = [...events].map(([eventId, p]) => ({ eventId, portions4: Math.max(0, p) }));
    const total = byEvent.reduce((s, e) => s + e.portions4, 0);
    if (total > 0) out.push({ dishId, portions4: total, byEvent });
  }
  return out;
}

export type DishIngredient = { dishId: string; ingredientId: string; quantityPerPerson: number };
export type IngredientInfo = {
  id: string;
  name: string;
  unit: IngredientUnit;
  group: string | null;
};
export type ShoppingItem = {
  ingredientId: string;
  name: string;
  unit: IngredientUnit;
  group: string | null;
  /** Bedarf in der Basiseinheit (g, ml, Stück) mit Puffer, ungerundet (nur Information). */
  need: number;
  /** Anzeigewert und -einheit nach 02 §8.3 (aufgerundet). */
  value: number;
  displayUnit: 'g' | 'kg' | 'ml' | 'l' | 'piece';
};
export type ShoppingList = {
  items: ShoppingItem[];
  /** Gerichte ohne Zutatenangaben mit ihren Portionen (ganze, aufgerundet). */
  withoutIngredients: { dishId: string; portions: number }[];
};

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/**
 * Bedarf(i) = Σ P(d) × Menge_pP(i, d) × (1 + Puffer), in der Basiseinheit (02 §8.3).
 * Anzeige: < 1000 g/ml ganze g/ml aufgerundet; ab 1000 in kg/l mit einer Nachkommastelle aufgerundet; Stück ganz aufgerundet.
 */
export function shoppingList(
  needs: DishNeed[],
  dishIngredients: DishIngredient[],
  ingredients: IngredientInfo[],
  bufferBp: number,
): ShoppingList {
  const info = new Map(ingredients.map((i) => [i.id, i]));
  const byDish = new Map<string, DishIngredient[]>();
  for (const di of dishIngredients) {
    const list = byDish.get(di.dishId) ?? [];
    list.push(di);
    byDish.set(di.dishId, list);
  }
  // Zähler in Einheiten von 1/(10000 · 100) der Basiseinheit, noch ohne Puffer
  const sums = new Map<string, bigint>();
  const withoutIngredients: ShoppingList['withoutIngredients'] = [];
  for (const n of needs) {
    const list = byDish.get(n.dishId) ?? [];
    if (list.length === 0) {
      withoutIngredients.push({ dishId: n.dishId, portions: displayPortions(n.portions4) });
      continue;
    }
    for (const di of list) {
      sums.set(
        di.ingredientId,
        (sums.get(di.ingredientId) ?? 0n) + BigInt(n.portions4) * BigInt(h(di.quantityPerPerson)),
      );
    }
  }
  const buffer = BigInt(10000 + bufferBp);
  const items: ShoppingItem[] = [];
  for (const [ingredientId, raw] of sums) {
    const ing = info.get(ingredientId);
    if (!ing) continue;
    const num = raw * buffer; // Nenner 10000 · 100 · 10000
    const den = 10000n * 100n * 10000n;
    const need = Number(num) / Number(den);
    let value: number;
    let displayUnit: ShoppingItem['displayUnit'];
    if (ing.unit === 'piece') {
      value = Number(ceilDiv(num, den));
      displayUnit = 'piece';
    } else {
      const whole = ceilDiv(num, den);
      if (whole < 1000n) {
        value = Number(whole);
        displayUnit = ing.unit;
      } else {
        // Zehntel von kg bzw. l, aufgerundet
        value = Number(ceilDiv(num, den * 100n)) / 10;
        displayUnit = ing.unit === 'g' ? 'kg' : 'l';
      }
    }
    items.push({
      ingredientId,
      name: ing.name,
      unit: ing.unit,
      group: ing.group,
      need,
      value,
      displayUnit,
    });
  }
  items.sort(
    (a, b) =>
      (a.group ?? '￿').localeCompare(b.group ?? '￿', 'de') || a.name.localeCompare(b.name, 'de'),
  );
  return { items, withoutIngredients };
}

// ---------- Sonderessen (02 §8.2) ----------

type AllergenCode = import('./dietary').Allergen;
type DietCode = import('./dietary').Diet;

export type DishInfo = { id: string; name: string; allergens: AllergenCode[]; diets: DietCode[] };

/**
 * Warum ein Gericht für eine Sonderessen-Anforderung nicht passt: enthaltene Allergene, die gemieden werden
 * sollen, und eine fehlende Diätform. Leer = geeignet. Ein veganes Gericht gilt auch als vegetarisch.
 */
export function unsuitableReasons(
  request: { diet: DietCode | null; avoidAllergens: AllergenCode[] },
  dish: DishInfo,
): { allergens: AllergenCode[]; diet: DietCode | null } {
  const allergens = request.avoidAllergens.filter((a) => dish.allergens.includes(a));
  const ok =
    request.diet === null ||
    dish.diets.includes(request.diet) ||
    (request.diet === 'vegetarian' && dish.diets.includes('vegan'));
  return { allergens, diet: ok ? null : request.diet };
}
