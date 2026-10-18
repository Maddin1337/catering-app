import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate, formatDateTime, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { isClosed, nextStatuses, type EventStatus } from '@/lib/event-status';
import { tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useDeleteEvent, useEvent, useStatusHistory } from '../api';
import { KitchenTab } from '../components/kitchen-tab';
import { ScheduleTab } from '../components/schedule-tab';
import { StatusBadge } from '../components/status-badge';
import { StatusDialog } from '../components/status-dialog';
import type { EventRow } from '../types';

function Field({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null | undefined;
  onPress?: () => void;
}) {
  if (!value) return null;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      style={{ gap: 2 }}
    >
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <Text variant="body" color={onPress ? 'accent' : 'text'}>
        {value}
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
  const del = useDeleteEvent();
  const [tab, setTab] = useState<'overview' | 'schedule' | 'kitchen'>('overview');
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
      <View style={{ gap: 6 }}>
        <StatusBadge status={event.status} />
        <Text variant="body">
          {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
          {event.ends_at ? `–${formatTime(event.ends_at)}` : ''}
        </Text>
        {event.customer_name ? (
          <Text variant="body" color="textSecondary">
            {event.customer_name}
          </Text>
        ) : null}
        {event.guest_count ? (
          <Text variant="body" color="textSecondary">
            {t('events.detail.guests', { count: event.guest_count })}
          </Text>
        ) : null}
        {event.status === 'optioned' && event.option_expires_at ? (
          <Text variant="small" color="textSecondary">
            {t('events.detail.optionUntil')}: {formatDate(event.option_expires_at)}
          </Text>
        ) : null}
      </View>

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

      <View style={{ flexDirection: 'row' }} accessibilityRole="tablist">
        {(['overview', 'schedule', 'kitchen'] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              minHeight: tokens.touch.min,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === k ? tokens.color.accent : tokens.color.border,
            }}
          >
            <Text variant="bodyStrong" color={tab === k ? 'accent' : 'textSecondary'}>
              {t(`events.detail.tabs.${k}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' ? (
        <View style={{ gap: 12 }}>
          <Field label={t('events.detail.kind')} value={t(`events.kind.${event.kind}`)} />
          <Field label={t('events.detail.occasion')} value={event.occasion} />
          <Field
            label={t('events.detail.venue')}
            value={address}
            onPress={address ? openMap : undefined}
          />
          {event.is_pickup ? <Field label={t('events.detail.pickup')} value="✓" /> : null}
          <Field
            label={t('events.detail.onsite')}
            value={[event.onsite_contact_name, event.onsite_contact_phone]
              .filter(Boolean)
              .join(' · ')}
            onPress={
              event.onsite_contact_phone
                ? () => void Linking.openURL(`tel:${event.onsite_contact_phone}`)
                : undefined
            }
          />
          <Field label={t('events.detail.kitchenNotes')} value={event.kitchen_notes} />
          <Field label={t('events.detail.staffNotes')} value={event.staff_notes} />
          {isAdmin ? (
            <Field label={t('events.detail.internalNotes')} value={event.internal_notes} />
          ) : null}
          {isAdmin && event.changes_until ? (
            <Field
              label={t('events.detail.changesUntil')}
              value={formatDateTime(event.changes_until)}
            />
          ) : null}
          {isAdmin && event.invoice_reference ? (
            <Field
              label={t('events.detail.invoice')}
              value={[
                event.invoice_reference,
                event.invoiced_on ? formatDate(event.invoiced_on) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
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
      ) : (
        <KitchenTab event={event} />
      )}

      {isAdmin ? (
        <View style={{ gap: 8 }}>
          {!closed ? (
            <Button
              label={t('events.detail.edit')}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/events/[id]/edit', params: { id: event.id } })
              }
            />
          ) : null}
          <Button
            label={t('events.detail.copy')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/events/[id]/copy', params: { id: event.id } })}
          />
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
