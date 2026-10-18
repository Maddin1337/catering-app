import {
  addDays,
  berlinToIso,
  endIso,
  endOfBerlinDayIso,
  formatGermanDate,
  isoToBerlin,
  parseGermanDate,
  parseTime,
  todayBerlin,
  weekday,
} from '../berlin';

describe('Eingaben', () => {
  it('liest deutsche Datumsangaben', () => {
    expect(parseGermanDate('23.10.2026')).toBe('2026-10-23');
    expect(parseGermanDate('3.1.26')).toBe('2026-01-03');
    expect(parseGermanDate('31.02.2026')).toBeNull();
    expect(parseGermanDate('2026-10-23')).toBeNull();
    expect(formatGermanDate('2026-10-23')).toBe('23.10.2026');
  });
  it('liest Uhrzeiten', () => {
    expect(parseTime('12:00')).toBe('12:00');
    expect(parseTime('9:30')).toBe('09:30');
    expect(parseTime('1830')).toBe('18:30');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
  });
});

describe('Zeitumstellung (25.10.2026 und 28.03.2027)', () => {
  it('12:00 Uhr bleibt 12:00 Uhr vor und nach der Umstellung im Herbst', () => {
    expect(berlinToIso('2026-10-23', '12:00')).toBe('2026-10-23T10:00:00.000Z'); // MESZ, UTC+2
    expect(berlinToIso('2026-10-30', '12:00')).toBe('2026-10-30T11:00:00.000Z'); // MEZ, UTC+1
    expect(isoToBerlin('2026-10-30T11:00:00.000Z')).toEqual({ date: '2026-10-30', time: '12:00' });
  });
  it('12:00 Uhr bleibt 12:00 Uhr nach der Umstellung im Frühjahr', () => {
    expect(berlinToIso('2027-03-27', '12:00')).toBe('2027-03-27T11:00:00.000Z'); // MEZ
    expect(berlinToIso('2027-03-29', '12:00')).toBe('2027-03-29T10:00:00.000Z'); // MESZ
  });
  it('eine nicht existierende Ortszeit (02:30 am 28.03.2027) landet in der Stunde danach', () => {
    expect(isoToBerlin(berlinToIso('2027-03-28', '02:30')).date).toBe('2027-03-28');
    expect(isoToBerlin(berlinToIso('2027-03-28', '02:30')).time).toBe('03:30');
  });
  it('die Nacht der Umstellung im Herbst hat 25 Stunden', () => {
    const start = Date.parse(berlinToIso('2026-10-25', '00:00'));
    const end = Date.parse(berlinToIso('2026-10-26', '00:00'));
    expect((end - start) / 3_600_000).toBe(25);
  });
  it('der Tag der Umstellung im Frühjahr hat 23 Stunden', () => {
    const start = Date.parse(berlinToIso('2027-03-28', '00:00'));
    const end = Date.parse(berlinToIso('2027-03-29', '00:00'));
    expect((end - start) / 3_600_000).toBe(23);
  });
});

describe('Termine über Mitternacht', () => {
  it('„18:00–02:00“ endet am Folgetag', () => {
    expect(endIso('2026-11-14', '18:00', '02:00')).toBe(berlinToIso('2026-11-15', '02:00'));
  });
  it('„12:00–14:30“ endet am selben Tag', () => {
    expect(endIso('2026-11-14', '12:00', '14:30')).toBe(berlinToIso('2026-11-14', '14:30'));
  });
  it('„optioniert bis“ ist das Ende des gewählten Tages in Berliner Zeit', () => {
    expect(endOfBerlinDayIso('2026-11-14')).toBe('2026-11-14T22:59:59.000Z');
    expect(endOfBerlinDayIso('2026-10-25')).toBe('2026-10-25T22:59:59.000Z');
  });
});

describe('Datumsrechnung', () => {
  it('addiert Tage über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-23', 7)).toBe('2026-10-30');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
  it('kennt den Wochentag', () => {
    expect(weekday('2026-10-23')).toBe(5); // Freitag
  });
  it('„heute“ richtet sich nach Berlin, nicht nach dem Gerät', () => {
    expect(todayBerlin(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-24'); // 00:30 Uhr in Berlin
    expect(todayBerlin(new Date('2026-10-23T21:30:00Z'))).toBe('2026-10-23');
  });
});
