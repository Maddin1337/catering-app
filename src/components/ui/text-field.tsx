import { useId, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  helper?: string;
  /** Passwortfeld mit „Anzeigen/Verbergen“. */
  revealable?: boolean;
  showLabel?: string;
  hideLabel?: string;
};

// Eingaben mit 16 px, damit iOS Safari im Web nicht automatisch zoomt (docs/04 §4.4).
export function TextField({
  label,
  error,
  helper,
  revealable,
  showLabel = 'Anzeigen',
  hideLabel = 'Verbergen',
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = revealable ? !revealed : secureTextEntry;
  const sensitive = !!revealable || !!secureTextEntry;

  return (
    <View style={styles.wrap}>
      <Text variant="small" color="textSecondary" nativeID={id}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            borderColor: error
              ? tokens.color.danger
              : focused
                ? tokens.color.focus
                : tokens.color.borderInput,
          },
          focused && styles.focused,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={id}
          accessibilityHint={error ?? helper}
          placeholderTextColor={tokens.color.textTertiary}
          // Passwörter nie autokorrigieren oder rechtschreibprüfen (Web sendet sie sonst ggf. an den Browser-Dienst).
          autoCorrect={sensitive ? false : undefined}
          spellCheck={sensitive ? false : undefined}
          {...rest}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? hideLabel : showLabel}
            hitSlop={8}
            onPress={() => setRevealed((r) => !r)}
            style={styles.reveal}
          >
            <Text variant="small" color="accent">
              {revealed ? hideLabel : showLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="small" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  field: {
    minHeight: tokens.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: tokens.space[3],
  },
  focused: { borderWidth: 2 },
  input: {
    flex: 1,
    minHeight: tokens.touch.min,
    fontFamily: tokens.font.regular,
    fontSize: 16,
    color: tokens.color.text,
  },
  reveal: { minHeight: 44, justifyContent: 'center', paddingLeft: tokens.space[2] },
});
