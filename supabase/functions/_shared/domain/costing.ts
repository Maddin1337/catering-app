// Wareneinsatz und Preisvorschlag (docs/02 §3.3). Reines TypeScript, nur Ganzzahlen.
//
// Einheiten: Mengen in Hundertsteln der Basiseinheit (g, ml, Stück; Spalte `quantity_per_person` ist
// numeric(10,2), damit 0,25 Stück Ei möglich ist), Einkaufspreise in Cent je kg, l bzw. Stück.
// Zwischenwerte des Wareneinsatzes in 1/100000 Cent („micro“); erst der Preisvorschlag wird auf das
// Raster gerundet.

import { divRoundHalfUp } from './money';

export type IngredientUnit = 'g' | 'ml' | 'piece';

export type CostLine = {
  /** Menge pro Person in Hundertsteln der Basiseinheit: 180 g = 18000. */
  quantityHundredths: number;
  unit: IngredientUnit;
  /** Einkaufspreis in Cent je kg, l bzw. Stück; `null`, wenn (noch) kein Preis erfasst ist. */
  priceCents: number | null;
};

/** Ergebnis in 1/100000 Cent; `complete` ist `false`, sobald bei einer Zutat der Preis fehlt. */
export type Cost = { micro: number; complete: boolean };

function assertInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} muss eine ganze Zahl ≥ 0 sein`);
  }
}

/**
 * Kosten einer Zutat je Person in 1/100000 Cent.
 * g/ml: Menge/1000 × Preis je kg bzw. l → Hundertstel × Preis ergibt direkt 1/100000 Cent.
 * Stück: Menge × Preis → Hundertstel × Preis × 1000.
 */
export function lineCostMicro(
  quantityHundredths: number,
  unit: IngredientUnit,
  priceCents: number,
): number {
  assertInt(quantityHundredths, 'quantityHundredths');
  assertInt(priceCents, 'priceCents');
  return unit === 'piece'
    ? quantityHundredths * priceCents * 1000
    : quantityHundredths * priceCents;
}

/** Wareneinsatz je Person für ein Gericht (W_d). */
export function dishCost(lines: CostLine[]): Cost {
  let micro = 0;
  let complete = true;
  for (const l of lines) {
    if (l.priceCents === null) {
      complete = false;
      continue;
    }
    micro += lineCostMicro(l.quantityHundredths, l.unit, l.priceCents);
  }
  return { micro, complete };
}

export type PackageDishCost = {
  cost: Cost;
  /** Portionsfaktor in Hundertsteln: 1,00 = 100, 0,5 = 50. */
  factorHundredths: number;
};

/** Wareneinsatz je Person für ein Paket (W_P = Σ W_d × Portionsfaktor). */
export function packageCost(dishes: PackageDishCost[]): Cost {
  let weighted = 0;
  let complete = true;
  for (const d of dishes) {
    assertInt(d.factorHundredths, 'factorHundredths');
    weighted += d.cost.micro * d.factorHundredths;
    if (!d.cost.complete) complete = false;
  }
  return { micro: divRoundHalfUp(weighted, 100), complete };
}

/**
 * Preisvorschlag je Person in Cent: Wareneinsatz × (1 + Aufschlag), immer auf das Raster aufgerundet
 * (R2-5). `markupBp` ist der Aufschlag in Basispunkten: 20000 = 200 % = Faktor 3,0.
 * Ohne vollständigen Wareneinsatz gibt es keinen Vorschlag (`null`).
 */
export function suggestPriceCents(
  cost: Cost,
  markupBp: number,
  roundingCents: number,
): number | null {
  if (!cost.complete) return null;
  assertInt(markupBp, 'markupBp');
  if (!Number.isInteger(roundingCents) || roundingCents <= 0) {
    throw new RangeError('roundingCents muss eine ganze Zahl > 0 sein');
  }
  // price [Cent] = micro/100000 × (10000 + markupBp)/10000; aufgerundet auf Vielfache von roundingCents
  const numerator = cost.micro * (10000 + markupBp);
  const denominator = 1_000_000_000 * roundingCents;
  return Math.ceil(numerator / denominator) * roundingCents;
}

/** Wareneinsatzquote in Basispunkten (3113 = 31,13 %); `null` bei Preis 0. */
export function costRatioBp(cost: Cost, priceCents: number): number | null {
  if (priceCents <= 0) return null;
  // Quote = (micro/100000)/Preis × 10000 Basispunkte = micro / (10 × Preis)
  return divRoundHalfUp(cost.micro, 10 * priceCents);
}

/** Wareneinsatz in ganzen Cent für die Anzeige (gerundet). */
export function microToCents(micro: number): number {
  return divRoundHalfUp(micro, 100_000);
}
