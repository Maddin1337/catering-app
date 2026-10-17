// Prozentwerte als ganze Basispunkte (1 % = 100 bp), nie als Kommazahl gespeichert (docs/03 §2).

/** „19“, „7,5“ oder „7.5“ → Basispunkte; `null` bei ungültiger Eingabe oder außerhalb von min/max (in %). */
export function parsePercentToBp(input: string, min = 0, max = 100): number | null {
  const value = input.trim().replace('%', '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const bp = Math.round(Number(value) * 100);
  return bp >= min * 100 && bp <= max * 100 ? bp : null;
}

/** Basispunkte → deutsche Anzeige ohne unnötige Nullen: 700 → „7“, 750 → „7,5“. */
export function bpToPercentString(bp: number): string {
  return (bp / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
