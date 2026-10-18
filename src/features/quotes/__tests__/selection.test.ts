import type { TaxRate } from '../../company/types';
import { blankItem, runCalc } from '../model';
import { applySelection } from '../selection';
import { buildSnapshot } from '../snapshot';
import type { QuoteHeader } from '../types';

const rates: TaxRate[] = [
  { id: 'food', name: 'Speisen 7 %', rate_bp: 700, category: 'food', reviewed_at: null },
];
const header = {
  number: 'A-1',
  valid_until: null,
  customer_reference: null,
  intro_text: null,
  terms_text: null,
  closing_text: null,
  discount_bp: 0,
  discount_cents: 0,
  deposit_bp: null,
  deposit_cents: null,
  deposit_due_on: null,
} as unknown as QuoteHeader;

function snapshot() {
  const a = {
    ...blankItem('package', rates),
    key: 'a',
    name: 'Klassik',
    unit_price_cents: 3900,
    choice_group: 'menu',
    is_selected: true,
  };
  const b = {
    ...blankItem('package', rates),
    key: 'b',
    name: 'Mediterran',
    unit_price_cents: 4500,
    choice_group: 'menu',
    is_selected: false,
  };
  const c = {
    ...blankItem('dish', rates),
    key: 'c',
    name: 'Kuchen',
    unit_price_cents: 500,
    quantity: 2,
  };
  const items = [a, b, c];
  const settings = {
    entryMode: 'net' as const,
    display: 'net' as const,
    discountBp: 0,
    discountCents: 0,
    depositBp: null,
    depositCents: null,
  };
  return buildSnapshot({
    revision: 1,
    frozenAt: '2026-10-18T10:00:00Z',
    company: {
      name: 'F',
      accent_color: null,
      street: null,
      postal_code: null,
      city: null,
      phone: null,
      contact_email: 'a@b.de',
      vat_id: null,
      footer_text: null,
    },
    customer: {
      type: 'private',
      name: 'K',
      contact_person: null,
      email: null,
      billing_address: null,
    },
    event: {
      title: 'H',
      kind: 'event_catering',
      starts_at: '2026-12-01T10:00:00Z',
      ends_at: null,
      guest_count: 50,
      venue: null,
      option_expires_at: null,
    },
    header,
    items,
    calc: runCalc(items, rates, 50, settings),
    rates,
    catalog: { dishes: [], packages: [], packageLines: [] },
    guests: 50,
    entryMode: 'net',
    display: 'net',
  });
}

describe('applySelection', () => {
  it('lässt den Snapshot ohne Wahl unverändert', () => {
    const s = snapshot();
    expect(applySelection(s, {})).toBe(s);
  });
  it('tauscht die Alternative und rechnet die Summen neu', () => {
    const s = snapshot();
    expect(s.totals.net_cents).toBe(50 * 3900 + 2 * 500);
    const t = applySelection(s, { menu: 'b' });
    expect(t.totals.net_cents).toBe(50 * 4500 + 2 * 500);
    expect(t.items.find((i) => i.id === 'a')).toMatchObject({
      is_selected: false,
      line_net_cents: null,
    });
    expect(t.items.find((i) => i.id === 'b')).toMatchObject({
      is_selected: true,
      line_net_cents: 225000,
    });
    // USt auf die Summe, nicht je Zeile
    expect(t.totals.tax).toEqual([{ rate_bp: 700, base_cents: 226000, tax_cents: 15820 }]);
    expect(t.totals.gross_cents).toBe(241820);
  });
  it('ergibt bei der vorgewählten Alternative dieselben Summen wie das Original', () => {
    const s = snapshot();
    expect(applySelection(s, { menu: 'a' }).totals).toEqual(s.totals);
  });
});
