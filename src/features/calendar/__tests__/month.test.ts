import type { EventRow } from '../../events/types';
import { eventsOnDay, monthGrid, shiftMonth } from '../month';

describe('Monatsraster', () => {
  it('beginnt am Montag und hat volle Wochen (Oktober 2026)', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]!.date).toBe('2026-09-28'); // 1.10.2026 ist ein Donnerstag
    expect(weeks[0]![3]!).toEqual({ date: '2026-10-01', inMonth: true });
    expect(weeks[0]![0]!.inMonth).toBe(false);
    expect(weeks.at(-1)!.at(-1)!.date).toBe('2026-11-01');
  });
  it('enthält die Tage der Zeitumstellung genau einmal', () => {
    const days = monthGrid(2026, 10)
      .flat()
      .map((d) => d.date);
    expect(days.filter((d) => d === '2026-10-25')).toHaveLength(1);
    expect(new Set(days).size).toBe(days.length);
  });
  it('kommt mit Februar und Schaltjahren zurecht', () => {
    expect(
      monthGrid(2027, 2)
        .flat()
        .filter((d) => d.inMonth),
    ).toHaveLength(28);
    expect(
      monthGrid(2028, 2)
        .flat()
        .filter((d) => d.inMonth),
    ).toHaveLength(29);
    expect(monthGrid(2027, 2)).toHaveLength(4); // 1.2.2027 ist ein Montag: genau vier Wochen
    expect(monthGrid(2026, 2)).toHaveLength(5); // 1.2.2026 ist ein Sonntag: fünf Wochen
  });
  it('blättert über Jahresgrenzen', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });
});

const ev = (
  id: string,
  start: string,
  end: string | null,
  status: EventRow['status'] = 'confirmed',
): EventRow => ({
  id,
  title: id,
  kind: 'event_catering',
  occasion: null,
  status,
  starts_at: start,
  ends_at: end,
  event_date: start.slice(0, 10),
  guest_count: null,
  venue_name: null,
  street: null,
  postal_code: null,
  city: null,
  is_pickup: false,
  onsite_contact_name: null,
  onsite_contact_phone: null,
  meeting_point: null,
  dress_code: null,
  staff_notes: null,
  kitchen_notes: null,
});

describe('Aufträge pro Tag', () => {
  it('ordnet nach Berliner Ortszeit zu: 23:30 Uhr UTC ist schon der nächste Tag', () => {
    const e = ev('a', '2026-11-14T23:30:00Z', null); // 00:30 Uhr am 15.11. in Berlin
    expect(eventsOnDay([e], '2026-11-15')).toHaveLength(1);
    expect(eventsOnDay([e], '2026-11-14')).toHaveLength(0);
  });
  it('zeigt einen Auftrag über Mitternacht am Folgetag als Fortsetzung', () => {
    const e = ev('hochzeit', '2026-11-14T17:00:00Z', '2026-11-15T01:00:00Z'); // 18:00–02:00
    expect(eventsOnDay([e], '2026-11-14')).toEqual([{ event: e, continuation: false }]);
    expect(eventsOnDay([e], '2026-11-15')).toEqual([{ event: e, continuation: true }]);
    expect(eventsOnDay([e], '2026-11-16')).toHaveLength(0);
  });
  it('zeigt keine Fortsetzung, wenn der Auftrag genau um Mitternacht endet', () => {
    const e = ev('a', '2026-11-14T17:00:00Z', '2026-11-14T23:00:00Z'); // endet 00:00 am 15.11.
    expect(eventsOnDay([e], '2026-11-15')).toHaveLength(0);
  });
  it('blendet abgelehnte und abgesagte Aufträge aus und sortiert nach Beginn', () => {
    const list = [
      ev('spaet', '2026-11-14T16:00:00Z', null),
      ev('frueh', '2026-11-14T09:00:00Z', null),
      ev('abgesagt', '2026-11-14T10:00:00Z', null, 'cancelled'),
      ev('abgelehnt', '2026-11-14T10:00:00Z', null, 'declined'),
    ];
    expect(eventsOnDay(list, '2026-11-14').map((d) => d.event.id)).toEqual(['frueh', 'spaet']);
  });
});
