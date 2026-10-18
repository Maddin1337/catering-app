import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';

import { useEvents } from '../../events/api';
import { StatusBadge } from '../../events/components/status-badge';
import { useCustomers, useDeleteCustomer } from '../api';

/** SC-36 Kundendetail: Kontakt, Rechnungsanschrift, Notiz und Aufträge. */
export function CustomerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomers().data?.find((c) => c.id === id);
  const events = (useEvents().data ?? [])
    .filter((e) => e.customer_id === id)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const del = useDeleteCustomer();

  if (!customer) {
    return (
      <Screen
        title={t('customers.detail.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const remove = async () => {
    if (
      await confirm(
        t('customers.detail.deleteTitle', { name: customer.name }),
        t('customers.detail.deleteBody'),
        t('customers.detail.delete'),
        t('common.cancel'),
      )
    ) {
      del.mutate(id!, { onSuccess: () => router.back() });
    }
  };
  const billing = [
    customer.billing_street,
    [customer.billing_postal_code, customer.billing_city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Screen
      title={customer.name}
      subtitle={t(`customers.type.${customer.type}`)}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {del.error ? <Banner tone="danger">{toAppError(del.error).message}</Banner> : null}
      <View style={{ gap: 8 }}>
        {customer.contact_person ? <Text variant="body">{customer.contact_person}</Text> : null}
        {customer.phone ? (
          <Button
            label={`${t('customers.detail.call')}: ${customer.phone}`}
            variant="secondary"
            onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
          />
        ) : null}
        {customer.email ? (
          <Button
            label={`${t('customers.detail.mail')}: ${customer.email}`}
            variant="secondary"
            onPress={() => void Linking.openURL(`mailto:${customer.email}`)}
          />
        ) : null}
        {billing ? (
          <View>
            <Text variant="small" color="textSecondary">
              {t('customers.detail.billing')}
            </Text>
            <Text variant="body">{billing}</Text>
          </View>
        ) : null}
        {customer.notes ? (
          <View>
            <Text variant="small" color="textSecondary">
              {t('customers.detail.notes')}
            </Text>
            <Text variant="body">{customer.notes}</Text>
          </View>
        ) : null}
      </View>
      <Button
        label={t('customers.detail.newEvent')}
        onPress={() =>
          router.push({ pathname: '/events/intake', params: { customerId: customer.id } })
        }
      />
      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('customers.detail.events')}</Text>
        {events.length === 0 ? (
          <Text variant="body" color="textSecondary">
            {t('customers.detail.noEvents')}
          </Text>
        ) : null}
        {events.map((e) => (
          <View key={e.id} style={{ gap: 4 }}>
            <Button
              label={`${formatDate(e.starts_at)} · ${e.title}`}
              variant="secondary"
              onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
            />
            <StatusBadge status={e.status} />
          </View>
        ))}
      </View>
      <Button
        label={t('customers.detail.edit')}
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/customers/[id]/edit', params: { id: customer.id } })
        }
      />
      <Button
        label={t('customers.detail.delete')}
        variant="danger"
        loading={del.isPending}
        onPress={() => void remove()}
      />
    </Screen>
  );
}
