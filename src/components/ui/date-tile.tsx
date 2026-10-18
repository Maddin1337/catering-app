import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { weekday } from '@/lib/berlin';
import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Datumskachel für Listen: Wochentag über dem Tag des Monats (Ortsdatum `YYYY-MM-DD`). */
export function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const { t } = useTranslation();
  const names = t('start.week.days', { returnObjects: true }) as string[];
  return (
    <View
      style={[styles.tile, muted && styles.muted]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="caption" color={muted ? 'textTertiary' : 'accent'}>
        {names[weekday(date)]}
      </Text>
      <Text variant="title2" color={muted ? 'textTertiary' : 'text'}>
        {Number(date.slice(8))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 52,
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { backgroundColor: tokens.color.bgMuted },
});
