import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const palette: Record<
  Variant,
  { bg: string; pressed: string; fg: 'onAccent' | 'text' | 'accent' | 'danger'; border?: string }
> = {
  primary: { bg: tokens.color.accent, pressed: tokens.color.accentPressed, fg: 'onAccent' },
  secondary: {
    bg: tokens.color.bg,
    pressed: tokens.color.bgMuted,
    fg: 'text',
    border: tokens.color.borderInput,
  },
  ghost: { bg: 'transparent', pressed: tokens.color.bgMuted, fg: 'accent' },
  danger: {
    bg: tokens.color.bg,
    pressed: tokens.color.dangerSubtle,
    fg: 'danger',
    border: tokens.color.danger,
  },
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={label}
      disabled={inactive}
      {...rest}
      style={(state) => [
        styles.base,
        { backgroundColor: state.pressed ? p.pressed : p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        inactive && styles.inactive,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={p.fg === 'onAccent' ? tokens.color.onAccent : tokens.color.accent}
        />
      ) : (
        <Text variant="bodyStrong" color={p.fg}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.touch.min,
    minWidth: tokens.touch.min,
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.5 },
});
