import { seatsFor, slotState, staffingSummary } from '../staffing';
import type { Application, Slot } from '../types';

const slot = (id: string, seats: number, extra: Partial<Slot> = {}): Slot => ({
  id,
  event_id: 'e1',
  qualification_id: 'q1',
  title: 'Service',
  starts_at: '2026-11-26T12:00:00Z',
  ends_at: '2026-11-26T18:00:00Z',
  seats,
  taken_seats: 0,
  meeting_point: null,
  dress_code: null,
  notes: null,
  published_at: '2026-10-18T10:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  ...extra,
});
const app = (id: string, slotId: string, status: Application['status']): Application => ({
  id,
  shift_slot_id: slotId,
  member_id: `m-${id}`,
  status,
  comment: null,
  applied_at: null,
  late_cancellation: false,
  status_note: null,
});

describe('slotState', () => {
  it('unterscheidet Börse, Entwurf, wartend und abgesagt', () => {
    expect(slotState(slot('a', 1), true)).toBe('published');
    expect(slotState(slot('a', 1, { published_at: null }), true)).toBe('draft');
    expect(slotState(slot('a', 1, { published_at: null }), false)).toBe('waiting');
    expect(slotState(slot('a', 1, { cancelled_at: '2026-10-18T10:00:00Z' }), true)).toBe(
      'cancelled',
    );
  });
});

describe('seatsFor', () => {
  it('zeigt erst Besetzte, dann freie Plätze; Bewerbungen belegen keinen Platz', () => {
    const seats = seatsFor(slot('a', 3), [
      app('1', 'a', 'assigned'),
      app('2', 'a', 'applied'),
      app('3', 'a', 'accepted'),
      app('4', 'b', 'accepted'),
    ]);
    expect(seats.map((s) => s.kind)).toEqual(['filled', 'filled', 'free']);
  });
});

describe('staffingSummary', () => {
  it('zählt Plätze, Besetzte, offene Bewerbungen und Entwürfe ohne abgesagte Schichten', () => {
    const slots = [
      slot('a', 2),
      slot('b', 1, { published_at: null }),
      slot('c', 5, { cancelled_at: '2026-10-18T10:00:00Z' }),
    ];
    const apps = [
      app('1', 'a', 'accepted'),
      app('2', 'a', 'applied'),
      app('3', 'b', 'applied'),
      app('4', 'c', 'accepted'),
      app('5', 'a', 'rejected'),
    ];
    expect(staffingSummary(slots, apps, true)).toEqual({
      seats: 3,
      filled: 1,
      free: 2,
      pending: 2,
      drafts: 1,
    });
    expect(staffingSummary(slots, apps, false).drafts).toBe(0);
  });
});
