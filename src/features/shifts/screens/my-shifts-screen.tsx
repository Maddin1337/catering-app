import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CalendarCheck, ClipboardList, Clock, Hand, MapPin, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateTile } from '@/components/ui/date-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { HeroCard, type HeroFact } from '@/components/ui/hero-card';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { isoToBerlin } from '@/lib/berlin';
import { formatDate, formatDateTime, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useCompanyProfile, useMembership } from '../../company/api';
import { StatGrid } from '../../start/components/stat-grid';
import { NotificationBell } from '../../notifications/components/notification-bell';
import { whenLabel } from '../../start/components/next-event-card';
import { WeekStrip } from '../../start/components/week-strip';
import { daysUntilIso, firstName, greetingPart, stripFromTimestamps } from '../../start/overview';
import { useCancelMine, useMyShifts, useShiftBoard } from '../api';
import { currentShifts, nextShift, shiftStats } from '../overview';
import type { MyShift } from '../types';

const FIRM = ['accepted', 'assigned'];

/** SC-50/SC-51 Meine Einsätze: Begrüßung, nächste Schicht, Kennzahlen, Status, Einsatzinfos nach der Zusage, Absagen bis zur Frist. */
export function MyShiftsScreen({ standalone = false }: { standalone?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const shifts = useMyShifts();
  const board = useShiftBoard();
  const cancel = useCancelMine();
  const membership = useMembership();
  const phone = useCompanyProfile().data?.phone ?? null;
  const [phoneHint, setPhoneHint] = useState(false);
  const list = shifts.data ?? [];
  const current = currentShifts(list);
  const next = nextShift(list);
  const stats = shiftStats(list, board.data ?? []);
  const error =
    shifts.error ??
    (cancel.error && toAppError(cancel.error).code !== 'deadline_passed' ? cancel.error : null);

  const name = firstName(membership.data?.display_name);
  const greeting = t(`start.greeting.${greetingPart()}`);
  const todayLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date());

  const doCancel = async (s: MyShift) => {
    const ok = await confirm(
      t('shifts.mine.cancelTitle'),
      t('shifts.mine.cancelBody', { date: formatDateTime(s.cancel_deadline_at) }),
      t('shifts.mine.cancelAction'),
      t('common.cancel'),
    );
    if (!ok) return;
    setPhoneHint(false);
    cancel.mutate(
      { id: s.application_id, reason: '' },
      { onError: (e) => setPhoneHint(toAppError(e).code === 'deadline_passed') },
    );
  };

  const heroFacts = (s: MyShift): HeroFact[] => {
    const facts: HeroFact[] = [
      {
        icon: Clock,
        text: `${formatDate(s.starts_at)} · ${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`,
      },
    ];
    const place = [s.venue_name, s.city].filter(Boolean).join(', ');
    if (place) facts.push({ icon: MapPin, text: place });
    if (s.meeting_point) facts.push({ icon: Users, text: s.meeting_point });
    return facts;
  };

  return (
    <Screen
      title={
        standalone ? t('shifts.mine.title') : name ? t('start.hello', { greeting, name }) : greeting
      }
      subtitle={standalone ? undefined : todayLabel}
      onBack={standalone ? () => router.back() : undefined}
      backLabel={t('common.back')}
      actions={standalone ? undefined : <NotificationBell />}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {phoneHint ? <Banner tone="warning">{t('shifts.mine.phoneOnly')}</Banner> : null}
      {phoneHint && phone ? (
        <Button
          label={`${t('shifts.mine.call')}: ${phone}`}
          variant="secondary"
          onPress={() => void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
        />
      ) : null}

      <WeekStrip
        days={stripFromTimestamps(
          current
            .filter((s) => FIRM.includes(s.status) && !s.is_called_off)
            .map((s) => s.starts_at),
        )}
      />

      {next ? (
        <HeroCard
          eyebrow={t('shifts.mine.next.label')}
          when={whenLabel(daysUntilIso(next.starts_at), t)}
          title={`${next.title} · ${next.qualification_name}`}
          facts={heroFacts(next)}
          badge={<Pill label={t(`shifts.status.${next.status}`)} tone="teal" />}
          accessibilityLabel={`${t('shifts.mine.next.label')}: ${next.title}`}
        />
      ) : (
        <HeroCard
          eyebrow={t('shifts.mine.next.label')}
          title={t('shifts.mine.next.none')}
          body={t('shifts.mine.next.noneBody')}
          accessibilityLabel={t('shifts.mine.next.none')}
        />
      )}

      <StatGrid
        tiles={[
          {
            key: 'accepted',
            label: t('shifts.mine.stats.accepted'),
            value: stats.accepted,
            icon: CalendarCheck,
            tint: 'teal',
          },
          {
            key: 'applied',
            label: t('shifts.mine.stats.applied'),
            value: stats.applied,
            icon: Clock,
            tint: 'amber',
          },
          {
            key: 'free',
            label: t('shifts.mine.stats.free'),
            value: stats.free,
            icon: Hand,
            tint: 'indigo',
            onPress: () => router.push(standalone ? '/shifts/board' : '/shift-board'),
          },
        ]}
      />

      {!shifts.isPending && current.length === 0 ? (
        <EmptyState icon={ClipboardList} text={t('shifts.mine.empty')} />
      ) : null}
      <View style={{ gap: 12 }}>
        {current.map((s, i) => {
          const firm = FIRM.includes(s.status) && !s.is_called_off;
          return (
            <Appear key={s.application_id} index={i}>
              <Surface style={[styles.card, s.is_called_off && { opacity: 0.7 }]}>
                <View style={styles.head}>
                  <DateTile date={isoToBerlin(s.starts_at).date} muted={s.is_called_off} />
                  <View style={styles.texts}>
                    <Text variant="bodyStrong">{s.title}</Text>
                    <Text variant="small" color="textSecondary">
                      {s.qualification_name} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                    </Text>
                    <View style={styles.pills}>
                      <Pill
                        label={
                          s.is_called_off
                            ? t('shifts.mine.calledOff')
                            : t(`shifts.status.${s.status}`)
                        }
                        tone={s.is_called_off ? 'danger' : firm ? 'teal' : 'amber'}
                      />
                      {s.is_tentative && !s.is_called_off ? (
                        <Pill label={t('shifts.board.tentative')} tone="slate" />
                      ) : null}
                    </View>
                  </View>
                </View>
                {s.status === 'applied' ? (
                  <Text variant="small" color="textSecondary">
                    {t('shifts.mine.pending')}
                  </Text>
                ) : null}
                {firm ? <Info s={s} /> : null}
                {s.status === 'applied' ? (
                  <Button
                    label={t('shifts.mine.withdraw')}
                    variant="secondary"
                    onPress={() => cancel.mutate({ id: s.application_id, reason: '' })}
                  />
                ) : null}
                {firm ? (
                  <>
                    <Text variant="small" color="textSecondary">
                      {t('shifts.mine.deadline', { date: formatDateTime(s.cancel_deadline_at) })}
                    </Text>
                    <Button
                      label={t('shifts.mine.cancel')}
                      variant="secondary"
                      onPress={() => void doCancel(s)}
                    />
                  </>
                ) : null}
              </Surface>
            </Appear>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space[3], padding: tokens.space[4] },
  head: { flexDirection: 'row', gap: tokens.space[3] },
  texts: { flex: 1, gap: 2 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[1],
    marginTop: tokens.space[1],
  },
  info: {
    gap: 4,
    padding: tokens.space[3],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bgSubtle,
  },
});

function Info({ s }: { s: MyShift }) {
  const { t } = useTranslation();
  const place = [s.venue_name, s.street, [s.postal_code, s.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const rows: [string, string | null][] = [
    [t('shifts.mine.venue'), place || null],
    [t('shifts.mine.meeting'), s.meeting_point],
    [t('shifts.mine.dress'), s.dress_code],
    [t('shifts.mine.notes'), [s.staff_notes, s.slot_notes].filter(Boolean).join('\n') || null],
  ];
  return (
    <View style={styles.info}>
      <Text variant="small" color="textSecondary">
        {t('shifts.mine.info')}
      </Text>
      {rows.map(([label, value]) =>
        value ? (
          <Text key={label} variant="body">
            {label}: {value}
          </Text>
        ) : null,
      )}
      {s.onsite_contact_name || s.onsite_contact_phone ? (
        <Text
          variant="body"
          color={s.onsite_contact_phone ? 'accent' : 'text'}
          onPress={
            s.onsite_contact_phone
              ? () => void Linking.openURL(`tel:${s.onsite_contact_phone!.replace(/\s+/g, '')}`)
              : undefined
          }
        >
          {t('shifts.mine.contact')}:{' '}
          {[s.onsite_contact_name, s.onsite_contact_phone].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
