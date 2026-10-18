import { isoToBerlin } from '@/lib/berlin';
import type { Allergen, Diet } from '@/lib/dietary';
import {
  displayPortions,
  productionList,
  shoppingList,
  unsuitableReasons,
  type DietaryEntry,
  type DishIngredient,
  type DishInfo,
  type EventLine,
  type IngredientInfo,
  type PackageDish,
  type ShoppingList,
} from '@/lib/kitchen';

export type PlanEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  guest_count: number | null;
  basis: 'binding' | 'snapshot' | 'live';
  has_open_change: boolean;
};

export type DietaryRowInput = {
  id?: string;
  event_id: string;
  person_count: number;
  diet: Diet | null;
  avoid_allergens: Allergen[];
  note: string | null;
  table_label: string | null;
  guest_name: string | null;
  substitutions: { from_dish_id: string; to_dish_id: string }[];
};

export type PlanInput = {
  events: PlanEvent[];
  lines: (EventLine & { basis?: string })[];
  packageDishes: PackageDish[];
  dietary: DietaryRowInput[];
  dishes: DishInfo[];
  dishIngredients: DishIngredient[];
  ingredients: IngredientInfo[];
  from: string;
  to: string;
  includeOptions: boolean;
  bufferBp: number;
};

export type DayDish = {
  dishId: string;
  name: string;
  allergens: Allergen[];
  portions: number;
  byEvent: { eventId: string; title: string; portions: number }[];
};

export type SpecialEntry = {
  row: DietaryRowInput;
  /** Gerichte des Auftrags, die nicht passen (mit Gründen). */
  conflicts: { dishId: string; name: string; allergens: Allergen[]; diet: Diet | null }[];
  substitutes: { fromName: string; toName: string; toConflict: boolean }[];
};

export type Plan = {
  days: { date: string; events: PlanEvent[]; dishes: DayDish[]; withoutLines: PlanEvent[] }[];
  shopping: ShoppingList;
  special: { event: PlanEvent; entries: SpecialEntry[] }[];
};

const toEntry = (d: DietaryRowInput): DietaryEntry => ({
  eventId: d.event_id,
  personCount: d.person_count,
  substitutions: (d.substitutions ?? []).map((s) => ({
    fromDishId: s.from_dish_id,
    toDishId: s.to_dish_id,
  })),
});

/** Filtert Aufträge nach Zeitraum und Status und rechnet Produktion, Einkauf und Sonderessen (docs/02 §8). */
export function buildPlan(input: PlanInput): Plan {
  const statuses = input.includeOptions ? ['confirmed', 'optioned'] : ['confirmed'];
  const events = input.events
    .filter((e) => statuses.includes(e.status))
    .filter((e) => {
      const d = isoToBerlin(e.starts_at).date;
      return d >= input.from && d <= input.to;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const dish = new Map(input.dishes.map((d) => [d.id, d]));
  const ids = new Set(events.map((e) => e.id));
  const lines = input.lines.filter((l) => ids.has(l.eventId));
  const dietary = input.dietary.filter((d) => ids.has(d.event_id));

  const byDate = new Map<string, PlanEvent[]>();
  for (const e of events) {
    const date = isoToBerlin(e.starts_at).date;
    byDate.set(date, [...(byDate.get(date) ?? []), e]);
  }
  const days: Plan['days'] = [...byDate].map(([date, list]) => {
    const listIds = new Set(list.map((e) => e.id));
    const title = new Map(list.map((e) => [e.id, e.title]));
    const needs = productionList(
      lines.filter((l) => listIds.has(l.eventId)),
      input.packageDishes,
      dietary.filter((d) => listIds.has(d.event_id)).map(toEntry),
    );
    const dishes = needs
      .map((n) => ({
        dishId: n.dishId,
        name: dish.get(n.dishId)?.name ?? '?',
        allergens: dish.get(n.dishId)?.allergens ?? [],
        portions: displayPortions(n.portions4),
        byEvent: n.byEvent
          .filter((b) => b.portions4 > 0)
          .map((b) => ({
            eventId: b.eventId,
            title: title.get(b.eventId) ?? '',
            portions: displayPortions(b.portions4),
          })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const withLines = new Set(lines.map((l) => l.eventId));
    return { date, events: list, dishes, withoutLines: list.filter((e) => !withLines.has(e.id)) };
  });

  const allNeeds = productionList(lines, input.packageDishes, dietary.map(toEntry));
  const shopping = shoppingList(allNeeds, input.dishIngredients, input.ingredients, input.bufferBp);

  const special: Plan['special'] = [];
  for (const e of events) {
    const rows = dietary.filter((d) => d.event_id === e.id);
    if (rows.length === 0) continue;
    const eventDishIds = new Set<string>();
    for (const l of lines.filter((x) => x.eventId === e.id)) {
      if (l.dishId) eventDishIds.add(l.dishId);
      else if (l.packageId)
        input.packageDishes
          .filter((p) => p.packageId === l.packageId)
          .forEach((p) => eventDishIds.add(p.dishId));
    }
    const entries: SpecialEntry[] = rows.map((row) => {
      const req = { diet: row.diet, avoidAllergens: row.avoid_allergens };
      const conflicts = [...eventDishIds].flatMap((id) => {
        const d = dish.get(id);
        if (!d) return [];
        const r = unsuitableReasons(req, d);
        return r.allergens.length > 0 || r.diet ? [{ dishId: id, name: d.name, ...r }] : [];
      });
      const substitutes = (row.substitutions ?? []).map((s) => {
        const to = dish.get(s.to_dish_id);
        const r = to ? unsuitableReasons(req, to) : { allergens: [], diet: null };
        return {
          fromName: dish.get(s.from_dish_id)?.name ?? '?',
          toName: to?.name ?? '?',
          toConflict: r.allergens.length > 0 || r.diet !== null,
        };
      });
      return { row, conflicts, substitutes };
    });
    special.push({ event: e, entries });
  }
  return { days, shopping, special };
}
