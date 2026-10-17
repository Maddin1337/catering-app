import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { Allergen, Diet } from '@/lib/dietary';
import { tokens } from '@/theme/tokens';

import { ALLERGEN_LETTER } from '../types';

/** Allergen-Kurzcodes (A, C, G …) als kleine Plaketten; Screenreader lesen die vollen Namen. */
export function AllergenCodes({ allergens }: { allergens: Allergen[] }) {
  const { t } = useTranslation();
  if (allergens.length === 0) return null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${t('catalog.allergens')}: ${allergens.map((a) => t(`allergen.${a}`)).join(', ')}`}
    >
      {allergens.map((a) => (
        <View key={a} style={styles.code}>
          <Text variant="caption" color="textSecondary">
            {ALLERGEN_LETTER[a]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Kennzeichen für Diätformen („Vegan“, „Glutenfrei“ …). */
export function DietTags({ diets }: { diets: Diet[] }) {
  const { t } = useTranslation();
  if (diets.length === 0) return null;
  return (
    <View style={styles.row}>
      {diets.map((d) => (
        <View key={d} style={styles.tag}>
          <Text variant="caption" color="accent">
            {t(`diet.${d}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[1] },
  code: {
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.color.borderInput,
    paddingHorizontal: 4,
  },
  tag: {
    paddingHorizontal: tokens.space[2],
    height: 22,
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.accentSubtle,
  },
});
