import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ACCENT_SUGGESTIONS, normalizeHex } from '@/lib/color';
import { toAppError } from '@/lib/errors';
import { logoUrl } from '@/lib/logo';

import { ColorPicker } from '../../company/color-picker';
import { useCompanySettings, useRemoveLogo, useUpdateCompanySettings, useUploadLogo } from '../api';

/** SC-59 Branding: Logo (PNG oder JPEG, höchstens 2 MB) und Akzentfarbe. */
export function BrandingSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const upload = useUploadLogo();
  const removeLogo = useRemoveLogo();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hex = draft ?? settings.data?.accent_color ?? ACCENT_SUGGESTIONS[0];
  const valid = normalizeHex(hex);
  const logo = logoUrl(settings.data?.logo_path);

  const pickLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    upload.mutate({ uri: a.uri, mimeType: a.mimeType, file: a.file });
  };

  return (
    <Screen
      title={t('settings.branding.title')}
      subtitle={t('settings.branding.body')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {update.error || upload.error || removeLogo.error ? (
        <Banner tone="danger">
          {toAppError(update.error ?? upload.error ?? removeLogo.error).message}
        </Banner>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('settings.branding.logo')}</Text>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ width: 220, height: 80 }}
            contentFit="contain"
            accessibilityLabel={t('settings.branding.logo')}
          />
        ) : (
          <Text variant="small" color="textSecondary">
            {t('settings.branding.logoNone')}
          </Text>
        )}
        <Button
          label={logo ? t('settings.branding.logoChange') : t('settings.branding.logoPick')}
          variant="secondary"
          loading={upload.isPending}
          onPress={() => void pickLogo()}
        />
        {logo ? (
          <Button
            label={t('settings.branding.logoRemove')}
            variant="ghost"
            loading={removeLogo.isPending}
            onPress={() => removeLogo.mutate()}
          />
        ) : null}
        <Text variant="small" color="textTertiary">
          {t('settings.branding.logoHint')}
        </Text>
      </View>
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
