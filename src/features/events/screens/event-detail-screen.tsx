import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  CalendarDays,
  ChevronDown,
  Copy,
  FileText,
  Hourglass,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import type { SheetAction } from '@/components/ui/action-sheet';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate, formatDateTime, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { isClosed, nextStatuses, type EventStatus } from '@/lib/event-status';
import { tints, tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useExistingQuote } from '../../quotes/api';
import { PortalStatus } from '../../quotes/components/portal-status';
import { useDeleteEvent, useEvent, useStatusHistory } from '../api';
import { useApplications, useSlots } from '../../shifts/api';
import { useTeamMembers } from '../../team/api';
import { StaffingTab } from '../../shifts/components/staffing-tab';
import { whenLabel } from '../../start/components/next-event-card';
import { daysUntil } from '../../start/overview';
import { KitchenTab } from '../components/kitchen-tab';
import { ScheduleTab } from '../components/schedule-tab';
import { StatusBadge } from '../components/status-badge';
import { StatusDialog } from '../components/status-dialog';
import type { EventRow } from '../types';

type FieldRow = { label: string; value: string | null | undefined; onPress?: () => void };

/** Gruppierte Angaben: eine Karte, Zeilen mit feiner Trennlinie; leere Angaben entfallen. */
function FieldGroup({ rows }: { rows: FieldRow[] }) {
  const shown = rows.filter((r) => r.value);
  if (shown.length === 0) return null;
  return (
    <Surface padded={false} style={{ overflow: 'hidden' }}>
      {shown.map((r, i) => (
        <Pressable
          key={r.label}
          disabled={!r.onPress}
          onPress={r.onPress}
          accessibilityRole={r.onPress ? 'link' : undefined}
          style={[styles.field, i > 0 && styles.fieldDivider]}
        >
          <Text variant="small" color="textSecondary">
            {r.label}
          </Text>
          <Text variant="body" color={r.onPress ? 'accent' : 'text'}>
            {r.value}
          </Text>
        </Pressable>
      ))}
    </Surface>
  );
}

