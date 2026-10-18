import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useCustomers, useSaveCustomer } from '../api';
import { findDuplicate } from '../duplicates';
import type { Customer, CustomerType } from '../types';

type Values = Omit<Customer, 'id'>;
const EMPTY: Values = {
  type: 'private',
  name: '',
  contact_person: null,
  email: null,
  phone: null,
  billing_street: null,
  billing_postal_code: null,
  billing_city: null,
  vat_id: null,
  notes: null,
};
const TEXT_FIELDS = [
  'contact_person',
  'email',
  'phone',
  'billing_street',
  'billing_postal_code',
  'billing_city',
  'vat_id',
  'notes',
] as const;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** SC-37 Kunde anlegen/bearbeiten mit Duplikatwarnung (US-09.5). */
export function CustomerFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const customers = useCustomers();
  const existing = id ? customers.data?.find((c) => c.id === id) : undefined;

  if (id && customers.isPending) {
    return (
      <Screen
        title={t('customers.form.edit')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  return <CustomerForm key={id ?? 'new'} existing={existing} others={customers.data ?? []} />;
}

function CustomerForm({
  existing,
  others,
}: {
  existing: Customer | undefined;
  others: Customer[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveCustomer();
  const [v, setV] = useState<Values>(existing ? { ...EMPTY, ...existing } : EMPTY);
  const [tried, setTried] = useState(false);

  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((cur) => ({ ...cur, [k]: value }));
  const nameError = v.name.trim() === '' ? t('customers.form.nameError') : undefined;
  const emailError =
    v.email && v.email.trim() !== '' && !EMAIL.test(v.email.trim())
      ? t('customers.form.emailError')
      : undefined;
  const duplicate = findDuplicate(others, { name: v.name, email: v.email ?? '' }, existing?.id);

  const submit = () => {
    setTried(true);
    if (nameError || emailError) return;
    save.mutate(
      { id: existing?.id, values: v },
      {
        onSuccess: () => {
          showToast(t('common.saved'));
          router.back();
        },
      },
    );
  };

  return (
    <Screen
      title={existing ? t('customers.form.edit') : t('customers.form.new')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      footer={
        <Button
          style={{ flex: 1 }}
          label={t('common.save')}
          loading={save.isPending}
          onPress={submit}
        />
      }
      backIcon={existing ? 'back' : 'close'}
    >
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      <RadioList
        label={t('customers.form.type')}
        value={v.type}
        onChange={(x: CustomerType) => set('type', x)}
        options={[
          { value: 'private', label: t('customers.type.private') },
          { value: 'business', label: t('customers.type.business') },
        ]}
      />
      <View style={{ gap: 16 }}>
        <TextField
          label={t('customers.form.name')}
          value={v.name}
          onChangeText={(x) => set('name', x)}
          error={tried ? nameError : undefined}
          maxLength={120}
          autoCapitalize="words"
        />
        {duplicate ? (
          <View style={{ gap: 8 }}>
            <Banner tone="warning">
              {t('customers.form.duplicate', { name: duplicate.name })}
            </Banner>
            <Button
              label={t('customers.form.openDuplicate')}
              variant="secondary"
              onPress={() =>
                router.replace({ pathname: '/customers/[id]', params: { id: duplicate.id } })
              }
            />
          </View>
        ) : null}
        {TEXT_FIELDS.map((k) => (
          <TextField
            key={k}
            label={t(`customers.form.${k}`)}
            value={v[k] ?? ''}
            onChangeText={(x) => set(k, x)}
            error={k === 'email' && tried ? emailError : undefined}
            multiline={k === 'notes'}
            inputMode={k === 'email' ? 'email' : k === 'phone' ? 'tel' : undefined}
            autoCapitalize={k === 'email' ? 'none' : 'sentences'}
          />
        ))}
      </View>
    </Screen>
  );
}
