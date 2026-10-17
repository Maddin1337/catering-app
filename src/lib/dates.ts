import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// Anzeige immer in Europe/Berlin, unabhängig von der Zeitzone des Geräts (docs/05 §2.1).
export const BERLIN = 'Europe/Berlin';

const options = { locale: de, in: tz(BERLIN) };

export function formatDate(value: string | number | Date): string {
  return format(value, 'EEE, dd.MM.yyyy', options);
}

export function formatTime(value: string | number | Date): string {
  return format(value, 'HH:mm', options);
}

export function formatDateTime(value: string | number | Date): string {
  return format(value, "EEE, dd.MM.yyyy, HH:mm 'Uhr'", options);
}
