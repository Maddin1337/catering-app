import { filterEvents, DEFAULT_EVENT_FILTERS } from '../filter';
import { defaultSchedule } from '../schedule-default';
import type { EventRow } from '../types';

const base = {
  occasion: null,
  ends_at: null,
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
  kind: 'event_catering',
} as const;
const mk = (
  id: string,
  title: string,
  status: EventRow['status'],
  date: string,
  customer = 'Müller GmbH',
): EventRow => ({
  ...base,
  id,
  title,
  status,
  event_date: date,
  starts_at: `${date}T10:00:00Z`,
  customer_name: customer,
});
const events: EventRow[] = [
  mk('1', 'Hochzeit', 'confirmed', '2026-11-14'),
  mk('2', 'Business-Lunch', 'inquiry', '2026-10-30', 'Schmidt AG'),
  mk('3', 'Gestern', 'confirmed', '2026-10-22'),
  mk('4', 'Abgerechnet', 'invoiced', '2026-10-01'),
  mk('5', 'Abgelehnt', 'declined', '2026-11-01'),
  mk('6', 'Abgesagt', 'cancelled', '2026-11-02'),
];
const ids = (f: Partial<typeof DEFAULT_EVENT_FILTERS>) =>
  filterEvents(events, { ...DEFAULT_EVENT_FILTERS, ...f }, '2026-10-23').map((e) => e.id);

describe('Aufträge filtern', () => {
  it('zeigt standardmäßig anstehende Aufträge, nächster Termin zuerst', () => {
    expect(ids({})).toEqual(['2', '1']);
  });
  it('„Vergangen“ zeigt Durchgeführte, Abgerechnete und zurückliegende, neueste zuerst', () => {
    expect(ids({ mode: 'past' })).toEqual(['3', '4']);
  });
  it('„Archiv“ zeigt nur Abgelehnte und Abgesagte', () => {
    expect(ids({ mode: 'archive' }).sort()).toEqual(['5', '6']);
  });
  it('sucht in Titel und Kunde', () => {
    expect(ids({ query: 'schmidt' })).toEqual(['2']);
    expect(ids({ query: 'hochzeit' })).toEqual(['1']);
  });
});

describe('Standardablauf', () => {
  it('legt Abfahrt, Aufbau, Ausgabe und Abbau um den Termin', () => {
    const items = defaultSchedule('2026-11-14T17:00:00.000Z', '2026-11-14T23:00:00.000Z');
    expect(items.map((i) => i.kind)).toEqual(['departure', 'setup', 'service', 'teardown']);
    expect(items[0]!.starts_at).toBe('2026-11-14T15:00:00.000Z');
    expect(items[1]!.starts_at).toBe('2026-11-14T15:30:00.000Z');
    expect(items[2]).toEqual({
      kind: 'service',
      starts_at: '2026-11-14T17:00:00.000Z',
      ends_at: '2026-11-14T23:00:00.000Z',
    });
    expect(items[3]!.starts_at).toBe('2026-11-14T23:00:00.000Z');
  });
  it('nimmt ohne Ende zwei Stunden Ausgabe an', () => {
    const items = defaultSchedule('2026-11-14T17:00:00.000Z', null);
    expect(items[2]!.ends_at).toBe('2026-11-14T19:00:00.000Z');
  });
});
