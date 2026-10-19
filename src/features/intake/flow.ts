import type { Answers, Question } from '@/lib/intake';

// Ablauf des Anfrage-Chats: welche Frage als Nächstes kommt, wohin „Zurück“ führt und wie weit
// der Fortschrittsbalken ist. Reine Logik ohne Oberfläche.

/** Kennung der Zusammenfassung; Fragen haben UUIDs, es gibt also keine Verwechslung. */
export const SUMMARY = '__summary__';

type Visible = Pick<Question, 'id'>[];

const open = (q: Visible[number], answers: Answers, skipped: string[]) =>
  answers[q.id] === undefined && !skipped.includes(q.id);

/** Erste sichtbare Frage ohne Antwort und ohne Überspringen; `null`, wenn alles erledigt ist. */
export function frontier(visible: Visible, answers: Answers, skipped: string[]): string | null {
  return visible.find((q) => open(q, answers, skipped))?.id ?? null;
}

/**
 * Wohin es nach einer Antwort weitergeht: zur nächsten offenen Frage hinter der aktuellen, sonst
 * zur ersten offenen überhaupt (wer zurückging und etwas änderte, landet wieder dort, wo er war),
 * sonst zur Zusammenfassung.
 */
export function stepAfter(
  visible: Visible,
  answers: Answers,
  skipped: string[],
  currentId: string,
): string {
  const i = visible.findIndex((q) => q.id === currentId);
  const later = visible.slice(i + 1).find((q) => open(q, answers, skipped));
  return later?.id ?? frontier(visible, answers, skipped) ?? SUMMARY;
}

/** Vorherige Frage; `null` bei der ersten. Von der Zusammenfassung aus die letzte Frage. */
export function stepBefore(visible: Visible, stepId: string): string | null {
  if (stepId === SUMMARY) return visible.at(-1)?.id ?? null;
  const i = visible.findIndex((q) => q.id === stepId);
  return i > 0 ? visible[i - 1]!.id : null;
}

/** Anteil 0–1 für den Balken: Eine Frage vorn ist ein Schritt weiter, die Zusammenfassung ist voll. */
export function progressOf(visible: Visible, stepId: string): number {
  if (stepId === SUMMARY || visible.length === 0) return 1;
  const i = Math.max(
    0,
    visible.findIndex((q) => q.id === stepId),
  );
  return Math.min(1, (i + 1) / (visible.length + 1));
}

export type Section = 'customer' | 'kind' | 'schedule' | 'guests' | 'place' | 'kitchen' | 'more';

/** Kleine Überschrift über der Frage – sie hängt an der Zuordnung, springt also nicht mit der Fragenzahl. */
export function sectionOf(q: Pick<Question, 'target'>): Section {
  switch (q.target) {
    case 'customer':
    case 'customer_reference':
      return 'customer';
    case 'event_kind':
    case 'occasion':
      return 'kind';
    case 'starts_at':
    case 'ends_at':
      return 'schedule';
    case 'guest_count':
      return 'guests';
    case 'venue':
      return 'place';
    case 'dietary_requirements':
    case 'kitchen_notes':
      return 'kitchen';
    default:
      return 'more';
  }
}

export type RowKey =
  'customer' | 'kind' | 'occasion' | 'date' | 'time' | 'guests' | 'venue' | 'dietary';

/** Welche Frage eine Zeile der Zusammenfassung bearbeitet; `null`, wenn es dazu keine gibt. */
export function questionForRow(
  visible: Pick<Question, 'id' | 'target' | 'answer_type'>[],
  row: RowKey,
): string | null {
  const find = (fn: (q: (typeof visible)[number]) => boolean) => visible.find(fn)?.id ?? null;
  switch (row) {
    case 'customer':
      return find((q) => q.target === 'customer');
    case 'kind':
      return find((q) => q.target === 'event_kind');
    case 'occasion':
      return find((q) => q.target === 'occasion');
    case 'date':
      return find(
        (q) =>
          q.target === 'starts_at' && (q.answer_type === 'date' || q.answer_type === 'datetime'),
      );
    case 'time':
      return find(
        (q) =>
          (q.target === 'starts_at' || q.target === 'ends_at') &&
          (q.answer_type === 'time_range' ||
            q.answer_type === 'time' ||
            q.answer_type === 'datetime'),
      );
    case 'guests':
      return find((q) => q.target === 'guest_count');
    case 'venue':
      return find((q) => q.target === 'venue');
    case 'dietary':
      return find((q) => q.target === 'dietary_requirements');
  }
}

/**
 * Fragen, die keine feste Zeile haben (Hinweise für Küche und Personal, Referenz, Notizen ohne
 * Zuordnung): Jede beantwortete bekommt in der Zusammenfassung eine eigene Zeile.
 */
export function extraQuestions(
  visible: Pick<Question, 'id' | 'target'>[],
  answers: Answers,
): string[] {
  const own = ['customer_reference', 'kitchen_notes', 'staff_notes'];
  return visible
    .filter((q) => answers[q.id] !== undefined && (q.target === null || own.includes(q.target)))
    .map((q) => q.id);
}
