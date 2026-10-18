import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Clock,
  FilePlus,
  Hand,
  Hourglass,
  Inbox,
  MessageSquarePlus,
  MessageSquareWarning,
  Send,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useDishes } from '../../catalog/api';
import { useMembership, useSubscription } from '../../company/api';
import { useEvents, useSetEventStatus } from '../../events/api';
import type { EventRow } from '../../events/types';
import { useOpenChangeRequests } from '../../quotes/api';
import { useStaffingOverview } from '../../shifts/api';
import { useTeamMembers } from '../../team/api';
import { AgendaRow } from '../components/agenda-row';
import { NextEventCard } from '../components/next-event-card';
import { QuickActions } from '../components/quick-actions';
import { SetupCard } from '../components/setup-card';
import { StatGrid } from '../components/stat-grid';
import { TodoRow } from '../components/todo-row';
import { WeekStrip } from '../components/week-strip';
import {
  daysUntil,
  firstName,
  greetingPart,
  nextEvent,
  overviewStats,
  weekStrip,
} from '../overview';
import { computeTodos, todayAndTomorrow } from '../todos';

/** SC-12 Start (admin): Erste Schritte, heute und morgen, Zu erledigen mit Sammelaktion „Durchgeführt“. */
export function StartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const events = useEvents();
  const subscription = useSubscription();
  const membership = useMembership();
  const members = useTeamMembers();
  const dishes = useDishes();
  const staffing = useStaffingOverview().data;
  const changeRequests = useOpenChangeRequests().data ?? [];
  const [completing, setCompleting] = useState(false);

  const all = events.data ?? [];
  const { today, tomorrow } = todayAndTomorrow(all);
  const todos = computeTodos(all);
  const quoted = all.filter((e) => e.status === 'quoted');
  const unfilled = staffing?.unfilled ?? [];
  const applications = staffing?.applications ?? [];
  const hasTodos =
    todos.staleInquiries.length +
      todos.expiringOptions.length +
      todos.toComplete.length +
      quoted.length +
      changeRequests.length +
      unfilled.length +
      applications.length >
    0;
  const trialEnd =
    subscription.data?.status === 'trialing' ? subscription.data.trial_ends_at : null;

  const setup = [
    { key: 'setupTeam', done: (members.data ?? []).length > 1, href: '/team' as const },
    { key: 'setupDish', done: (dishes.data ?? []).length > 0, href: '/dishes/new' as const },
    { key: 'setupEvent', done: all.length > 0, href: '/events/new' as const },
  ];
  const setupOpen =
    events.isSuccess && members.isSuccess && dishes.isSuccess && setup.some((s) => !s.done);

  const open = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  const next = nextEvent(all);
  const stats = overviewStats(all);
  const name = firstName(membership.data?.display_name);
  const greeting = t(`start.greeting.${greetingPart()}`);
  const todayLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date());

  const agenda = (label: string, list: EventRow[]) =>
    list.length > 0 ? (
      <View style={{ gap: 8 }}>
        <Text variant="small" color="textSecondary">
          {label}
        </Text>
        {list.map((e) => (
          <AgendaRow key={e.id} event={e} onPress={() => open(e.id)} />
        ))}
      </View>
    ) : null;

  return (
    <Screen title={name ? t('start.hello', { greeting, name }) : greeting} subtitle={todayLabel}>
      {trialEnd ? (
        <Banner tone="info">{t('start.trial', { date: formatDate(trialEnd) })}</Banner>
      ) : null}
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}

      <WeekStrip days={weekStrip(all)} />

      <NextEventCard
        event={next}
        days={next ? daysUntil(next) : 0}
        onPress={() => next && open(next.id)}
      />

      {setupOpen ? (
        <SetupCard
          steps={setup.map((s) => ({
            key: s.key,
            label: t(`start.${s.key}`),
            done: s.done,
            onPress: () => router.push(s.href),
          }))}
        />
      ) : null}

      <QuickActions
        actions={[
          {
            key: 'chat',
            label: t('start.new'),
            icon: MessageSquarePlus,
            primary: true,
            onPress: () => router.push('/events/intake'),
          },
          {
            key: 'form',
            label: t('start.newQuick'),
            icon: FilePlus,
            onPress: () => router.push('/events/new'),
          },
        ]}
      />

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('start.stats.title')}</Text>
        <StatGrid
          tiles={[
            {
              key: 'week',
              label: t('start.stats.week'),
              value: stats.weekEvents,
              icon: CalendarDays,
              tint: 'teal',
              onPress: () => router.push('/calendar'),
            },
            {
              key: 'guests',
              label: t('start.stats.guests'),
              value: stats.weekGuests,
              icon: Users,
              tint: 'violet',
            },
            {
              key: 'inquiries',
              label: t('start.stats.inquiries'),
              value: stats.inquiries,
              icon: Inbox,
              tint: 'amber',
              onPress: () => router.push('/events'),
            },
            {
              key: 'quotes',
              label: t('start.stats.quotes'),
              value: stats.quotes,
              icon: Send,
              tint: 'sky',
              onPress: () => router.push('/events'),
            },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('start.todo')}</Text>
        {!hasTodos ? (
          <EmptyState icon={CircleCheck} tint="indigo" text={t('start.nothingTodo')} />
        ) : null}
        {todos.staleInquiries.length > 0 ? (
          <TodoRow
            icon={Clock}
            tint="amber"
            title={t('start.staleInquiries', { count: todos.staleInquiries.length })}
            onPress={() => open(todos.staleInquiries[0]!.id)}
          />
        ) : null}
        {todos.expiringOptions.length > 0 ? (
          <TodoRow
            icon={Hourglass}
            tint="rose"
            title={t('start.expiringOptions', { count: todos.expiringOptions.length })}
            onPress={() => open(todos.expiringOptions[0]!.id)}
          />
        ) : null}
        {changeRequests.length > 0 ? (
          <TodoRow
            icon={MessageSquareWarning}
            tint="violet"
            title={t('start.changeRequests', { count: changeRequests.length })}
            onPress={() => open(changeRequests[0]!)}
          />
        ) : null}
        {applications.length > 0 ? (
          <TodoRow
            icon={Hand}
            tint="teal"
            title={t('start.applications', {
              count: applications.reduce((n, a) => n + a.count, 0),
            })}
            onPress={() => open(applications[0]!.event_id)}
          />
        ) : null}
        {unfilled.length > 0 ? (
          <TodoRow
            icon={UserPlus}
            tint="indigo"
            title={t('start.unfilled', { count: unfilled.reduce((n, a) => n + a.open, 0) })}
            onPress={() => open(unfilled[0]!.event_id)}
          />
        ) : null}
        {quoted.length > 0 ? (
          <TodoRow
            icon={Send}
            tint="sky"
            title={t('start.quoted', { count: quoted.length })}
            onPress={() => open(quoted[0]!.id)}
          />
        ) : null}
        {todos.toComplete.length > 0 ? (
          <TodoRow
            icon={CircleCheck}
            tint="slate"
            title={t('start.toComplete', { count: todos.toComplete.length })}
            onPress={() => setCompleting(true)}
          />
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('start.todayTomorrow')}</Text>
        {today.length + tomorrow.length === 0 ? (
          <EmptyState icon={CalendarCheck} text={t('start.nothing')} />
        ) : null}
        {agenda(t('start.today'), today)}
        {agenda(t('start.tomorrow'), tomorrow)}
      </View>

      {completing ? (
        <CompleteDialog events={todos.toComplete} onClose={() => setCompleting(false)} />
      ) : null}
    </Screen>
  );
}

