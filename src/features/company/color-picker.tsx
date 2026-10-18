import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ACCENT_SUGGESTIONS, normalizeHex, whiteTextReadable } from '@/lib/color';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

/** Vorschau, wie Portal-Kopf und Schaltfläche in der gewählten Farbe aussehen. */
function BrandPreview({ name, color }: { name: string; color: string }) {
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

/** Akzentfarbe wählen: Vorschläge, eigener Hex-Wert, Kontrastwarnung und Vorschau (SC-09, SC-59). */
export function ColorPicker({
  hex,
  onChangeHex,
  companyName,
}: {
  hex: string;
  onChangeHex: (hex: string) => void;
  companyName: string;
}) {
  const { t } = useTranslation();
  const valid = normalizeHex(hex);
  const readable = valid ? whiteTextReadable(valid) : true;
  return (
    <>
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {ACCENT_SUGGESTIONS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={c}
            accessibilityState={{ selected: valid === c }}
            onPress={() => onChangeHex(c)}
            style={[styles.swatch, { backgroundColor: c }, valid === c && styles.swatchOn]}
          />
        ))}
      </View>
      <TextField
        label={t('company.branding.hex')}
        value={hex}
        onChangeText={onChangeHex}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        error={valid ? undefined : t('company.branding.hexInvalid')}
      />
      {!readable ? <Banner tone="warning">{t('company.branding.contrast')}</Banner> : null}
      <BrandPreview name={companyName} color={valid ?? tokens.color.accent} />
    </>
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
    ...surfaceStyle(),
  },
  previewButton: {
    minHeight: tokens.touch.min,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