function Fact({
  icon: Icon,
  children,
  onPress,
}: {
  icon: LucideIcon;
  children: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      style={[styles.fact, onPress && styles.factLink]}
    >
      <Icon color={tokens.color.textTertiary} size={18} strokeWidth={2} />
      <Text variant="body" color={onPress ? 'accent' : 'text'} style={{ flex: 1 }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** SC-18/SC-19 Auftragsdetail mit Übersicht und Zeitplan; Statuswechsel immer über den Bestätigungsdialog. */
export function EventDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAdmin = useMembership().data?.role === 'admin';
  const events = useEvent(id);
  const event = events.data;
  const history = useStatusHistory(id);
  const quote = useExistingQuote(id).data;
  const del = useDeleteEvent();
  const [tab, setTab] = useState<'overview' | 'schedule' | 'kitchen' | 'staff'>('overview');
  const [target, setTarget] = useState<EventStatus | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Offene Bewerbungen als Zahl am Reiter „Personal“ (dieselben Abfragen wie im Reiter, aus dem Cache).
  const slots = useSlots(isAdmin ? id : undefined).data ?? [];
  const apps = useApplications(slots.map((s) => s.id)).data ?? [];
  const pendingApps = apps.filter((a) => a.status === 'applied').length;
  // Eingeplantes Team als Gesichter-Stapel in der Zusammenfassung.
  const members = useTeamMembers().data ?? [];
  const liveSlots = new Set(slots.filter((s) => !s.cancelled_at).map((s) => s.id));
  const team = [
    ...new Set(
      apps
        .filter(
          (a) =>
            liveSlots.has(a.shift_slot_id) && (a.status === 'accepted' || a.status === 'assigned'),
        )
        .map((a) => a.member_id),
    ),
  ].map((mid) => members.find((m) => m.id === mid)?.display_name ?? '?');

  if (!event) {
    return (
      <Screen
        title={t('events.detail.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        {events.isPending ? (
          <Surface style={styles.summary}>
            <Skeleton width={120} height={22} radius={tokens.radius.full} />
            <Skeleton width="70%" />
            <Skeleton width="55%" />
            <Skeleton width="40%" />
          </Surface>
        ) : (
          <Banner tone="info">{t('events.detail.gone')}</Banner>
        )}
      </Screen>
    );
  }

  const closed = isClosed(event.status);
  const upcomingDays =
    !closed && !['declined', 'cancelled'].includes(event.status) && daysUntil(event) >= 0
      ? daysUntil(event)
      : null;
  const address = [
    event.venue_name,
    event.street,
    [event.postal_code, event.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const openMap = () => {
    const q = encodeURIComponent(address);
    void Linking.openURL(
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`,
    );
  };

  const remove = async (e: EventRow) => {
    if (
      await confirm(
        t('events.detail.deleteTitle', { title: e.title }),
        t('events.detail.deleteBody'),
        t('events.detail.delete'),
        t('common.cancel'),
      )
    ) {
      del.mutate(e.id, { onSuccess: () => router.back() });
    }
  };

  // Nächster Schritt: der erste Übergang unten als Hauptaktion, ein zweiter friedlicher daneben;
  // Absagen und Löschen liegen hinter „⋯“, damit sie nicht versehentlich getroffen werden.
  const steps = isAdmin ? nextStatuses(event.status) : [];
  const harsh = (s: EventStatus) => s === 'declined' || s === 'cancelled';
  const calm = steps.filter((s) => !harsh(s));
  const stepLabel = (s: EventStatus) =>
    t(`events.action.${event.status === 'optioned' && s === 'optioned' ? 'optionedExtend' : s}`);
  const menu: SheetAction[] = isAdmin
    ? [
        {
          label: t('events.detail.copy'),
          icon: Copy,
          onPress: () => router.push({ pathname: '/events/[id]/copy', params: { id: event.id } }),
        },
        ...calm.slice(2).map((s) => ({ label: stepLabel(s), onPress: () => setTarget(s) })),
        ...steps.filter(harsh).map((s) => ({
          label: stepLabel(s),
          icon: Ban,
          destructive: true,
          onPress: () => setTarget(s),
        })),
        ...(event.status === 'inquiry'
          ? [
              {
                label: t('events.detail.delete'),
                icon: Trash2,
                destructive: true,
                onPress: () => void remove(event),
              },
            ]
          : []),
      ]
    : [];

  return (
    <Screen
      title={event.title}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        isAdmin && !closed ? (
          <IconButton
            icon={Pencil}
            label={t('events.detail.edit')}
            onPress={() => router.push({ pathname: '/events/[id]/edit', params: { id: event.id } })}
          />
        ) : null
      }
      menu={menu}
      onRefresh={() => void events.refetch()}
      refreshing={events.isRefetching}
      footer={
        calm.length > 0 ? (
          <>
            {calm[1] ? (
              <Button
                label={stepLabel(calm[1])}
                variant="secondary"
                style={styles.footerButton}
                onPress={() => setTarget(calm[1]!)}
              />
            ) : null}
            <Button
              label={stepLabel(calm[0]!)}
              style={styles.footerButton}
              onPress={() => setTarget(calm[0]!)}
            />
          </>
        ) : undefined
      }
    >
      {del.error ? <Banner tone="danger">{toAppError(del.error).message}</Banner> : null}
      <Surface style={styles.summary}>
        <View style={styles.summaryTop}>
          <StatusBadge status={event.status} />
          {upcomingDays !== null ? <Pill label={whenLabel(upcomingDays, t)} tone="teal" /> : null}
        </View>
        <Fact icon={CalendarDays}>
          {`${formatDate(event.starts_at)} · ${formatTime(event.starts_at)}${event.ends_at ? `–${formatTime(event.ends_at)}` : ''}`}
        </Fact>
        {event.customer_name ? <Fact icon={UserRound}>{event.customer_name}</Fact> : null}
        {event.guest_count ? (
          <Fact icon={Users}>{t('events.detail.guests', { count: event.guest_count })}</Fact>
        ) : null}
        {address ? (
          <Fact icon={MapPin} onPress={openMap}>
            {address}
          </Fact>
        ) : null}
        {event.status === 'optioned' && event.option_expires_at ? (
          <Fact icon={Hourglass}>
            {`${t('events.detail.optionUntil')}: ${formatDate(event.option_expires_at)}`}
          </Fact>
        ) : null}
        {team.length > 0 ? (
          <View style={styles.teamRow}>
            <AvatarStack
              names={team}
              label={t('events.detail.teamA11y', { names: team.join(', ') })}
            />
            <Text variant="small" color="textSecondary">
              {t('events.detail.team', { count: team.length })}
            </Text>
          </View>
        ) : null}
      </Surface>

      {isAdmin && closed ? <Banner tone="info">{t('events.detail.closed')}</Banner> : null}
      <SegmentedTabs
        items={(isAdmin
          ? (['overview', 'schedule', 'kitchen', 'staff'] as const)
          : (['overview', 'schedule', 'kitchen'] as const)
        ).map((k) => ({
          key: k,
          label: t(`events.detail.tabs.${k}`),
          badge: k === 'staff' ? pendingApps : undefined,
        }))}
        active={tab}
        onChange={setTab}
      />

      <Appear key={tab}>
        {tab === 'overview' ? (
          <View style={{ gap: 12 }}>
            <FieldGroup
              rows={[
                { label: t('events.detail.kind'), value: t(`events.kind.${event.kind}`) },
                { label: t('events.detail.occasion'), value: event.occasion },
                {
                  label: t('events.detail.onsite'),
                  value: [event.onsite_contact_name, event.onsite_contact_phone]
                    .filter(Boolean)
                    .join(' · '),
                  onPress: event.onsite_contact_phone
                    ? () => void Linking.openURL(`tel:${event.onsite_contact_phone}`)
                    : undefined,
                },
                { label: t('events.detail.pickup'), value: event.is_pickup ? '✓' : null },
              ]}
            />
            <FieldGroup
              rows={[
                { label: t('events.detail.kitchenNotes'), value: event.kitchen_notes },
                { label: t('events.detail.staffNotes'), value: event.staff_notes },
                ...(isAdmin
                  ? [{ label: t('events.detail.internalNotes'), value: event.internal_notes }]
                  : []),
              ]}
            />
            {isAdmin ? (
              <FieldGroup
                rows={[
                  {
                    label: t('events.detail.changesUntil'),
                    value: event.changes_until ? formatDateTime(event.changes_until) : null,
                  },
                  {
                    label: t('events.detail.invoice'),
                    value: event.invoice_reference
                      ? [
                          event.invoice_reference,
                          event.invoiced_on ? formatDate(event.invoiced_on) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : null,
                  },
                ]}
              />
            ) : null}
            {isAdmin ? (
              <View style={{ gap: 8 }}>
                <Button
                  label={
                    showHistory ? t('events.detail.hideHistory') : t('events.detail.showHistory')
                  }
                  variant="ghost"
                  icon={ChevronDown}
                  onPress={() => setShowHistory((s) => !s)}
                />
                {showHistory
                  ? (history.data ?? []).map((h, i) => (
                      <Appear key={h.id} index={i}>
                        <Text variant="small" color="textSecondary">
                          {formatDateTime(h.created_at)} ·{' '}
                          {t('events.detail.historyEntry', {
                            from: h.from_status ? t(`events.status.${h.from_status}`) : '–',
                            to: t(`events.status.${h.to_status}`),
                          })}
                          {h.confirmation_channel
                            ? ` (${t(`events.dialog.channels.${h.confirmation_channel as 'phone'}`)})`
                            : ''}
                          {h.reason ? ` – ${h.reason}` : ''}
                        </Text>
                      </Appear>
                    ))
                  : null}
              </View>
            ) : null}
          </View>
        ) : tab === 'schedule' ? (
          <ScheduleTab event={event} isAdmin={isAdmin} />
        ) : tab === 'staff' ? (
          <StaffingTab event={event} />
        ) : (
          <KitchenTab event={event} />
        )}
      </Appear>

      {isAdmin ? (
        <View style={{ gap: 12 }}>
          <Surface style={styles.quote}>
            <View style={styles.quoteHead}>
              <View style={styles.quoteIcon}>
                <FileText color={tints.violet.fg} size={22} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title2">{quote ? quote.number : t('quote.none')}</Text>
                {quote && quote.revision > 0 ? (
                  <Text variant="small" color="textSecondary">
                    {t('events.detail.quoteSent', { n: quote.revision })}
                    {quote.has_unsent_changes ? ` · ${t('quoteSend.unsent')}` : ''}
                  </Text>
                ) : null}
              </View>
              {quote ? (
                <Text variant="title2" tabular>
                  {formatCents(quote.total_gross_cents)}
                </Text>
              ) : null}
            </View>
            {quote && quote.revision > 0 ? <PortalStatus quoteId={quote.id} enabled /> : null}
            {!closed ? (
              <Button
                label={t('quote.open')}
                onPress={() =>
                  router.push({ pathname: '/events/[id]/quote', params: { id: event.id } })
                }
              />
            ) : null}
            {quote && quote.revision > 0 && !closed ? (
              <Button
                label={t('quoteSend.title')}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/events/[id]/quote-send', params: { id: event.id } })
                }
              />
            ) : null}
          </Surface>
        </View>
      ) : null}

      {target ? (
        <StatusDialog event={event} target={target} onClose={() => setTarget(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: tokens.space[3], padding: tokens.space[4] },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    flexWrap: 'wrap',
  },
  factLink: { minHeight: 44, alignItems: 'center' },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space[3], minHeight: 24 },
  field: { gap: 2, paddingVertical: tokens.space[3], paddingHorizontal: tokens.space[4] },
  fieldDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  quote: { gap: tokens.space[3], padding: tokens.space[4] },
  footerButton: { flex: 1 },
  quoteHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  quoteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tints.violet.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
