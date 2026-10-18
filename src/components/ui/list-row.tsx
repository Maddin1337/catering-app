import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Surface } from './surface';
import { Text } from './text';

/** Zeile in Listen: Titel, Untertitel, rechts Zusatz (z. B. Badge). Tippbar, wenn `onPress` gesetzt ist. */
export function ListRow({
  title,
  subtitle,
  right,
  leading,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Element links vor dem Text, z. B. ein Avatar. */
  leading?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Surface onPress={onPress} accessibilityLabel={title} style={styles.row}>
      {leading}
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <ChevronRight color={tokens.color.textTertiary} size={20} /> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
  },
  texts: { flex: 1, gap: 2 },
});
