import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale, type PressableScaleProps } from './pressable-scale';

/** Runder Symbolknopf (44 dp) für Monatspfeile und ähnliche Bedienelemente; `label` ist der Zugänglichkeitsname. */
export function IconButton({
  icon: Icon,
  label,
  ...rest
}: Omit<PressableScaleProps, 'children' | 'accessibilityLabel'> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scale={0.92}
      {...rest}
      style={[styles.button, rest.style]}
      pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
    >
      <Icon color={tokens.color.text} size={20} strokeWidth={2.2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    boxShadow: tokens.shadow.card,
  },
});
