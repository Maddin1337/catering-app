import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Copy,
  FileText,
  Hourglass,
  MapPin,
  Pencil,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
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

  if (!event) {
    return (
      <Screen
        title={t('events.detail.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        {events.isPending ? (
          <Text>{t('common.loading')}</Text>
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

  return (
    <Screen title={event.title} onBack={() => router.back()} backLabel={t('common.back')}>
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
      </Surface>

      {isAdmin && closed ? <Banner tone="info">{t('events.detail.closed')}</Banner> : null}
      {isAdmin && nextStatuses(event.status).length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="title2">{t('events.detail.actions')}</Text>
          {nextStatuses(event.status).map((s, i) => (
            <Button
              key={s}
              label={t(
                `events.action.${event.status === 'optioned' && s === 'optioned' ? 'optionedExtend' : s}`,
              )}
              variant={
                i === 0 ? 'primary' : s === 'declined' || s === 'cancelled' ? 'danger' : 'secondary'
              }
              onPress={() => setTarget(s)}
            />
          ))}
        </View>
      ) : null}

      <SegmentedTabs
        items={(isAdmin
          ? (['overview', 'schedule', 'kitchen', 'staff'] as const)
          : (['overview', 'schedule', 'kitchen'] as const)
        ).map((k) => ({ key: k, label: t(`events.detail.tabs.${k}`) }))}
        active={tab}
        onChange={setTab}
      />

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
                onPress={() => setShowHistory((s) => !s)}
              />
              {showHistory
                ? (history.data ?? []).map((h) => (
                    <Text key={h.id} variant="small" color="textSecondary">
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!closed ? (
              <Button
                label={t('events.detail.edit')}
                icon={Pencil}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({ pathname: '/events/[id]/edit', params: { id: event.id } })
                }
              />
            ) : null}
            <Button
              label={t('events.detail.copy')}
              icon={Copy}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({ pathname: '/events/[id]/copy', params: { id: event.id } })
              }
            />
          </View>
          {event.status === 'inquiry' ? (
            <Button
              label={t('events.detail.delete')}
              variant="danger"
              loading={del.isPending}
              onPress={() => void remove(event)}
            />
          ) : null}
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
