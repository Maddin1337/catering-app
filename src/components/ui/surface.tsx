import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale, type PressableScaleProps } from './pressable-scale';

type Elevation = 'none' | 'card' | 'raised';

/** Stil einer weißen, weich abgehobenen Karte; für Stellen, die eine Pressable-Struktur selbst bauen. */
export function surfaceStyle(elevation: Elevation = 'card'): ViewStyle {
  return {
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...(elevation === 'none' ? null : { boxShadow: tokens.shadow[elevation] }),
  };
}

/** Karte auf dem warmen Hintergrund. Mit `onPress` wird sie tippbar und gibt beim Drücken nach. */
export function Surface({
  children,
  elevation = 'card',
  padded = true,
  onPress,
  style,
  ...rest
}: Omit<PressableScaleProps, 'style' | 'children'> & {
  children: ReactNode;
  elevation?: Elevation;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const base = [surfaceStyle(elevation), padded && styles.padded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      {...rest}
      onPress={onPress}
      scale={0.985}
      style={base}
      pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  padded: { padding: tokens.space[4], gap: tokens.space[2] },
});
