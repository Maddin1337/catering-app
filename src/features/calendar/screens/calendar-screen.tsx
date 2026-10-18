import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { addDays, formatGermanDate, todayBerlin } from '@/lib/berlin';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { eventStatusStyle, tokens } from '@/theme/tokens';

import { useEvents } from '../../events/api';
import { EventListItem } from '../../events/components/event-list-item';
import { filterEvents } from '../../events/filter';
import { groupByMonth } from '../../events/group';
import type { EventKind, EventRow } from '../../events/types';
import { eventsOnDay, monthGrid, shiftMonth, weekDays } from '../month';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** SC-14 Kalender: Monat mit Tagesliste und Listenansicht; vorläufige Termine sind erkennbar (04 §4.3). */
export function CalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const events = useEvents();
  const today = todayBerlin();
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [ym, setYm] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState<EventKind | null>(null);

  const all = (events.data ?? []).filter((e) => !kind || e.kind === kind);
  const weeks = monthGrid(ym.year, ym.month);
  const week = weekDays(selected);
  const dayEntries = eventsOnDay(all, selected);
  const upcoming = filterEvents(all, { query: '', mode: 'upcoming', kind: null }, today);
  const monthName = new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleString('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const open = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });
  const timeLabel = (e: EventRow, continuation: boolean) =>
    continuation
      ? t('calendar.continuation')
      : `${formatTime(e.starts_at)}${e.ends_at ? `–${formatTime(e.ends_at)}` : ''}`;
  const monthNav = (title: string, onPrev: () => void, onNext: () => void) => (
    <View style={styles.nav}>
      <IconButton icon={ChevronLeft} label={t('calendar.prev')} onPress={onPrev} />
      <Text variant="title2" accessibilityRole="header" style={styles.navTitle}>
        {title}
      </Text>
      <IconButton icon={ChevronRight} label={t('calendar.next')} onPress={onNext} />
    </View>
  );

  return (
    <Screen title={t('calendar.title')}>
      {events.error ? <Banner tone="danger">{toAppError(events.error).message}</Banner> : null}
      <SegmentedTabs
        items={[
          { key: 'month', label: t('calendar.month') },
          { key: 'week', label: t('calendar.week') },
          { key: 'list', label: t('calendar.list') },
        ]}
        active={view}
        onChange={setView}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['event_catering', 'business_lunch'] as const).map((k) => (
          <Chip
            key={k}
            label={t(`events.kind.${k}`)}
            selected={kind === k}
            onPress={() => setKind(kind === k ? null : k)}
          />
        ))}
      </View>

      {view === 'week' ? (
        <>
          {monthNav(
            `${formatGermanDate(week[0]!)} – ${formatGermanDate(week[6]!)}`,
            () => setSelected((d) => addDays(d, -7)),
            () => setSelected((d) => addDays(d, 7)),
          )}
          <View style={{ gap: 16 }}>
            {week.map((date, i) => {
              const entries = eventsOnDay(all, date);
              return (
                <View key={date} style={{ gap: 8 }}>
                  <View style={styles.dayHead}>
                    <Text variant="bodyStrong" color={date === today ? 'accent' : 'text'}>
                      {WEEKDAYS[i]}, {formatGermanDate(date)}
                    </Text>
                    {date === today ? <Pill label={t('start.today')} tone="teal" /> : null}
                  </View>
                  {entries.length === 0 ? (
                    <Text variant="small" color="textTertiary">
                      {t('calendar.noEvents')}
                    </Text>
                  ) : null}
                  {entries.map(({ event, continuation }) => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      showTile={false}
                      timeLabel={timeLabel(event, continuation)}
                      onPress={() => open(event.id)}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </>
      ) : view === 'month' ? (
        <>
          <Surface style={styles.monthCard}>
            {monthNav(
              monthName,
              () => setYm((c) => shiftMonth(c.year, c.month, -1)),
              () => setYm((c) => shiftMonth(c.year, c.month, 1)),
            )}
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
                  const isToday = d.date === today;
                  return (
                    <PressableScale
                      key={d.date}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatGermanDate(d.date)}, ${t('calendar.eventCount', { count: entries.length })}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelected(d.date)}
                      scale={0.9}
                      style={styles.cell}
                    >
                      <View
                        style={[
                          styles.day,
                          isSelected && styles.daySelected,
                          isToday && !isSelected && styles.dayToday,
                        ]}
                      >
                        <Text
                          variant="small"
                          color={isSelected ? 'onAccent' : d.inMonth ? 'text' : 'textTertiary'}
                          style={
                            isToday || isSelected ? { fontFamily: tokens.font.semibold } : null
                          }
                        >
                          {Number(d.date.slice(8))}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
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
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </Surface>
          <Text variant="title2">{formatGermanDate(selected)}</Text>
          {dayEntries.length === 0 ? (
            <EmptyState icon={CalendarDays} text={t('calendar.noEvents')} />
          ) : null}
          <View style={{ gap: 8 }}>
            {dayEntries.map(({ event, continuation }, i) => (
              // Neuer Schlüssel je Tag: Beim Wechsel des Tages gleiten die Einträge frisch herein.
              <Appear key={`${selected}-${event.id}`} index={i}>
                <EventListItem
                  event={event}
                  showTile={false}
                  timeLabel={timeLabel(event, continuation)}
                  onPress={() => open(event.id)}
                />
              </Appear>
            ))}
          </View>
        </>
      ) : (
        <View style={{ gap: 16 }}>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} text={t('calendar.noEvents')} />
          ) : null}
          {groupByMonth(upcoming).map((g) => (
            <View key={g.month} style={{ gap: 8 }}>
              <Text variant="title2" accessibilityRole="header">
                {new Intl.DateTimeFormat('de-DE', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${g.month}T00:00:00Z`))}
              </Text>
              {g.events.map((e, i) => (
                <Appear key={e.id} index={i}>
                  <EventListItem event={e} onPress={() => open(e.id)} />
                </Appear>
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navTitle: { flex: 1, textAlign: 'center' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthCard: { gap: tokens.space[2], padding: tokens.space[3] },
  cell: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: tokens.color.ink },
  dayToday: { borderWidth: 1.5, borderColor: tokens.color.accent },
});
