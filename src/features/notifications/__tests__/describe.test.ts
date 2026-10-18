import i18n from '@/lib/i18n';

import { ago, describe as describeN, splitByDay } from '../describe';
import type { AppNotification } from '../types';

const t = i18n.t.bind(i18n);
const base = (
  kind: AppNotification['kind'],
  extra: Partial<AppNotification> = {},
): AppNotification => ({
  id: 'n1',
  kind,
  event_id: 'e1',
  shift_slot_id: 's1',
  payload: {
    slot_title: 'Service',
    starts_at: '2026-11-26T12:00:00Z',
    member_name: 'Sven',
    event_title: 'Sommerfest',
    customer_name: 'Müller GmbH',
  },
  created_at: '2026-10-18T10:00:00Z',
  read_at: null,
  ...extra,
});

describe('describe', () => {
  it('baut Titel und Text aus Art und Rohdaten', () => {
    const d = describeN(base('application_new'), 'admin', t);
    expect(d.title).toBe('Neue Bewerbung');
    expect(d.body).toBe('Sven möchte „Service“ am Do., 26.11.2026 übernehmen.');
    expect(d.target).toEqual({ pathname: '/events/[id]', params: { id: 'e1' } });
  });

  it('führt das Personal zu seinen Schichten bzw. zur Börse, je nach Rolle', () => {
    expect(describeN(base('shift_confirmed', { event_id: null }), 'staff', t).target).toBe(
      '/my-shifts',
    );
    expect(describeN(base('shift_confirmed', { event_id: null }), 'kitchen', t).target).toBe(
      '/shifts/mine',
    );
    expect(describeN(base('shift_new', { event_id: null }), 'staff', t).target).toBe(
      '/shift-board',
    );
  });

  it('nennt den Ort nur, wenn es einen gibt, und markiert kurzfristige Sonderessen', () => {
    const withCity = base('shift_new', {
      payload: { slot_title: 'Bar', starts_at: '2026-11-26T12:00:00Z', city: 'Berlin' },
    });
    expect(describeN(withCity, 'staff', t).body).toContain(' in Berlin.');
    const diet = base('dietary_added', {
      payload: {
        event_title: 'Gala',
        starts_at: '2026-11-26T12:00:00Z',
        person_count: 2,
        short_notice: true,
      },
    });
    expect(describeN(diet, 'kitchen', t).body).toMatch(/2 Personen.*\(kurzfristig\)$/);
  });
});

describe('splitByDay', () => {
  it('trennt Heute und Früher nach Berliner Datum', () => {
    const now = new Date('2026-10-18T22:30:00Z'); // 00:30 am 19.10. in Berlin
    const list = [
      base('application_new', { id: 'a', created_at: '2026-10-18T22:10:00Z' }),
      base('application_new', { id: 'b', created_at: '2026-10-18T21:50:00Z' }),
    ];
    const { today, earlier } = splitByDay(list, now);
    expect(today.map((n) => n.id)).toEqual(['a']);
    expect(earlier.map((n) => n.id)).toEqual(['b']);
  });
});

describe('ago', () => {
  it('zeigt Minuten, Stunden und sonst das Datum', () => {
    const now = new Date('2026-10-18T12:00:00Z').getTime();
    expect(ago('2026-10-18T11:59:40Z', t, now)).toBe('gerade eben');
    expect(ago('2026-10-18T11:55:00Z', t, now)).toBe('vor 5 Min.');
    expect(ago('2026-10-18T09:00:00Z', t, now)).toBe('vor 3 Std.');
    expect(ago('2026-10-16T09:00:00Z', t, now)).toBe('Fr., 16.10.2026');
  });
});
