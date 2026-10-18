import type { EventRow } from '../../events/types';
import { computeTodos, todayAndTomorrow } from '../todos';

const mk = (
  id: string,
  status: EventRow['status'],
  start: string,
  extra: Partial<EventRow> = {},
): EventRow => ({
  id,
  title: id,
  kind: 'event_catering',
  occasion: null,
  status,
  starts_at: start,
  ends_at: null,
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
  ...extra,
});
const now = new Date('2026-11-10T10:00:00Z'); // 11:00 Uhr in Berlin

describe('Zu erledigen', () => {
  it('findet Anfragen, die länger als 24 Stunden liegen', () => {
    const t = computeTodos(
      [
        mk('alt', 'inquiry', '2026-12-01T10:00:00Z', { created_at: '2026-11-09T09:00:00Z' }),
        mk('neu', 'inquiry', '2026-12-01T10:00:00Z', { created_at: '2026-11-10T08:00:00Z' }),
      ],
      now,
    );
    expect(t.staleInquiries.map((e) => e.id)).toEqual(['alt']);
  });
  it('findet Optionen, die in höchstens drei Tagen ablaufen', () => {
    const t = computeTodos(
      [
        mk('bald', 'optioned', '2026-12-01T10:00:00Z', {
          option_expires_at: '2026-11-12T22:59:59Z',
        }),
        mk('spaet', 'optioned', '2026-12-01T10:00:00Z', {
          option_expires_at: '2026-11-20T22:59:59Z',
        }),
        mk('abgelaufen', 'optioned', '2026-12-01T10:00:00Z', {
          option_expires_at: '2026-11-08T22:59:59Z',
        }),
      ],
      now,
    );
    expect(t.expiringOptions.map((e) => e.id).sort()).toEqual(['abgelaufen', 'bald']);
  });
  it('schlägt „durchgeführt“ nur für bestätigte Aufträge vor, die gestern oder früher endeten', () => {
    const t = computeTodos(
      [
        mk('gestern', 'confirmed', '2026-11-09T10:00:00Z', { ends_at: '2026-11-09T18:00:00Z' }),
        mk('heute', 'confirmed', '2026-11-10T09:00:00Z', { ends_at: '2026-11-10T20:00:00Z' }),
        mk('ueber-mitternacht', 'confirmed', '2026-11-09T18:00:00Z', {
          ends_at: '2026-11-10T01:00:00Z',
        }),
        mk('anfrage', 'inquiry', '2026-11-01T10:00:00Z'),
      ],
      now,
    );
    expect(t.toComplete.map((e) => e.id)).toEqual(['gestern']);
  });
});

describe('Heute und morgen', () => {
  it('rechnet in Berliner Datum', () => {
    const r = todayAndTomorrow(
      [
        mk('heute', 'confirmed', '2026-11-10T11:00:00Z'),
        mk('morgen-frueh', 'confirmed', '2026-11-10T23:30:00Z'), // 00:30 Uhr am 11.11. in Berlin
        mk('abgesagt', 'cancelled', '2026-11-10T11:00:00Z'),
      ],
      now,
    );
    expect(r.today.map((e) => e.id)).toEqual(['heute']);
    expect(r.tomorrow.map((e) => e.id)).toEqual(['morgen-frueh']);
  });
});
