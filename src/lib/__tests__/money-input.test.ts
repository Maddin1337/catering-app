import {
  centsToEuroInput,
  hundredthsToInput,
  parseEuroToCents,
  parseQuantityToHundredths,
} from '../money-input';

describe('parseEuroToCents', () => {
  it('liest Komma, Punkt und ganze Euro', () => {
    expect(parseEuroToCents('11,70')).toBe(1170);
    expect(parseEuroToCents('11.7')).toBe(1170);
    expect(parseEuroToCents('12')).toBe(1200);
    expect(parseEuroToCents(' 0,05 € ')).toBe(5);
  });
  it('lehnt Ungültiges ab', () => {
    expect(parseEuroToCents('')).toBeNull();
    expect(parseEuroToCents('-1')).toBeNull();
    expect(parseEuroToCents('1,234')).toBeNull();
    expect(parseEuroToCents('abc')).toBeNull();
  });
  it('rechnet ohne Gleitkomma-Fehler (1,15 → 115)', () => {
    expect(parseEuroToCents('1,15')).toBe(115);
    expect(parseEuroToCents('0,29')).toBe(29);
  });
});

describe('centsToEuroInput', () => {
  it('formatiert für Eingabefelder', () => {
    expect(centsToEuroInput(1170)).toBe('11,70');
    expect(centsToEuroInput(5)).toBe('0,05');
    expect(centsToEuroInput(1200)).toBe('12,00');
  });
});

describe('Mengen', () => {
  it('liest Gramm und Bruchteile', () => {
    expect(parseQuantityToHundredths('180')).toBe(18000);
    expect(parseQuantityToHundredths('0,25')).toBe(25);
    expect(parseQuantityToHundredths('0')).toBeNull();
    expect(parseQuantityToHundredths('1,234')).toBeNull();
  });
  it('zeigt Mengen ohne Tausendertrennung', () => {
    expect(hundredthsToInput(18000)).toBe('180');
    expect(hundredthsToInput(25)).toBe('0,25');
    expect(hundredthsToInput(150)).toBe('1,5');
  });
});
