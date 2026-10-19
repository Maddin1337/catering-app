import * as Haptics from 'expo-haptics';
import { Check, Minus, Plus, UserPlus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput as NativeInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import type { Answer, Question } from '@/lib/intake';
import { textStyles, tokens } from '@/theme/tokens';

import { useCustomers } from '../../customers/api';
import { searchCustomers } from '../../customers/duplicates';
import { OptionCard } from './option-card';

/** Zahl aus „65“, „65,5“ oder „65.5“; `null` bei ungültiger Eingabe. */
export function parseNumber(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

// Wie lange die gewählte Karte sichtbar bleibt, bevor es weitergeht.
const ADVANCE_MS = 260;
const GUEST_PRESETS = [20, 40, 60, 80, 100];
const START_PRESETS = ['12:00', '17:00', '18:00', '19:00'];
const MANY_OPTIONS = 7;

type Props = {
  question: Question;
  initial?: Answer;
  /** Meldet den aktuellen, gültigen Stand der Eingabe (`null`, solange etwas fehlt oder nicht stimmt). */
  onDraft: (a: Answer | null) => void;
  /** Auswahl, Ja/Nein und Kunde antworten sofort: Die Frage ist damit beantwortet. */
  onCommit: (a: Answer) => void;
};

/** Antwortfeld je Antworttyp im Anfrage-Chat (SC-17). Alles ist für das Handy gebaut: Antippen statt Tastatur. */
export function StepInput(props: Props) {
  switch (props.question.answer_type) {
    case 'single_choice':
      return <SingleChoice {...props} />;
    case 'boolean':
      return <YesNo {...props} />;
    case 'multi_choice':
      return <MultiChoice {...props} />;
    case 'number':
      return <NumberAnswer {...props} />;
    case 'text':
      return <TextAnswer {...props} />;
    case 'date':
      return <DateAnswer {...props} />;
    case 'time':
      return <TimeAnswer {...props} />;
    case 'time_range':
      return <TimeRangeAnswer {...props} />;
    case 'datetime':
      return <DateTimeAnswer {...props} />;
    case 'customer':
      return <CustomerAnswer {...props} />;
  }
}

/** Sofort-Antwort: Die Karte bleibt kurz markiert, dann geht es weiter; ein zweiter Tipp zählt nicht. */
function useAdvance<T>(commit: (a: T & Answer) => void) {
  const [picked, setPicked] = useState<unknown>(undefined);
  // Ein Ref statt Zustand: Zwei Tipps im selben Moment sehen beide „noch nichts gewählt“.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wer in der Wartezeit zurückgeht, soll nicht doch noch weitergeschickt werden.
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  return {
    picked,
    pick: (value: T & Answer) => {
      if (pending.current) return;
      setPicked(value);
      pending.current = setTimeout(() => commit(value), ADVANCE_MS);
    },
  };
}

function SingleChoice({ question, initial, onCommit }: Props) {
  const { picked, pick } = useAdvance<string>(onCommit);
  const current = picked ?? initial;
  if (question.options.length > MANY_OPTIONS) {
    return (
      <View style={styles.chips}>
        {question.options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={current === o.value}
            onPress={() => pick(o.value)}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.stack} accessibilityRole="radiogroup">
      {question.options.map((o) => (
        <OptionCard
          key={o.value}
          label={o.label}
          selected={current === o.value}
          onPress={() => pick(o.value)}
        />
      ))}
    </View>
  );
}

function YesNo({ initial, onCommit }: Props) {
  const { t } = useTranslation();
  const { picked, pick } = useAdvance<boolean>(onCommit);
  const current = picked ?? initial;
  return (
    <View style={styles.pair} accessibilityRole="radiogroup">
      <OptionCard
        compact
        icon={Check}
        label={t('intake.chat.yes')}
        selected={current === true}
        onPress={() => pick(true)}
      />
      <OptionCard
        compact
        icon={X}
        label={t('intake.chat.no')}
        selected={current === false}
        onPress={() => pick(false)}
      />
    </View>
  );
}

function MultiChoice({ question, initial, onDraft }: Props) {
  const [chosen, setChosen] = useState<string[]>(Array.isArray(initial) ? initial : []);
  const toggle = (v: string) => {
    const next = chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v];
    setChosen(next);
    onDraft(next.length > 0 ? next : null);
  };
  if (question.options.length > MANY_OPTIONS) {
    return (
      <View style={styles.chips}>
        {question.options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={chosen.includes(o.value)}
            onPress={() => toggle(o.value)}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      {question.options.map((o) => (
        <OptionCard
          key={o.value}
          indicator="check"
          label={o.label}
          selected={chosen.includes(o.value)}
          onPress={() => toggle(o.value)}
        />
      ))}
    </View>
  );
}

/**
 * Zahl groß in der Mitte, links und rechts − und +, darunter bei der Gästezahl Schnellwahl. Die Zahl
 * lässt sich auch antippen und eintippen.
 */
function NumberAnswer({ question, initial, onDraft }: Props) {
  const { t } = useTranslation();
  const integerOnly =
    question.target === 'guest_count' || question.target === 'dietary_requirements';
  // Eine Gästezahl von 0 ergäbe keinen Auftrag; alles andere darf 0 sein (z. B. „0 vegan“).
  const min = question.target === 'guest_count' ? 1 : 0;
  const [text, setText] = useState(typeof initial === 'number' ? String(initial) : '');
  const [error, setError] = useState<string | undefined>();

  const set = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      setError(undefined);
      onDraft(null);
      return;
    }
    const n = parseNumber(next);
    if (n === null || (integerOnly && !Number.isInteger(n))) {
      setError(t(integerOnly ? 'intake.chat.errors.integer' : 'intake.chat.errors.number'));
      onDraft(null);
      return;
    }
    if (n < min) {
      setError(t('intake.chat.errors.atLeastOne'));
      onDraft(null);
      return;
    }
    setError(undefined);
    onDraft(n);
  };
  const value = parseNumber(text);
  const step = (d: 1 | -1) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    set(String(Math.max(min, Math.round((value ?? 0) + d))));
  };

  return (
    <View style={styles.numberWrap}>
      <View style={styles.numberRow}>
        {integerOnly ? (
          <RoundButton
            icon={Minus}
            label={t('intake.chat.fewer')}
            disabled={(value ?? 0) <= min}
            onPress={() => step(-1)}
          />
        ) : null}
        <NativeInput
          accessibilityLabel={question.prompt}
          value={text}
          onChangeText={set}
          placeholder="0"
          placeholderTextColor={tokens.color.borderInput}
          inputMode={integerOnly ? 'numeric' : 'decimal'}
          keyboardType={integerOnly ? 'number-pad' : 'decimal-pad'}
          selectTextOnFocus
          style={styles.numberInput}
        />
        {integerOnly ? (
          <RoundButton icon={Plus} label={t('intake.chat.more')} onPress={() => step(1)} />
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert" style={styles.centered}>
          {error}
        </Text>
      ) : null}
      {question.target === 'guest_count' ? (
        <View style={[styles.chips, styles.centeredRow]}>
          {GUEST_PRESETS.map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={value === n}
              onPress={() => {
                if (Platform.OS !== 'web') void Haptics.selectionAsync();
                set(String(n));
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RoundButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      scale={0.92}
      style={[styles.round, disabled && styles.roundOff]}
    >
      <Icon color={tokens.color.text} size={24} strokeWidth={2.4} />
    </PressableScale>
  );
}

function TextAnswer({ initial, onDraft }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(typeof initial === 'string' ? initial : '');
  return (
    <TextField
      label={t('intake.chat.yourAnswer')}
      value={text}
      onChangeText={(v) => {
        setText(v);
        onDraft(v.trim() === '' ? null : v.trim());
      }}
      multiline
      autoFocus
    />
  );
}

function DateAnswer({ initial, onDraft }: Props) {
  const { t } = useTranslation();
  const [date, setDate] = useState(typeof initial === 'string' ? initial : '');
  return (
    <DateField
      variant="card"
      label={t('intake.chat.pickDate')}
      value={date}
      onChange={(d) => {
        setDate(d);
        onDraft(d || null);
      }}
    />
  );
}

function TimeAnswer({ initial, onDraft }: Props) {
  const { t } = useTranslation();
  const [time, setTime] = useState(typeof initial === 'string' ? initial : '');
  const set = (v: string) => {
    setTime(v);
    onDraft(v || null);
  };
  return (
    <View style={styles.stack}>
      <TimeField variant="card" label={t('intake.chat.pickTime')} value={time} onChange={set} />
      <StartPresets value={time} onPick={set} />
    </View>
  );
}

function StartPresets({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {START_PRESETS.map((p) => (
        <Chip
          key={p}
          label={p}
          selected={value === p}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync();
            onPick(p);
          }}
        />
      ))}
    </View>
  );
}

function TimeRangeAnswer({ initial, onDraft }: Props) {
  const { t } = useTranslation();
  const given =
    initial && typeof initial === 'object' && !Array.isArray(initial) && 'start' in initial
      ? initial
      : null;
  const [start, setStart] = useState(given?.start ?? '');
  const [end, setEnd] = useState(given?.end ?? '');
  const report = (s: string, e: string) =>
    onDraft(s ? (e ? { start: s, end: e } : { start: s }) : null);
  return (
    <View style={styles.stack}>
      <TimeField
        variant="card"
        label={t('intake.chat.from')}
        value={start}
        onChange={(v) => {
          setStart(v);
          report(v, end);
        }}
      />
      <StartPresets
        value={start}
        onPick={(v) => {
          setStart(v);
          report(v, end);
        }}
      />
      <TimeField
        variant="card"
        label={t('intake.chat.to')}
        value={end}
        optional
        defaultHour={14}
        onChange={(v) => {
          setEnd(v);
          report(start, v);
        }}
      />
      <Text variant="small" color="textTertiary">
        {t('events.form.endHint')}
      </Text>
    </View>
  );
}

function DateTimeAnswer({ initial, onDraft }: Props) {
  const { t } = useTranslation();
  const given =
    initial && typeof initial === 'object' && !Array.isArray(initial) && 'date' in initial
      ? initial
      : null;
  const [date, setDate] = useState(given?.date ?? '');
  const [time, setTime] = useState(given?.time ?? '');
  const report = (d: string, v: string) => onDraft(d && v ? { date: d, time: v } : null);
  return (
    <View style={styles.stack}>
      <DateField
        variant="card"
        label={t('intake.chat.pickDate')}
        value={date}
        onChange={(d) => {
          setDate(d);
          report(d, time);
        }}
      />
      <TimeField
        variant="card"
        label={t('intake.chat.pickTime')}
        value={time}
        onChange={(v) => {
          setTime(v);
          report(date, v);
        }}
      />
    </View>
  );
}

/** Kunde suchen (ab 2 Zeichen) oder neu eintragen; neue Kunden entstehen erst beim Abschluss (docs/02 §11.2). */
function CustomerAnswer({ initial, onCommit }: Props) {
  const { t } = useTranslation();
  const customers = useCustomers();
  const { picked, pick } = useAdvance<Answer>(onCommit);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'private' | 'business'>('private');
  const q = query.trim();
  const results = q.length >= 2 ? searchCustomers(customers.data ?? [], query).slice(0, 5) : [];
  const current =
    initial && typeof initial === 'object' && !Array.isArray(initial) && 'customerId' in initial
      ? initial
      : null;
  // Ein früher neu eingetragener Kunde (entsteht erst beim Abschluss) bleibt hier wählbar.
  const created =
    initial && typeof initial === 'object' && !Array.isArray(initial) && 'newCustomer' in initial
      ? initial
      : null;
  const chosenId =
    picked && typeof picked === 'object' && !Array.isArray(picked) && 'customerId' in picked
      ? picked.customerId
      : current?.customerId;

  return (
    <View style={styles.stack}>
      <TextField
        label={t('events.form.customerSearch')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoFocus={!current && !created}
      />
      {current && q.length < 2 ? (
        <PersonRow
          name={current.name}
          selected
          onPress={() => pick({ customerId: current.customerId, name: current.name })}
        />
      ) : null}
      {created && q.length < 2 ? (
        <PersonRow
          name={created.newCustomer.name}
          detail={t(`customers.type.${created.newCustomer.type}`)}
          selected
          onPress={() => pick(created)}
        />
      ) : null}
      {q.length < 2 && !current && !created ? (
        <Text variant="small" color="textTertiary">
          {t('intake.chat.searchHint')}
        </Text>
      ) : null}
      {results.map((c) => (
        <PersonRow
          key={c.id}
          name={c.name}
          detail={c.contact_person ?? undefined}
          selected={chosenId === c.id}
          onPress={() => pick({ customerId: c.id, name: c.name })}
        />
      ))}
      {q.length >= 2 ? (
        <Animated.View entering={ZoomIn.duration(tokens.motion.base)} style={styles.newBox}>
          <SegmentedTabs
            items={[
              { key: 'private', label: t('customers.type.private') },
              { key: 'business', label: t('customers.type.business') },
            ]}
            active={type}
            onChange={setType}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('events.form.customerCreate', { name: q })}
            onPress={() => pick({ newCustomer: { name: q, type } })}
            scale={0.98}
            style={styles.newRow}
          >
            <View style={styles.newIcon}>
              <UserPlus color={tokens.color.accent} size={20} strokeWidth={2.2} />
            </View>
            <Text variant="bodyStrong" color="accent" style={styles.newText} numberOfLines={2}>
              {t('events.form.customerCreate', { name: q })}
            </Text>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

function PersonRow({
  name,
  detail,
  selected,
  onPress,
}: {
  name: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={detail ? `${name}, ${detail}` : name}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      scale={0.98}
      style={[styles.person, selected && styles.personOn]}
    >
      <Avatar name={name} size={44} />
      <View style={styles.personTexts}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Check color={tokens.color.accent} size={20} strokeWidth={3} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.space[3] },
  pair: { flexDirection: 'row', gap: tokens.space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  centeredRow: { justifyContent: 'center' },
  centered: { textAlign: 'center' },
  numberWrap: { gap: tokens.space[5], paddingTop: tokens.space[4] },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[4],
  },
  numberInput: {
    ...textStyles.display,
    fontSize: 56,
    lineHeight: 64,
    minWidth: 110,
    maxWidth: 200,
    textAlign: 'center',
    color: tokens.color.text,
    outlineWidth: 0,
    padding: 0,
  },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg,
    boxShadow: tokens.shadow.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  roundOff: { opacity: 0.4 },
  person: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.color.bg,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
  },
  personOn: { borderColor: tokens.color.accent, backgroundColor: tokens.color.accentSubtle },
  personTexts: { flex: 1, gap: 1 },
  newBox: {
    gap: tokens.space[3],
    padding: tokens.space[3],
    borderRadius: tokens.radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.accent,
  },
  newRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  newIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accentSubtle,
  },
  newText: { flex: 1 },
});
