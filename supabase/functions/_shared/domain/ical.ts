// Kalender-Feed im iCalendar-Format (RFC 5545). Zeiten in UTC, damit der Kalenderdienst des Nutzers sie in
// seine Zeitzone umrechnet; ohne Kundendaten (der Aufrufer liefert nur freigegebene Felder).

export type IcalEntry = {
  uid: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location?: string | null;
  description?: string | null;
  tentative?: boolean;
  updated_at?: string | null;
};

const utc = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Text-Escape nach RFC 5545 §3.3.11. */
export function escapeText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen länger als 75 Oktette werden gefaltet (Folgezeile beginnt mit einem Leerzeichen). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n');
}

export function buildIcal(name: string, entries: IcalEntry[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//catering-app//Kalender-Abo//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const e of entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@catering-app`,
      `DTSTAMP:${utc((e.updated_at ?? now.toISOString()) as string)}`,
      `DTSTART:${utc(e.starts_at)}`,
      `DTEND:${utc(e.ends_at)}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push(`STATUS:${e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
