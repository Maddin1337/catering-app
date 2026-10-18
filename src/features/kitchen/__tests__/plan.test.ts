import { buildPlan, type PlanInput } from '../plan';

const ev = (id: string, status: string, startsAt: string, title = id) => ({
  id,
  title,
  status,
  starts_at: startsAt,
  guest_count: 10,
  basis: 'binding' as const,
  has_open_change: false,
});

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  events: [
    ev('A', 'confirmed', '2026-11-20T10:00:00Z'),
    ev('B', 'confirmed', '2026-11-20T15:00:00Z'),
    ev('C', 'optioned', '2026-11-21T10:00:00Z'),
    ev('D', 'confirmed', '2026-12-30T10:00:00Z'),
    ev('E', 'inquiry', '2026-11-20T10:00:00Z'),
  ],
  lines: [
    { eventId: 'A', dishId: null, packageId: 'buffet', quantity: 60 },
    { eventId: 'B', dishId: 'braten', packageId: null, quantity: 25 },
    { eventId: 'C', dishId: 'braten', packageId: null, quantity: 10 },
    { eventId: 'D', dishId: 'braten', packageId: null, quantity: 99 },
  ],
  packageDishes: [
    { packageId: 'buffet', dishId: 'braten', portionFactor: 1 },
    { packageId: 'buffet', dishId: 'gemuese', portionFactor: 0.5 },
  ],
  dietary: [
    {
      event_id: 'B',
      person_count: 2,
      diet: 'vegan',
      avoid_allergens: ['celery'],
      note: null,
      table_label: null,
      guest_name: null,
      substitutions: [{ from_dish_id: 'braten', to_dish_id: 'gemuese' }],
    },
  ],
  dishes: [
    { id: 'braten', name: 'Rinderbraten', allergens: ['celery'], diets: [] },
    { id: 'gemuese', name: 'Ofengemüse', allergens: [], diets: ['vegan'] },
  ],
  dishIngredients: [{ dishId: 'braten', ingredientId: 'rind', quantityPerPerson: 180 }],
  ingredients: [{ id: 'rind', name: 'Rind', unit: 'g', group: null }],
  from: '2026-11-20',
  to: '2026-11-22',
  includeOptions: false,
  bufferBp: 500,
  ...over,
});

describe('buildPlan', () => {
  it('nimmt nur bestätigte Aufträge im Zeitraum (Optionen nur auf Wunsch)', () => {
    const p = buildPlan(base());
    expect(p.days.map((d) => d.date)).toEqual(['2026-11-20']);
    expect(p.days[0]!.events.map((e) => e.id)).toEqual(['A', 'B']);
    const q = buildPlan(base({ includeOptions: true }));
    expect(q.days.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-21']);
  });

  it('rechnet Portionen je Tag mit Ersatzgericht', () => {
    const day = buildPlan(base()).days[0]!;
    const braten = day.dishes.find((d) => d.dishId === 'braten')!;
    expect(braten.portions).toBe(83); // 60 + 25 − 2
    expect(braten.byEvent.map((b) => [b.eventId, b.portions])).toEqual([
      ['A', 60],
      ['B', 23],
    ]);
    expect(day.dishes.find((d) => d.dishId === 'gemuese')!.portions).toBe(32);
  });

  it('rechnet die Einkaufsliste über den ganzen Zeitraum', () => {
    const p = buildPlan(base({ includeOptions: true }));
    // 83 + 10 Portionen Braten × 180 g × 1,05 = 17.577 g → 17,6 kg
    expect(p.shopping.items[0]).toMatchObject({ value: 17.6, displayUnit: 'kg' });
  });

  it('prüft Sonderessen gegen die Gerichte des Auftrags', () => {
    const s = buildPlan(base()).special;
    expect(s).toHaveLength(1);
    const entry = s[0]!.entries[0]!;
    expect(entry.conflicts).toEqual([
      { dishId: 'braten', name: 'Rinderbraten', allergens: ['celery'], diet: 'vegan' },
    ]);
    expect(entry.substitutes).toEqual([
      { fromName: 'Rinderbraten', toName: 'Ofengemüse', toConflict: false },
    ]);
  });

  it('meldet Aufträge ohne Positionen', () => {
    const p = buildPlan(base({ lines: [] }));
    expect(p.days[0]!.withoutLines).toHaveLength(2);
  });
});
