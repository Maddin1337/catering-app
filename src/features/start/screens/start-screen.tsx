import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useDishes } from '../../catalog/api';
import { useSubscription } from '../../company/api';
import { useEvents, useSetEventStatus } from '../../events/api';
import { StatusBadge } from '../../events/components/status-badge';
import type { EventRow } from '../../events/types';
import { useTeamMembers } from '../../team/api';
import { computeTodos, todayAndTomorrow } from '../todos';

/** SC-12 Start (admin): Erste Schritte, heute und morgen, Zu erledigen mit Sammelaktion „Durchgeführt“. */
export function StartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const events = useEvents();
  const subscription = useSubscription();
  const members = useTeamMembers();
  const dishes = useDishes();
  const [completing, setCompleting] = useState(false);

  const all = events.data ?? [];
  const { today, tomorrow } = todayAndTomorrow(all);
  const todos = computeTodos(all);
  const hasTodos =
    todos.staleInquiries.length + todos.expiringOptions.length + todos.toComplete.length > 0;
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

  const dayCard = (label: string, list: EventRow[]) =>
    list.length > 0 ? (
      <View style={{ gap: 8 }}>
        <Text variant="small" color="textSecondary">
          {label}
        </Text>
        {list.map((e) => (
          <ListRow
            key={e.id}
            title={e.title}
            subtitle={`${formatTime(e.starts_at)}${e.customer_name ? ` · ${e.customer_name}` : ''}`}
            right={<StatusBadge status={e.status} />}
            onPress={() => open(e.id)}
          />
        ))}
      </View>
    ) : null;

  return (
    <Screen title={t('start.title')}>
      {trialEnd ? (
        <Banner tone="info">{t('start.trial', { date: formatDate(trialEnd) })}</Banner>
      ) : null}
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      <Button label={t('start.new')} onPress={() => router.push('/events/new')} />

      {setupOpen ? (
        <View style={{ gap: 8 }}>
          <Text variant="title2">{t('start.setup')}</Text>
          {setup.map((s) => (
            <ListRow
              key={s.key}
              title={t(`start.${s.key}`)}
              subtitle={s.done ? t('start.setupDone') : undefined}
              onPress={s.done ? undefined : () => router.push(s.href)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('start.todayTomorrow')}</Text>
        {today.length + tomorrow.length === 0 ? (
          <Text variant="body" color="textSecondary">
            {t('start.nothing')}
          </Text>
        ) : null}
        {dayCard(t('start.today'), today)}
        {dayCard(t('start.tomorrow'), tomorrow)}
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('start.todo')}</Text>
        {!hasTodos ? (
          <Text variant="body" color="textSecondary">
            {t('start.nothingTodo')}
          </Text>
        ) : null}
        {todos.staleInquiries.length > 0 ? (
          <ListRow
            title={t('start.staleInquiries', { count: todos.staleInquiries.length })}
            onPress={() => open(todos.staleInquiries[0]!.id)}
          />
        ) : null}
        {todos.expiringOptions.length > 0 ? (
          <ListRow
            title={t('start.expiringOptions', { count: todos.expiringOptions.length })}
            onPress={() => open(todos.expiringOptions[0]!.id)}
          />
        ) : null}
        {todos.toComplete.length > 0 ? (
          <ListRow
            title={t('start.toComplete', { count: todos.toComplete.length })}
            onPress={() => setCompleting(true)}
          />
        ) : null}
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
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
