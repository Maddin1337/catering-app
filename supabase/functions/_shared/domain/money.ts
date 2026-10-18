// Reines TypeScript ohne Deno- oder npm-Abhängigkeiten: App und Edge Functions nutzen dieselbe Datei.
// Geld ist durchgehend ganzzahlig (Cent); Rechnen mit Gleitkommazahlen ist verboten (docs/02 §3).

/** Ganzzahlige Division, kaufmännisch gerundet (.5 rundet weg von null). Nenner muss > 0 sein. */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError('divRoundHalfUp erwartet ganze Zahlen und einen Nenner > 0');
  }
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.floor((2 * abs + denominator) / (2 * denominator));
}

/** Rundet einen Betrag in Cent auf das nächste Vielfache von `stepCents` auf (Preisraster, R2-5). */
export function roundUpToStep(cents: number, stepCents: number): number {
  if (!Number.isInteger(cents) || !Number.isInteger(stepCents) || stepCents <= 0) {
    throw new RangeError('roundUpToStep erwartet ganze Zahlen und stepCents > 0');
  }
  return Math.ceil(cents / stepCents) * stepCents;
}

/** „1.234,56 €“ (de-DE). */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError('formatCents erwartet ganze Cent-Beträge');
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** „12.400 €“: ganze Euro, für Kennzahlen (Rundung kaufmännisch, nur Anzeige). */
export function formatEuroRounded(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError('formatEuroRounded erwartet ganze Cent-Beträge');
  }
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
