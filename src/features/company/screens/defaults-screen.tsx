import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { StepProgress } from '@/components/ui/step-progress';
import { Text } from '@/components/ui/text';
import { toAppError } from '@/lib/errors';

import { useMarkTaxRatesReviewed, useTaxRates, useUpdateCompany } from '../api';

const formatRate = (bp: number) => `${(bp / 100).toLocaleString('de-DE')} %`;

/** SC-10 Onboarding 3 · Arbeitsweise: vorbelegte Standards bestätigen. */
export function DefaultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useUpdateCompany();
  const mark = useMarkTaxRatesReviewed();
  const taxRates = useTaxRates();

  const [pricing, setPricing] = useState<'flat' | 'cost_based'>('flat');
  const [cancelHours, setCancelHours] = useState(48);
  const [leadHours, setLeadHours] = useState(72);
  const [reviewed, setReviewed] = useState(false);

  const error = update.error ?? mark.error;

  const save = async () => {
    try {
      await update.mutateAsync({
        default_pricing_mode: pricing,
        shift_cancel_deadline_hours: cancelHours,
        portal_change_lead_hours: leadHours,
      });
      if (reviewed) await mark.mutateAsync();
      router.push('/onboarding/done');
    } catch {
      // Fehler stehen in update.error bzw. mark.error und werden angezeigt.
    }
  };

  return (
    <Screen title={t('company.defaults.title')} subtitle={t('company.defaults.body')}>
      <StepProgress step={3} total={3} label={t('company.step', { current: 3, total: 3 })} />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <RadioList
        label={t('company.defaults.pricing')}
        value={pricing}
        onChange={setPricing}
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
        label={t('company.defaults.cancel')}
        value={cancelHours}
        onChange={setCancelHours}
        options={[24, 48, 72].map((h) => ({
          value: h,
          label: t('company.defaults.hours', { hours: h }),
        }))}
      />
      <RadioList
        label={t('company.defaults.lead')}
        value={leadHours}
        onChange={setLeadHours}
        options={[48, 72, 120].map((h) => ({
          value: h,
          label: t('company.defaults.hours', { hours: h }),
          hint: h === 72 ? t('company.defaults.leadHint') : undefined,
        }))}
      />
      <View style={{ gap: 8 }}>
        <Text variant="small" color="textSecondary">
          {t('company.defaults.tax')}
        </Text>
        {(taxRates.data ?? []).map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">{r.name.replace(/ \d+ %$/, '')}</Text>
            <Text variant="body" tabular>
              {formatRate(r.rate_bp)}
            </Text>
          </View>
        ))}
        <Checkbox
          label={t('company.defaults.taxReviewed')}
          checked={reviewed}
          onChange={setReviewed}
        />
        <Text variant="caption" color="textTertiary">
          {t('company.defaults.taxHint')}
        </Text>
      </View>
      <Button
        label={t('company.defaults.submit')}
        loading={update.isPending || mark.isPending}
        onPress={() => void save()}
      />
      <Button
        label={t('common.skip')}
        variant="ghost"
        onPress={() => router.push('/onboarding/done')}
      />
    </Screen>
  );
}
