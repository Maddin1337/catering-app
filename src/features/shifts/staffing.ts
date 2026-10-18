import type { Application, Slot } from './types';

// Zusagen und Einplanungen belegen einen Platz.
export const FILLED = ['accepted', 'assigned'] as const;

export type SlotState = 'cancelled' | 'published' | 'draft' | 'waiting';

/**
 * Stand einer Schicht für die Anzeige: in der Börse, Entwurf (könnte veröffentlicht werden) oder
 * wartend (der Auftrag ist noch nicht optioniert, die Schicht geht später automatisch hinein).
 */
export function slotState(slot: Slot, eventOpen: boolean): SlotState {
  if (slot.cancelled_at) return 'cancelled';
  if (slot.published_at) return 'published';
  return eventOpen ? 'draft' : 'waiting';
}

export type Seat = { kind: 'filled'; application: Application } | { kind: 'free' };

/** Plätze einer Schicht in fester Reihenfolge: erst Besetzte, dann freie Plätze. */
export function seatsFor(slot: Slot, apps: Application[]): Seat[] {
  const filled = apps.filter(
    (a) => a.shift_slot_id === slot.id && (FILLED as readonly string[]).includes(a.status),
  );
  const free = Math.max(slot.seats - filled.length, 0);
  return [
    ...filled.map((application) => ({ kind: 'filled' as const, application })),
    ...Array.from({ length: free }, () => ({ kind: 'free' as const })),
  ];
}

export type StaffingSummary = {
  seats: number;
  filled: number;
  free: number;
  /** Offene Bewerbungen, über die noch zu entscheiden ist. */
  pending: number;
  /** Schichten, die noch nicht in der Börse stehen, obwohl sie es könnten. */
  drafts: number;
};

/** Kennzahlen über alle nicht abgesagten Schichten eines Auftrags. */
export function staffingSummary(
  slots: Slot[],
  apps: Application[],
  eventOpen: boolean,
): StaffingSummary {
  const live = slots.filter((s) => !s.cancelled_at);
  const ids = new Set(live.map((s) => s.id));
  const mine = apps.filter((a) => ids.has(a.shift_slot_id));
  const seats = live.reduce((n, s) => n + s.seats, 0);
  const filled = live.reduce(
    (n, s) => n + Math.min(seatsFor(s, mine).filter((x) => x.kind === 'filled').length, s.seats),
    0,
  );
  return {
    seats,
    filled,
    free: Math.max(seats - filled, 0),
    pending: mine.filter((a) => a.status === 'applied').length,
    drafts: live.filter((s) => slotState(s, eventOpen) === 'draft').length,
  };
}
