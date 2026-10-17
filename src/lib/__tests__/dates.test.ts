import { formatDate, formatDateTime, formatTime } from '../dates';

// Anzeige immer in Europe/Berlin, egal in welcher Zone der Test läuft.
describe('dates', () => {
  it('zeigt Sommerzeit (UTC+2)', () => {
    expect(formatTime('2026-06-12T18:00:00Z')).toBe('20:00');
  });

  it('zeigt Winterzeit (UTC+1)', () => {
    expect(formatTime('2026-12-24T18:00:00Z')).toBe('19:00');
  });

  it('wechselt den Tag nach Berliner Zeit', () => {
    // 23:30 UTC ist in Berlin (Sommer) schon der Folgetag.
    expect(formatDate('2026-06-12T23:30:00Z')).toContain('13.06.2026');
  });

  it('formatiert Datum und Uhrzeit auf Deutsch', () => {
    expect(formatDateTime('2026-06-12T18:00:00Z')).toBe('Fr., 12.06.2026, 20:00 Uhr');
  });
});
