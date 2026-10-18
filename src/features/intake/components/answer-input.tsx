import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import type { Answer, Question } from '@/lib/intake';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useCustomers } from '../../customers/api';
import { searchCustomers } from '../../customers/duplicates';

/** Zahl aus „65“, „65,5“ oder „65.5“; `null` bei ungültiger Eingabe. */
export function parseNumber(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

/**
 * Antwortfeld je Antworttyp in der Daumenzone des Chats (SC-17). Auswahl und Ja/Nein antworten sofort;
 * alle anderen Typen brauchen „Weiter“. Alle Eingaben sind für das Handy gebaut: Antippen statt Tastatur,
 * wo es geht.
 */
export function AnswerInput({
  question,
  initial,
  onSubmit,
  onSkip,
}: {
  question: Question;
  initial?: Answer;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | undefined>();

  const fail = (key: string) => setError(t(`intake.chat.errors.${key}`));
  const skip = onSkip ? (
    <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} />
  ) : null;

  switch (question.answer_type) {
    case 'single_choice':
      return (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {question.options.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                selected={initial === o.value}
                onPress={() => onSubmit(o.value)}
              />
            ))}
          </View>
          {skip}
        </View>
      );
    case 'boolean':
      return (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t('intake.chat.yes')}
                variant={initial === true ? 'primary' : 'secondary'}
                onPress={() => onSubmit(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('intake.chat.no')}
                variant={initial === false ? 'primary' : 'secondary'}
                onPress={() => onSubmit(false)}
              />
            </View>
          </View>
          {skip}
        </View>
      );
    case 'multi_choice':
      return (
        <MultiChoice
          question={question}
          initial={Array.isArray(initial) ? initial : []}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />
      );
    case 'number':
      return (
        <NumberInput
          question={question}
          initial={typeof initial === 'number' ? String(initial) : ''}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />
      );
    case 'text':
      return (
        <TextInput
          initial={typeof initial === 'string' ? initial : ''}
          required={question.is_required}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />
      );
    case 'date':
      return (
        <View style={{ gap: 8 }}>
          <DateField
            label={t('intake.chat.pickDate')}
            value={typeof initial === 'string' ? initial : ''}
            onChange={(d) => d && onSubmit(d)}
          />
          {skip}
        </View>
      );
    case 'time':
      return (
        <View style={{ gap: 8 }}>
          <TimeField
            label={t('intake.chat.pickTime')}
            value={typeof initial === 'string' ? initial : ''}
            onChange={(v) => v && onSubmit(v)}
          />
          {skip}
        </View>
      );
    case 'time_range':
      return (
        <TimeRange
          initial={
            initial && typeof initial === 'object' && !Array.isArray(initial) && 'start' in initial
              ? initial
              : null
          }
          onSubmit={onSubmit}
          onSkip={onSkip}
          fail={fail}
          error={error}
        />
      );
    case 'datetime':
      return (
        <DateTime
          initial={
            initial && typeof initial === 'object' && !Array.isArray(initial) && 'date' in initial
              ? initial
              : null
          }
          onSubmit={onSubmit}
          onSkip={onSkip}
          fail={fail}
          error={error}
        />
      );
    case 'customer':
      return <CustomerInput initial={initial} onSubmit={onSubmit} onSkip={onSkip} />;
  }
}

function MultiChoice({
  question,
  initial,
  onSubmit,
  onSkip,
}: {
  question: Question;
  initial: string[];
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>(initial);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {question.options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={picked.includes(o.value)}
            onPress={() =>
              setPicked((p) =>
                p.includes(o.value) ? p.filter((x) => x !== o.value) : [...p, o.value],
              )
            }
          />
        ))}
      </View>
      <Button label={t('intake.chat.next')} onPress={() => onSubmit(picked)} />
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

