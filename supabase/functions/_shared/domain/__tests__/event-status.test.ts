import {
  EVENT_STATUSES,
  isAllowedTransition,
  isClosed,
  nextStatuses,
  requirementsFor,
  TRANSITIONS,
} from '../event-status';

// Dieselbe Liste steht in supabase/tests/rls/m3_events.test.sql und in der Funktion
// private.is_allowed_event_transition(): ändert sich eine, müssen alle drei geändert werden.
const EXPECTED = [
  'inquiry>quoted',
  'inquiry>optioned',
  'inquiry>confirmed',
  'inquiry>declined',
  'quoted>optioned',
  'quoted>confirmed',
  'quoted>declined',
  'optioned>confirmed',
  'optioned>cancelled',
  'confirmed>completed',
  'confirmed>cancelled',
  'completed>invoiced',
];

describe('Übergangstabelle', () => {
  it('enthält genau die zwölf erlaubten Übergänge', () => {
    expect(TRANSITIONS.map(([f, t]) => `${f}>${t}`).sort()).toEqual([...EXPECTED].sort());
  });

  it('prüft alle 64 Statuspaare', () => {
    let allowed = 0;
    for (const f of EVENT_STATUSES) {
      for (const t of EVENT_STATUSES) {
        const expected = EXPECTED.includes(`${f}>${t}`);
        expect(isAllowedTransition(f, t)).toBe(expected);
        if (expected) allowed++;
      }
    }
    expect(allowed).toBe(12);
  });

  it('kennt keine Rückwärts-Übergänge und keine Reaktivierung (R2-4)', () => {
    expect(isAllowedTransition('completed', 'confirmed')).toBe(false);
    expect(isAllowedTransition('invoiced', 'completed')).toBe(false);
    expect(isAllowedTransition('declined', 'quoted')).toBe(false);
    expect(isAllowedTransition('cancelled', 'confirmed')).toBe(false);
    expect(isAllowedTransition('declined', 'inquiry')).toBe(false);
  });
});

describe('Aktionen je Status', () => {
  it('bietet aus der Anfrage vormerken, direkt bestätigen und ablehnen an (ohne „Angebot versendet“)', () => {
    expect(nextStatuses('inquiry')).toEqual(['optioned', 'confirmed', 'declined']);
  });
  it('erlaubt bei einer Option zusätzlich das Verlängern', () => {
    expect(nextStatuses('optioned')).toEqual(['optioned', 'confirmed', 'cancelled']);
  });
  it('führt bestätigt zu durchgeführt oder abgesagt, durchgeführt zu abgerechnet', () => {
    expect(nextStatuses('confirmed')).toEqual(['completed', 'cancelled']);
    expect(nextStatuses('completed')).toEqual(['invoiced']);
  });
  it('bietet in Endzuständen nichts an', () => {
    for (const s of ['declined', 'cancelled', 'invoiced'] as const) {
      expect(nextStatuses(s)).toEqual([]);
      expect(isClosed(s)).toBe(true);
    }
  });
  it('nennt die Pflichtangaben', () => {
    expect(requirementsFor('inquiry', 'optioned')).toEqual(['option']);
    expect(requirementsFor('inquiry', 'confirmed')).toEqual(['channel']);
    expect(requirementsFor('inquiry', 'declined')).toEqual(['reason']);
    expect(requirementsFor('confirmed', 'cancelled')).toEqual(['reason']);
    expect(requirementsFor('completed', 'invoiced')).toEqual(['invoice']);
    expect(requirementsFor('confirmed', 'completed')).toEqual([]);
  });
});
