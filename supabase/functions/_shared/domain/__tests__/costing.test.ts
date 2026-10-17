import {
  costRatioBp,
  dishCost,
  lineCostMicro,
  microToCents,
  packageCost,
  suggestPriceCents,
} from '../costing';

// Rechenbeispiel aus docs/02 §3.3: Rinderschmorbraten je Person
const braten = dishCost([
  { quantityHundredths: 18000, unit: 'g', priceCents: 1490 }, // Rinderschulter 180 g à 14,90 €/kg
  { quantityHundredths: 20000, unit: 'g', priceCents: 120 }, // Kartoffeln 200 g à 1,20 €/kg
  { quantityHundredths: 5000, unit: 'ml', priceCents: 600 }, // Rotwein 50 ml à 6,00 €/l
  { quantityHundredths: 12000, unit: 'g', priceCents: 350 }, // Wurzelgemüse 120 g à 3,50 €/kg
]);

describe('Wareneinsatz', () => {
  it('rechnet die Zutaten einzeln in 1/100000 Cent', () => {
    expect(lineCostMicro(18000, 'g', 1490)).toBe(26_820_000); // 268,2 ct
    expect(lineCostMicro(20000, 'g', 120)).toBe(2_400_000); // 24,0 ct
    expect(lineCostMicro(5000, 'ml', 600)).toBe(3_000_000); // 30,0 ct
    expect(lineCostMicro(12000, 'g', 350)).toBe(4_200_000); // 42,0 ct
  });

  it('summiert das Gericht auf 364,2 ct', () => {
    expect(braten).toEqual({ micro: 36_420_000, complete: true });
    expect(microToCents(braten.micro)).toBe(364);
  });

  it('rechnet Stück-Zutaten (0,25 Stück Ei à 30 ct = 7,5 ct)', () => {
    expect(lineCostMicro(25, 'piece', 30)).toBe(750_000);
  });

  it('meldet fehlende Preise als unvollständig und schlägt keinen Preis vor', () => {
    const c = dishCost([
      { quantityHundredths: 10000, unit: 'g', priceCents: 200 },
      { quantityHundredths: 5000, unit: 'g', priceCents: null },
    ]);
    expect(c.complete).toBe(false);
    expect(c.micro).toBe(2_000_000);
    expect(suggestPriceCents(c, 20000, 10)).toBeNull();
  });

  it('lehnt negative oder gebrochene Eingaben ab', () => {
    expect(() => lineCostMicro(-1, 'g', 100)).toThrow(RangeError);
    expect(() => lineCostMicro(10, 'g', 1.5)).toThrow(RangeError);
  });
});

describe('Preisvorschlag', () => {
  it('Beispiel Schmorbraten: Faktor 3,2 → 11,70 €, Quote 31,1 %', () => {
    const price = suggestPriceCents(braten, 22000, 10);
    expect(price).toBe(1170);
    expect(costRatioBp(braten, price!)).toBe(3113);
  });

  it('rundet immer auf das Raster auf (9,40 € × 2,8 = 26,32 € → 26,40 €)', () => {
    expect(suggestPriceCents({ micro: 94_000_000, complete: true }, 18000, 10)).toBe(2640);
  });

  it('rundet nicht auf, wenn der Wert genau auf dem Raster liegt', () => {
    expect(suggestPriceCents({ micro: 10_000_000, complete: true }, 20000, 10)).toBe(300);
    expect(suggestPriceCents({ micro: 10_000_000, complete: true }, 20000, 100)).toBe(300);
  });

  it('kennt die Rasterstufen 1, 10, 50 und 100 Cent', () => {
    const cost = { micro: 33_333_330, complete: true }; // 333,3333 ct × 3 = 999,9999 ct
    expect(suggestPriceCents(cost, 20000, 1)).toBe(1000);
    expect(suggestPriceCents(cost, 20000, 10)).toBe(1000);
    expect(suggestPriceCents(cost, 20000, 50)).toBe(1000);
    expect(suggestPriceCents(cost, 20000, 100)).toBe(1000);
  });

  it('gibt bei Preis 0 keine Quote', () => {
    expect(costRatioBp({ micro: 100, complete: true }, 0)).toBeNull();
  });
});

describe('Paket', () => {
  it('gewichtet Gerichte mit dem Portionsfaktor', () => {
    const beilage = { micro: 10_000_000, complete: true }; // 100 ct
    const hauptgang = { micro: 36_420_000, complete: true };
    const p = packageCost([
      { cost: hauptgang, factorHundredths: 100 },
      { cost: beilage, factorHundredths: 50 },
    ]);
    expect(p).toEqual({ micro: 41_420_000, complete: true });
  });

  it('ist unvollständig, sobald ein Gericht unvollständig ist', () => {
    const p = packageCost([
      { cost: { micro: 10_000_000, complete: true }, factorHundredths: 100 },
      { cost: { micro: 0, complete: false }, factorHundredths: 100 },
    ]);
    expect(p.complete).toBe(false);
  });
});
