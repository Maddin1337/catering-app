import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepProgress } from '@/components/ui/step-progress';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ACCENT_SUGGESTIONS, normalizeHex, whiteTextReadable } from '@/lib/color';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { useCompanyProfile, useUpdateCompany } from '../api';

/** Vorschau, wie Portal-Kopf und Schaltfläche in der gewählten Farbe aussehen. */
export function BrandPreview({ name, color }: { name: string; color: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.preview} accessibilityLabel={t('company.branding.previewLabel')}>
      <Text variant="small" color="textTertiary">
        {t('company.branding.previewLabel')}
      </Text>
      <Text variant="title2">{name}</Text>
      <View style={[styles.previewButton, { backgroundColor: color }]}>
        <Text variant="bodyStrong" color="onAccent">
          {t('company.branding.previewButton')}
        </Text>
      </View>
    </View>
  );
}

/** SC-09 Onboarding 2 · Branding: Akzentfarbe mit Vorschau. Das Logo folgt in den Einstellungen. */
export function BrandingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useCompanyProfile();
  const update = useUpdateCompany();
  const [hex, setHex] = useState<string>(profile.data?.accent_color ?? ACCENT_SUGGESTIONS[0]);

  const valid = normalizeHex(hex);
  const readable = valid ? whiteTextReadable(valid) : true;

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
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {ACCENT_SUGGESTIONS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={c}
            accessibilityState={{ selected: valid === c }}
            onPress={() => setHex(c)}
            style={[styles.swatch, { backgroundColor: c }, valid === c && styles.swatchOn]}
          />
        ))}
      </View>
      <TextField
        label={t('company.branding.hex')}
        value={hex}
        onChangeText={setHex}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        error={valid ? undefined : t('company.branding.hexInvalid')}
      />
      {!readable ? <Banner tone="warning">{t('company.branding.contrast')}</Banner> : null}
      <BrandPreview name={profile.data?.name ?? ''} color={valid ?? tokens.color.accent} />
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

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: tokens.color.text },
  preview: {
    gap: tokens.space[2],
    padding: tokens.space[4],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
  },
  previewButton: {
    minHeight: tokens.touch.min,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
