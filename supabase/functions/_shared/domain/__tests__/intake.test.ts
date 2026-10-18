import {
  answerText,
  buildResult,
  pruneAnswers,
  targetsFor,
  validateQuestion,
  visibleQuestions,
  type Answers,
  type Question,
} from '../intake';

const q = (n: number, p: Partial<Question>): Question => ({
  id: `q${n}`,
  sort_order: n,
  prompt: `Frage ${n}`,
  help_text: null,
  answer_type: 'text',
  options: [],
  is_required: false,
  target: null,
  target_config: null,
  show_if: null,
  ...p,
});

// verkürzter Standardkatalog (docs/03 §3.7)
const catalog: Question[] = [
  q(1, {
    prompt: 'Für wen ist die Anfrage?',
    answer_type: 'customer',
    target: 'customer',
    is_required: true,
  }),
  q(2, {
    prompt: 'Was ist es?',
    answer_type: 'single_choice',
    target: 'event_kind',
    is_required: true,
    options: [
      { value: 'event_catering', label: 'Event-Catering' },
      { value: 'business_lunch', label: 'Business-Lunch' },
    ],
  }),
  q(3, {
    prompt: 'Welcher Anlass?',
    answer_type: 'single_choice',
    target: 'occasion',
    options: [
      { value: 'Hochzeit', label: 'Hochzeit' },
      { value: 'Firmenfeier', label: 'Firmenfeier' },
    ],
    show_if: { question_id: 'q2', operator: 'equals', value: 'event_catering' },
  }),
  q(4, { prompt: 'An welchem Tag?', answer_type: 'date', target: 'starts_at', is_required: true }),
  q(5, {
    prompt: 'Von wann bis wann?',
    answer_type: 'time_range',
    target: 'starts_at',
    is_required: true,
  }),
  q(6, { prompt: 'Wie viele Gäste?', answer_type: 'number', target: 'guest_count' }),
  q(7, { prompt: 'Wo findet es statt?', answer_type: 'text', target: 'venue' }),
  q(8, {
    prompt: 'Gibt es vor Ort eine Küche?',
    answer_type: 'boolean',
    target: 'kitchen_notes',
    show_if: { question_id: 'q2', operator: 'equals', value: 'event_catering' },
  }),
  q(10, { prompt: 'Sind Sonderessen bekannt?', answer_type: 'boolean' }),
  q(11, {
    prompt: 'Wie viele vegetarisch?',
    answer_type: 'number',
    target: 'dietary_requirements',
    target_config: { diet: 'vegetarian' },
    show_if: { question_id: 'q10', operator: 'is_true' },
  }),
  q(15, { prompt: 'Budget pro Person?', answer_type: 'number' }),
  q(16, {
    prompt: 'Ihre Referenz?',
    answer_type: 'text',
    target: 'customer_reference',
    show_if: { question_id: 'q2', operator: 'equals', value: 'business_lunch' },
  }),
];

const hochzeit: Answers = {
  q1: { customerId: 'c1', name: 'Müller GmbH' },
  q2: 'event_catering',
  q3: 'Hochzeit',
  q4: '2026-11-14',
  q5: { start: '18:00', end: '02:00' },
  q6: 80,
  q7: 'Gutshof Berlin',
  q8: false,
  q10: true,
  q11: 12,
  q15: 65,
};

