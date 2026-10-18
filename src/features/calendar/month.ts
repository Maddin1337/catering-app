import { isoToBerlin } from '@/lib/berlin';
import { monthGrid, shiftMonth } from '@/lib/month-grid';

import type { EventRow } from '../events/types';

export { monthGrid, shiftMonth };
export type { MonthDay } from '@/lib/month-grid';

export type DayEntry = { event: EventRow; continuation: boolean };

/**
 * Aufträge eines Tages in Berliner Ortszeit. Ein Auftrag über Mitternacht erscheint am Folgetag
 * zusätzlich als „Fortsetzung“ (docs/04 SC-14). Abgelehnte und abgesagte Aufträge sind ausgeblendet.
 */
export function eventsOnDay(events: EventRow[], isoDate: string): DayEntry[] {
  const out: DayEntry[] = [];
  for (const e of events) {
    if (e.status === 'declined' || e.status === 'cancelled') continue;
    const start = isoToBerlin(e.starts_at);
    if (start.date === isoDate) {
      out.push({ event: e, continuation: false });
    } else if (e.ends_at) {
      const end = isoToBerlin(e.ends_at);
      // endet genau um 00:00? Dann gehört der Auftrag nicht mehr zum Folgetag
      if (
        start.date < isoDate &&
        end.date >= isoDate &&
        !(end.date === isoDate && end.time === '00:00')
      ) {
        out.push({ event: e, continuation: true });
      }
    }
  }
  return out.sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
}
