// Betragseingaben in Euro als ganze Cent, ohne Gleitkomma (docs/02 §3).

/** „11,70“, „11.7“ oder „12“ → Cent; `null` bei ungültiger Eingabe (mehr als 2 Nachkommastellen, negativ, Text). */
export function parseEuroToCents(input: string): number | null {
  const v = input.trim().replace('€', '').trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return null;
  const [euros = '0', cents = ''] = v.split('.');
  return Number(euros) * 100 + Number(cents.padEnd(2, '0'));
}

/** Cent → „11,70“ (ohne Währungszeichen, für Eingabefelder). */
export function centsToEuroInput(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const rest = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${euros},${rest}`;
}

/** Menge pro Person als Zahl mit höchstens 2 Nachkommastellen → Hundertstel; `null` bei ungültig oder ≤ 0. */
export function parseQuantityToHundredths(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(v)) return null;
  const [whole = '0', frac = ''] = v.split('.');
  const hundredths = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return hundredths > 0 ? hundredths : null;
}

/** Hundertstel → Anzeige: 18000 → „180“, 25 → „0,25“. */
export function hundredthsToInput(hundredths: number): string {
  return (hundredths / 100).toLocaleString('de-DE', {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}
