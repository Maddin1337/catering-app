import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ChefHat,
  Clock,
  PenLine,
  TriangleAlert,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { addDays, isoToBerlin, todayBerlin } from '@/lib/berlin';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tints, tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useDietary, useEvents, useScheduleItems } from '../../events/api';
import type { EventRow } from '../../events/types';
import { NextEventCard } from '../../start/components/next-event-card';
import { StatGrid } from '../../start/components/stat-grid';
import { WeekStrip } from '../../start/components/week-strip';
import { daysUntil, firstName, greetingPart, nextEvent, weekStrip } from '../../start/overview';

const FIRM = ['optioned', 'confirmed'];

/** SC-13 Heute (Küche): Begrüßung, Wochenleiste, nächster Auftrag, Kennzahlen des Tages und Karten mit Gästen, Abfahrt, Ausgabe, Sonderessen, Hinweisen. Keine Preise. */
export function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const events = useEvents();
  const membership = useMembership();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const date = day === 'today' ? todayBerlin() : addDays(todayBerlin(), 1);
  const all = events.data ?? [];
  const firm = all.filter((e) => FIRM.includes(e.status));
  const list = firm
    .filter((e) => isoToBerlin(e.starts_at).date === date)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = nextEvent(firm);
  const name = firstName(membership.data?.display_name);
  const greeting = t(`start.greeting.${greetingPart()}`);
  const todayLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date());
  const upcoming = firm.filter((e) => isoToBerlin(e.starts_at).date >= todayBerlin());

  return (
    <Screen title={name ? t('start.hello', { greeting, name }) : greeting} subtitle={todayLabel}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}

      <WeekStrip days={weekStrip(firm)} />

      <NextEventCard
        event={next}
        days={next ? daysUntil(next) : 0}
        onPress={() => next && router.push({ pathname: '/events/[id]', params: { id: next.id } })}
      />

      <SegmentedTabs
        items={[
          { key: 'today', label: t('today.today') },
          { key: 'tomorrow', label: t('today.tomorrow') },
        ]}
        active={day}
        onChange={setDay}
      />

      <StatGrid
        tiles={[
          {
            key: 'orders',
            label: t('today.stats.orders'),
            value: list.length,
            icon: CalendarDays,
            tint: 'teal',
          },
          {
            key: 'guests',
            label: t('today.stats.guests'),
            value: list.reduce((n, e) => n + (e.guest_count ?? 0), 0),
            icon: Users,
            tint: 'violet',
          },
          {
            key: 'changes',
            label: t('today.stats.changes'),
            value: upcoming.filter((e) => e.has_open_change).length,
            icon: PenLine,
            tint: 'rose',
          },
          {
            key: 'provisional',
            label: t('today.stats.provisional'),
            value: upcoming.filter((e) => e.status === 'optioned').length,
            icon: Clock,
            tint: 'amber',
          },
        ]}
      />

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
  const provisional = event.status === 'optioned' || event.basis === 'snapshot';

  return (
    <Surface
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      accessibilityLabel={event.title}
      style={styles.card}
    >
      <View style={styles.top}>
        <Text variant="bodyStrong" color="accent" tabular>
          {formatTime(event.starts_at)}
        </Text>
        <View style={styles.pills}>
          {provisional ? <Pill label={t('today.badge.provisional')} tone="amber" /> : null}
          {event.has_open_change ? (
            <Pill label={t('today.badge.change')} tone="danger" icon={TriangleAlert} />
          ) : null}
          {special > 0 ? <Pill label={t('today.special', { count: special })} tone="rose" /> : null}
        </View>
      </View>
      <Text variant="kitchen">{event.title}</Text>
      <View style={styles.facts}>
        {event.guest_count ? (
          <Fact icon={Users}>{t('events.detail.guests', { count: event.guest_count })}</Fact>
        ) : null}
        {departure ? (
          <Fact icon={Truck}>
            {t('events.schedule.kind.departure')} {formatTime(departure.starts_at)}
          </Fact>
        ) : null}
        {service ? (
          <Fact icon={UtensilsCrossed}>
            {t('events.schedule.kind.service')} {formatTime(service.starts_at)}
          </Fact>
        ) : null}
      </View>
      {event.has_open_change ? (
        <View style={[styles.note, { backgroundColor: tokens.color.dangerSubtle }]}>
          <Text variant="small" color="danger">
            {t('today.openChange', {
              from: event.guest_count ?? '–',
              to: event.draft_guest_count ?? '–',
            })}
          </Text>
        </View>
      ) : null}
      {event.kitchen_notes ? (
        <View style={[styles.note, { backgroundColor: tokens.color.bgMuted }]}>
          <Text variant="small" color="textSecondary">
            {event.kitchen_notes}
          </Text>
        </View>
      ) : null}
    </Surface>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <View style={styles.fact}>
      <Icon color={tints.slate.fg} size={16} strokeWidth={2} />
      <Text variant="small" color="textSecondary">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space[2], padding: tokens.space[4] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[1],
    justifyContent: 'flex-end',
    flex: 1,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.space[4],
    rowGap: tokens.space[1],
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
  note: { borderRadius: tokens.radius.md, padding: tokens.space[3] },
});
