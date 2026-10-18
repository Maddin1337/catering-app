/** Zeile der Monatsübersicht aus `revenue_overview()` (Cent, netto). */
export type RevenueMonth = {
  month: string; // ISO-Datum des Monatsersten
  booked_cents: number;
  booked_count: number;
  open_cents: number;
  open_count: number;
};

export type RevenueOverview = { current_month: string; months: RevenueMonth[] };

export type RevenueSummary = {
  current: RevenueMonth;
  /** Veränderung des gebuchten Werts zum Vormonat in Prozent; null, wenn der Vormonat 0 war. */
  deltaPercent: number | null;
  /** Höchster Monatswert (gebucht + offen), Maßstab für die Balken. */
  max: number;
  months: RevenueMonth[];
};

/** Fasst die Monatszeilen für die Karte zusammen; leer, wenn es (noch) keinen Wert gibt. */
export function summarizeRevenue(data: RevenueOverview | null | undefined): RevenueSummary | null {
  if (!data) return null;
  const current = data.months.find((m) => m.month === data.current_month);
  if (!current) return null;
  const prev = data.months[data.months.indexOf(current) - 1];
  const max = Math.max(...data.months.map((m) => m.booked_cents + m.open_cents));
  if (max === 0) return null;
  return {
    current,
    deltaPercent:
      prev && prev.booked_cents > 0
        ? Math.round(((current.booked_cents - prev.booked_cents) / prev.booked_cents) * 100)
        : null,
    max,
    months: data.months,
  };
}
