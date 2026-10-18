// Angebotsrechnung (docs/02 §3.6): nur Ganzzahlen, Rechenseite = Anzeigeart, USt je Steuersatz auf die Summe.
// Ein Modul für App, Portal und PDF, damit Bildschirm und Dokument auf den Cent übereinstimmen.

import { divRoundHalfUp } from './money';

export type PriceBasis = 'net' | 'gross';

export type CalcItem = {
  id: string;
  /** Überschrift oder nicht gewählte Alternative: zählt nicht. */
  isHeading?: boolean;
  isSelected?: boolean;
  /** Menge in Hundertsteln (q100); bei `per_guest` die Gästezahl × 100. */
  quantityHundredths: number;
  /** Stunden je Person in Viertelstunden (nur Personal); sonst `null`. */
  hoursQuarters?: number | null;
  /** Einzelpreis in Cent in der Eingabeart der Firma. */
  unitPriceCents: number | null;
  taxRateBp: number;
  /** Positionsrabatt in Basispunkten. */
  discountBp?: number;
};

export type CalcInput = {
  entryMode: PriceBasis;
  displayMode: PriceBasis;
  /** Gesamtrabatt in Basispunkten oder als Betrag (höchstens eines ≠ 0). */
  discountBp?: number;
  discountCents?: number;
  depositBp?: number | null;
  depositCents?: number | null;
  guestCount?: number | null;
  items: CalcItem[];
};

export type CalcLine = {
  id: string;
  /** Einzelpreis auf der Rechenseite (so zeigen ihn Portal und PDF). */
  unitPriceDisplayCents: number;
  baseCents: number;
  lineNetCents: number;
  lineTaxCents: number;
  lineGrossCents: number;
};

export type TaxBlock = { rateBp: number; baseCents: number; taxCents: number; grossCents: number };

export type CalcResult = {
  lines: CalcLine[];
  /** Summe der Positionen vor Rabatten, auf der Rechenseite (Anzeigeart). */
  sumBeforeDiscountCents: number;
  /** Rabatte insgesamt (Positions- und Gesamtrabatt), auf der Rechenseite. */
  discountCents: number;
  taxes: TaxBlock[];
  netCents: number;
  taxCents: number;
  grossCents: number;
  depositCents: number | null;
  /** Gesamtbetrag brutto je Gast, gerundet (nur Anzeige). */
  perGuestCents: number | null;
  errors: ('discount_exceeds_total' | 'negative_amount')[];
};

function assertInt(v: number, name: string, min = 0): void {
  if (!Number.isInteger(v) || v < min)
    throw new RangeError(`${name} muss eine ganze Zahl ≥ ${min} sein`);
}

/**
 * Verteilt `total` auf Anteile `numerators[i] / denominator` nach dem Largest-Remainder-Verfahren:
 * zuerst abrunden, die fehlenden Cent an die größten Reste. Die Summe stimmt exakt.
 */
export function distribute(total: number, numerators: number[], denominator: number): number[] {
  assertInt(total, 'total');
  const floors = numerators.map((n) => Math.floor(n / denominator));
  const rests = numerators.map((n, i) => ({ i, rest: n - floors[i]! * denominator }));
  let missing = total - floors.reduce((a, b) => a + b, 0);
  rests.sort((a, b) => b.rest - a.rest || a.i - b.i);
  const out = [...floors];
  for (let k = 0; missing > 0 && rests.length > 0; k = (k + 1) % rests.length, missing--)
    out[rests[k]!.i]! += 1;
  // Falls Rundung zu viel verteilt hat (selten), von den kleinsten Resten wieder abziehen
  let excess = -missing;
  for (
    let k = rests.length - 1;
    excess > 0 && k >= 0;
    k = k === 0 ? rests.length - 1 : k - 1, excess--
  ) {
    if (out[rests[k]!.i]! > 0) out[rests[k]!.i]! -= 1;
  }
  return out;
}

/** Einzelpreis auf der Rechenseite (02 §3.6 Schritt 0). */
export function unitPriceOnCalcSide(
  inputCents: number,
  rateBp: number,
  entry: PriceBasis,
  display: PriceBasis,
): number {
  assertInt(inputCents, 'unitPriceCents');
  if (entry === display) return inputCents;
  return entry === 'gross'
    ? divRoundHalfUp(inputCents * 10000, 10000 + rateBp)
    : divRoundHalfUp(inputCents * (10000 + rateBp), 10000);
}

