import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SkeletonList } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { transition } from '@/components/ui/transition';
import { berlinToIso, endIso, formatGermanDate, isoToBerlin } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import { toAppError } from '@/lib/errors';
import {
  answerText,
  buildResult,
  pruneAnswers,
  visibleQuestions,
  type Answer,
  type Answers,
  type Question,
} from '@/lib/intake';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useCustomers } from '../../customers/api';
import { useEvent } from '../../events/api';
import { useCreateEventFromIntake, useIntakeQuestions, type IntakePayload } from '../api';
import { AnswerInput } from '../components/answer-input';
import { prefillAnswers } from '../prefill';

/** SC-17 Angebots-Chat: geführte Erfassung einer Anfrage mit deinem eigenen Fragenkatalog, ohne KI. */
export function IntakeChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { eventId, customerId, test } = useLocalSearchParams<{
    eventId?: string;
    customerId?: string;
    test?: string;
  }>();
  const questions = useIntakeQuestions();
  const customers = useCustomers();
  const existing = useEvent(eventId).data;

  const loading = questions.isPending || customers.isPending || (!!eventId && !existing);
  const active = (questions.data ?? []).filter((q) => !q.archived_at);

  if (loading) {
    return (
      <View style={styles.center}>
        <SkeletonList rows={3} />
      </View>
    );
  }
  if (active.length === 0) {
    return (
      <View style={styles.center}>
        <Banner tone="info">{t('intake.chat.noQuestions')}</Banner>
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const customer = existing?.customer_id
    ? { id: existing.customer_id, name: existing.customer_name ?? '' }
    : customerId
      ? (() => {
          const c = customers.data?.find((x) => x.id === customerId);
          return c ? { id: c.id, name: c.name } : null;
        })()
      : null;
  const start = existing ? isoToBerlin(existing.starts_at) : null;
  const end = existing?.ends_at ? isoToBerlin(existing.ends_at) : null;

  return (
    <Chat
      key={eventId ?? customerId ?? 'new'}
      questions={active}
      initialAnswers={prefillAnswers(active, {
        customer,
        event:
          existing && start
            ? {
                kind: existing.kind,
                occasion: existing.occasion,
                event_date: start.date,
                guest_count: existing.guest_count,
                venue_name: existing.venue_name,
                startTime: start.time,
                endTime: end?.time ?? null,
              }
            : null,
      })}
      eventId={eventId}
      testRun={test === '1'}
    />
  );
}

function Chat({
  questions,
  initialAnswers,
  eventId,
  testRun,
}: {
  questions: Question[];
  initialAnswers: Answers;
  eventId?: string;
  testRun: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const create = useCreateEventFromIntake();
  const scroll = useRef<ScrollViewInstance>(null);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [dropped, setDropped] = useState(0);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  const visible = visibleQuestions(questions, answers);
  const current = visible.find((q) => answers[q.id] === undefined && !skipped.includes(q.id));
  const inputQuestion = editing ? visible.find((q) => q.id === editing) : current;
  const shown = visible.filter(
    (q) => answers[q.id] !== undefined || skipped.includes(q.id) || q.id === current?.id,
  );
  const done = !current && !editing;
  const index = inputQuestion
    ? visible.findIndex((q) => q.id === inputQuestion.id) + 1
    : visible.length;

  const labels = { yes: t('intake.chat.yes'), no: t('intake.chat.no') };
  const kindLabels = {
    event_catering: t('events.kind.event_catering'),
    business_lunch: t('events.kind.business_lunch'),
  };
  const result = buildResult(questions, answers, { kindLabels, labels });
  const title = titleDraft ?? result.titleSuggestion;

  const scrollDown = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);

  const submit = (q: Question, a: Answer) => {
    const next = { ...answers, [q.id]: a };
    const pruned = pruneAnswers(questions, next);
    setAnswers(pruned.answers);
    setSkipped((s) => s.filter((id) => id !== q.id && !pruned.dropped.includes(id)));
    setDropped(pruned.dropped.length);
    setEditing(null);
    scrollDown();
  };
  const skip = (q: Question) => {
    setSkipped((s) => [...s, q.id]);
    setEditing(null);
    scrollDown();
  };

  const discard = async () => {
    if (
      Object.keys(answers).length === 0 ||
      (await confirm(
        t('intake.chat.discardTitle'),
        t('intake.chat.discardBody'),
        t('intake.chat.discard'),
        t('common.cancel'),
      ))
    ) {
      router.back();
    }
  };

  const finish = () => {
    if (
      testRun ||
      result.problems.length > 0 ||
      !result.customer ||
      !result.schedule.date ||
      !result.schedule.start ||
      title.trim() === ''
    )
      return;
    const { date, start, end } = result.schedule;
    const payload: IntakePayload = {
      ...(eventId ? { event_id: eventId } : {}),
      customer: 'id' in result.customer ? { id: result.customer.id } : result.customer,
      event: {
        kind: result.event.kind,
        title: title.trim(),
        occasion: result.event.occasion,
        starts_at: berlinToIso(date, start),
        ends_at: end ? endIso(date, start, end) : null,
        guest_count: result.event.guest_count,
        venue_name: result.event.venue_name,
        kitchen_notes: result.event.kitchen_notes,
        staff_notes: result.event.staff_notes,
        internal_notes: result.event.internal_notes,
      },
      dietary: result.dietary,
      intake_answers: result.intakeAnswers,
    };
    create.mutate(payload, {
      onSuccess: (id) => router.replace({ pathname: '/events/[id]', params: { id } }),
    });
  };

  const problemText = (p: string) => t(`intake.chat.problems.${p}`);
  const customerName = result.customer
    ? 'id' in result.customer
      ? (
          questions
            .map((q) => answers[q.id])
            .find((a) => a && typeof a === 'object' && !Array.isArray(a) && 'customerId' in a) as
            { name: string } | undefined
        )?.name
      : result.customer.name
    : '—';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + tokens.space[2] }]}>
        <View style={styles.headerRow}>
          <IconButton
            icon={X}
            label={t('intake.chat.discardShort')}
            onPress={() => void discard()}
          />
          <Text variant="small" color="textSecondary">
            {done
              ? t('intake.chat.summaryTitle')
              : t('intake.chat.progress', { n: index, total: visible.length })}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {/* Fortschritt gleitet mit jeder Antwort weiter. */}
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.progress,
              {
                width: `${done ? 100 : Math.round((Math.max(index - 1, 0) / Math.max(visible.length, 1)) * 100)}%`,
              },
              transition('width', tokens.motion.slow),
            ]}
          />
        </View>
      </View>
      {testRun ? <Banner tone="warning">{t('intake.chat.testRun')}</Banner> : null}

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {dropped > 0 ? (
          <Banner tone="info">{t('intake.chat.dropped', { count: dropped })}</Banner>
        ) : null}
        {shown.map((q) => {
          const a = answers[q.id];
          return (
            <Animated.View
              key={q.id}
              entering={FadeInDown.duration(tokens.motion.slow)}
              style={{ gap: 6 }}
            >
              <View style={[styles.bubble, styles.question]}>
                <Text variant="body">{q.prompt}</Text>
                {q.help_text ? (
                  <Text variant="small" color="textSecondary">
                    {q.help_text}
                  </Text>
                ) : null}
              </View>
              {a !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${q.prompt}: ${answerText(q, a, labels)}. ${t('intake.chat.change')}`}
                  onPress={() => setEditing(q.id)}
                  style={[
                    styles.bubble,
                    styles.answer,
                    editing === q.id && { borderColor: tokens.color.accent, borderWidth: 2 },
                  ]}
                >
                  <Text variant="body">{answerText(q, a, labels)}</Text>
                </Pressable>
              ) : skipped.includes(q.id) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSkipped((s) => s.filter((id) => id !== q.id));
                    setEditing(q.id);
                  }}
                  style={[styles.bubble, styles.answer]}
                >
                  <Text variant="small" color="textSecondary">
                    {t('intake.chat.skipped')}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>
          );
        })}

        {done ? (
          <View style={styles.summary}>
            <Text variant="title2">{t('intake.chat.summaryTitle')}</Text>
            {create.error ? (
              <Banner tone="danger">{toAppError(create.error).message}</Banner>
            ) : null}
            {result.problems.map((p) => (
              <Banner key={p} tone="warning">
                {problemText(p)}
              </Banner>
            ))}
            <Row label={t('events.form.customer')} value={customerName ?? '—'} />
            <Row label={t('events.form.kind')} value={t(`events.kind.${result.event.kind}`)} />
            <Row label={t('events.form.occasion')} value={result.event.occasion} />
            <Row
              label={t('events.form.date')}
              value={result.schedule.date ? formatGermanDate(result.schedule.date) : null}
            />
            <Row
              label={t('intake.chat.time')}
              value={
                result.schedule.start
                  ? `${result.schedule.start}${result.schedule.end ? `–${result.schedule.end}` : ''}`
                  : null
              }
            />
            <Row
              label={t('events.form.guests')}
              value={result.event.guest_count ? String(result.event.guest_count) : null}
            />
            <Row label={t('events.form.venue')} value={result.event.venue_name} />
            {result.dietary.map((d, i) => (
              <Row
                key={i}
                label={t('events.kitchen.title')}
                value={`${d.person_count}× ${d.diet ? t(`diet.${d.diet}`) : t('events.kitchen.allergy')}`}
              />
            ))}
            <Row label={t('events.form.kitchenNotes')} value={result.event.kitchen_notes} />
            <Row label={t('events.form.internalNotes')} value={result.event.internal_notes} />
            <TextField
              label={t('events.form.title')}
              helper={t('events.form.titleHint')}
              value={title}
              onChangeText={setTitleDraft}
              maxLength={120}
            />
            {testRun ? (
              <Button label={t('intake.chat.endTest')} onPress={() => router.back()} />
            ) : (
              <Button
                label={eventId ? t('intake.chat.update') : t('intake.chat.create')}
                loading={create.isPending}
                disabled={result.problems.length > 0 || title.trim() === ''}
                onPress={finish}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {inputQuestion ? (
        <View style={[styles.input, { paddingBottom: insets.bottom + tokens.space[3] }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
            <AnswerInput
              key={`${inputQuestion.id}-${editing ? 'edit' : 'new'}`}
              question={inputQuestion}
              initial={answers[inputQuestion.id]}
              onSubmit={(a) => submit(inputQuestion, a)}
              onSkip={inputQuestion.is_required ? undefined : () => skip(inputQuestion)}
            />
            {editing ? (
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(null)} />
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: tokens.color.canvas },
  center: {
    flex: 1,
    padding: tokens.space[6],
    justifyContent: 'center',
    gap: tokens.space[4],
    backgroundColor: tokens.color.bg,
  },
  header: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.space[4],
    paddingBottom: tokens.space[3],
    backgroundColor: tokens.color.chrome,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.hairline,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 44 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.bgMuted,
    overflow: 'hidden',
  },
  progress: { height: 4, borderRadius: 2, backgroundColor: tokens.color.accent },
  messages: {
    padding: tokens.space[4],
    gap: tokens.space[4],
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  bubble: { maxWidth: '88%', padding: tokens.space[3], borderRadius: tokens.radius.xl, gap: 4 },
  question: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.bg,
    borderBottomLeftRadius: tokens.radius.sm,
    boxShadow: tokens.shadow.card,
  },
  answer: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: tokens.radius.sm,
    backgroundColor: tokens.color.accentSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  summary: {
    gap: tokens.space[3],
    padding: tokens.space[4],
    ...surfaceStyle(),
  },
  input: {
    padding: tokens.space[4],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.bg,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
});
