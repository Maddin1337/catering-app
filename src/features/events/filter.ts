import { todayBerlin } from '@/lib/berlin';

import type { EventRow } from './types';

export type EventListMode = 'upcoming' | 'past' | 'archive' | 'all';

export type EventFilters = { query: string; mode: EventListMode; kind: EventRow['kind'] | null };

export const DEFAULT_EVENT_FILTERS: EventFilters = { query: '', mode: 'upcoming', kind: null };

const ARCHIVED = ['declined', 'cancelled'];
const DONE = ['completed', 'invoiced'];

/**
 * „Anstehend“: offene und bestätigte Aufträge ab heute. „Vergangen“: durchgeführt, abgerechnet oder
 * der Termin liegt vor heute. „Archiv“: abgelehnt und abgesagt (Standardansichten blenden sie aus).
 */
export function filterEvents(
  events: EventRow[],
  f: EventFilters,
  today: string = todayBerlin(),
): EventRow[] {
  const q = f.query.trim().toLowerCase();
  return (
    events
      .filter((e) => {
        const archived = ARCHIVED.includes(e.status);
        const done = DONE.includes(e.status) || (!archived && e.event_date < today);
        if (f.mode === 'archive' && !archived) return false;
        if (f.mode === 'upcoming' && (archived || done)) return false;
        if (f.mode === 'past' && (archived || !done)) return false;
        if (f.kind && e.kind !== f.kind) return false;
        if (q) {
          const hay = [e.title, e.customer_name, e.city, e.venue_name, e.occasion]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      // anstehend aufsteigend, sonst absteigend (neueste zuerst)
      .sort((a, b) =>
        f.mode === 'upcoming'
          ? a.starts_at.localeCompare(b.starts_at)
          : b.starts_at.localeCompare(a.starts_at),
      )
  );
}
