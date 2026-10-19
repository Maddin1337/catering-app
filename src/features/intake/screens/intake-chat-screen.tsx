import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SkeletonList } from '@/components/ui/skeleton';
import { transition } from '@/components/ui/transition';
import { berlinToIso, endIso, isoToBerlin } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import {
  buildResult,
  pruneAnswers,
  visibleQuestions,
  type Answer,
  type Answers,
  type Question,
} from '@/lib/intake';
import { tokens } from '@/theme/tokens';

import { useCustomers } from '../../customers/api';
import { useEvent } from '../../events/api';
import { useCreateEventFromIntake, useIntakeQuestions, type IntakePayload } from '../api';
import { CreatedOverlay } from '../components/created-overlay';
import { QuestionStep } from '../components/question-step';
import { SummaryStep } from '../components/summary-step';
import { frontier, progressOf, stepAfter, stepBefore, SUMMARY } from '../flow';
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
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [step, setStep] = useState<string>(
    () => frontier(visibleQuestions(questions, initialAnswers), initialAnswers, []) ?? SUMMARY,
  );
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [dropped, setDropped] = useState(0);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const visible = visibleQuestions(questions, answers);
  const question = visible.find((q) => q.id === step);
  // Eine Frage, die inzwischen nicht mehr sichtbar ist, führt zur nächsten offenen bzw. zur Zusammenfassung.
  const shown =
    step === SUMMARY || question ? step : (frontier(visible, answers, skipped) ?? SUMMARY);
  const shownQuestion = visible.find((q) => q.id === shown);
  const before = stepBefore(visible, shown);

  const labels = { yes: t('intake.chat.yes'), no: t('intake.chat.no') };
  const kindLabels = {
    event_catering: t('events.kind.event_catering'),
    business_lunch: t('events.kind.business_lunch'),
  };
  const result = buildResult(questions, answers, { kindLabels, labels });
  const title = titleDraft ?? result.titleSuggestion;

  const go = (next: string, dir: 'forward' | 'back') => {
    setDirection(dir);
    setStep(next);
  };

  const submit = (q: Question, a: Answer) => {
    const pruned = pruneAnswers(questions, { ...answers, [q.id]: a });
    const nextSkipped = skipped.filter((id) => id !== q.id && !pruned.dropped.includes(id));
    setAnswers(pruned.answers);
    setSkipped(nextSkipped);
    setDropped(pruned.dropped.length);
    go(
      stepAfter(visibleQuestions(questions, pruned.answers), pruned.answers, nextSkipped, q.id),
      'forward',
    );
  };
  const skip = (q: Question) => {
    // Überspringen löscht eine frühere Antwort auf diese Frage.
    const pruned = pruneAnswers(questions, { ...answers, [q.id]: undefined });
    const nextSkipped = [...skipped.filter((id) => !pruned.dropped.includes(id)), q.id];
    setAnswers(pruned.answers);
    setSkipped(nextSkipped);
    setDropped(pruned.dropped.length);
    go(
      stepAfter(visibleQuestions(questions, pruned.answers), pruned.answers, nextSkipped, q.id),
      'forward',
    );
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
  const back = () => (before === null ? void discard() : go(before, 'back'));

  const finish = () => {
    if (
      testRun ||
      create.isPending ||
      createdId ||
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
    create.mutate(payload, { onSuccess: (id) => setCreatedId(id) });
  };

  const customerName = result.customer
    ? 'id' in result.customer
      ? (
          questions
            .map((q) => answers[q.id])
            .find((a) => a && typeof a === 'object' && !Array.isArray(a) && 'customerId' in a) as
            { name: string } | undefined
        )?.name
      : result.customer.name
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + tokens.space[2] }]}>
        {before === null ? (
          <View style={styles.spacer} />
        ) : (
          <IconButton icon={ChevronLeft} label={t('common.back')} onPress={back} />
        )}
        {/* Fortschritt gleitet mit jeder Antwort weiter. */}
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progressOf(visible, shown) * 100),
          }}
        >
          <Animated.View
            style={[
              styles.progress,
              { width: `${Math.round(progressOf(visible, shown) * 100)}%` },
              transition('width', tokens.motion.slow),
            ]}
          />
        </View>
        <IconButton icon={X} label={t('intake.chat.discardShort')} onPress={() => void discard()} />
      </View>
      <View style={styles.banners}>
        {testRun ? <Banner tone="warning">{t('intake.chat.testRun')}</Banner> : null}
        {dropped > 0 ? (
          <Banner tone="info">{t('intake.chat.dropped', { count: dropped })}</Banner>
        ) : null}
      </View>

      {shown === SUMMARY ? (
        <SummaryStep
          visible={visible}
          answers={answers}
          result={result}
          customerName={customerName ?? null}
          title={title}
          onTitle={setTitleDraft}
          eventId={eventId}
          testRun={testRun}
          creating={create.isPending}
          error={create.error}
          onEdit={(id) => go(id, 'forward')}
          onCreate={finish}
          onEndTest={() => router.back()}
        />
      ) : shownQuestion ? (
        <QuestionStep
          key={shownQuestion.id}
          question={shownQuestion}
          initial={answers[shownQuestion.id]}
          direction={direction}
          onSubmit={(a) => submit(shownQuestion, a)}
          onSkip={shownQuestion.is_required ? undefined : () => skip(shownQuestion)}
        />
      ) : null}

      {createdId ? (
        <CreatedOverlay
          title={title}
          onDone={() => router.replace({ pathname: '/events/[id]', params: { id: createdId } })}
        />
      ) : null}
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    paddingBottom: tokens.space[2],
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  spacer: { width: 44 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.bgMuted,
    overflow: 'hidden',
  },
  progress: { height: 6, borderRadius: 3, backgroundColor: tokens.color.accent },
  banners: { paddingHorizontal: tokens.space[4], gap: tokens.space[2] },
});
