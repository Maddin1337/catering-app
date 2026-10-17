import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

export type RadioOption<T extends string | number> = {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
};

/** Auswahlliste mit Radio-Zeilen; die ganze Zeile ist tippbar (docs/research M-A-02). */
export function RadioList<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <View style={styles.card}>
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!o.disabled }}
              accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
              disabled={o.disabled}
              onPress={() => onChange(o.value)}
              style={[styles.row, i > 0 && styles.divider, o.disabled && styles.disabled]}
            >
              <View style={styles.texts}>
                <Text variant="body">{o.label}</Text>
                {o.hint ? (
                  <Text variant="small" color="textTertiary">
                    {o.hint}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.borderInput,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.color.bg,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[2],
    gap: tokens.space[3],
  },
  divider: { borderTopWidth: 1, borderTopColor: tokens.color.border },
  disabled: { opacity: 0.5 },
  texts: { flex: 1 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.color.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: tokens.color.accent },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: tokens.color.accent },
});
