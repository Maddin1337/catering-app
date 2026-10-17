import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useCompanyDetails, useUpdateCompanyDetails, type CompanyDetails } from '../api';

const EMPTY: CompanyDetails = {
  name: '',
  phone: '',
  contact_email: '',
  street: '',
  postal_code: '',
  city: '',
  vat_id: '',
  tax_number: '',
};

const FIELDS: { key: keyof CompanyDetails; label: string }[] = [
  { key: 'name', label: 'settings.name' },
  { key: 'contact_email', label: 'settings.email' },
  { key: 'phone', label: 'settings.phone' },
  { key: 'street', label: 'settings.street' },
  { key: 'postal_code', label: 'settings.postalCode' },
  { key: 'city', label: 'settings.city' },
  { key: 'vat_id', label: 'settings.vatId' },
  { key: 'tax_number', label: 'settings.taxNumber' },
];

/** Firmendaten (SC-57): erscheinen später auf Angeboten und Rechnungen. */
export function CompanySettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const details = useCompanyDetails();
  const update = useUpdateCompanyDetails();
  // Änderungen stehen im Entwurf; bis dahin gelten die gespeicherten Werte.
  const [draft, setDraft] = useState<Partial<CompanyDetails>>({});
  const [saved, setSaved] = useState(false);
  const form: CompanyDetails = { ...EMPTY, ...details.data, ...draft };

  const set = (key: keyof CompanyDetails) => (value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const nameError = form.name.trim() === '' ? t('company.validation.nameRequired') : undefined;
  const emailError = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact_email.trim())
    ? undefined
    : t('auth.validation.emailInvalid');

  const save = () => {
    const clean = (v: string | null) => (v?.trim() ? v.trim() : null);
    update.mutate(
      {
        name: form.name.trim(),
        contact_email: form.contact_email.trim(),
        phone: clean(form.phone),
        street: clean(form.street),
        postal_code: clean(form.postal_code),
        city: clean(form.city),
        vat_id: clean(form.vat_id),
        tax_number: clean(form.tax_number),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Screen
      title={t('settings.title')}
      subtitle={t('settings.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {details.error || update.error ? (
        <Banner tone="danger">{toAppError(details.error ?? update.error).message}</Banner>
      ) : null}
      {saved ? <Banner tone="success">{t('common.saved')}</Banner> : null}
      <View style={{ gap: 16 }}>
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={t(label)}
            value={form[key] ?? ''}
            onChangeText={set(key)}
            error={key === 'name' ? nameError : key === 'contact_email' ? emailError : undefined}
            autoCapitalize={key === 'contact_email' ? 'none' : 'words'}
            inputMode={key === 'contact_email' ? 'email' : key === 'phone' ? 'tel' : undefined}
          />
        ))}
      </View>
      <Button
        label={t('common.save')}
        disabled={!!nameError || !!emailError}
        loading={update.isPending}
        onPress={save}
      />
    </Screen>
  );
}
