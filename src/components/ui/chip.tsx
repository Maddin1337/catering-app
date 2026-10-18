import { StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** Auswahl-Chip für Filter und Kennzeichen; Zielhöhe 40 dp mit Tippfläche-Erweiterung. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      scale={0.95}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, selected && styles.on]}
    >
      <Text variant="small" color={selected ? 'onAccent' : 'text'} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: tokens.font.semibold },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.bg,
  },
  on: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
});
