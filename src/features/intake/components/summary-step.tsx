import {
  CalendarDays,
  Clock,
  HeartPulse,
  MapPin,
  MessageSquareText,
  PartyPopper,
  Shapes,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { HeroCard, type HeroFact } from '@/components/ui/hero-card';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';
import { formatGermanDate } from '@/lib/berlin';
import { answerText, type Answers, type IntakeResult, type Question } from '@/lib/intake';
import { tokens } from '@/theme/tokens';

import { extraQuestions, questionForRow, type RowKey } from '../flow';

/**
 * Letzter Schritt: „Alles korrekt?“. Oben eine dunkle Karte mit dem Wichtigsten, darunter jede Angabe
 * als Zeile – ein Tipp springt zur Frage und danach direkt hierher zurück. Fest unten die Aktion.
 */
export function SummaryStep({
  visible,
  answers,
  result,
  customerName,
  title,
  onTitle,
  eventId,
  testRun,
  creating,
  error,
  onEdit,
  onCreate,
  onEndTest,
}: {
  visible: Question[];
  answers: Answers;
  result: IntakeResult;
  customerName: string | null;
  title: string;
  onTitle: (v: string) => void;
  eventId?: string;
  testRun: boolean;
  creating: boolean;
  error: unknown;
  onEdit: (questionId: string) => void;
  onCreate: () => void;
  onEndTest: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const labels = { yes: t('intake.chat.yes'), no: t('intake.chat.no') };

  const edit = (row: RowKey) => {
    const id = questionForRow(visible, row);
    return id ? () => onEdit(id) : undefined;
  };
  const { schedule, event } = result;
  const dateText = schedule.date ? formatGermanDate(schedule.date) : null;
  const timeText = schedule.start
    ? `${schedule.start}${schedule.end ? `–${schedule.end}` : ''} ${t('picker.oclock')}`
    : null;
  const dietaryText = result.dietary
    .map((d) => `${d.person_count}× ${d.diet ? t(`diet.${d.diet}`) : t('events.kitchen.allergy')}`)
    .join(', ');
  const missing = t('intake.chat.missing');
  const notGiven = t('intake.chat.notGiven');

  const facts: HeroFact[] = [
    ...(dateText
      ? [{ icon: CalendarDays, text: [dateText, timeText].filter(Boolean).join(' · ') }]
      : []),
    ...(event.guest_count
      ? [{ icon: Users, text: t('intake.chat.guestsFact', { count: event.guest_count }) }]
      : []),
    ...(event.venue_name ? [{ icon: MapPin, text: event.venue_name }] : []),
  ];
  const extras = extraQuestions(visible, answers);
  const blocked = result.problems.length > 0 || title.trim() === '';

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.duration(tokens.motion.slow)} style={styles.stack}>
          <View style={styles.head}>
            <Text variant="caption" color="accent" style={styles.eyebrow}>
              {t('intake.chat.summaryEyebrow')}
            </Text>
            <Text variant="display" accessibilityRole="header" style={styles.title}>
              {t('intake.chat.summaryTitle')}
            </Text>
            <Text variant="body" color="textSecondary">
              {t('intake.chat.summaryHint')}
            </Text>
          </View>

          {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
          {result.problems.map((p) => (
            <Banner key={p} tone="warning">
              {t(`intake.chat.problems.${p}`)}
            </Banner>
          ))}

          <HeroCard
            eyebrow={eventId ? t('intake.chat.heroUpdate') : t('intake.chat.heroNew')}
            when={event.occasion ?? t(`events.kind.${event.kind}`)}
            title={customerName || missing}
            facts={facts}
            accessibilityLabel={[customerName, ...facts.map((f) => f.text)]
              .filter(Boolean)
              .join(', ')}
          />

          <ListGroup title={t('intake.chat.groupRequest')}>
            <GroupRow
              icon={UserRound}
              tint={customerName ? 'teal' : 'rose'}
              title={customerName || missing}
              subtitle={t('events.form.customer')}
              onPress={edit('customer')}
            />
            <GroupRow
              icon={Shapes}
              tint="indigo"
              title={t(`events.kind.${event.kind}`)}
              subtitle={t('events.form.kind')}
              onPress={edit('kind')}
            />
            {event.occasion ? (
              <GroupRow
                icon={PartyPopper}
                tint="rose"
                title={event.occasion}
                subtitle={t('intake.chat.occasion')}
                onPress={edit('occasion')}
              />
            ) : null}
          </ListGroup>

          <ListGroup title={t('intake.chat.groupWhen')}>
            <GroupRow
              icon={CalendarDays}
              tint={dateText ? 'sky' : 'rose'}
              title={dateText ?? missing}
              subtitle={t('events.form.date')}
              onPress={edit('date')}
            />
            <GroupRow
              icon={Clock}
              tint={timeText ? 'amber' : 'rose'}
              title={timeText ?? missing}
              subtitle={t('intake.chat.time')}
              onPress={edit('time')}
            />
            {event.guest_count || edit('guests') ? (
              <GroupRow
                icon={Users}
                tint="violet"
                title={event.guest_count ? String(event.guest_count) : notGiven}
                subtitle={t('events.form.guests')}
                onPress={edit('guests')}
              />
            ) : null}
            {event.venue_name || edit('venue') ? (
              <GroupRow
                icon={MapPin}
                tint="teal"
                title={event.venue_name ?? notGiven}
                subtitle={t('events.form.venue')}
                onPress={edit('venue')}
              />
            ) : null}
          </ListGroup>

          {dietaryText || extras.length > 0 ? (
            <ListGroup title={t('intake.chat.groupMore')}>
              {dietaryText ? (
                <GroupRow
                  icon={HeartPulse}
                  tint="rose"
                  title={dietaryText}
                  subtitle={t('events.kitchen.title')}
                  onPress={edit('dietary')}
                />
              ) : null}
              {extras.map((id) => {
                const q = visible.find((x) => x.id === id)!;
                return (
                  <GroupRow
                    key={id}
                    icon={MessageSquareText}
                    tint="slate"
                    // Frage und Antwort wie im Gespräch: die Frage fett, die Antwort darunter.
                    title={q.prompt.replace(/\s*[?:]\s*$/, '')}
                    subtitle={answerText(q, answers[id]!, labels)}
                    onPress={() => onEdit(id)}
                  />
                );
              })}
            </ListGroup>
          ) : null}

          <TextField
            label={t('events.form.title')}
            helper={t('events.form.titleHint')}
            value={title}
            onChangeText={onTitle}
            maxLength={120}
          />
        </Animated.View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, tokens.space[3]) }]}>
        {testRun ? (
          <Button label={t('intake.chat.endTest')} onPress={onEndTest} />
        ) : (
          <Button
            label={eventId ? t('intake.chat.update') : t('intake.chat.create')}
            loading={creating}
            disabled={blocked}
            onPress={onCreate}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: tokens.space[5],
    paddingTop: tokens.space[4],
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  stack: { gap: tokens.space[5] },
  head: { gap: tokens.space[2] },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.9 },
  title: { fontSize: 28, lineHeight: 36 },
  bar: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
    backgroundColor: tokens.color.chrome,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.hairline,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
