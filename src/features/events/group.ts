import { isoToBerlin } from '@/lib/berlin';

import type { EventRow } from './types';

export type MonthGroup = { month: string; events: EventRow[] };

/** Gruppiert eine bereits sortierte Liste nach Monat des Beginns (`YYYY-MM-01`), die Reihenfolge bleibt erhalten. */
export function groupByMonth(events: EventRow[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const e of events) {
    const month = `${isoToBerlin(e.starts_at).date.slice(0, 7)}-01`;
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.events.push(e);
    else groups.push({ month, events: [e] });
  }
  return groups;
}
