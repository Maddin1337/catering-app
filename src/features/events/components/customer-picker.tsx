import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useCustomers, useSaveCustomer } from '../../customers/api';
import { searchCustomers } from '../../customers/duplicates';
import type { CustomerType } from '../../customers/types';

/** Kunde wählen (Suche ab 2 Zeichen) oder inline neu anlegen (SC-16). */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const customers = useCustomers();
  const save = useSaveCustomer();
  const [query, setQuery] = useState('');
  const [changing, setChanging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<CustomerType>('private');

  const selected = customers.data?.find((c) => c.id === value);
  const results = searchCustomers(customers.data ?? [], query).slice(0, 6);

  if (selected && !changing) {
    return (
      <View style={{ gap: 8 }}>
        <Text variant="small" color="textSecondary">
          {t('events.form.customer')}
        </Text>
        <Text variant="bodyStrong">{selected.name}</Text>
        <Button
          label={t('events.form.customerChange')}
          variant="ghost"
          onPress={() => setChanging(true)}
        />
      </View>
    );
  }

  const create = () => {
    save.mutate(
      {
        values: {
          type,
          name: query.trim(),
          contact_person: null,
          email: null,
          phone: null,
          billing_street: null,
          billing_postal_code: null,
          billing_city: null,
          vat_id: null,
          notes: null,
        },
      },
      {
        onSuccess: (id) => {
          onChange(id);
          setChanging(false);
          setCreating(false);
          setQuery('');
        },
      },
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <TextField
        label={t('events.form.customerSearch')}
        value={query}
        onChangeText={setQuery}
        error={error}
        autoCorrect={false}
      />
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      {query.trim().length >= 2
        ? results.map((c) => (
            <ListRow
              key={c.id}
              title={c.name}
              subtitle={c.contact_person ?? undefined}
              onPress={() => {
                onChange(c.id);
                setChanging(false);
              }}
            />
          ))
        : null}
      {query.trim().length >= 2 ? (
        creating ? (
          <View
            style={{
              gap: 8,
              padding: tokens.space[3],
              borderWidth: 1,
              borderColor: tokens.color.border,
              borderRadius: tokens.radius.md,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip
                label={t('customers.type.private')}
                selected={type === 'private'}
                onPress={() => setType('private')}
              />
              <Chip
                label={t('customers.type.business')}
                selected={type === 'business'}
                onPress={() => setType('business')}
              />
            </View>
            <Button
              label={t('events.form.customerCreate', { name: query.trim() })}
              loading={save.isPending}
              onPress={create}
            />
          </View>
        ) : (
          <Button
            label={t('events.form.customerCreate', { name: query.trim() })}
            variant="secondary"
            onPress={() => setCreating(true)}
          />
        )
      ) : null}
    </View>
  );
}
