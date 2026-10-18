// Angebots-Chat (docs/02 §11): sichtbare Fragen, Feldzuordnung und Prüfung des Fragenkatalogs.
// Reines TypeScript ohne Abhängigkeiten; App und Edge Functions nutzen dieselbe Datei.

export type AnswerType =
  | 'single_choice'
  | 'multi_choice'
  | 'number'
  | 'date'
  | 'time'
  | 'time_range'
  | 'datetime'
  | 'text'
  | 'boolean'
  | 'customer';

export type Target =
  | 'customer'
  | 'event_kind'
  | 'occasion'
  | 'starts_at'
  | 'ends_at'
  | 'guest_count'
  | 'venue'
  | 'dietary_requirements'
  | 'kitchen_notes'
  | 'staff_notes'
  | 'customer_reference';

export type ShowIf = {
  question_id: string;
  operator: 'equals' | 'in' | 'not_equals' | 'gt' | 'lt' | 'is_true';
  value?: string | number | boolean | (string | number)[];
};

export type Question = {
  id: string;
  sort_order: number;
  prompt: string;
  help_text: string | null;
  answer_type: AnswerType;
  options: { value: string; label: string }[];
  is_required: boolean;
  target: Target | null;
  target_config: { diet?: string; allergens?: string[] } | null;
  show_if: ShowIf | null;
};

/** Antwort je Antworttyp. Eine übersprungene Frage hat keinen Eintrag. */
export type Answer =
  | string // single_choice (Wert), date (YYYY-MM-DD), time (HH:mm), text
  | string[] // multi_choice
  | number // number
  | boolean // boolean
  | { start: string; end?: string } // time_range
  | { date: string; time: string } // datetime
  | { customerId: string; name: string } // customer, bestehend
  | { newCustomer: { name: string; type: 'business' | 'private' } }; // customer, neu

export type Answers = Record<string, Answer | undefined>;

// ---------- Bedingungen ----------

function matches(cond: ShowIf, answer: Answer | undefined): boolean {
  if (answer === undefined) return cond.operator === 'not_equals';
  const list = Array.isArray(answer) ? answer : [answer];
  switch (cond.operator) {
    case 'equals':
      return list.some((a) => a === cond.value);
    case 'not_equals':
      return !list.some((a) => a === cond.value);
    case 'in': {
      const wanted = Array.isArray(cond.value) ? cond.value : [cond.value];
      return list.some((a) => wanted.includes(a as string | number));
    }
    case 'gt':
      return typeof answer === 'number' && typeof cond.value === 'number' && answer > cond.value;
    case 'lt':
      return typeof answer === 'number' && typeof cond.value === 'number' && answer < cond.value;
    case 'is_true':
      return answer === true;
  }
}

/** Aktive Fragen in Reihenfolge, deren Bedingung erfüllt ist. Die Bedingung bezieht sich nur auf frühere Fragen. */
export function visibleQuestions(questions: Question[], answers: Answers): Question[] {
  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
  const visible: Question[] = [];
  const visibleIds = new Set<string>();
  for (const q of sorted) {
    const cond = q.show_if;
    const ok =
      !cond || (visibleIds.has(cond.question_id) && matches(cond, answers[cond.question_id]));
    if (ok) {
      visible.push(q);
      visibleIds.add(q.id);
    }
  }
  return visible;
}

/** Antworten auf Fragen, die nicht mehr sichtbar sind, entfallen („2 Antworten entfallen“). */
export function pruneAnswers(
  questions: Question[],
  answers: Answers,
): { answers: Answers; dropped: string[] } {
  const ids = new Set(visibleQuestions(questions, answers).map((q) => q.id));
  const kept: Answers = {};
  const dropped: string[] = [];
  for (const [id, a] of Object.entries(answers)) {
    if (a === undefined) continue;
    if (ids.has(id)) kept[id] = a;
    else dropped.push(id);
  }
  // Das Weglassen kann weitere Bedingungen kippen: bis zum stabilen Stand wiederholen.
  if (dropped.length > 0) {
    const again = pruneAnswers(questions, kept);
    return { answers: again.answers, dropped: [...dropped, ...again.dropped] };
  }
  return { answers: kept, dropped };
}

// ---------- Anzeige ----------

const germanDate = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');