/** Sammelaktion „Durchgeführt“ (R2-3): Liste der Aufträge, fester Hinweis, dann ein Statuswechsel je Auftrag. */
function CompleteDialog({ events, onClose }: { events: EventRow[]; onClose: () => void }) {
  const { t } = useTranslation();
  const set = useSetEventStatus();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    let ok = true;
    for (const e of events) {
      try {
        await set.mutateAsync({ eventId: e.id, status: 'completed' });
      } catch {
        ok = false;
      }
    }
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <ScrollView contentContainerStyle={{ gap: tokens.space[4] }}>
            <Text variant="title2" accessibilityRole="header">
              {t('start.completeTitle', { count: events.length })}
            </Text>
            {failed ? <Banner tone="danger">{t('start.completeError')}</Banner> : null}
            {set.error && failed ? (
              <Banner tone="danger">{toAppError(set.error).message}</Banner>
            ) : null}
            <View style={{ gap: 4 }}>
              {events.map((e) => (
                <Text key={e.id} variant="body">
                  {formatDate(e.starts_at)} · {e.title}
                </Text>
              ))}
            </View>
            <Text variant="small" color="textSecondary">
              {t('events.dialog.consequences.completed')}
            </Text>
            <Text variant="small" color="danger">
              {t('events.dialog.irreversible')}
            </Text>
            <View style={{ gap: 8 }}>
              <Button label={t('events.dialog.cancel')} onPress={onClose} />
              <Button
                label={t('start.completeAll')}
                variant="secondary"
                loading={busy}
                onPress={() => void run()}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.color.scrim,
    justifyContent: 'center',
    padding: tokens.space[4],
  },
  card: {
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.xl,
    padding: tokens.space[5],
  },
});
