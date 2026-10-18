import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { PartyPopper } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useEvents } from '../api';
import { StatusBadge } from '../components/status-badge';
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

  return (
    <Screen title={t('events.title')}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      {isAdmin ? (
        <View style={{ gap: 8 }}>
          <Button label={t('events.addChat')} onPress={() => router.push('/events/intake')} />
          <Button
            label={t('events.addQuick')}
            variant="secondary"
            onPress={() => router.push('/events/new')}
          />
        </View>
      ) : null}
      <TextField
        label={t('events.search')}
        value={filters.query}
        onChangeText={(v) => setFilters((f) => ({ ...f, query: v }))}
        autoCorrect={false}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MODES.map((m) => (
          <Chip
            key={m}
            label={t(`events.mode.${m}`)}
            selected={filters.mode === m}
            onPress={() => setFilters((f) => ({ ...f, mode: m }))}
          />
        ))}
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
      <View style={{ gap: 8 }}>
        {shown.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
            style={({ pressed }) => ({
              gap: 4,
              padding: tokens.space[3],
              ...surfaceStyle(),
              ...(pressed ? { backgroundColor: tokens.color.bgSubtle } : null),
            })}
          >
            <Text variant="small" color="textSecondary">
              {formatDate(e.starts_at)} · {formatTime(e.starts_at)}
              {e.guest_count ? ` · ${t('events.detail.guests', { count: e.guest_count })}` : ''}
            </Text>
            <Text variant="bodyStrong">{e.title}</Text>
            {e.customer_name ? (
              <Text variant="small" color="textSecondary">
                {e.customer_name}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={e.status} />
              {e.status === 'optioned' && e.option_expires_at ? (
                <Text variant="caption" color="textSecondary">
                  {t('events.badge.optionExpires', { date: formatDate(e.option_expires_at) })}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
