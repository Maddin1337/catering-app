import { filterDishes, NO_FILTERS } from '../filter';
import type { Dish } from '../types';

const base = {
  description: null,
  portion_label: 'Portion',
  allergens_reviewed_by: null,
  archived_at: null,
} as const;
const dishes: Dish[] = [
  {
    ...base,
    id: '1',
    name: 'Rinderschmorbraten',
    category: 'main',
    diets: [],
    allergens: ['celery', 'sulphites'],
    allergens_reviewed_at: '2026-11-01T10:00:00Z',
  },
  {
    ...base,
    id: '2',
    name: 'Ofengemüse',
    category: 'side',
    diets: ['vegetarian', 'vegan', 'gluten_free'],
    allergens: [],
    allergens_reviewed_at: '2026-11-01T10:00:00Z',
  },
  {
    ...base,
    id: '3',
    name: 'Kartoffelgratin',
    category: 'side',
    diets: ['vegetarian'],
    allergens: ['milk', 'eggs'],
    allergens_reviewed_at: null,
  },
  {
    ...base,
    id: '4',
    name: 'Brotkorb',
    category: 'side',
    diets: ['vegan'],
    allergens: ['gluten'],
    allergens_reviewed_at: '2026-11-01T10:00:00Z',
  },
  {
    ...base,
    id: '5',
    name: 'Altes Gericht',
    category: 'main',
    diets: [],
    allergens: [],
    allergens_reviewed_at: '2026-11-01T10:00:00Z',
    archived_at: '2026-11-02T00:00:00Z',
  },
];
const ids = (f: Partial<typeof NO_FILTERS>) =>
  filterDishes(dishes, { ...NO_FILTERS, ...f }).map((d) => d.id);

describe('Gerichte filtern', () => {
  it('blendet Archivierte standardmäßig aus und zeigt sie im Archiv', () => {
    expect(ids({})).toEqual(['1', '2', '3', '4']);
    expect(ids({ showArchived: true })).toEqual(['5']);
  });
  it('sucht im Namen ohne Groß-/Kleinschreibung', () => {
    expect(ids({ query: 'gratin' })).toEqual(['3']);
  });
  it('filtert nach Kategorie', () => {
    expect(ids({ category: 'main' })).toEqual(['1']);
  });
  it('„vegan“ liefert nur vegane Gerichte', () => {
    expect(ids({ diets: ['vegan'] })).toEqual(['2', '4']);
  });
  it('„ohne Gluten“ liefert nur geprüfte Gerichte ohne Gluten', () => {
    expect(ids({ without: ['gluten'] })).toEqual(['1', '2']);
  });
  it('„ohne Milch“ schließt das ungeprüfte Gratin aus, auch wenn man es für milchfrei hielte', () => {
    expect(ids({ without: ['milk'] })).toEqual(['1', '2', '4']);
  });
  it('zeigt nur ungeprüfte Gerichte', () => {
    expect(ids({ unreviewedOnly: true })).toEqual(['3']);
  });
});
