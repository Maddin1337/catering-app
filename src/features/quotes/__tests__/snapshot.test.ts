import type { Dish, MenuPackage } from '../../catalog/types';
import type { TaxRate } from '../../company/types';
import { renderQuoteHtml } from '../document';
import { blankItem, runCalc } from '../model';
import { buildSnapshot } from '../snapshot';
import type { QuoteHeader } from '../types';

const rates: TaxRate[] = [
  { id: 'food', name: 'Speisen 7 %', rate_bp: 700, category: 'food', reviewed_at: null },
  { id: 'svc', name: 'Personal 19 %', rate_bp: 1900, category: 'service', reviewed_at: null },
];
const header: QuoteHeader = {
  id: 'q1',
  event_id: 'e1',
  number: 'A-2026-0001',
  status: 'draft',
  revision: 0,
  pricing_mode: 'flat',
  markup_bp: 20000,
  price_display: 'net',
  discount_bp: 500,
  discount_cents: 0,
  deposit_bp: 3000,
  deposit_cents: null,
  deposit_due_on: '2026-12-01',
  customer_reference: 'PO <42>',
  intro_text: 'Guten Tag,\nvielen Dank.',
  terms_text: 'Zahlbar in 14 Tagen.',
  closing_text: null,
  valid_until: '2026-12-24',
  total_net_cents: 0,
  total_tax_cents: 0,
  total_gross_cents: 0,
  cost_total_cents: 1234,
  cost_incomplete: false,
  has_unsent_changes: false,
};
const settings = {
  entryMode: 'net' as const,
  display: 'net' as const,
  discountBp: 500,
  discountCents: 0,
  depositBp: 3000,
  depositCents: null,
};
const dish = {
  id: 'd1',
  name: 'Rinderbraten',
  allergens: ['celery', 'gluten'],
  diets: [],
} as unknown as Dish;
const pkgRow = {
  id: 'p1',
  name: 'Menü Klassik',
  allergens: ['celery', 'gluten'],
  diets: [],
} as unknown as MenuPackage;

function build() {
  const pkg = {
    ...blankItem('package', rates),
    key: 'i1',
    name: 'Menü Klassik',
    menu_package_id: 'p1',
    unit_price_cents: 2450,
    markup_bp: 15000,
    unit_cost: 800,
  };
  const svc = {
    ...blankItem('service', rates),
    key: 'i2',
    name: 'Servicekräfte',
    quantity: 3,
    hours: 6.5,
    unit_price_cents: 3200,
  };
  const head = { ...blankItem('custom', rates, { heading: true }), key: 'i0', name: 'Verpflegung' };
  const items = [head, pkg, svc];
  const calc = runCalc(items, rates, 60, settings);
  return buildSnapshot({
    revision: 1,
    frozenAt: '2026-10-18T10:00:00.000Z',
    company: {
      name: 'Krügers Tafelküche',
      accent_color: '#1F6F5C',
      street: 'Hauptstr. 1',
      postal_code: '10115',
      city: 'Berlin',
      phone: null,
      contact_email: 'info@krueger.test',
      vat_id: 'DE123',
      footer_text: null,
    },
    customer: {
      type: 'business',
      name: 'Müller GmbH',
      contact_person: null,
      email: 'm@mueller.test',
      billing_address: null,
    },
    event: {
      title: 'Firmenfeier',
      kind: 'event_catering',
      starts_at: '2026-11-20T17:00:00.000Z',
      ends_at: null,
      guest_count: 60,
      venue: 'Halle 3',
      option_expires_at: null,
    },
    header,
    items,
    calc,
    rates,
    catalog: {
      dishes: [dish],
      packages: [pkgRow],
      packageLines: [{ menu_package_id: 'p1', dish_id: 'd1', portion_factor: 1, sort_order: 0 }],
    },
    guests: 60,
    display: 'net',
  });
}

describe('buildSnapshot', () => {
  it('übernimmt Summen und Positionswerte aus dem Rechenmodul, ohne Kalkulationsdaten', () => {
    const s = build();
    expect(s.totals.net_cents).toBe(198930);
    expect(s.totals.gross_cents).toBe(219969);
    const selected = s.items.filter((i) => i.is_selected && !i.is_heading);
    // die Regeln der Datenbankprüfung in send_quote
    expect(selected.reduce((sum, i) => sum + (i.line_net_cents ?? 0), 0)).toBe(s.totals.net_cents);
    expect(s.totals.tax.reduce((sum, x) => sum + x.tax_cents, 0)).toBe(
      s.totals.gross_cents - s.totals.net_cents,
    );
    const json = JSON.stringify(s);
    expect(json).not.toContain('unit_cost');
    expect(json).not.toContain('markup_bp');
    expect(json).not.toContain('cost_total');
  });

  it('führt Allergene und Paketinhalt mit', () => {
    const pkg = build().items.find((i) => i.id === 'i1')!;
    expect(pkg.allergens).toEqual(['celery', 'gluten']);
    expect(pkg.package_dishes).toEqual([
      { name: 'Rinderbraten', portion_factor: 1, allergens: ['celery', 'gluten'], diets: [] },
    ]);
    expect(pkg.quantity).toBe(60);
  });

  it('berechnet die Anzahlung aus dem Rechenmodul', () => {
    expect(build().quote.deposit.amount_cents).toBe(65991);
  });
});

describe('renderQuoteHtml', () => {
  const t = (k: string, o?: Record<string, unknown>) =>
    o ? `${k}:${Object.values(o).join('|')}` : k;

  it('enthält Firma, Summen, Legende und maskiert Eingaben', () => {
    const html = renderQuoteHtml(build(), t);
    expect(html).toContain('Krügers Tafelküche');
    expect(html).toContain('A-2026-0001');
    expect(html).toContain('1.989,30');
    expect(html).toContain('2.199,69');
    expect(html).toContain('A = allergen.gluten, L = allergen.celery');
    expect(html).toContain('PO &lt;42&gt;');
    expect(html).not.toContain('PO <42>');
    expect(html).toContain('Guten Tag,<br>vielen Dank.');
    expect(html).toContain('#1F6F5C');
  });

  it('ersetzt eine ungültige Akzentfarbe durch den Standard', () => {
    const s = build();
    s.company.accent_color = 'red;} body{display:none';
    const html = renderQuoteHtml(s, t);
    expect(html).not.toContain('display:none');
    expect(html).toContain('#0F766E');
  });
});
