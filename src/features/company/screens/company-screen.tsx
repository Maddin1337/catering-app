import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { StepProgress } from '@/components/ui/step-progress';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';

import { useSession } from '../../auth/session-provider';
import { useCreateCompany } from '../api';
import { createCompanySchema, type CreateCompanyFormValues } from '../schemas';

// Apple-Relay-Adressen taugen nicht als Reply-To (docs/01 US-01.4): Das Feld bleibt dann leer.
const isAppleRelay = (email: string) => email.toLowerCase().endsWith('@privaterelay.appleid.com');

/** SC-08 Onboarding 1 · Firma: Pflichtdaten, Firma und Testphase anlegen. */
export function CompanyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const create = useCreateCompany();
  const accountEmail = session?.user.email ?? '';

  const { control, handleSubmit } = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: '',
      contactEmail: isAppleRelay(accountEmail) ? '' : accountEmail,
      acceptAvv: false,
    },
  });

  // Danach wechselt das Gate von selbst in das Onboarding (neue Mitgliedschaft).
  const submit = handleSubmit((v) =>
    create.mutate(v, { onSuccess: () => router.replace('/onboarding/branding') }),
  );

  return (
    <Screen title={t('company.company.title')} subtitle={t('company.company.body')}>
      <StepProgress step={1} total={3} label={t('company.step', { current: 1, total: 3 })} />
      {create.error ? <Banner tone="danger">{toAppError(create.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label={t('company.company.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              maxLength={120}
              autoComplete="organization"
              autoCapitalize="words"
            />
          )}
        />
        <RadioList
          label={t('company.company.country')}
          value="DE"
          onChange={() => undefined}
          options={[
            { value: 'DE', label: t('company.country.DE') },
            {
              value: 'AT',
              label: t('company.country.AT'),
              hint: t('company.company.soon'),
              disabled: true,
            },
            {
              value: 'CH',
              label: t('company.country.CH'),
              hint: t('company.company.soon'),
              disabled: true,
            },
          ]}
        />
        <Controller
          control={control}
          name="contactEmail"
          render={({ field, fieldState }) => (
            <TextField
              label={t('company.company.email')}
              helper={t('company.company.emailHint')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
            />
          )}
        />
        <Controller
          control={control}
          name="acceptAvv"
          render={({ field, fieldState }) => (
            <Checkbox
              label={t('company.company.avv')}
              checked={field.value}
              onChange={field.onChange}
              error={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            />
          )}
        />
      </View>
      <Button
        label={t('company.company.submit')}
        loading={create.isPending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
