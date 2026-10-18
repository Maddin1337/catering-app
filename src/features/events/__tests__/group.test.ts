import { groupByMonth } from '../group';
import type { EventRow } from '../types';

const ev = (id: string, start: string) => ({ id, starts_at: start }) as EventRow;

describe('groupByMonth', () => {
  it('fasst aufeinanderfolgende Aufträge eines Monats zusammen und behält die Reihenfolge', () => {
    const groups = groupByMonth([
      ev('a', '2026-10-05T10:00:00Z'),
      ev('b', '2026-10-20T10:00:00Z'),
      ev('c', '2026-11-02T10:00:00Z'),
    ]);
    expect(groups.map((g) => [g.month, g.events.map((e) => e.id)])).toEqual([
      ['2026-10-01', ['a', 'b']],
      ['2026-11-01', ['c']],
    ]);
  });

  it('rechnet nach Berliner Datum: Mitternacht Berlin liegt noch im Vormonat in UTC', () => {
    const groups = groupByMonth([ev('a', '2026-10-31T23:30:00Z')]);
    expect(groups[0]!.month).toBe('2026-11-01');
  });

  it('liefert bei leerer Liste keine Gruppen', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
