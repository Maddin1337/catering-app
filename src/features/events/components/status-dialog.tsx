import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { RadioList } from '@/components/ui/radio-list';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { addDays, endOfBerlinDayIso, todayBerlin } from '@/lib/berlin';
import { requirementsFor, type EventStatus } from '@/lib/event-status';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useSetEventStatus } from '../api';
import type { EventRow } from '../types';

type Channel = 'phone' | 'email' | 'in_person';

/**
 * SC-31 Bestätigungsdialog vor jedem Statuswechsel (docs/02 §1.1.1): Zielstatus im Titel, Pflichtangaben,
 * Folgen, fester Hinweis „nicht rückgängig“; „Abbrechen“ ist der hervorgehobene Standard.
 */
export function StatusDialog({
  event,
  target,
  onClose,
}: {
  event: EventRow;
  target: EventStatus;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const set = useSetEventStatus();
  const needs = requirementsFor(event.status, target);
  const extend = event.status === 'optioned' && target === 'optioned';
  const actionKey = extend ? 'optionedExtend' : target;

  const [optionDate, setOptionDate] = useState(addDays(todayBerlin(), 7));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [reason, setReason] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [tried, setTried] = useState(false);

  const optionIso = optionDate || null;
  const optionError =
    needs.includes('option') && (!optionIso || optionIso < todayBerlin())
      ? t('events.dialog.optionError')
      : undefined;
  const channelError =
    needs.includes('channel') && !channel ? t('events.dialog.channelError') : undefined;
  const reasonError =
    needs.includes('reason') && reason.trim() === '' ? t('events.dialog.reasonError') : undefined;
  const invDateParsed = invoiceDate || undefined;
  const notYet = target === 'completed' && event.starts_at > new Date().toISOString();
  const danger = target === 'declined' || target === 'cancelled';

  const submit = () => {
    setTried(true);
    if (optionError || channelError || reasonError) return;
    set.mutate(
      {
        eventId: event.id,
        status: target,
        reason: reason.trim() || undefined,
        channel: channel ?? undefined,
        optionExpiresAt:
          needs.includes('option') && optionIso ? endOfBerlinDayIso(optionIso) : undefined,
        invoiceReference: invoiceRef.trim() || undefined,
        invoicedOn: invDateParsed ?? undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={t('events.dialog.cancel')}
      >
        <Pressable style={styles.card} onPress={() => undefined}>
          <ScrollView
            contentContainerStyle={{ gap: tokens.space[4] }}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="title2" accessibilityRole="header">
              {t('events.dialog.title', {
                title: event.title,
                action: t(`events.action.${actionKey}`),
              })}
            </Text>
            {set.error ? <Banner tone="danger">{toAppError(set.error).message}</Banner> : null}
            {notYet ? <Banner tone="warning">{t('events.dialog.notYet')}</Banner> : null}

            {needs.includes('option') ? (
              <DateField
                label={t('events.dialog.optionDate')}
                value={optionDate}
                onChange={setOptionDate}
                error={tried ? optionError : undefined}
              />
            ) : null}
            {needs.includes('channel') ? (
              <RadioList
                label={t('events.dialog.channel')}
                value={channel ?? ('' as Channel)}
                onChange={setChannel}
                options={(['phone', 'email', 'in_person'] as const).map((c) => ({
                  value: c,
                  label: t(`events.dialog.channels.${c}`),
                }))}
              />
            ) : null}
            {channelError && tried ? (
              <Text variant="small" color="danger">
                {channelError}
              </Text>
            ) : null}
            {needs.includes('reason') ? (
              <TextField
                label={t('events.dialog.reason')}
                value={reason}
                onChangeText={setReason}
                error={tried ? reasonError : undefined}
                multiline
              />
            ) : null}
            {needs.includes('invoice') ? (
              <>
                <TextField
                  label={t('events.dialog.invoiceReference')}
                  value={invoiceRef}
                  onChangeText={setInvoiceRef}
                />
                <DateField
                  label={t('events.dialog.invoicedOn')}
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                  optional
                />
              </>
            ) : null}

            <Text variant="small" color="textSecondary">
              {t(`events.dialog.consequences.${actionKey}`)}
            </Text>
            <Text variant="small" color="danger">
              {t('events.dialog.irreversible')}
            </Text>
            <View style={{ gap: 8 }}>
              <Button label={t('events.dialog.cancel')} onPress={onClose} />
              <Button
                label={t(`events.action.${actionKey}`)}
                variant={danger ? 'danger' : 'secondary'}
                loading={set.isPending}
                onPress={submit}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.color.scrim,
    justifyContent: 'center',
    padding: tokens.space[4],
  },
  card: {
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.xl,
    padding: tokens.space[5],
  },
});
