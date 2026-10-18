import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatDateTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';

import { useApplySelection, usePortalInfo, useResolveChange } from '../api';

/** Reaktion des Kunden im Portal: gesehen, angenommen, abgelehnt, Änderungswunsch (SC-28, vereinfacht). */
export function PortalStatus({ quoteId, enabled }: { quoteId: string; enabled: boolean }) {
  const { t } = useTranslation();
  const info = usePortalInfo(quoteId, enabled).data;
  const resolve = useResolveChange();
  const applySelection = useApplySelection();
  if (!info) return null;
  const pc = info.pending_change;
  const choices = Object.keys(info.portal_selection?.choices ?? {}).length;
  return (
    <View style={{ gap: 8 }}>
      {info.accepted_at ? (
        <Banner tone="success">
          {t('quoteSend.portal.accepted', {
            name: info.acceptance_name ?? '',
            date: formatDateTime(info.accepted_at),
            revision: info.acceptance_revision ?? 0,
          })}
        </Banner>
      ) : info.declined_at ? (
        <Banner tone="warning">
          {t('quoteSend.portal.declined', {
            date: formatDateTime(info.declined_at),
            reason: info.decline_reason ?? '–',
          })}
        </Banner>
      ) : info.last_viewed_at ? (
        <Text variant="small" color="textSecondary">
          {t('quoteSend.portal.viewed', { date: formatDateTime(info.last_viewed_at) })}
        </Text>
      ) : (
        <Text variant="small" color="textSecondary">
          {t('quoteSend.portal.notViewed')}
        </Text>
      )}
      {info.acceptance_comment ? (
        <Text variant="small" color="textSecondary">
          {t('quoteSend.portal.comment', { text: info.acceptance_comment })}
        </Text>
      ) : null}
      {choices > 0 ? (
        <>
          <Banner tone="info">{t('quoteSend.portal.selection', { count: choices })}</Banner>
          <Button
            label={t('quoteSend.portal.applySelection')}
            variant="secondary"
            loading={applySelection.isPending}
            onPress={() => applySelection.mutate(quoteId)}
          />
        </>
      ) : null}
      {pc ? (
        <Banner tone="warning">
          {t('quoteSend.portal.change', {
            name: pc.name,
            date: formatDateTime(pc.requested_at),
            guests: pc.guest_count ?? '–',
            text: pc.comment ?? '–',
          })}
        </Banner>
      ) : null}
      {pc ? (
        <Button
          label={t('quoteSend.portal.resolve')}
          variant="secondary"
          loading={resolve.isPending}
          onPress={() => resolve.mutate(quoteId)}
        />
      ) : null}
      {applySelection.error ? (
        <Banner tone="danger">{toAppError(applySelection.error).message}</Banner>
      ) : null}
      {resolve.error ? <Banner tone="danger">{toAppError(resolve.error).message}</Banner> : null}
    </View>
  );
}
