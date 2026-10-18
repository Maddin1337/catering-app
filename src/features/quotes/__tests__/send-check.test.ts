import type { Dish } from '../../catalog/types';
import type { TaxRate } from '../../company/types';
import { blankItem, runCalc } from '../model';
import { sendChecklist } from '../send-check';

const rates: TaxRate[] = [
  { id: 'food', name: 'Speisen 7 %', rate_bp: 700, category: 'food', reviewed_at: null },
];
const settings = {
  entryMode: 'net' as const,
  display: 'net' as const,
  discountBp: 0,
  discountCents: 0,
  depositBp: null,
  depositCents: null,
};

function run(over: Partial<Parameters<typeof sendChecklist>[0]> = {}) {
  const item = {
    ...blankItem('dish', rates),
    name: 'Braten',
    dish_id: 'd1',
    unit_price_cents: 1000,
  };
  const items = over.items ?? [item];
  return sendChecklist({
    eventStatus: 'inquiry',
    items,
    guests: 20,
    calc: runCalc(items, rates, 20, settings),
    customerEmail: 'a@b.de',
    validUntil: '2026-12-01',
    dishes: [{ id: 'd1', allergens_reviewed_at: '2026-01-01' } as unknown as Dish],
    rates,
    via: 'email',
    ...over,
  });
}

describe('sendChecklist', () => {
  it('lässt ein vollständiges Angebot durch (Steuersatz noch ungeprüft ist nur ein Hinweis)', () => {
    expect(run()).toEqual({ blockers: [], warnings: ['tax_unreviewed'] });
  });
  it('blockiert leere Angebote und Endzustände', () => {
    expect(run({ items: [] }).blockers).toContain('no_items');
    expect(run({ eventStatus: 'declined' }).blockers).toContain('status_closed');
    expect(run({ eventStatus: 'completed' }).blockers).toContain('status_closed');
  });
  it('braucht die E-Mail nur für den Versandweg E-Mail', () => {
    expect(run({ customerEmail: null }).blockers).toContain('no_email');
    expect(run({ customerEmail: ' ' }).blockers).toContain('no_email');
    expect(run({ customerEmail: null, via: 'link' }).blockers).not.toContain('no_email');
  });
  it('warnt bei fehlender Gültigkeit und ungeprüften Allergenen', () => {
    const w = run({
      validUntil: null,
      dishes: [{ id: 'd1', allergens_reviewed_at: null } as unknown as Dish],
    }).warnings;
    expect(w).toEqual(expect.arrayContaining(['no_valid_until', 'allergens_unreviewed']));
  });
});
