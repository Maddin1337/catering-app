import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FilePlus, MessageSquarePlus, PartyPopper } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
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

  return (
    <Screen title={t('events.title')}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      {isAdmin ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={t('events.addChat')}
            icon={MessageSquarePlus}
            style={{ flex: 1 }}
            onPress={() => router.push('/events/intake')}
          />
          <Button
            label={t('events.addQuick')}
            icon={FilePlus}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push('/events/new')}
          />
        </View>
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
      {!events.isPending && (events.data ?? []).length === 0 ? (
        <EmptyState icon={PartyPopper} text={t('events.empty')} />
      ) : null}
      {(events.data ?? []).length > 0 ? (
        <Text variant="small" color="textSecondary">
          {shown.length === 0 ? t('events.noMatch') : t('events.count', { count: shown.length })}
        </Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.month} style={{ gap: 8 }}>
          <Text variant="title2" accessibilityRole="header">
            {monthTitle(g.month)}
          </Text>
          {g.events.map((e) => (
            <EventListItem
              key={e.id}
              event={e}
              onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
            />
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
