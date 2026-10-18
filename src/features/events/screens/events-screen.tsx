import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FilePlus, MessageSquarePlus, PartyPopper, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { toAppError } from '@/lib/errors';

import { useMembership } from '../../company/api';
import { useEvents } from '../api';
import { EventListItem } from '../components/event-list-item';
import { groupByMonth } from '../group';
import {
  DEFAULT_EVENT_FILTERS,
  filterEvents,
  type EventFilters,
  type EventListMode,
} from '../filter';

const MODES: EventListMode[] = ['upcoming', 'past', 'archive'];

/** SC-15 Aufträge: Suche, Filter Anstehend/Vergangen/Archiv und Art; Zeile mit Datum, Titel, Kunde, Status. */
export function EventsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useMembership().data?.role === 'admin';
  const events = useEvents();
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const shown = useMemo(() => filterEvents(events.data ?? [], filters), [events.data, filters]);

  const groups = useMemo(() => groupByMonth(shown), [shown]);
  const [adding, setAdding] = useState(false);

  return (
    <Screen
      title={t('events.title')}
      actions={
        isAdmin ? (
          <IconButton icon={Plus} label={t('tabs.create')} onPress={() => setAdding(true)} />
        ) : null
      }
      onRefresh={() => void events.refetch()}
      refreshing={events.isRefetching}
    >
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      {adding ? (
        <ActionSheet
          title={t('create.title')}
          onClose={() => setAdding(false)}
          actions={[
            {
              label: t('events.addChat'),
              hint: t('create.intakeHint'),
              icon: MessageSquarePlus,
              onPress: () => router.push('/events/intake'),
            },
            {
              label: t('events.addQuick'),
              hint: t('create.eventHint'),
              icon: FilePlus,
              onPress: () => router.push('/events/new'),
            },
          ]}
        />
      ) : null}
      <SearchField
        label={t('events.search')}
        clearLabel={t('common.clear')}
        value={filters.query}
        onChangeText={(v) => setFilters((f) => ({ ...f, query: v }))}
      />
      <SegmentedTabs
        items={MODES.map((m) => ({ key: m, label: t(`events.mode.${m}`) }))}
        active={filters.mode === 'all' ? 'upcoming' : filters.mode}
        onChange={(m) => setFilters((f) => ({ ...f, mode: m }))}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['event_catering', 'business_lunch'] as const).map((k) => (
          <Chip
            key={k}
            label={t(`events.kind.${k}`)}
            selected={filters.kind === k}
            onPress={() => setFilters((f) => ({ ...f, kind: f.kind === k ? null : k }))}
          />
        ))}
      </View>
      {events.isPending ? <SkeletonList rows={4} /> : null}
      {!events.isPending && (events.data ?? []).length === 0 ? (
        <EmptyState icon={PartyPopper} text={t('events.empty')} />
      ) : null}
      {(events.data ?? []).length > 0 ? (
        <Text variant="small" color="textSecondary">
          {shown.length === 0 ? t('events.noMatch') : t('events.count', { count: shown.length })}
        </Text>
      ) : null}
      {groups.map((g, gi) => (
        <View key={g.month} style={{ gap: 8 }}>
          <Text variant="title2" accessibilityRole="header">
            {monthTitle(g.month)}
          </Text>
          {g.events.map((e, i) => (
            <Appear key={e.id} index={gi * 3 + i}>
              <EventListItem
                event={e}
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
              />
            </Appear>
          ))}
        </View>
      ))}
    </Screen>
  );
}

function monthTitle(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
