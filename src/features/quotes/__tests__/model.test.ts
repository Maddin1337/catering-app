import type { TaxRate } from '../../company/types';
import {
  blankItem,
  buildSavePayload,
  costTotal,
  defaultTaxRateId,
  effectiveQuantity,
  quoteWarnings,
  runCalc,
} from '../model';

const rates: TaxRate[] = [
  { id: 'food', name: 'Speisen 7 %', rate_bp: 700, category: 'food', reviewed_at: null },
  { id: 'bev', name: 'Getränke 19 %', rate_bp: 1900, category: 'beverage', reviewed_at: null },
  { id: 'svc', name: 'Personal 19 %', rate_bp: 1900, category: 'service', reviewed_at: null },
  { id: 'oth', name: 'Sonstiges 19 %', rate_bp: 1900, category: 'other', reviewed_at: null },
];
const settings = {
  entryMode: 'net' as const,
  display: 'net' as const,
  discountBp: 0,
  discountCents: 0,
  depositBp: null,
  depositCents: null,
};

describe('Positionen', () => {
  it('wählt den Standardsteuersatz je Positionstyp', () => {
    expect(defaultTaxRateId('dish', rates)).toBe('food');
    expect(defaultTaxRateId('package', rates)).toBe('food');
    expect(defaultTaxRateId('beverage', rates)).toBe('bev');
    expect(defaultTaxRateId('service', rates)).toBe('svc');
    expect(defaultTaxRateId('custom', rates)).toBe('oth');
    expect(defaultTaxRateId('travel', rates)).toBeNull(); // kein Satz hinterlegt → Warnung im Editor
  });
  it('legt Pakete und Getränke „pro Person“ an, Personal mit Stunden', () => {
    expect(blankItem('package', rates).quantity_mode).toBe('per_guest');
    expect(blankItem('beverage', rates).quantity_mode).toBe('per_guest');
    expect(blankItem('dish', rates).quantity_mode).toBe('fixed');
    expect(blankItem('service', rates).hours).toBe(4);
  });
  it('folgt bei „pro Person“ der Gästezahl', () => {
    const p = { ...blankItem('package', rates), quantity: 1 };
    expect(effectiveQuantity(p, 80)).toBe(80);
    expect(effectiveQuantity({ ...p, quantity_mode: 'fixed', quantity: 3 }, 80)).toBe(3);
  });
});

describe('Rechnen im Editor', () => {
  it('rechnet Menge × Preis mit der Gästezahl und je Steuersatz', () => {
    const pkg = { ...blankItem('package', rates), name: 'Menü', unit_price_cents: 3900 };
    const bev = { ...blankItem('beverage', rates), name: 'Getränke', unit_price_cents: 980 };
    const r = runCalc([pkg, bev], rates, 60, settings);
    expect(r.netCents).toBe(60 * 3900 + 60 * 980);
    expect(r.taxes.map((t) => t.rateBp)).toEqual([700, 1900]);
  });
  it('rechnet Personal mit Stunden', () => {
    const svc = {
      ...blankItem('service', rates),
      name: 'Service',
      quantity: 3,
      hours: 6.5,
      unit_price_cents: 3200,
    };
    expect(runCalc([svc], rates, 60, settings).netCents).toBe(62400);
  });
  it('ignoriert Überschriften', () => {
    const h = { ...blankItem('custom', rates, { heading: true }), name: 'Getränke' };
    expect(runCalc([h], rates, 60, settings).netCents).toBe(0);
  });
  it('summiert den Wareneinsatz und meldet fehlende Kosten bei Katalogpositionen', () => {
    const a = { ...blankItem('dish', rates), unit_cost: 364.2, quantity: 20 };
    const b = { ...blankItem('dish', rates), unit_cost: null };
    expect(costTotal([a], 60)).toEqual({ cents: 7284, incomplete: false });
    expect(costTotal([a, b], 60).incomplete).toBe(true);
    expect(costTotal([{ ...blankItem('custom', rates) }], 60)).toEqual({
      cents: null,
      incomplete: false,
    });
  });
});

describe('Warnungen', () => {
  const empty = runCalc([], rates, null, settings);
  it('meldet ein leeres Angebot, fehlende Gästezahl und fehlenden Steuersatz', () => {
    expect(quoteWarnings([], 80, empty, false)).toContain('no_items');
    const pkg = { ...blankItem('package', rates), tax_rate_id: null };
    const w = quoteWarnings([pkg], null, runCalc([pkg], rates, null, settings), false);
    expect(w).toEqual(expect.arrayContaining(['no_guests', 'missing_tax']));
  });
  it('verlangt genau eine gewählte Alternative je Wahlgruppe', () => {
    const a = {
      ...blankItem('package', rates),
      choice_group: 'menu',
      is_selected: true,
      unit_price_cents: 100,
    };
    const b = {
      ...blankItem('package', rates),
      choice_group: 'menu',
      is_selected: true,
      unit_price_cents: 100,
    };
    expect(quoteWarnings([a, b], 10, runCalc([a, b], rates, 10, settings), false)).toContain(
      'choice_group_empty',
    );
    expect(
      quoteWarnings(
        [a, { ...b, is_selected: false }],
        10,
        runCalc([a, b], rates, 10, settings),
        false,
      ),
    ).not.toContain('choice_group_empty');
  });
});

describe('Speichern', () => {
  it('baut die Nutzlast mit berechneten Positionswerten und Summen', () => {
    const pkg = { ...blankItem('package', rates), name: 'Menü', unit_price_cents: 3900 };
    const calc = runCalc([pkg], rates, 80, settings);
    const payload = buildSavePayload({
      quoteId: 'q1',
      header: {
        pricing_mode: 'flat',
        markup_bp: 20000,
        price_display: 'net',
        deposit_due_on: null,
        customer_reference: null,
        intro_text: null,
        terms_text: null,
        closing_text: null,
        valid_until: null,
      },
      settings,
      items: [pkg],
      guests: 80,
      calc,
      cost: { cents: null, incomplete: false },
      editorSeconds: 42,
    });
    expect(payload.header.totals).toEqual({ net: 312000, tax: 21840, gross: 333840 });
    expect(payload.items[0]).toMatchObject({
      name: 'Menü',
      quantity: 80,
      line_net_cents: 312000,
      line_tax_cents: 21840,
      line_gross_cents: 333840,
    });
    expect(payload.editor_seconds).toBe(42);
  });
});