describe('Verzweigung', () => {
  it('zeigt bei Event-Catering den Anlass und die Küchenfrage, aber nicht die Referenz', () => {
    const ids = visibleQuestions(catalog, { q2: 'event_catering' }).map((x) => x.id);
    expect(ids).toContain('q3');
    expect(ids).toContain('q8');
    expect(ids).not.toContain('q16');
  });
  it('zeigt bei Business-Lunch die Referenz, aber nicht den Anlass', () => {
    const ids = visibleQuestions(catalog, { q2: 'business_lunch' }).map((x) => x.id);
    expect(ids).toContain('q16');
    expect(ids).not.toContain('q3');
  });
  it('blendet Sonderessen-Folgefragen erst nach „Ja“ ein', () => {
    expect(visibleQuestions(catalog, { q10: false }).map((x) => x.id)).not.toContain('q11');
    expect(visibleQuestions(catalog, { q10: true }).map((x) => x.id)).toContain('q11');
  });
  it('wirft Antworten weg, deren Bedingung nicht mehr gilt, auch verkettet', () => {
    const r = pruneAnswers(catalog, { ...hochzeit, q2: 'business_lunch' });
    expect(r.dropped.sort()).toEqual(['q3', 'q8']);
    expect(r.answers.q3).toBeUndefined();
    const chain = pruneAnswers(catalog, { q10: false, q11: 3 });
    expect(chain.dropped).toEqual(['q11']);
  });
  it('unterstützt die Operatoren in, not_equals, gt und lt', () => {
    const cats = [
      q(1, { answer_type: 'number' }),
      q(2, { show_if: { question_id: 'q1', operator: 'gt', value: 50 } }),
      q(3, { show_if: { question_id: 'q1', operator: 'lt', value: 10 } }),
      q(4, { answer_type: 'single_choice', options: [{ value: 'a', label: 'A' }] }),
      q(5, { show_if: { question_id: 'q4', operator: 'in', value: ['a', 'b'] } }),
      q(6, { show_if: { question_id: 'q4', operator: 'not_equals', value: 'a' } }),
    ];
    expect(visibleQuestions(cats, { q1: 80, q4: 'a' }).map((x) => x.id)).toEqual([
      'q1',
      'q2',
      'q4',
      'q5',
    ]);
    expect(visibleQuestions(cats, { q1: 5, q4: 'c' }).map((x) => x.id)).toEqual([
      'q1',
      'q3',
      'q4',
      'q6',
    ]);
  });
});

describe('Feldzuordnung', () => {
  const r = buildResult(catalog, hochzeit, {
    now: new Date('2026-10-18T10:00:00Z'),
    kindLabels: { event_catering: 'Event-Catering' },
  });

  it('füllt die Felder des Auftrags', () => {
    expect(r.customer).toEqual({ id: 'c1' });
    expect(r.event.kind).toBe('event_catering');
    expect(r.event.occasion).toBe('Hochzeit');
    expect(r.event.guest_count).toBe(80);
    expect(r.event.venue_name).toBe('Gutshof Berlin');
    expect(r.schedule).toEqual({ date: '2026-11-14', start: '18:00', end: '02:00' });
  });
  it('macht aus „Sonderessen vegetarisch: 12“ einen Eintrag und aus Notizfragen Zeilen', () => {
    expect(r.dietary).toEqual([
      { person_count: 12, diet: 'vegetarian', avoid_allergens: [], note: 'aus Anfrage' },
    ]);
    expect(r.event.kitchen_notes).toBe('Gibt es vor Ort eine Küche?: Nein');
    expect(r.event.internal_notes).toContain('Angebots-Chat – Sind Sonderessen bekannt?: Ja');
    expect(r.event.internal_notes).toContain('Angebots-Chat – Budget pro Person?: 65');
  });
  it('schlägt „Anlass Kunde“ als Titel vor', () => {
    expect(r.titleSuggestion).toBe('Hochzeit Müller GmbH');
  });
  it('speichert alle Antworten mit Fragetext', () => {
    expect(r.intakeAnswers.find((a) => a.question_id === 'q6')).toEqual({
      question_id: 'q6',
      prompt: 'Wie viele Gäste?',
      answer: 80,
      target: 'guest_count',
      answered_at: '2026-10-18T10:00:00.000Z',
    });
  });
  it('nimmt bei Business-Lunch den Art-Namen im Titel und die Referenz in die Notizen', () => {
    const b = buildResult(
      catalog,
      {
        q1: { newCustomer: { name: 'Kanzlei Neumann', type: 'business' } },
        q2: 'business_lunch',
        q4: '2026-11-03',
        q5: { start: '12:00' },
        q16: 'KST 4711',
      },
      { kindLabels: { business_lunch: 'Business-Lunch' } },
    );
    expect(b.titleSuggestion).toBe('Business-Lunch Kanzlei Neumann');
    expect(b.customer).toEqual({ name: 'Kanzlei Neumann', type: 'business' });
    expect(b.event.internal_notes).toBe('Ihre Referenz: KST 4711');
    expect(b.schedule.end).toBeNull();
  });
  it('meldet fehlende Pflichtangaben und zu viele Sonderessen', () => {
    expect(buildResult(catalog, {}).problems).toEqual([
      'missing_customer',
      'missing_date',
      'missing_start',
    ]);
    const many = buildResult(catalog, { ...hochzeit, q6: 10, q11: 12 });
    expect(many.problems).toContain('dietary_exceeds_guests');
  });
  it('lässt Antworten verworfener Fragen aus und ignoriert 0 bei Sonderessen', () => {
    const z = buildResult(catalog, { ...hochzeit, q10: true, q11: 0 });
    expect(z.dietary).toEqual([]);
    const v = buildResult(catalog, { ...hochzeit, q2: 'business_lunch' });
    expect(v.event.occasion).toBeNull();
  });
  it('trägt Datum und Uhrzeit auch aus getrennten Fragen zusammen (datetime, time)', () => {
    const cats = [
      q(1, { answer_type: 'datetime', target: 'starts_at' }),
      q(2, { answer_type: 'time', target: 'ends_at' }),
    ];
    const r2 = buildResult(cats, { q1: { date: '2026-12-24', time: '17:00' }, q2: '23:00' });
    expect(r2.schedule).toEqual({ date: '2026-12-24', start: '17:00', end: '23:00' });
  });
});

