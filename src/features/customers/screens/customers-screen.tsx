import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { formatDate } from '@/lib/dates';
import { toAppError } from '@/lib/errors';

import { useEvents } from '../../events/api';
import { useCustomers } from '../api';
import { searchCustomers } from '../duplicates';
import type { CustomerType } from '../types';

/** SC-35 Kunden: Suche ab 2 Zeichen, Filter privat/geschäftlich, nächster Auftrag. */
export function CustomersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const customers = useCustomers();
  const events = useEvents();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CustomerType | null>(null);

  const nextEvent = useMemo(() => {
    const now = new Date().toISOString();
    const map = new Map<string, string>();
    for (const e of events.data ?? []) {
      if (!e.customer_id || e.starts_at < now || ['declined', 'cancelled'].includes(e.status))
        continue;
      const cur = map.get(e.customer_id);
      if (!cur || e.starts_at < cur) map.set(e.customer_id, e.starts_at);
    }
    return map;
  }, [events.data]);

  const shown = searchCustomers(customers.data ?? [], query).filter(
    (c) => !type || c.type === type,
  );

  return (
    <Screen title={t('customers.title')} onBack={() => router.back()} backLabel={t('common.back')}>
      {customers.error ? (
        <Banner tone="danger">{toAppError(customers.error).message}</Banner>
      ) : null}
      <Button label={t('customers.add')} onPress={() => router.push('/customers/new')} />
      <Button
        label={t('customers.import.open')}
        variant="secondary"
        onPress={() => router.push('/customers/import')}
      />
      <TextField
        label={t('customers.search')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={t('customers.all')} selected={type === null} onPress={() => setType(null)} />
        <Chip
          label={t('customers.type.business')}
          selected={type === 'business'}
          onPress={() => setType(type === 'business' ? null : 'business')}
        />
        <Chip
          label={t('customers.type.private')}
          selected={type === 'private'}
          onPress={() => setType(type === 'private' ? null : 'private')}
        />
      </View>
      {!customers.isPending && (customers.data ?? []).length === 0 ? (
        <Banner tone="info">{t('customers.empty')}</Banner>
      ) : null}
      <View style={{ gap: 8 }}>
        {shown.map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={[
              c.contact_person,
              nextEvent.has(c.id)
                ? t('customers.next', { date: formatDate(nextEvent.get(c.id)!) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })}
          />
        ))}
      </View>
    </Screen>
  );
}
