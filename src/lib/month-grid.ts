import { addDays, weekday } from '@/lib/berlin';

const pad = (n: number) => String(n).padStart(2, '0');

export type MonthDay = { date: string; inMonth: boolean };

/** Monatsraster ab Montag; jede Woche hat 7 Tage, Tage außerhalb des Monats sind markiert. */
export function monthGrid(year: number, month: number): MonthDay[][] {
  const first = `${year}-${pad(month)}-01`;
  const offset = (weekday(first) + 6) % 7; // Montag = 0
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((offset + lastDay) / 7) * 7;
  const weeks: MonthDay[][] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(first, i - offset);
    const inMonth = date.startsWith(`${year}-${pad(month)}-`);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push({ date, inMonth });
  }
  return weeks;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
