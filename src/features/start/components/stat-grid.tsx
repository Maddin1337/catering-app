import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { tints, tokens, type Tint } from '@/theme/tokens';

export type StatTile = {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tint: Tint;
  onPress?: () => void;
};

/** Kennzahlen als zwei Spalten: große Zahl, Beschriftung, Symbol-Plakette. Tippbar, wenn es ein Ziel gibt. */
export function StatGrid({ tiles }: { tiles: StatTile[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map(({ key, label, value, icon: Icon, tint, onPress }) => (
        <Surface
          key={key}
          onPress={onPress}
          accessibilityLabel={`${label}: ${value}`}
          style={styles.tile}
        >
          <View style={[styles.badge, { backgroundColor: tints[tint].bg }]}>
            <Icon color={tints[tint].fg} size={18} strokeWidth={2.2} />
          </View>
          <Text variant="display" tabular style={styles.value}>
            {value}
          </Text>
          <Text variant="small" color="textSecondary">
            {label}
          </Text>
        </Surface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 0, padding: tokens.space[4] },
  badge: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { marginTop: tokens.space[1] },
});
