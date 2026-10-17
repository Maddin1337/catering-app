import { ACCENT_SUGGESTIONS, contrastRatio, normalizeHex, whiteTextReadable } from '../color';

describe('color', () => {
  it('normalisiert Eingaben', () => {
    expect(normalizeHex('0f766e')).toBe('#0F766E');
    expect(normalizeHex(' #0f766e ')).toBe('#0F766E');
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('xyz123')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });

  it('berechnet den Kontrast nach WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Wert aus docs/04 §4.2: Petrol mit weißem Text ≈ 5,5 : 1
    expect(contrastRatio('#0F766E', '#FFFFFF')).toBeGreaterThan(5);
  });

  it('warnt bei zu hellen Farben', () => {
    expect(whiteTextReadable('#FDE047')).toBe(false);
    expect(whiteTextReadable('#0F766E')).toBe(true);
  });

  it('alle Vorschläge sind mit weißem Text lesbar', () => {
    for (const c of ACCENT_SUGGESTIONS) expect(whiteTextReadable(c)).toBe(true);
  });
});
