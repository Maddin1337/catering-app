import { isoToBerlin, todayBerlin } from '@/lib/berlin';

import type { BoardSlot, MyShift } from './types';

const FIRM = ['accepted', 'assigned'];
const CLOSED = ['rejected', 'withdrawn', 'cancelled_by_staff'];

/** Laufende Einsätze: nicht abgesagt, zurückgezogen oder abgelehnt. */
export function currentShifts(list: MyShift[]): MyShift[] {
  return list.filter((s) => !CLOSED.includes(s.status));
}

/** Nächster zugesagter Einsatz, der noch nicht vorbei und nicht abgesagt ist. */
export function nextShift(list: MyShift[], now: Date = new Date()): MyShift | null {
  return (
    list
      .filter((s) => FIRM.includes(s.status) && !s.is_called_off && s.ends_at >= now.toISOString())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
  );
}

export type ShiftStats = { accepted: number; applied: number; free: number };

/** Zahlen für die Startseite des Personals: zugesagt, beworben und freie Schichten auf der Börse. */
export function shiftStats(
  list: MyShift[],
  board: BoardSlot[],
  now: Date = new Date(),
): ShiftStats {
  const today = todayBerlin(now);
  const upcoming = currentShifts(list).filter(
    (s) => !s.is_called_off && isoToBerlin(s.ends_at).date >= today,
  );
  return {
    accepted: upcoming.filter((s) => FIRM.includes(s.status)).length,
    applied: upcoming.filter((s) => s.status === 'applied').length,
    free: board.filter((b) => b.free_seats > 0 && !b.my_application_status).length,
  };
}
