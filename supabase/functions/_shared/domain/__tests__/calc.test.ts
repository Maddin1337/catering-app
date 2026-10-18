import { calculate, distribute, unitPriceOnCalcSide, type CalcItem } from '../calc';

const item = (
  id: string,
  q: number,
  p: number,
  r: number,
  o: Partial<CalcItem> = {},
): CalcItem => ({
  id,
  quantityHundredths: Math.round(q * 100),
  unitPriceCents: p,
  taxRateBp: r,
  ...o,
});

// Rechenbeispiel docs/02 §3.6: Firmenfeier, Anzeige netto, 60 Gäste, Eingabe netto, 5 % Gesamtrabatt
const firmenfeier = calculate({
  entryMode: 'net',
  displayMode: 'net',
  discountBp: 500,
  guestCount: 60,
  items: [
    item('fingerfood', 60, 2450, 700),
    item('braten', 20, 1170, 700),
    item('getraenke', 60, 980, 1900),
    item('service', 3, 3200, 1900, { hoursQuarters: 26 }), // 6,5 h
    item('tische', 8, 1200, 1900),
    item('anfahrt', 1, 4500, 1900),
  ],
});

describe('Rechenbeispiel Firmenfeier (02 §3.6)', () => {
  it('stimmt auf den Cent mit den Summen der Planung überein', () => {
    expect(firmenfeier.sumBeforeDiscountCents).toBe(305700);
    expect(firmenfeier.discountCents).toBe(15285);
    expect(firmenfeier.netCents).toBe(290415);
    expect(firmenfeier.taxes).toEqual([
      { rateBp: 700, baseCents: 161880, taxCents: 11332, grossCents: 173212 },
      { rateBp: 1900, baseCents: 128535, taxCents: 24422, grossCents: 152957 },
    ]);
    expect(firmenfeier.taxCents).toBe(35754);
    expect(firmenfeier.grossCents).toBe(326169);
    expect(firmenfeier.perGuestCents).toBe(5436);
  });
  it('rechnet die Positionen nach der Tabelle', () => {
    const byId = Object.fromEntries(firmenfeier.lines.map((l) => [l.id, l]));
    expect(byId.fingerfood!.lineNetCents).toBe(139650);
    expect(byId.braten!.lineNetCents).toBe(22230);
    expect(byId.getraenke!.lineNetCents).toBe(55860);
    expect(byId.service!.baseCents).toBe(62400);
    expect(byId.service!.lineNetCents).toBe(59280);
    expect(byId.tische!.lineNetCents).toBe(9120);
    expect(byId.anfahrt!.lineNetCents).toBe(4275);
  });
  it('verteilt die Steuer nach Largest-Remainder: 19 % auf Stehtische und Getränke je +1 Cent', () => {
    const byId = Object.fromEntries(firmenfeier.lines.map((l) => [l.id, l]));
    expect(byId.getraenke!.lineTaxCents).toBe(10614);
    expect(byId.service!.lineTaxCents).toBe(11263);
    expect(byId.tische!.lineTaxCents).toBe(1733);
    expect(byId.anfahrt!.lineTaxCents).toBe(812);
  });
  it('die Positionswerte ergeben je Steuersatz exakt die Summen', () => {
    for (const t of firmenfeier.taxes) {
      const ids =
        t.rateBp === 700 ? ['fingerfood', 'braten'] : ['getraenke', 'service', 'tische', 'anfahrt'];
      const lines = firmenfeier.lines.filter((l) => ids.includes(l.id));
      expect(lines.reduce((s, l) => s + l.lineNetCents, 0)).toBe(t.baseCents);
      expect(lines.reduce((s, l) => s + l.lineTaxCents, 0)).toBe(t.taxCents);
    }
  });
});

describe('Anzeigeart ≠ Eingabeart', () => {
  it('Eingabe brutto, Anzeige netto: 24,50 € brutto bei 7 % wird 22,90 € netto, brutto 1.470,18 €', () => {
    expect(unitPriceOnCalcSide(2450, 700, 'gross', 'net')).toBe(2290);
    const r = calculate({
      entryMode: 'gross',
      displayMode: 'net',
      items: [item('f', 60, 2450, 700)],
    });
    expect(r.lines[0]!.unitPriceDisplayCents).toBe(2290);
    expect(r.netCents).toBe(137400);
    expect(r.taxes[0]!.taxCents).toBe(9618);
    expect(r.grossCents).toBe(147018);
  });
  it('Eingabe netto, Anzeige brutto: Preis wird brutto umgerechnet und bleibt exakt', () => {
    expect(unitPriceOnCalcSide(2290, 700, 'net', 'gross')).toBe(2450);
    const r = calculate({
      entryMode: 'net',
      displayMode: 'gross',
      items: [item('f', 60, 2290, 700)],
    });
    expect(r.grossCents).toBe(147000);
    expect(r.netCents).toBe(137383); // 1.470,00 / 1,07 = 1.373,83
    expect(r.taxCents).toBe(9617);
  });
  it('gleiche Art: eingegebene Preise bleiben exakt erhalten', () => {
    expect(unitPriceOnCalcSide(3900, 700, 'net', 'net')).toBe(3900);
    expect(unitPriceOnCalcSide(3900, 700, 'gross', 'gross')).toBe(3900);
  });
  it('rechnet bei Anzeige brutto die Positionswerte netto/steuer konsistent', () => {
    const r = calculate({
      entryMode: 'gross',
      displayMode: 'gross',
      items: [item('a', 1, 1190, 1900), item('b', 1, 1070, 700)],
    });
    expect(r.grossCents).toBe(2260);
    for (const l of r.lines) expect(l.lineNetCents + l.lineTaxCents).toBe(l.lineGrossCents);
    expect(r.lines.reduce((s, l) => s + l.lineTaxCents, 0)).toBe(r.taxCents);
  });
});

