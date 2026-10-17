import { divRoundHalfUp, formatCents, roundUpToStep } from '../money';

describe('divRoundHalfUp', () => {
  it('rundet .5 kaufmännisch auf', () => {
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(15, 10)).toBe(2);
    expect(divRoundHalfUp(14, 10)).toBe(1);
  });

  it('rundet negative Werte spiegelbildlich (weg von null)', () => {
    expect(divRoundHalfUp(-5, 2)).toBe(-3);
    expect(divRoundHalfUp(-14, 10)).toBe(-1);
  });

  it('lehnt Gleitkommazahlen und Nenner ≤ 0 ab', () => {
    expect(() => divRoundHalfUp(1.5, 2)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1, 0)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1, -2)).toThrow(RangeError);
  });
});

describe('roundUpToStep (Preisraster, R2-5)', () => {
  it('rundet auf volle 10 Cent auf', () => {
    expect(roundUpToStep(2632, 10)).toBe(2640);
    expect(roundUpToStep(2640, 10)).toBe(2640);
    expect(roundUpToStep(2641, 10)).toBe(2650);
  });

  it('lehnt ungültige Eingaben ab', () => {
    expect(() => roundUpToStep(10.5, 10)).toThrow(RangeError);
    expect(() => roundUpToStep(10, 0)).toThrow(RangeError);
  });
});

describe('formatCents', () => {
  // Intl setzt ein geschütztes Leerzeichen vor „€“.
  const norm = (s: string) => s.replace(/ /g, ' ');

  it('formatiert deutsch', () => {
    expect(norm(formatCents(123456))).toBe('1.234,56 €');
    expect(norm(formatCents(5))).toBe('0,05 €');
    expect(norm(formatCents(0))).toBe('0,00 €');
  });

  it('lehnt Kommazahlen ab', () => {
    expect(() => formatCents(10.5)).toThrow(RangeError);
  });
});