export function calculate(input: CalcInput): CalcResult {
  const active = input.items.filter(
    (i) => !i.isHeading && i.isSelected !== false && i.unitPriceCents !== null,
  );
  const errors: CalcResult['errors'] = [];

  // 0.–2. Preis auf der Rechenseite, Basis, Positionsrabatt
  const prepared = active.map((it) => {
    assertInt(it.quantityHundredths, 'quantityHundredths');
    assertInt(it.taxRateBp, 'taxRateBp');
    const p = unitPriceOnCalcSide(
      it.unitPriceCents!,
      it.taxRateBp,
      input.entryMode,
      input.displayMode,
    );
    const base =
      it.hoursQuarters != null
        ? divRoundHalfUp(it.quantityHundredths * it.hoursQuarters * p, 400)
        : divRoundHalfUp(it.quantityHundredths * p, 100);
    const afterItem = base - divRoundHalfUp(base * (it.discountBp ?? 0), 10000);
    return { it, p, base, afterItem };
  });

  const sumBefore = prepared.reduce((s, x) => s + x.base, 0);
  const sumAfterItem = prepared.reduce((s, x) => s + x.afterItem, 0);

  // 3. Gesamtrabatt: Prozent je Position, Betrag nach Largest-Remainder
  let afterTotal: number[];
  const rabattBp = input.discountBp ?? 0;
  const rabattCents = input.discountCents ?? 0;
  assertInt(rabattBp, 'discountBp');
  assertInt(rabattCents, 'discountCents');
  if (rabattCents > 0) {
    if (rabattCents > sumAfterItem) {
      errors.push('discount_exceeds_total');
      afterTotal = prepared.map((x) => 0);
    } else {
      const shares = distribute(
        rabattCents,
        prepared.map((x) => x.afterItem * rabattCents),
        sumAfterItem || 1,
      );
      afterTotal = prepared.map((x, i) => x.afterItem - shares[i]!);
    }
  } else {
    afterTotal = prepared.map((x) => x.afterItem - divRoundHalfUp(x.afterItem * rabattBp, 10000));
  }

  // 4. je Steuersatz
  const rates = [...new Set(prepared.map((x) => x.it.taxRateBp))].sort((a, b) => a - b);
  const taxes: TaxBlock[] = [];
  const lines: CalcLine[] = new Array(prepared.length);

  for (const r of rates) {
    const idx = prepared.map((_, i) => i).filter((i) => prepared[i]!.it.taxRateBp === r);
    const sum = idx.reduce((s, i) => s + afterTotal[i]!, 0);
    let net: number;
    let tax: number;
    let gross: number;
    if (input.displayMode === 'net') {
      net = sum;
      tax = divRoundHalfUp(net * r, 10000);
      gross = net + tax;
    } else {
      gross = sum;
      net = divRoundHalfUp(gross * 10000, 10000 + r);
      tax = gross - net;
    }
    taxes.push({ rateBp: r, baseCents: net, taxCents: tax, grossCents: gross });

    // 6. Positionswerte nur zur Anzeige: die Steuer (netto) bzw. der Nettoanteil (brutto) wird verteilt
    if (input.displayMode === 'net') {
      const taxShares = distribute(
        tax,
        idx.map((i) => afterTotal[i]! * r),
        10000,
      );
      idx.forEach((i, k) => {
        lines[i] = {
          id: prepared[i]!.it.id,
          unitPriceDisplayCents: prepared[i]!.p,
          baseCents: prepared[i]!.base,
          lineNetCents: afterTotal[i]!,
          lineTaxCents: taxShares[k]!,
          lineGrossCents: afterTotal[i]! + taxShares[k]!,
        };
      });
    } else {
      const netShares = distribute(
        net,
        idx.map((i) => afterTotal[i]! * 10000),
        10000 + r,
      );
      idx.forEach((i, k) => {
        lines[i] = {
          id: prepared[i]!.it.id,
          unitPriceDisplayCents: prepared[i]!.p,
          baseCents: prepared[i]!.base,
          lineNetCents: netShares[k]!,
          lineTaxCents: afterTotal[i]! - netShares[k]!,
          lineGrossCents: afterTotal[i]!,
        };
      });
    }
  }

  const netCents = taxes.reduce((s, t) => s + t.baseCents, 0);
  const taxCents = taxes.reduce((s, t) => s + t.taxCents, 0);
  const grossCents = taxes.reduce((s, t) => s + t.grossCents, 0);
  if (grossCents < 0) errors.push('negative_amount');

  let depositCents: number | null = null;
  if (input.depositCents != null) depositCents = input.depositCents;
  else if (input.depositBp != null)
    depositCents = divRoundHalfUp(grossCents * input.depositBp, 10000);

  return {
    lines,
    sumBeforeDiscountCents: sumBefore,
    discountCents: sumBefore - afterTotal.reduce((s, v) => s + v, 0),
    taxes,
    netCents,
    taxCents,
    grossCents,
    depositCents,
    perGuestCents:
      input.guestCount && input.guestCount > 0
        ? divRoundHalfUp(grossCents, input.guestCount)
        : null,
    errors,
  };
}
