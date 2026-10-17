import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ACCENT_SUGGESTIONS, normalizeHex } from '@/lib/color';
import { toAppError } from '@/lib/errors';

import { ColorPicker } from '../../company/color-picker';
import { useCompanySettings, useUpdateCompanySettings } from '../api';

/** SC-59 Branding: Akzentfarbe. Das Logo folgt mit dem nächsten App-Build (Foto-Auswahl). */
export function BrandingSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hex = draft ?? settings.data?.accent_color ?? ACCENT_SUGGESTIONS[0];
  const valid = normalizeHex(hex);

  return (
    <Screen
      title={t('settings.branding.title')}
      subtitle={t('settings.branding.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {update.error ? <Banner tone="danger">{toAppError(update.error).message}</Banner> : null}
      {saved ? <Banner tone="success">{t('common.saved')}</Banner> : null}
      <ColorPicker
        hex={hex}
        onChangeHex={(v) => {
          setSaved(false);
          setDraft(v);
        }}
        companyName={settings.data?.name ?? ''}
      />
      <Text variant="small" color="textTertiary">
        {t('settings.branding.note')}
      </Text>
      <Button
        label={t('common.save')}
        disabled={!valid || draft === null}
        loading={update.isPending}
        onPress={() =>
          valid &&
          update.mutate(
            { accent_color: valid },
            {
              onSuccess: () => {
                setSaved(true);
                setDraft(null);
              },
            },
          )
        }
      />
    </Screen>
  );
}
