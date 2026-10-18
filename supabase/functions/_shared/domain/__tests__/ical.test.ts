import { buildIcal, escapeText, fold } from '../ical';

describe('iCal', () => {
  it('escaped Sonderzeichen und Zeilenumbrüche', () => {
    expect(escapeText('Halle 3, Tor; A\nB\\')).toBe('Halle 3\\, Tor\; A\\nB\\\\');
  });
  it('faltet lange Zeilen nach 75 Oktetten, auch mit Umlauten', () => {
    const line = 'SUMMARY:' + 'ä'.repeat(60);
    const folded = fold(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });
  it('baut einen gültigen Kalender mit UTC-Zeiten und Status', () => {
    const ics = buildIcal(
      'Firma A',
      [
        { uid: 'e1', title: 'Gala', starts_at: '2026-11-20T17:00:00+00:00', ends_at: '2026-11-20T21:30:00Z', tentative: true, location: 'Halle 3, Berlin' },
        { uid: 'e2', title: 'Lunch', starts_at: '2026-11-21T10:00:00Z', ends_at: '2026-11-21T12:00:00Z' },
      ],
      new Date('2026-10-18T10:00:00Z'),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261120T170000Z');
    expect(ics).toContain('DTEND:20261120T213000Z');
    expect(ics).toContain('STATUS:TENTATIVE');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('LOCATION:Halle 3\\, Berlin');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
