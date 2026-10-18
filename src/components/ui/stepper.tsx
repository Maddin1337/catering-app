import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { IconButton } from './icon-button';
import { Text } from './text';

/** Zahl mit − und + (Plätze, Personen): schneller als Tippen auf der Zifferntastatur. */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
  decreaseLabel = 'Weniger',
  increaseLabel = 'Mehr',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  decreaseLabel?: string;
  increaseLabel?: string;
}) {
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next === value) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(next);
  };
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label}>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <View style={styles.controls}>
        <IconButton
          icon={Minus}
          label={`${label}: ${decreaseLabel}`}
          disabled={value <= min}
          onPress={() => step(-1)}
          style={value <= min ? styles.off : undefined}
        />
        <Text variant="title2" tabular style={styles.value} accessibilityLiveRegion="polite">
          {value}
        </Text>
        <IconButton
          icon={Plus}
          label={`${label}: ${increaseLabel}`}
          disabled={value >= max}
          onPress={() => step(1)}
          style={value >= max ? styles.off : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3], minHeight: 48 },
  label: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  value: { minWidth: 32, textAlign: 'center' },
  off: { opacity: 0.4 },
});
