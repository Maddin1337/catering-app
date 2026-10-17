import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Checkbox mit Text daneben; die ganze Zeile ist tippbar (Ziel ≥ 48 dp). */
export function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxOn, !!error && styles.boxError]}>
          {checked ? (
            <Text variant="caption" color="onAccent">
              ✓
            </Text>
          ) : null}
        </View>
        <View style={styles.label}>
          <Text variant="body">{label}</Text>
        </View>
      </Pressable>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  row: {
    minHeight: tokens.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.sm,
    borderWidth: 2,
    borderColor: tokens.color.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg,
  },
  boxOn: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  boxError: { borderColor: tokens.color.danger },
  label: { flex: 1 },
});
