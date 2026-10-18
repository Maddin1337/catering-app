import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { Chip } from '@/components/ui/chip';
import { ChipRow } from '@/components/ui/chip-row';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SearchField } from '@/components/ui/search-field';
import { SkeletonList } from '@/components/ui/skeleton';
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
    <Screen
      title={t('customers.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        <IconButton
          icon={Plus}
          label={t('customers.add')}
          onPress={() => router.push('/customers/new')}
        />
      }
      menu={[
        {
          label: t('customers.import.open'),
          icon: FileSpreadsheet,
          onPress: () => router.push('/customers/import'),
        },
      ]}
      onRefresh={() => void customers.refetch()}
      refreshing={customers.isRefetching}
    >
      {customers.error ? (
        <Banner tone="danger">{toAppError(customers.error).message}</Banner>
      ) : null}
      <SearchField
        label={t('customers.search')}
        clearLabel={t('common.clear')}
        value={query}
        onChangeText={setQuery}
      />
      <ChipRow>
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
      </ChipRow>
      {customers.isPending ? <SkeletonList /> : null}
      {!customers.isPending && (customers.data ?? []).length === 0 ? (
        <EmptyState icon={Users} tint="sky" text={t('customers.empty')} />
      ) : null}
      <View style={{ gap: 8 }}>
        {shown.map((c, i) => (
          <Appear key={c.id} index={i}>
            <ListRow
              title={c.name}
              leading={<Avatar name={c.name} />}
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
          </Appear>
        ))}
      </View>
    </Screen>
  );
}