export function answerText(
  q: Question,
  a: Answer,
  labels: { yes: string; no: string } = { yes: 'Ja', no: 'Nein' },
): string {
  if (typeof a === 'boolean') return a ? labels.yes : labels.no;
  if (typeof a === 'number') return String(a);
  if (typeof a === 'string') {
    if (q.answer_type === 'single_choice') return q.options.find((o) => o.value === a)?.label ?? a;
    if (q.answer_type === 'date') return germanDate(a);
    return a;
  }
  if (Array.isArray(a))
    return a.map((v) => q.options.find((o) => o.value === v)?.label ?? v).join(', ');
  if ('start' in a) return a.end ? `${a.start}–${a.end}` : a.start;
  if ('date' in a) return `${germanDate(a.date)} ${a.time}`;
  if ('customerId' in a) return a.name;
  return a.newCustomer.name;
}

// ---------- Zuordnung ----------

export type IntakeResult = {
  customer: { id: string } | { name: string; type: 'business' | 'private' } | null;
  event: {
    kind: 'event_catering' | 'business_lunch';
    occasion: string | null;
    guest_count: number | null;
    venue_name: string | null;
    kitchen_notes: string | null;
    staff_notes: string | null;
    internal_notes: string | null;
  };
  /** Datum und Uhrzeiten in Ortszeit; die App rechnet in Zeitstempel um (Ende vor Beginn = Folgetag). */
  schedule: { date: string | null; start: string | null; end: string | null };
  dietary: { person_count: number; diet: string | null; avoid_allergens: string[]; note: string }[];
  /** Sammelt Hinweise: Sonderessen über der Gästezahl, fehlende Pflichtangaben. */
  problems: ('dietary_exceeds_guests' | 'missing_customer' | 'missing_date' | 'missing_start')[];
  intakeAnswers: {
    question_id: string;
    prompt: string;
    answer: Answer;
    target: Target | null;
    answered_at: string;
  }[];
  titleSuggestion: string;
};

const line = (parts: string[]) => (parts.length > 0 ? parts.join('\n') : null);

export function buildResult(
  questions: Question[],
  rawAnswers: Answers,
  options: {
    now?: Date;
    kindLabels?: Record<string, string>;
    labels?: { yes: string; no: string };
  } = {},
): IntakeResult {
  const { answers } = pruneAnswers(questions, rawAnswers);
  const visible = visibleQuestions(questions, answers);
  const now = (options.now ?? new Date()).toISOString();
  const labels = options.labels ?? { yes: 'Ja', no: 'Nein' };

  const out: IntakeResult = {
    customer: null,
    event: {
      kind: 'event_catering',
      occasion: null,
      guest_count: null,
      venue_name: null,
      kitchen_notes: null,
      staff_notes: null,
      internal_notes: null,
    },
    schedule: { date: null, start: null, end: null },
    dietary: [],
    problems: [],
    intakeAnswers: [],
    titleSuggestion: '',
  };
  const kitchen: string[] = [];
  const staff: string[] = [];
  const internal: string[] = [];
  let occasionLabel = '';

  for (const q of visible) {
    const a = answers[q.id];
    if (a === undefined) continue;
    out.intakeAnswers.push({
      question_id: q.id,
      prompt: q.prompt,
      answer: a,
      target: q.target,
      answered_at: now,
    });
    const text = answerText(q, a, labels);

    switch (q.target) {
      case 'customer':
        if (typeof a === 'object' && !Array.isArray(a)) {
          if ('customerId' in a) out.customer = { id: a.customerId };
          else if ('newCustomer' in a) out.customer = a.newCustomer;
        }
        break;
      case 'event_kind':
        if (a === 'event_catering' || a === 'business_lunch') out.event.kind = a;
        break;
      case 'occasion':
        out.event.occasion = text;
        occasionLabel = text;
        break;
      case 'starts_at':
      case 'ends_at':
        if (typeof a === 'string' && q.answer_type === 'date') out.schedule.date = a;
        else if (typeof a === 'string' && q.answer_type === 'time') {
          if (q.target === 'starts_at') out.schedule.start = a;
          else out.schedule.end = a;
        } else if (typeof a === 'object' && !Array.isArray(a) && 'start' in a) {
          out.schedule.start = a.start;
          if (a.end) out.schedule.end = a.end;
        } else if (typeof a === 'object' && !Array.isArray(a) && 'date' in a) {
          if (q.target === 'starts_at') {
            out.schedule.date = a.date;
            out.schedule.start = a.time;
          } else out.schedule.end = a.time;
        }
        break;
      case 'guest_count':
        if (typeof a === 'number' && Number.isInteger(a) && a >= 1) out.event.guest_count = a;
        break;
      case 'venue':
        if (typeof a === 'string') out.event.venue_name = a;
        break;
      case 'dietary_requirements':
        if (typeof a === 'number' && a > 0) {
          out.dietary.push({
            person_count: a,
            diet: q.target_config?.diet ?? null,
            avoid_allergens: q.target_config?.allergens ?? [],
            note: 'aus Anfrage',
          });
        }
        break;
      case 'kitchen_notes':
        kitchen.push(`${q.prompt}: ${text}`);
        break;
      case 'staff_notes':
        staff.push(`${q.prompt}: ${text}`);
        break;
      case 'customer_reference':
        // Das Angebot (M4/M5) übernimmt die Referenz später; bis dahin steht sie in den Notizen.
        internal.push(`Ihre Referenz: ${text}`);
        break;
      default:
        internal.push(`Angebots-Chat – ${q.prompt}: ${text}`);
    }
  }

  out.event.kitchen_notes = line(kitchen);
  out.event.staff_notes = line(staff);
  out.event.internal_notes = line(internal);

  if (!out.customer) out.problems.push('missing_customer');
  if (!out.schedule.date) out.problems.push('missing_date');
  if (!out.schedule.start) out.problems.push('missing_start');
  const dietTotal = out.dietary.reduce((s, d) => s + d.person_count, 0);
  if (out.event.guest_count !== null && dietTotal > out.event.guest_count)
    out.problems.push('dietary_exceeds_guests');

  const customerName = out.customer
    ? 'id' in out.customer
      ? customerNameFrom(answers, questions)
      : out.customer.name
    : '';
  const base = occasionLabel || options.kindLabels?.[out.event.kind] || out.event.kind;
  out.titleSuggestion = [base, customerName].filter(Boolean).join(' ');
  return out;
}

