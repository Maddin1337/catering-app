import { Pressable, StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

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
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      disabled={!onPress}
      hitSlop={4}
      onPress={onPress}
      style={[styles.chip, selected && styles.on]}
    >
      <Text variant="small" color={selected ? 'onAccent' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.borderInput,
    backgroundColor: tokens.color.bg,
  },
  on: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
});
