import type { EventRow } from '../../events/types';
import {
  daysUntil,
  firstName,
  greetingPart,
  nextEvent,
  overviewStats,
  weekStrip,
} from '../overview';

const mk = (id: string, status: EventRow['status'], start: string, guests: number | null = null) =>
  ({
    id,
    title: id,
    status,
    starts_at: start,
    ends_at: null,
    event_date: start.slice(0, 10),
    guest_count: guests,
  }) as EventRow;

// 15.10.2026 10:00 Uhr in Berlin (Sommerzeit endet am 25.10.)
const NOW = new Date('2026-10-15T08:00:00Z');

describe('Startseite: Übersicht', () => {
  it('wählt die Begrüßung nach Berliner Uhrzeit', () => {
    expect(greetingPart(NOW)).toBe('morning');
    expect(greetingPart(new Date('2026-10-15T12:00:00Z'))).toBe('day');
    expect(greetingPart(new Date('2026-10-15T17:30:00Z'))).toBe('evening');
  });

  it('nimmt den Vornamen', () => {
    expect(firstName('Anna Admin')).toBe('Anna');
    expect(firstName('  ')).toBe('');
    expect(firstName(null)).toBe('');
  });

  it('findet den nächsten feststehenden Auftrag', () => {
    const events = [
      mk('alt', 'confirmed', '2026-10-10T10:00:00Z'),
      mk('anfrage', 'inquiry', '2026-10-16T10:00:00Z'),
      mk('spaeter', 'confirmed', '2026-10-30T10:00:00Z'),
      mk('naechster', 'optioned', '2026-10-20T10:00:00Z'),
      mk('abgesagt', 'cancelled', '2026-10-16T12:00:00Z'),
    ];
    expect(nextEvent(events, NOW)?.id).toBe('naechster');
    expect(nextEvent([], NOW)).toBeNull();
  });

  it('zählt Tage bis zum Auftrag nach Berliner Datum', () => {
    expect(daysUntil(mk('a', 'confirmed', '2026-10-15T20:00:00Z'), NOW)).toBe(0);
    expect(daysUntil(mk('b', 'confirmed', '2026-10-18T10:00:00Z'), NOW)).toBe(3);
  });

  it('baut die Wochenleiste mit Zahl aktiver Aufträge', () => {
    const strip = weekStrip(
      [
        mk('a', 'confirmed', '2026-10-15T10:00:00Z'),
        mk('b', 'inquiry', '2026-10-15T12:00:00Z'),
        mk('c', 'declined', '2026-10-16T10:00:00Z'),
        mk('d', 'quoted', '2026-10-21T10:00:00Z'),
        mk('e', 'confirmed', '2026-10-22T10:00:00Z'),
      ],
      NOW,
    );
    expect(strip.map((d) => d.date.slice(8))).toEqual(['15', '16', '17', '18', '19', '20', '21']);
    expect(strip.map((d) => d.count)).toEqual([2, 0, 0, 0, 0, 0, 1]);
    expect(strip[0]!.isToday).toBe(true);
  });

  it('fasst die Woche zusammen', () => {
    const stats = overviewStats(
      [
        mk('a', 'confirmed', '2026-10-15T10:00:00Z', 40),
        mk('b', 'optioned', '2026-10-21T10:00:00Z', 25),
        mk('c', 'confirmed', '2026-10-22T10:00:00Z', 99),
        mk('d', 'inquiry', '2026-10-30T10:00:00Z', 10),
        mk('e', 'quoted', '2026-11-02T10:00:00Z'),
        mk('f', 'inquiry', '2026-10-01T10:00:00Z'),
      ],
      NOW,
    );
    expect(stats).toEqual({ weekEvents: 2, weekGuests: 65, inquiries: 1, quotes: 1 });
  });
});