function customerNameFrom(answers: Answers, questions: Question[]): string {
  for (const q of questions) {
    const a = answers[q.id];
    if (
      q.target === 'customer' &&
      a &&
      typeof a === 'object' &&
      !Array.isArray(a) &&
      'customerId' in a
    )
      return a.name;
  }
  return '';
}

// ---------- Prüfung des Katalogs (beim Speichern einer Frage) ----------

/** Welche Antworttypen zu welcher Zuordnung passen (docs/02 §11.2). `null` = Notiz: jeder Typ. */
export const COMPATIBLE: Record<Target, AnswerType[]> = {
  customer: ['customer'],
  event_kind: ['single_choice'],
  occasion: ['single_choice', 'text'],
  starts_at: ['date', 'time', 'time_range', 'datetime'],
  ends_at: ['time', 'datetime'],
  guest_count: ['number'],
  venue: ['text'],
  dietary_requirements: ['number'],
  kitchen_notes: ['text', 'boolean', 'multi_choice'],
  staff_notes: ['text', 'boolean'],
  customer_reference: ['text'],
};

export function targetsFor(type: AnswerType): Target[] {
  return (Object.keys(COMPATIBLE) as Target[]).filter((t) => COMPATIBLE[t].includes(type));
}

export type QuestionProblem =
  'prompt_missing' | 'options_missing' | 'target_incompatible' | 'diet_missing' | 'show_if_invalid';

export function validateQuestion(
  q: Pick<
    Question,
    'prompt' | 'answer_type' | 'options' | 'target' | 'target_config' | 'show_if' | 'sort_order'
  > & { id?: string },
  all: Pick<Question, 'id' | 'sort_order'>[],
): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  if (q.prompt.trim() === '') problems.push('prompt_missing');
  if (
    (q.answer_type === 'single_choice' || q.answer_type === 'multi_choice') &&
    q.options.filter((o) => o.label.trim() !== '').length < 1
  ) {
    problems.push('options_missing');
  }
  if (q.target && !COMPATIBLE[q.target].includes(q.answer_type))
    problems.push('target_incompatible');
  if (
    q.target === 'dietary_requirements' &&
    !q.target_config?.diet &&
    !(q.target_config?.allergens?.length ?? 0)
  ) {
    problems.push('diet_missing');
  }
  if (q.show_if) {
    const ref = all.find((x) => x.id === q.show_if!.question_id);
    // nur auf eine frühere Frage (keine Zyklen)
    if (!ref || ref.sort_order >= q.sort_order || ref.id === q.id) problems.push('show_if_invalid');
  }
  return problems;
}
