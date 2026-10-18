import { calculate } from '@/lib/calc';

import type { QuoteSnapshot } from './snapshot';

/**
 * Wählt je Wahlgruppe die Alternative des Kunden und rechnet Positionswerte und Summen mit dem gemeinsamen
 * Rechenmodul neu. Der Snapshot selbst bleibt unverändert (Wahl vor der Annahme erzeugt keine Fassung).
 * Die Einzelpreise im Snapshot stehen schon auf der Anzeigeseite, Eingabe- und Anzeigeart sind hier gleich.
 */
export function applySelection(s: QuoteSnapshot, choices: Record<string, string>): QuoteSnapshot {
  const groups = Object.keys(choices);
  if (groups.length === 0) return s;
  const items = s.items.map((i) =>
    i.choice_group && choices[i.choice_group] !== undefined
      ? { ...i, is_selected: i.id === choices[i.choice_group] }
      : i,
  );
  const display = s.quote.price_display;
  const calc = calculate({
    entryMode: display,
    displayMode: display,
    discountBp: s.quote.discount_bp,
    discountCents: s.quote.discount_cents,
    depositBp: s.quote.deposit.bp,
    depositCents: s.quote.deposit.cents,
    guestCount: s.event.guest_count,
    items: items.map((i) => ({
      id: i.id,
      isHeading: i.is_heading,
      isSelected: i.is_selected,
      quantityHundredths: Math.round(i.quantity * 100),
      hoursQuarters: i.hours ? Math.round(i.hours * 4) : null,
      unitPriceCents: i.is_heading ? null : (i.unit_price_display_cents ?? 0),
      taxRateBp: i.tax_rate_bp,
      discountBp: i.discount_bp,
    })),
  });
  const line = new Map(calc.lines.map((l) => [l.id, l]));
  return {
    ...s,
    quote: { ...s.quote, deposit: { ...s.quote.deposit, amount_cents: calc.depositCents } },
    items: items.map((i) => {
      const l = line.get(i.id);
      return l
        ? {
            ...i,
            line_net_cents: l.lineNetCents,
            line_tax_cents: l.lineTaxCents,
            line_gross_cents: l.lineGrossCents,
          }
        : { ...i, line_net_cents: null, line_tax_cents: null, line_gross_cents: null };
    }),
    totals: {
      sum_before_discount_cents: calc.sumBeforeDiscountCents,
      discount_cents: calc.discountCents,
      net_cents: calc.netCents,
      tax: calc.taxes.map((t) => ({
        rate_bp: t.rateBp,
        base_cents: t.baseCents,
        tax_cents: t.taxCents,
      })),
      gross_cents: calc.grossCents,
      per_guest_cents: calc.perGuestCents,
    },
  };
}