function NumberInput({
  question,
  initial,
  onSubmit,
  onSkip,
}: {
  question: Question;
  initial: string;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const integerOnly =
    question.target === 'guest_count' || question.target === 'dietary_requirements';
  const submit = () => {
    const n = parseNumber(text);
    if (n === null || (integerOnly && !Number.isInteger(n))) {
      setError(t(integerOnly ? 'intake.chat.errors.integer' : 'intake.chat.errors.number'));
      return;
    }
    onSubmit(n);
  };
  return (
    <View style={{ gap: 8 }}>
      <TextField
        label={t('intake.chat.yourAnswer')}
        value={text}
        onChangeText={setText}
        error={error}
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        keyboardType={integerOnly ? 'number-pad' : 'decimal-pad'}
        onSubmitEditing={submit}
      />
      <Button label={t('intake.chat.next')} onPress={submit} />
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

function TextInput({
  initial,
  required,
  onSubmit,
  onSkip,
}: {
  initial: string;
  required: boolean;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  return (
    <View style={{ gap: 8 }}>
      <TextField
        label={t('intake.chat.yourAnswer')}
        value={text}
        onChangeText={setText}
        error={error}
        multiline
      />
      <Button
        label={t('intake.chat.next')}
        onPress={() => {
          if (text.trim() === '' && required) {
            setError(t('intake.chat.errors.required'));
            return;
          }
          onSubmit(text.trim());
        }}
      />
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

function TimeRange({
  initial,
  onSubmit,
  onSkip,
  fail,
  error,
}: {
  initial: { start: string; end?: string } | null;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
  fail: (k: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');
  return (
    <View style={{ gap: 8 }}>
      <TimeField label={t('intake.chat.from')} value={start} onChange={setStart} />
      <TimeField
        label={t('intake.chat.to')}
        value={end}
        onChange={setEnd}
        optional
        defaultHour={14}
      />
      <Text variant="small" color="textTertiary">
        {t('events.form.endHint')}
      </Text>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label={t('intake.chat.next')}
        onPress={() => (start ? onSubmit(end ? { start, end } : { start }) : fail('start'))}
      />
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

function DateTime({
  initial,
  onSubmit,
  onSkip,
  fail,
  error,
}: {
  initial: { date: string; time: string } | null;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
  fail: (k: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  return (
    <View style={{ gap: 8 }}>
      <DateField label={t('intake.chat.pickDate')} value={date} onChange={setDate} />
      <TimeField label={t('intake.chat.pickTime')} value={time} onChange={setTime} />
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label={t('intake.chat.next')}
        onPress={() => (date && time ? onSubmit({ date, time }) : fail('datetime'))}
      />
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

/** Kunde suchen (ab 2 Zeichen) oder neu eintragen; neue Kunden entstehen erst beim Abschluss (docs/02 §11.2). */
function CustomerInput({
  initial,
  onSubmit,
  onSkip,
}: {
  initial?: Answer;
  onSubmit: (a: Answer) => void;
  onSkip?: () => void;
}) {
  const { t } = useTranslation();
  const customers = useCustomers();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'private' | 'business'>('private');
  const results = searchCustomers(customers.data ?? [], query).slice(0, 5);
  const q = query.trim();
  const current =
    initial && typeof initial === 'object' && !Array.isArray(initial) && 'customerId' in initial
      ? initial.name
      : null;
  return (
    <View style={{ gap: 8 }}>
      {current ? (
        <Text variant="small" color="textSecondary">
          {t('intake.chat.currentCustomer', { name: current })}
        </Text>
      ) : null}
      <TextField
        label={t('events.form.customerSearch')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {q.length >= 2
        ? results.map((c) => (
            <Button
              key={c.id}
              label={c.contact_person ? `${c.name} · ${c.contact_person}` : c.name}
              variant="secondary"
              onPress={() => onSubmit({ customerId: c.id, name: c.name })}
            />
          ))
        : null}
      {q.length >= 2 ? (
        <View
          style={{
            gap: 8,
            padding: tokens.space[3],
            ...surfaceStyle(),
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              label={t('customers.type.private')}
              selected={type === 'private'}
              onPress={() => setType('private')}
            />
            <Chip
              label={t('customers.type.business')}
              selected={type === 'business'}
              onPress={() => setType('business')}
            />
          </View>
          <Button
            label={t('events.form.customerCreate', { name: q })}
            onPress={() => onSubmit({ newCustomer: { name: q, type } })}
          />
        </View>
      ) : null}
      {onSkip ? <Button label={t('intake.chat.skip')} variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}
