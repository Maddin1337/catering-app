import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { showToast } from '@/components/ui/toast';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';

import { useCompanySettings, useUpdateCompanySettings } from '../api';
import {
  parseDefaults,
  ROUNDING_STEPS,
  toDefaultsForm,
  type DefaultsErrors,
  type DefaultsForm,
} from '../defaults';

type NumberField =
  | 'cancelHours'
  | 'leadHours'
  | 'leadHoursLunch'
  | 'validityDays'
  | 'markupPercent'
  | 'bufferPercent';
const NUMBER_FIELDS: NumberField[] = [
  'cancelHours',
  'leadHours',
  'leadHoursLunch',
  'validityDays',
  'markupPercent',
  'bufferPercent',
];

/** SC-62 Fristen & Standardwerte: Regeln des Betriebs mit Beispielen. */
export function DefaultsSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [draft, setDraft] = useState<Partial<DefaultsForm>>({});
  const [errors, setErrors] = useState<DefaultsErrors>({});

  if (!settings.data) {
    return (
      <Screen
        title={t('settings.defaults.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        {settings.error ? (
          <Banner tone="danger">{toAppError(settings.error).message}</Banner>
        ) : null}
      </Screen>
    );
  }

  const form: DefaultsForm = { ...toDefaultsForm(settings.data), ...draft };
  const change = <K extends keyof DefaultsForm>(k: K, v: DefaultsForm[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const save = () => {
    const result = parseDefaults(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    update.mutate(result.value, {
      onSuccess: () => {
        showToast(t('common.saved'));
        setDraft({});
      },
    });
  };

  return (
    <Screen
      title={t('settings.defaults.title')}
      subtitle={t('settings.defaults.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      footer={
        <Button
          style={{ flex: 1 }}
          label={t('common.save')}
          disabled={Object.keys(draft).length === 0}
          loading={update.isPending}
          onPress={save}
        />
      }
    >
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        {NUMBER_FIELDS.map((k) => (
          <TextField
            key={k}
            label={t(`settings.defaults.fields.${k}.label`)}
            helper={t(`settings.defaults.fields.${k}.help`)}
            value={form[k]}
            onChangeText={(v) => change(k, v)}
            error={errors[k] ? t(errors[k]) : undefined}
            inputMode={k.endsWith('Percent') ? 'decimal' : 'numeric'}
            keyboardType={k.endsWith('Percent') ? 'decimal-pad' : 'number-pad'}
          />
        ))}
        <RadioList
          label={t('settings.defaults.pricingMode')}
          value={form.pricingMode}
          onChange={(v) => change('pricingMode', v)}
          options={[
            {
              value: 'flat',
              label: t('company.defaults.pricingFlat'),
              hint: t('company.defaults.pricingFlatHint'),
            },
            {
              value: 'cost_based',
              label: t('company.defaults.pricingCost'),
              hint: t('company.defaults.pricingCostHint'),
            },
          ]}
        />
        <RadioList
          label={t('settings.defaults.rounding')}
          value={form.rounding}
          onChange={(v) => change('rounding', v)}
          options={ROUNDING_STEPS.map((c) => ({
            value: c,
            label: formatCents(c),
            hint: c === 10 ? t('settings.defaults.roundingHint') : undefined,
          }))}
        />
      </View>
    </Screen>
  );
}
