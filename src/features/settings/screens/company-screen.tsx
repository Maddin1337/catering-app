import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { showToast } from '@/components/ui/toast';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useCompanySettings, useUpdateCompanySettings } from '../api';
import type { CompanySettings } from '../types';

type Key =
  | 'name'
  | 'contact_email'
  | 'phone'
  | 'website'
  | 'street'
  | 'postal_code'
  | 'city'
  | 'vat_id'
  | 'tax_number'
  | 'footer_text'
  | 'privacy_policy_url'
  | 'imprint_url';

const FIELDS: Key[] = [
  'name',
  'contact_email',
  'phone',
  'website',
  'street',
  'postal_code',
  'city',
  'vat_id',
  'tax_number',
  'footer_text',
  'privacy_policy_url',
  'imprint_url',
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** SC-58 Firma: Stammdaten für Angebote, Rechnungen und das Kundenportal. */
export function CompanyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});

  const value = (k: Key) => draft[k] ?? (settings.data?.[k] as string | null | undefined) ?? '';
  const set = (k: Key) => (v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const nameError = value('name').trim() === '' ? t('company.validation.nameRequired') : undefined;
  const emailError = EMAIL.test(value('contact_email').trim())
    ? undefined
    : t('auth.validation.emailInvalid');

  const save = () => {
    const values: Partial<CompanySettings> = {};
    for (const k of FIELDS) {
      const v = value(k).trim();
      (values as Record<string, string | null>)[k] =
        v === '' && k !== 'name' && k !== 'contact_email' ? null : v;
    }
    update.mutate(values, {
      onSuccess: () => {
        showToast(t('common.saved'));
        setDraft({});
      },
    });
  };

  return (
    <Screen
      title={t('settings.company.title')}
      subtitle={t('settings.company.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      footer={
        <Button
          style={{ flex: 1 }}
          label={t('common.save')}
          disabled={!!nameError || !!emailError || Object.keys(draft).length === 0}
          loading={update.isPending}
          onPress={save}
        />
      }
    >
      {settings.error || update.error ? (
        <Banner tone="danger">{toAppError(settings.error ?? update.error).message}</Banner>
      ) : null}
      <View style={{ gap: 16 }}>
        {FIELDS.map((k) => (
          <TextField
            key={k}
            label={t(`settings.company.fields.${k}`)}
            value={value(k)}
            onChangeText={set(k)}
            error={k === 'name' ? nameError : k === 'contact_email' ? emailError : undefined}
            multiline={k === 'footer_text'}
            autoCapitalize={
              ['contact_email', 'website', 'privacy_policy_url', 'imprint_url'].includes(k)
                ? 'none'
                : 'sentences'
            }
            inputMode={
              k === 'contact_email'
                ? 'email'
                : k === 'phone'
                  ? 'tel'
                  : k.endsWith('_url') || k === 'website'
                    ? 'url'
                    : undefined
            }
          />
        ))}
      </View>
    </Screen>
  );
}
