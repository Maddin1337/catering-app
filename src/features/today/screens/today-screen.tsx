import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChefHat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { addDays, isoToBerlin, todayBerlin } from '@/lib/berlin';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useDietary, useEvents, useScheduleItems } from '../../events/api';
import type { EventRow } from '../../events/types';

/** SC-13 Heute (Küche): Umschalter Heute/Morgen, Karten mit Gästen, Abfahrt und Ausgabe, Sonderessen, Hinweisen. Keine Preise. */
export function TodayScreen() {
  const { t } = useTranslation();
  const events = useEvents();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const date = day === 'today' ? todayBerlin() : addDays(todayBerlin(), 1);
  const list = (events.data ?? [])
    .filter(
      (e) => ['optioned', 'confirmed'].includes(e.status) && isoToBerlin(e.starts_at).date === date,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <Screen title={t('today.title')}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={t('today.today')} selected={day === 'today'} onPress={() => setDay('today')} />
        <Chip
          label={t('today.tomorrow')}
          selected={day === 'tomorrow'}
          onPress={() => setDay('tomorrow')}
        />
      </View>
      {!events.isPending && list.length === 0 ? (
        <EmptyState icon={ChefHat} text={t('today.empty')} />
      ) : null}
      <View style={{ gap: 12 }}>
        {list.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </View>
    </Screen>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const { t } = useTranslation();
  const router = useRouter();
  const schedule = useScheduleItems(event.id).data ?? [];
  const dietary = useDietary(event.id).data ?? [];
  const departure = schedule.find((s) => s.kind === 'departure');
  const service = schedule.find((s) => s.kind === 'service');
  const special = dietary.reduce((sum, d) => sum + d.person_count, 0);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      style={({ pressed }) => ({
        gap: 6,
        padding: tokens.space[4],
        ...surfaceStyle(),
        ...(pressed ? { backgroundColor: tokens.color.bgSubtle } : null),
      })}
    >
      <Text variant="kitchen">{event.title}</Text>
      {event.has_open_change ? (
        <Text variant="caption" color="danger">
          {t('today.openChange', {
            from: event.guest_count ?? '–',
            to: event.draft_guest_count ?? '–',
          })}
        </Text>
      ) : null}
      {event.status === 'optioned' || event.basis === 'snapshot' ? (
        <Text variant="caption" color="accent">
          {t('today.provisional')}
        </Text>
      ) : null}
      {event.guest_count ? (
        <Text variant="body">{t('events.detail.guests', { count: event.guest_count })}</Text>
      ) : null}
      <Text variant="body" color="textSecondary">
        {[
          departure
            ? `${t('events.schedule.kind.departure')} ${formatTime(departure.starts_at)}`
            : null,
          service
            ? `${t('events.schedule.kind.service')} ${formatTime(service.starts_at)}`
            : `${formatTime(event.starts_at)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {special > 0 ? (
        <Text variant="body" color="danger">
          {t('today.special', { count: special })}
        </Text>
      ) : null}
      {event.kitchen_notes ? (
        <Text variant="small" color="textSecondary">
          {event.kitchen_notes}
        </Text>
      ) : null}
    </Pressable>
  );
}
