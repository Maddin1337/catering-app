import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { tokens } from '@/theme/tokens';

/** Suchfeld als Pille mit Lupe und Löschen-Knopf. Die Beschriftung dient als Platzhalter und Zugänglichkeitsname. */
export function SearchField({
  label,
  value,
  onChangeText,
  clearLabel = 'Leeren',
  ...rest
}: Omit<TextInputProps, 'style' | 'placeholder' | 'accessibilityLabel'> & {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  clearLabel?: string;
}) {
  return (
    <View style={styles.field}>
      <Search color={tokens.color.textTertiary} size={20} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={tokens.color.textTertiary}
        returnKeyType="search"
        autoCorrect={false}
        {...rest}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <X color={tokens.color.textSecondary} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: tokens.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bg,
    borderWidth: 1,
    borderColor: tokens.color.borderInput,
  },
  // 16 px, damit iOS Safari im Web nicht zoomt.
  input: {
    flex: 1,
    minHeight: tokens.touch.min,
    fontFamily: tokens.font.regular,
    fontSize: 16,
    color: tokens.color.text,
    outlineWidth: 0,
  },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
