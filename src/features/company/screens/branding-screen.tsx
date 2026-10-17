import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepProgress } from '@/components/ui/step-progress';
import { Text } from '@/components/ui/text';
import { ACCENT_SUGGESTIONS, normalizeHex } from '@/lib/color';
import { toAppError } from '@/lib/errors';

import { useCompanyProfile, useUpdateCompany } from '../api';
import { ColorPicker } from '../color-picker';

/** SC-09 Onboarding 2 · Branding: Akzentfarbe mit Vorschau. Das Logo folgt in den Einstellungen. */
export function BrandingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useCompanyProfile();
  const update = useUpdateCompany();
  const [hex, setHex] = useState<string>(profile.data?.accent_color ?? ACCENT_SUGGESTIONS[0]);
  const valid = normalizeHex(hex);

  const save = () => {
    if (!valid) return;
    update.mutate(
      { accent_color: valid },
      { onSuccess: () => router.push('/onboarding/defaults') },
    );
  };

  return (
    <Screen title={t('company.branding.title')} subtitle={t('company.branding.body')}>
      <StepProgress step={2} total={3} label={t('company.step', { current: 2, total: 3 })} />
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      <ColorPicker hex={hex} onChangeHex={setHex} companyName={profile.data?.name ?? ''} />
      <Text variant="small" color="textTertiary">
        {t('company.branding.logoLater')}
      </Text>
      <Button
        label={t('common.next')}
        disabled={!valid}
        loading={update.isPending}
        onPress={save}
      />
      <Button
        label={t('common.skip')}
        variant="ghost"
        onPress={() => router.push('/onboarding/defaults')}
      />
    </Screen>
  );
}
