import { addDays, isoToBerlin, todayBerlin } from '@/lib/berlin';

import type { EventRow } from '../events/types';

const HOUR = 3_600_000;

export type TodoCounts = {
  /** Anfragen, die länger als 24 h ohne Antwort liegen (Angebote folgen in M5). */
  staleInquiries: EventRow[];
  /** Optionen, die in höchstens 3 Tagen ablaufen oder schon abgelaufen sind. */
  expiringOptions: EventRow[];
  /** Bestätigte Aufträge, deren Ende gestern oder früher war: „als durchgeführt markieren“ (nur manuell, R2-3). */
  toComplete: EventRow[];
};

export function computeTodos(events: EventRow[], now: Date = new Date()): TodoCounts {
  const today = todayBerlin(now);
  const optionLimit = new Date(now.getTime() + 3 * 24 * HOUR).toISOString();
  return {
    staleInquiries: events.filter(
      (e) =>
        e.status === 'inquiry' &&
        e.created_at &&
        now.getTime() - Date.parse(e.created_at) > 24 * HOUR &&
        e.event_date >= today,
    ),
    expiringOptions: events.filter(
      (e) => e.status === 'optioned' && e.option_expires_at && e.option_expires_at <= optionLimit,
    ),
    toComplete: events
      .filter((e) => {
        if (e.status !== 'confirmed') return false;
        const endDate = isoToBerlin(e.ends_at ?? e.starts_at).date;
        return endDate < today;
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  };
}

/** Aufträge von heute und morgen (Berliner Datum), ohne abgelehnte und abgesagte. */
export function todayAndTomorrow(
  events: EventRow[],
  now: Date = new Date(),
): { today: EventRow[]; tomorrow: EventRow[] } {
  const today = todayBerlin(now);
  const tomorrow = addDays(today, 1);
  const open = events.filter((e) => e.status !== 'declined' && e.status !== 'cancelled');
  return {
    today: open.filter((e) => isoToBerlin(e.starts_at).date === today),
    tomorrow: open.filter((e) => isoToBerlin(e.starts_at).date === tomorrow),
  };
}
