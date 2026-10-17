// Farbhilfen für die Akzentfarbe der Firma (docs/04 SC-09): Prüfung, Normalisierung, Kontrast.

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Acht Vorschläge (docs/04 SC-09). Alle erreichen mit weißem Text mindestens 4,5 : 1. */
export const ACCENT_SUGGESTIONS = [
  '#0F766E', // Petrol (Standard)
  '#1D4ED8', // Blau
  '#4338CA', // Indigo
  '#7E22CE', // Violett
  '#BE123C', // Rot
  '#B45309', // Bernstein
  '#15803D', // Grün
  '#334155', // Schiefer
] as const;

/** Ergänzt ein fehlendes „#“ und macht Großbuchstaben; gibt `null` bei ungültiger Eingabe. */
export function normalizeHex(input: string): string | null {
  const value = input.trim();
  const withHash = value.startsWith('#') ? value : `#${value}`;
  return HEX_COLOR.test(withHash) ? withHash.toUpperCase() : null;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** Kontrastverhältnis nach WCAG zwischen zwei Farben (1 bis 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reicht weißer Text auf dieser Hintergrundfarbe (AA, 4,5 : 1)? */
export function whiteTextReadable(background: string): boolean {
  return contrastRatio(background, '#FFFFFF') >= 4.5;
}
