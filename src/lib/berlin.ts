import { TZDate } from '@date-fns/tz';

// Zeitlogik für Europe/Berlin (docs/05 §2.1): Eingaben und Anzeige in Ortszeit, gespeichert als UTC.
// Termine werden als Datum „YYYY-MM-DD“ und Uhrzeit „HH:mm“ gehalten, nie als Differenz in Stunden,
// damit „12:00 Uhr“ über die Zeitumstellung hinweg „12:00 Uhr“ bleibt.

const ZONE = 'Europe/Berlin';
const pad = (n: number) => String(n).padStart(2, '0');

/** „23.10.2026“ oder „23.10.26“ → „2026-10-23“; `null` bei ungültigem Datum (z. B. 31.02.). */
export function parseGermanDate(input: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  )
    return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** „2026-10-23“ → „23.10.2026“. */
export function formatGermanDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/** „12:00“, „9:30“ oder „1230“ → „HH:mm“; `null` bei ungültiger Uhrzeit. */
export function parseTime(input: string): string | null {
  const v = input.trim().replace('.', ':');
  const m = /^(\d{1,2}):?(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Ortszeit Berlin (Datum + Uhrzeit) → UTC-Zeitstempel (ISO). Nicht existierende Ortszeit (Umstellung) rutscht vor. */
export function berlinToIso(isoDate: string, time: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, ZONE).getTime()).toISOString();
}

/** UTC-Zeitstempel → Ortszeit Berlin als Datum und Uhrzeit. */
export function isoToBerlin(iso: string | Date): { date: string; time: string } {
  const t = new TZDate(new Date(iso), ZONE);
  return {
    date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
    time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
  };
}

/** Ende des Tages 23:59:59 Ortszeit (z. B. „optioniert bis“). */
export function endOfBerlinDayIso(isoDate: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, mo - 1, d, 23, 59, 59, ZONE).getTime()).toISOString();
}

/** Kalendertage addieren (Ortsdatum, ohne Zeitzonenrechnung). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Heutiges Datum in Berlin, unabhängig von der Zeitzone des Geräts. */
export function todayBerlin(now: Date = new Date()): string {
  return isoToBerlin(now).date;
}

/** Wochentag 0 (Sonntag) bis 6 (Samstag) eines Ortsdatums. */
export function weekday(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Ende eines Termins, der über Mitternacht geht: ist die Endzeit nicht später als der Beginn,
 * endet er am Folgetag („18:00–02:00“, docs/01 US-10).
 */
export function endIso(startDate: string, startTime: string, endTime: string): string {
  const crossesMidnight = endTime <= startTime;
  return berlinToIso(crossesMidnight ? addDays(startDate, 1) : startDate, endTime);
}
