import type { Answers, Question } from '@/lib/intake';

import type { EventRow } from '../events/types';

/**
 * Felder einer bestehenden Anfrage oder eines vorgewählten Kunden als beantwortete Fragen (docs/02 §11.1:
 * „Start aus einer bestehenden Anfrage“). Sie bleiben änderbar.
 */
export function prefillAnswers(
  questions: Question[],
  source: {
    customer?: { id: string; name: string } | null;
    event?:
      | (Pick<EventRow, 'kind' | 'occasion' | 'event_date' | 'guest_count' | 'venue_name'> & {
          startTime: string;
          endTime: string | null;
        })
      | null;
  },
): Answers {
  const answers: Answers = {};
  const e = source.event;
  for (const q of questions) {
    switch (q.target) {
      case 'customer':
        if (source.customer)
          answers[q.id] = { customerId: source.customer.id, name: source.customer.name };
        break;
      case 'event_kind':
        if (e) answers[q.id] = e.kind;
        break;
      case 'occasion':
        if (e?.occasion) {
          if (q.answer_type === 'single_choice') {
            const hit = q.options.find((o) => o.label === e.occasion || o.value === e.occasion);
            if (hit) answers[q.id] = hit.value;
          } else answers[q.id] = e.occasion;
        }
        break;
      case 'starts_at':
        if (e && q.answer_type === 'date') answers[q.id] = e.event_date;
        else if (e && q.answer_type === 'time') answers[q.id] = e.startTime;
        else if (e && q.answer_type === 'time_range')
          answers[q.id] = e.endTime
            ? { start: e.startTime, end: e.endTime }
            : { start: e.startTime };
        else if (e && q.answer_type === 'datetime')
          answers[q.id] = { date: e.event_date, time: e.startTime };
        break;
      case 'guest_count':
        if (e?.guest_count) answers[q.id] = e.guest_count;
        break;
      case 'venue':
        if (e?.venue_name) answers[q.id] = e.venue_name;
        break;
    }
  }
  return answers;
}
