import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale, type PressableScaleProps } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'dark' | 'secondary' | 'tonal' | 'ghost' | 'danger';
type FgColor = 'onAccent' | 'text' | 'accent' | 'danger';

export type ButtonProps = Omit<PressableScaleProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Kleinere Schaltfläche für Zeilen und Kopfleisten; die Tippfläche bleibt ≥ 44 dp. */
  size?: 'md' | 'sm';
  icon?: LucideIcon;
};

type Look = {
  bg: string;
  pressed: string;
  fg: FgColor;
  border?: string;
  shadow?: string;
  gradient?: readonly [string, string];
};

const looks: Record<Variant, Look> = {
  primary: {
    bg: tokens.color.accent,
    pressed: tokens.color.accentPressed,
    fg: 'onAccent',
    shadow: tokens.shadow.accent,
    gradient: [tokens.color.accentGradientFrom, tokens.color.accentGradientTo],
  },
  dark: {
    bg: tokens.color.ink,
    pressed: tokens.color.inkPressed,
    fg: 'onAccent',
    shadow: tokens.shadow.ink,
  },
  secondary: {
    bg: tokens.color.bg,
    pressed: tokens.color.bgMuted,
    fg: 'text',
    border: tokens.color.border,
    shadow: tokens.shadow.card,
  },
  tonal: { bg: tokens.color.accentSubtle, pressed: '#C3EBE3', fg: 'accent' },
  ghost: { bg: 'transparent', pressed: tokens.color.bgMuted, fg: 'accent' },
  danger: {
    bg: tokens.color.dangerSubtle,
    pressed: '#F9CFCB',
    fg: 'danger',
  },
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  size = 'md',
  icon: Icon,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const look = looks[variant];
  const inactive = disabled || loading;
  const fgHex = tokens.color[look.fg];

  const base: ViewStyle = {
    backgroundColor: look.bg,
    ...(look.border ? { borderWidth: 1, borderColor: look.border } : null),
    ...(look.shadow && !inactive ? { boxShadow: look.shadow } : null),
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={label}
      disabled={inactive}
      {...rest}
      onPress={(e) => {
        // Leichtes Tippgefühl auf dem Gerät; im Web gibt es das nicht.
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      pressedStyle={{ backgroundColor: look.pressed }}
      style={[styles.base, size === 'sm' && styles.small, base, inactive && styles.inactive, style]}
    >
      {look.gradient && !inactive ? (
        <LinearGradient
          colors={look.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={fgHex} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon color={fgHex} size={size === 'sm' ? 16 : 18} strokeWidth={2.25} /> : null}
          <Text
            variant={size === 'sm' ? 'small' : 'bodyStrong'}
            color={look.fg}
            style={styles.label}
          >
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.touch.min,
    minWidth: tokens.touch.min,
    paddingHorizontal: tokens.space[6],
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.space[2],
    overflow: 'hidden',
  },
  small: { minHeight: 44, paddingHorizontal: tokens.space[4] },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  // Lange Beschriftungen umbrechen, statt aus der Schaltfläche zu laufen.
  label: { flexShrink: 1, textAlign: 'center' },
  inactive: { opacity: 0.45 },
});
