import { summarizeRevenue, type RevenueMonth, type RevenueOverview } from '../revenue';

const month = (m: string, booked: number, open = 0): RevenueMonth => ({
  month: m,
  booked_cents: booked,
  booked_count: booked > 0 ? 1 : 0,
  open_cents: open,
  open_count: open > 0 ? 1 : 0,
});

const data = (months: RevenueMonth[]): RevenueOverview => ({
  current_month: '2026-10-01',
  months,
});

describe('summarizeRevenue', () => {
  const base = [
    month('2026-08-01', 0),
    month('2026-09-01', 100000),
    month('2026-10-01', 150000, 50000),
    month('2026-11-01', 20000),
    month('2026-12-01', 0),
    month('2027-01-01', 0),
  ];

  it('liefert den aktuellen Monat, die Veränderung und den Maßstab', () => {
    const s = summarizeRevenue(data(base))!;
    expect(s.current.booked_cents).toBe(150000);
    expect(s.deltaPercent).toBe(50);
    expect(s.max).toBe(200000);
  });

  it('zeigt keine Veränderung, wenn der Vormonat 0 war', () => {
    const s = summarizeRevenue(data([month('2026-09-01', 0), month('2026-10-01', 5000)]))!;
    expect(s.deltaPercent).toBeNull();
  });

  it('zeigt negative Veränderungen', () => {
    const s = summarizeRevenue(data([month('2026-09-01', 200000), month('2026-10-01', 150000)]))!;
    expect(s.deltaPercent).toBe(-25);
  });

  it('blendet die Karte aus, wenn es keine Werte gibt', () => {
    expect(summarizeRevenue(data([month('2026-10-01', 0)]))).toBeNull();
    expect(summarizeRevenue(null)).toBeNull();
    expect(summarizeRevenue(data([month('2026-11-01', 5)]))).toBeNull();
  });
});
