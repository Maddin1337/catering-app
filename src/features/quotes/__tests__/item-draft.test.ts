import type { TaxRate } from '../../company/types';
import { docSummaries, parseDoc, type Doc } from '../editor-doc';
import {
  advancedSummary,
  buildItem,
  draftErrors,
  draftFrom,
  linePreview,
  parseHours,
  parseQty,
} from '../item-draft';
import { blankItem } from '../model';

const rates: TaxRate[] = [
  { id: 'food', name: 'Speisen 7 %', rate_bp: 700, category: 'food', reviewed_at: null },
  { id: 'svc', name: 'Personal 19 %', rate_bp: 1900, category: 'service', reviewed_at: null },
];
// formatCents trennt Betrag und € mit geschütztem Leerzeichen.
const sp = (s: string | null) => s?.replace(/\u00a0/g, ' ') ?? null;
// Gibt Schlüssel und Werte zurück, damit die Tests ohne Übersetzungen lesbar bleiben.
const t = (key: string, o?: Record<string, unknown>) =>
  o ? `${key}(${Object.values(o).join(',')})` : key;

describe('Eingaben einer Position', () => {
  it('liest Mengen und Stunden mit Komma, Stunden nur in Viertelstunden', () => {
    expect(parseQty('2,5')).toBe(2.5);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseHours('6,5')).toBe(6.5);
    expect(parseHours('6,3')).toBeNull();
  });

  it('macht aus dem Entwurf wieder dieselbe Position', () => {
    const item = { ...blankItem('package', rates), name: 'Fingerfood', unit_price_cents: 2450 };
    expect(buildItem(item, draftFrom(item))).toEqual(item);
  });

  it('meldet fehlende Bezeichnung, Menge und Preis', () => {
    const item = blankItem('custom', rates);
    const d = { ...draftFrom(item), name: ' ', qty: '', price: 'x' };
    expect(draftErrors(item, d)).toEqual({ name: true, qty: true, price: true });
    expect(buildItem(item, d)).toBeNull();
  });

  it('übernimmt eine feste Menge und gibt die Gästezahl frei', () => {
    const item = blankItem('package', rates);
    const d = { ...draftFrom(item), name: 'Buffet', perGuest: false, qty: '12', price: '10,50' };
    const built = buildItem(item, d)!;
    expect(built.quantity_mode).toBe('fixed');
    expect(built.quantity).toBe(12);
    expect(built.unit_price_cents).toBe(1050);
  });

  it('wählt außerhalb einer Wahlgruppe immer aus', () => {
    const item = { ...blankItem('dish', rates), name: 'Suppe', unit_price_cents: 500 };
    const built = buildItem(item, { ...draftFrom(item), selected: false, group: ' ' })!;
    expect(built.is_selected).toBe(true);
  });

  it('braucht bei einer Zwischenüberschrift nur den Text', () => {
    const item = blankItem('custom', rates, { heading: true });
    expect(draftErrors(item, { ...draftFrom(item), name: 'Vorspeisen', price: '' })).toEqual({});
  });

  it('rechnet die Zeile vor: Gäste × Preis, bei Personal mit Stunden, mit Rabatt', () => {
    const pkg = blankItem('package', rates);
    expect(sp(linePreview(pkg, { ...draftFrom(pkg), price: '24,50' }, 80))).toBe(
      '80 × 24,50 € = 1.960,00 €',
    );
    const svc = blankItem('service', rates);
    const d = { ...draftFrom(svc), perGuest: false, qty: '2', hours: '6', price: '32' };
    expect(sp(linePreview(svc, d, 80))).toBe('2 × 6 h × 32,00 € = 384,00 €');
    expect(sp(linePreview(svc, { ...d, discount: '10' }, 80))).toBe('2 × 6 h × 32,00 € = 345,60 €');
    expect(linePreview(pkg, { ...draftFrom(pkg), price: '' }, 80)).toBeNull();
  });

  it('fasst die zugeklappten Optionen zusammen', () => {
    const item = blankItem('dish', rates);
    const d = { ...draftFrom(item), discount: '5', group: 'Hauptgang', custQty: true };
    expect(advancedSummary(d, rates, t)).toBe(
      'Speisen 7 % · quote.item.discountShort(5) · quote.item.groupShort(Hauptgang) · quote.item.customerQtyShort',
    );
    expect(advancedSummary({ ...d, taxId: '' }, rates, t)).toMatch(/^quote\.noTax/);
  });
});

describe('Einstellungen des Angebots', () => {
  const doc: Doc = {
    items: [],
    price_display: 'gross',
    pricing_mode: 'flat',
    markup: '200',
    valid_until: '2026-11-01',
    customer_reference: '',
    intro: 'Hallo',
    terms: '',
    closing: 'Gruß',
    discountMode: 'bp',
    discount: '',
    depositMode: 'none',
    deposit: '',
    deposit_due_on: '',
  };

  it('liest Rabatt, Anzahlung und Aufschlag', () => {
    expect(parseDoc(doc)).toEqual({ disc: 0, dep: null, markup: 20000 });
    expect(parseDoc({ ...doc, discountMode: 'cents', discount: '50' }).disc).toBe(5000);
    expect(parseDoc({ ...doc, depositMode: 'bp', deposit: '30' }).dep).toBe(3000);
    expect(parseDoc({ ...doc, discount: '120' }).disc).toBeNull();
  });

  it('zeigt an jeder Zeile den aktuellen Wert', () => {
    const s = docSummaries(doc, t);
    expect(s.pricing).toBe('quote.settings.flat');
    expect(s.display).toBe('quote.settings.pricesGross');
    expect(s.discount).toBe('quote.settings.none');
    expect(s.deposit).toBe('quote.settings.none');
    expect(s.validity).toBe('quote.settings.until(So., 01.11.2026)');
    expect(s.texts).toBe('quote.settings.texts(2)');
    const changed = docSummaries(
      {
        ...doc,
        pricing_mode: 'cost_based',
        discount: '10',
        depositMode: 'cents',
        deposit: '500',
        valid_until: '',
      },
      t,
    );
    expect(changed.pricing).toBe('quote.settings.markupShort(200)');
    expect(changed.discount).toBe('10 %');
    expect(sp(changed.deposit)).toBe('500,00 €');
    expect(changed.validity).toBe('quote.settings.open');
    expect(docSummaries({ ...doc, discount: 'x' }, t).discount).toBe('quote.settings.invalid');
  });
});
