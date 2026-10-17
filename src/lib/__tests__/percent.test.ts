import { bpToPercentString, parsePercentToBp } from '../percent';

describe('parsePercentToBp', () => {
  it('liest ganze Zahlen und Dezimalwerte mit Komma oder Punkt', () => {
    expect(parsePercentToBp('19')).toBe(1900);
    expect(parsePercentToBp('7,5')).toBe(750);
    expect(parsePercentToBp('7.25')).toBe(725);
    expect(parsePercentToBp(' 7 % ')).toBe(700);
  });
  it('lehnt Ungültiges und Werte außerhalb des Bereichs ab', () => {
    expect(parsePercentToBp('')).toBeNull();
    expect(parsePercentToBp('abc')).toBeNull();
    expect(parsePercentToBp('-5')).toBeNull();
    expect(parsePercentToBp('7,555')).toBeNull();
    expect(parsePercentToBp('101')).toBeNull();
    expect(parsePercentToBp('600', 0, 1000)).toBe(60000);
    expect(parsePercentToBp('1001', 0, 1000)).toBeNull();
  });
  it('rundet nicht über Gleitkomma falsch (0,29 % → 29 bp)', () => {
    expect(parsePercentToBp('0,29')).toBe(29);
    expect(parsePercentToBp('1,15')).toBe(115);
  });
});

describe('bpToPercentString', () => {
  it('zeigt deutsche Schreibweise', () => {
    expect(bpToPercentString(700)).toBe('7');
    expect(bpToPercentString(750)).toBe('7,5');
    expect(bpToPercentString(1900)).toBe('19');
  });
});
