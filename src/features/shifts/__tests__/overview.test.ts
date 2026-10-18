import { currentShifts, nextShift, shiftStats } from '../overview';
import type { BoardSlot, MyShift } from '../types';

const NOW = new Date('2026-10-15T08:00:00Z');

const shift = (
  id: string,
  status: MyShift['status'],
  start: string,
  extra: Partial<MyShift> = {},
) =>
  ({
    application_id: id,
    status,
    starts_at: start,
    ends_at: new Date(Date.parse(start) + 5 * 3_600_000).toISOString(),
    is_called_off: false,
    ...extra,
  }) as MyShift;

const slot = (id: string, free: number, mine: BoardSlot['my_application_status'] = null) =>
  ({ shift_slot_id: id, free_seats: free, my_application_status: mine }) as BoardSlot;

describe('Schichten: Übersicht für das Personal', () => {
  const list = [
    shift('vorbei', 'accepted', '2026-10-10T10:00:00Z'),
    shift('abgesagt', 'cancelled_by_staff', '2026-10-16T10:00:00Z'),
    shift('storniert', 'accepted', '2026-10-16T12:00:00Z', { is_called_off: true }),
    shift('spaeter', 'assigned', '2026-10-30T10:00:00Z'),
    shift('naechste', 'accepted', '2026-10-20T10:00:00Z'),
    shift('beworben', 'applied', '2026-10-18T10:00:00Z'),
  ];

  it('blendet abgeschlossene Bewerbungen aus', () => {
    expect(currentShifts(list).map((s) => s.application_id)).not.toContain('abgesagt');
  });

  it('findet den nächsten zugesagten Einsatz', () => {
    expect(nextShift(list, NOW)?.application_id).toBe('naechste');
    expect(nextShift([], NOW)).toBeNull();
    expect(nextShift([shift('x', 'applied', '2026-10-20T10:00:00Z')], NOW)).toBeNull();
  });

  it('zählt zugesagt, beworben und freie Schichten', () => {
    expect(
      shiftStats(list, [slot('a', 2), slot('b', 0), slot('c', 1, 'applied'), slot('d', 1)], NOW),
    ).toEqual({ accepted: 2, applied: 1, free: 2 });
  });
});
