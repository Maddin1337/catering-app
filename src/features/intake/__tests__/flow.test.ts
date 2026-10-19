import type { Answers, Question } from '@/lib/intake';

import {
  extraQuestions,
  frontier,
  progressOf,
  questionForRow,
  sectionOf,
  stepAfter,
  stepBefore,
  SUMMARY,
} from '../flow';

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  sort_order: Number(id.slice(1)),
  prompt: id,
  help_text: null,
  answer_type: 'text',
  options: [],
  is_required: false,
  target: null,
  target_config: null,
  show_if: null,
  ...extra,
});
const visible = [q('q1'), q('q2'), q('q3'), q('q4')];

describe('Ablauf des Anfrage-Chats', () => {
  it('beginnt bei der ersten offenen Frage', () => {
    expect(frontier(visible, {}, [])).toBe('q1');
    expect(frontier(visible, { q1: 'a', q2: 'b' }, [])).toBe('q3');
    expect(frontier(visible, { q1: 'a' }, ['q2'])).toBe('q3');
    expect(frontier(visible, { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, [])).toBeNull();
  });

  it('geht nach einer Antwort zur nächsten offenen Frage', () => {
    expect(stepAfter(visible, { q1: 'a' }, [], 'q1')).toBe('q2');
  });

  it('springt nach einer Änderung weiter vorn zurück an die Stelle, wo man war', () => {
    const answers: Answers = { q1: 'a', q2: 'b', q3: 'c' };
    expect(stepAfter(visible, answers, [], 'q1')).toBe('q4');
    expect(stepAfter(visible, answers, [], 'q2')).toBe('q4');
  });

  it('landet in der Zusammenfassung, wenn nichts mehr offen ist', () => {
    const all: Answers = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };
    expect(stepAfter(visible, all, [], 'q4')).toBe(SUMMARY);
    expect(stepAfter(visible, all, [], 'q2')).toBe(SUMMARY);
    expect(stepAfter(visible, { q1: 'a', q2: 'b' }, ['q3', 'q4'], 'q2')).toBe(SUMMARY);
  });

  it('führt mit „Zurück“ zur vorherigen Frage, von der Zusammenfassung zur letzten', () => {
    expect(stepBefore(visible, 'q1')).toBeNull();
    expect(stepBefore(visible, 'q3')).toBe('q2');
    expect(stepBefore(visible, SUMMARY)).toBe('q4');
    expect(stepBefore([], SUMMARY)).toBeNull();
  });

  it('füllt den Balken mit jedem Schritt und ganz bei der Zusammenfassung', () => {
    const p = visible.map((x) => progressOf(visible, x.id));
    expect([...p].sort((a, b) => a - b)).toEqual(p);
    expect(p[0]).toBeGreaterThan(0);
    expect(p.at(-1)).toBeLessThan(1);
    expect(progressOf(visible, SUMMARY)).toBe(1);
    expect(progressOf([], 'x')).toBe(1);
  });

  it('ordnet jede Frage einem Bereich zu', () => {
    expect(sectionOf({ target: 'customer' })).toBe('customer');
    expect(sectionOf({ target: 'occasion' })).toBe('kind');
    expect(sectionOf({ target: 'starts_at' })).toBe('schedule');
    expect(sectionOf({ target: 'guest_count' })).toBe('guests');
    expect(sectionOf({ target: 'venue' })).toBe('place');
    expect(sectionOf({ target: 'dietary_requirements' })).toBe('kitchen');
    expect(sectionOf({ target: null })).toBe('more');
  });
});

describe('Zusammenfassung', () => {
  const list = [
    q('q1', { target: 'customer', answer_type: 'customer' }),
    q('q2', { target: 'starts_at', answer_type: 'date' }),
    q('q3', { target: 'starts_at', answer_type: 'time_range' }),
    q('q4', { target: 'guest_count', answer_type: 'number' }),
    q('q5', { target: 'kitchen_notes', answer_type: 'text' }),
    q('q6', { target: null, answer_type: 'number' }),
    q('q7', { target: 'dietary_requirements', answer_type: 'number' }),
  ];

  it('findet zu jeder Zeile die Frage zum Bearbeiten', () => {
    expect(questionForRow(list, 'customer')).toBe('q1');
    expect(questionForRow(list, 'date')).toBe('q2');
    expect(questionForRow(list, 'time')).toBe('q3');
    expect(questionForRow(list, 'guests')).toBe('q4');
    expect(questionForRow(list, 'dietary')).toBe('q7');
    expect(questionForRow(list, 'venue')).toBeNull();
  });

  it('nimmt eine Frage mit Datum und Uhrzeit für beide Zeilen', () => {
    const one = [q('q1', { target: 'starts_at', answer_type: 'datetime' })];
    expect(questionForRow(one, 'date')).toBe('q1');
    expect(questionForRow(one, 'time')).toBe('q1');
  });

  it('gibt Hinweise und Notizen eigene Zeilen, sobald sie beantwortet sind', () => {
    expect(extraQuestions(list, { q5: 'Nüsse', q6: 5, q4: 80 })).toEqual(['q5', 'q6']);
    expect(extraQuestions(list, {})).toEqual([]);
  });
});
