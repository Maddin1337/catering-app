import type { ScheduleKind } from './types';

export type DefaultItem = { kind: ScheduleKind; starts_at: string; ends_at: string | null };

const HOUR = 3_600_000;
const at = (iso: string, offsetMs: number) => new Date(Date.parse(iso) + offsetMs).toISOString();

/**
 * Standardablauf (SC-26): Abfahrt 2 h, Aufbau 1,5 h vor Beginn; Ausgabe über die Dauer des Events;
 * Abbau ab dem Ende (1 h). Ohne Ende dauert die Ausgabe 2 h.
 */
export function defaultSchedule(startsAt: string, endsAt: string | null): DefaultItem[] {
  const end = endsAt ?? at(startsAt, 2 * HOUR);
  return [
    { kind: 'departure', starts_at: at(startsAt, -2 * HOUR), ends_at: null },
    { kind: 'setup', starts_at: at(startsAt, -1.5 * HOUR), ends_at: startsAt },
    { kind: 'service', starts_at: startsAt, ends_at: end },
    { kind: 'teardown', starts_at: end, ends_at: at(end, HOUR) },
  ];
}