describe('Rundung und Grenzfälle', () => {
  it('rundet an der ,5-Grenze kaufmännisch: 1,15 × 3,50 € = 4,03 € und 0,41 × 24,50 € = 10,05 €', () => {
    expect(
      calculate({ entryMode: 'net', displayMode: 'net', items: [item('a', 1.15, 350, 700)] })
        .lines[0]!.baseCents,
    ).toBe(403);
    expect(
      calculate({ entryMode: 'net', displayMode: 'net', items: [item('b', 0.41, 2450, 700)] })
        .lines[0]!.baseCents,
    ).toBe(1005);
  });
  it('rechnet die Steuer je Satz auf die Summe, nicht je Position', () => {
    // drei Positionen à 0,33 € bei 19 %: je Position 0,06 € (0,0627), auf die Summe 0,99 € → 0,19 €
    const r = calculate({
      entryMode: 'net',
      displayMode: 'net',
      items: [item('a', 1, 33, 1900), item('b', 1, 33, 1900), item('c', 1, 33, 1900)],
    });
    expect(r.taxes[0]!.taxCents).toBe(19);
    expect(r.lines.reduce((s, l) => s + l.lineTaxCents, 0)).toBe(19);
  });
  it('ignoriert Überschriften und nicht gewählte Alternativen', () => {
    const r = calculate({
      entryMode: 'net',
      displayMode: 'net',
      items: [
        item('h', 1, 0, 700, { isHeading: true, unitPriceCents: null }),
        item('a', 1, 1000, 700, { isSelected: false }),
        item('b', 1, 2000, 700),
      ],
    });
    expect(r.lines).toHaveLength(1);
    expect(r.netCents).toBe(2000);
  });
  it('wendet Positionsrabatt und Gesamtrabatt nacheinander an', () => {
    const r = calculate({
      entryMode: 'net',
      displayMode: 'net',
      discountBp: 1000,
      items: [item('a', 1, 10000, 700, { discountBp: 1000 })],
    });
    expect(r.lines[0]!.lineNetCents).toBe(8100); // 100 € −10 % = 90 € −10 % = 81 €
    expect(r.discountCents).toBe(1900);
  });
  it('verteilt einen Gesamtrabatt als Betrag so, dass die Summe stimmt', () => {
    const r = calculate({
      entryMode: 'net',
      displayMode: 'net',
      discountCents: 1000,
      items: [item('a', 1, 3333, 700), item('b', 1, 3333, 1900), item('c', 1, 3334, 1900)],
    });
    expect(r.sumBeforeDiscountCents - r.discountCents).toBe(10000 - 1000);
    expect(r.discountCents).toBe(1000);
    expect(r.netCents).toBe(9000);
  });
  it('meldet einen Rabatt über der Summe', () => {
    const r = calculate({
      entryMode: 'net',
      displayMode: 'net',
      discountCents: 20000,
      items: [item('a', 1, 10000, 700)],
    });
    expect(r.errors).toContain('discount_exceeds_total');
  });
  it('berechnet die Anzahlung in Prozent vom Brutto oder als Betrag', () => {
    const items = [item('a', 1, 10000, 1900)];
    expect(
      calculate({ entryMode: 'net', displayMode: 'net', depositBp: 3000, items }).depositCents,
    ).toBe(3570);
    expect(
      calculate({ entryMode: 'net', displayMode: 'net', depositCents: 5000, items }).depositCents,
    ).toBe(5000);
    expect(calculate({ entryMode: 'net', displayMode: 'net', items }).depositCents).toBeNull();
  });
  it('lehnt Gleitkomma und negative Mengen ab', () => {
    expect(() =>
      calculate({ entryMode: 'net', displayMode: 'net', items: [item('a', -1, 100, 700)] }),
    ).toThrow(RangeError);
    expect(() => unitPriceOnCalcSide(10.5, 700, 'net', 'net')).toThrow(RangeError);
  });
  it('ein leeres Angebot rechnet 0', () => {
    const r = calculate({ entryMode: 'net', displayMode: 'net', items: [] });
    expect([r.netCents, r.taxCents, r.grossCents, r.perGuestCents]).toEqual([0, 0, 0, null]);
  });
});

describe('distribute', () => {
  it('verteilt Reste an die größten Nachkommaanteile', () => {
    expect(distribute(3, [10, 10, 10], 10)).toEqual([1, 1, 1]);
    const d = distribute(100, [333, 333, 334], 10); // Anteile 33,3 / 33,3 / 33,4 → Summe 100
    expect(d.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