describe('Anzeige', () => {
  it('zeigt Datum deutsch und Auswahl mit Beschriftung', () => {
    expect(answerText(catalog[3]!, '2026-11-14')).toBe('14.11.2026');
    expect(answerText(catalog[1]!, 'business_lunch')).toBe('Business-Lunch');
    expect(answerText(catalog[7]!, true)).toBe('Ja');
    expect(answerText(catalog[4]!, { start: '18:00', end: '02:00' })).toBe('18:00–02:00');
  });
});

describe('Prüfung des Fragenkatalogs', () => {
  const all = [
    { id: 'a', sort_order: 1 },
    { id: 'b', sort_order: 2 },
  ];
  const base = {
    prompt: 'X',
    answer_type: 'text' as const,
    options: [],
    target: null,
    target_config: null,
    show_if: null,
    sort_order: 3,
  };
  it('verlangt Fragetext und bei Auswahl mindestens eine Option', () => {
    expect(validateQuestion({ ...base, prompt: ' ' }, all)).toContain('prompt_missing');
    expect(validateQuestion({ ...base, answer_type: 'single_choice' }, all)).toContain(
      'options_missing',
    );
    expect(
      validateQuestion(
        { ...base, answer_type: 'single_choice', options: [{ value: 'x', label: 'X' }] },
        all,
      ),
    ).toEqual([]);
  });
  it('lässt nur passende Zuordnungen zu', () => {
    expect(validateQuestion({ ...base, target: 'guest_count' }, all)).toContain(
      'target_incompatible',
    );
    expect(
      validateQuestion({ ...base, answer_type: 'number', target: 'guest_count' }, all),
    ).toEqual([]);
    expect(targetsFor('number')).toEqual(['guest_count', 'dietary_requirements']);
  });
  it('verlangt bei Sonderessen eine Diätform oder Allergene', () => {
    expect(
      validateQuestion({ ...base, answer_type: 'number', target: 'dietary_requirements' }, all),
    ).toContain('diet_missing');
    expect(
      validateQuestion(
        {
          ...base,
          answer_type: 'number',
          target: 'dietary_requirements',
          target_config: { diet: 'vegan' },
        },
        all,
      ),
    ).toEqual([]);
  });
  it('erlaubt Bedingungen nur auf frühere Fragen', () => {
    expect(
      validateQuestion({ ...base, show_if: { question_id: 'a', operator: 'is_true' } }, all),
    ).toEqual([]);
    expect(
      validateQuestion(
        { ...base, sort_order: 1, show_if: { question_id: 'b', operator: 'is_true' } },
        all,
      ),
    ).toContain('show_if_invalid');
    expect(
      validateQuestion({ ...base, show_if: { question_id: 'zzz', operator: 'is_true' } }, all),
    ).toContain('show_if_invalid');
  });
});
