import { addDays, isoToBerlin, todayBerlin } from '@/lib/berlin';

import type { EventRow } from '../events/types';

const ACTIVE = new Set(['inquiry', 'quoted', 'optioned', 'confirmed']);
const FIRM = new Set(['optioned', 'confirmed']);

/** Tageszeit der Begrüßung nach Berliner Uhrzeit: Morgen bis 11, Tag bis 17, sonst Abend. */
export function greetingPart(now: Date = new Date()): 'morning' | 'day' | 'evening' {
  const hour = Number(isoToBerlin(now).time.slice(0, 2));
  if (hour < 11) return 'morning';
  if (hour < 18) return 'day';
  return 'evening';
}

/** Vorname aus dem Anzeigenamen („Anna Admin“ → „Anna“); leer, wenn kein Name bekannt ist. */
export function firstName(displayName: string | null | undefined): string {
  return (displayName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Nächster feststehender Auftrag (optioniert oder bestätigt), der noch nicht vorbei ist. */
export function nextEvent(events: EventRow[], now: Date = new Date()): EventRow | null {
  const today = todayBerlin(now);
  return (
    events
      .filter((e) => FIRM.has(e.status) && isoToBerlin(e.ends_at ?? e.starts_at).date >= today)
      .filter((e) => (e.ends_at ?? e.starts_at) >= now.toISOString() || e.event_date >= today)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
  );
}

/** Tage von heute bis zu einem Zeitpunkt (0 = heute) nach Berliner Datum; negativ, wenn er schon vorbei ist. */
export function daysUntilIso(iso: string, now: Date = new Date()): number {
  const a = Date.parse(`${todayBerlin(now)}T00:00:00Z`);
  const b = Date.parse(`${isoToBerlin(iso).date}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Tage von heute bis zum Beginn des Auftrags (0 = heute). */
export function daysUntil(event: EventRow, now: Date = new Date()): number {
  return daysUntilIso(event.starts_at, now);
}

export type StripDay = { date: string; count: number; isToday: boolean };

/** Sieben Tage ab heute mit der Zahl aktiver Aufträge je Tag (für die Wochenleiste). */
export function weekStrip(events: EventRow[], now: Date = new Date()): StripDay[] {
  const today = todayBerlin(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return {
      date,
      isToday: i === 0,
      count: events.filter((e) => ACTIVE.has(e.status) && isoToBerlin(e.starts_at).date === date)
        .length,
    };
  });
}

export type Stats = {
  /** Aktive Aufträge in den nächsten 7 Tagen (inkl. heute). */
  weekEvents: number;
  /** Gäste dieser Aufträge (ohne Angabe zählt nicht). */
  weekGuests: number;
  /** Anfragen, die noch beantwortet werden müssen. */
  inquiries: number;
  /** Versendete Angebote ohne Antwort. */
  quotes: number;
};

export function overviewStats(events: EventRow[], now: Date = new Date()): Stats {
  const today = todayBerlin(now);
  const end = addDays(today, 6);
  const week = events.filter((e) => {
    const d = isoToBerlin(e.starts_at).date;
    return ACTIVE.has(e.status) && d >= today && d <= end;
  });
  return {
    weekEvents: week.length,
    weekGuests: week.reduce((n, e) => n + (e.guest_count ?? 0), 0),
    inquiries: events.filter((e) => e.status === 'inquiry' && e.event_date >= today).length,
    quotes: events.filter((e) => e.status === 'quoted' && e.event_date >= today).length,
  };
}

/** Wochenleiste aus beliebigen Datums-Zeitstempeln (z. B. Schichten): Zahl der Einträge je Tag. */
export function stripFromTimestamps(timestamps: string[], now: Date = new Date()): StripDay[] {
  const today = todayBerlin(now);
  const dates = timestamps.map((ts) => isoToBerlin(ts).date);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return { date, isToday: i === 0, count: dates.filter((d) => d === date).length };
  });
}
