import { clock, pickLive } from '../live';

const now = new Date('2026-10-18T16:00:00Z').getTime();
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 18, h, m)).toISOString();

describe('pickLive', () => {
  it('nimmt, was gerade läuft, mit Restzeit und Fortschritt', () => {
    const live = pickLive(
      [
        { id: 'a', title: 'Gala', starts_at: at(14), ends_at: at(18) },
        { id: 'b', title: 'Später', starts_at: at(17), ends_at: at(20) },
      ],
      now,
    );
    expect(live?.id).toBe('a');
    expect(live?.phase).toBe('running');
    expect(live?.minutes).toBe(120);
    expect(live?.progress).toBeCloseTo(0.5);
  });

  it('ohne Ende gilt eine Dauer von vier Stunden', () => {
    const live = pickLive([{ id: 'a', title: 'Lunch', starts_at: at(13), ends_at: null }], now);
    expect(live?.phase).toBe('running');
    expect(live?.minutes).toBe(60);
  });

  it('zeigt sonst, was in den nächsten drei Stunden beginnt', () => {
    const live = pickLive(
      [
        { id: 'a', title: 'Zu spät', starts_at: at(20), ends_at: null },
        { id: 'b', title: 'Bald', starts_at: at(17, 30), ends_at: null },
      ],
      now,
    );
    expect(live).toMatchObject({ id: 'b', phase: 'soon', minutes: 90, progress: 0 });
  });

  it('liefert nichts, wenn nichts läuft oder bald beginnt', () => {
    expect(
      pickLive([{ id: 'a', title: 'Morgen', starts_at: at(23), ends_at: null }], now),
    ).toBeNull();
    expect(
      pickLive([{ id: 'a', title: 'Vorbei', starts_at: at(10), ends_at: at(12) }], now),
    ).toBeNull();
  });
});

describe('clock', () => {
  it('zeigt Minuten oder Stunden:Minuten', () => {
    expect(clock(45)).toEqual({ value: '45', unit: 'min' });
    expect(clock(125)).toEqual({ value: '2:05', unit: 'h' });
  });
});
