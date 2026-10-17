import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** „Schritt 2 von 3“ mit Balken (docs/research M-A-01). */
export function StepProgress({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.wrap}
    >
      <View style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentOn]} />
        ))}
      </View>
      <Text variant="caption" color="textTertiary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[2] },
  bar: { flexDirection: 'row', gap: tokens.space[1] },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: tokens.color.border },
  segmentOn: { backgroundColor: tokens.color.accent },
});
