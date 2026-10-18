import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatGermanDate, todayBerlin, weekday } from '@/lib/berlin';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { eventStatusStyle, tokens } from '@/theme/tokens';

import { useEvents } from '../../events/api';
import { StatusBadge } from '../../events/components/status-badge';
import { filterEvents } from '../../events/filter';
import type { EventKind } from '../../events/types';
import { eventsOnDay, monthGrid, shiftMonth } from '../month';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** SC-14 Kalender: Monat mit Tagesliste und Listenansicht; vorläufige Termine sind erkennbar (04 §4.3). */
export function CalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const events = useEvents();
  const today = todayBerlin();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [ym, setYm] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState<EventKind | null>(null);

  const all = (events.data ?? []).filter((e) => !kind || e.kind === kind);
  const weeks = monthGrid(ym.year, ym.month);
  const dayEntries = eventsOnDay(all, selected);
  const upcoming = filterEvents(all, { query: '', mode: 'upcoming', kind: null }, today);
  const monthName = new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleString('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const open = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  return (
    <Screen title={t('calendar.title')}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label={t('calendar.month')}
          selected={view === 'month'}
          onPress={() => setView('month')}
        />
        <Chip
          label={t('calendar.list')}
          selected={view === 'list'}
          onPress={() => setView('list')}
        />
        {(['event_catering', 'business_lunch'] as const).map((k) => (
          <Chip
            key={k}
            label={t(`events.kind.${k}`)}
            selected={kind === k}
            onPress={() => setKind(kind === k ? null : k)}
          />
        ))}
      </View>

      {view === 'month' ? (
        <>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Button
              label="‹"
              variant="ghost"
              onPress={() => setYm((c) => shiftMonth(c.year, c.month, -1))}
              accessibilityLabel={t('calendar.prev')}
            />
            <Text variant="title2" accessibilityRole="header">
              {monthName}
            </Text>
            <Button
              label="›"
              variant="ghost"
              onPress={() => setYm((c) => shiftMonth(c.year, c.month, 1))}
              accessibilityLabel={t('calendar.next')}
            />
          </View>
          <View>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d) => (
                <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Text variant="caption" color="textTertiary">
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            {weeks.map((w) => (
              <View key={w[0]!.date} style={{ flexDirection: 'row' }}>
                {w.map((d) => {
                  const entries = eventsOnDay(all, d.date);
                  const isSelected = d.date === selected;
                  return (
                    <Pressable
                      key={d.date}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatGermanDate(d.date)}, ${t('calendar.eventCount', { count: entries.length })}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelected(d.date)}
                      style={{
                        flex: 1,
                        minHeight: 52,
                        alignItems: 'center',
                        paddingVertical: 4,
                        gap: 2,
                        borderRadius: tokens.radius.md,
                        backgroundColor: isSelected ? tokens.color.accentSubtle : undefined,
                        borderWidth: d.date === today ? 1 : 0,
                        borderColor: tokens.color.accent,
                      }}
                    >
                      <Text variant="small" color={d.inMonth ? 'text' : 'textTertiary'}>
                        {Number(d.date.slice(8))}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {entries.slice(0, 3).map((x) => (
                          <View
                            key={x.event.id}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: eventStatusStyle[x.event.status].fg,
                              opacity:
                                x.event.status === 'inquiry' ||
                                x.event.status === 'optioned' ||
                                x.event.status === 'quoted'
                                  ? 0.45
                                  : 1,
                            }}
                          />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <Text variant="title2">{formatGermanDate(selected)}</Text>
          {dayEntries.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('calendar.noEvents')}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            {dayEntries.map(({ event, continuation }) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                onPress={() => open(event.id)}
                style={({ pressed }) => ({
                  gap: 4,
                  padding: tokens.space[3],
                  borderWidth: 1,
                  borderColor: tokens.color.border,
                  borderRadius: tokens.radius.md,
                  backgroundColor: pressed ? tokens.color.bgMuted : tokens.color.bg,
                })}
              >
                <Text variant="small" color="textSecondary">
                  {continuation
                    ? t('calendar.continuation')
                    : `${formatTime(event.starts_at)}${event.ends_at ? `–${formatTime(event.ends_at)}` : ''}`}
                </Text>
                <Text variant="bodyStrong">{event.title}</Text>
                {event.customer_name ? (
                  <Text variant="small" color="textSecondary">
                    {event.customer_name}
                  </Text>
                ) : null}
                <StatusBadge status={event.status} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {upcoming.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('calendar.noEvents')}
            </Text>
          ) : null}
          {upcoming.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              onPress={() => open(e.id)}
              style={({ pressed }) => ({
                gap: 4,
                padding: tokens.space[3],
                borderWidth: 1,
                borderColor: tokens.color.border,
                borderRadius: tokens.radius.md,
                backgroundColor: pressed ? tokens.color.bgMuted : tokens.color.bg,
              })}
            >
              <Text variant="small" color="textSecondary">
                {WEEKDAYS[(weekday(e.event_date) + 6) % 7]}, {formatGermanDate(e.event_date)} ·{' '}
                {formatTime(e.starts_at)}
              </Text>
              <Text variant="bodyStrong">{e.title}</Text>
              <StatusBadge status={e.status} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
