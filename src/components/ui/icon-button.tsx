import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale, type PressableScaleProps } from './pressable-scale';

/** Runder Symbolknopf (44 dp) für Monatspfeile und ähnliche Bedienelemente; `label` ist der Zugänglichkeitsname. */
const TONES = {
  default: { bg: tokens.color.bg, fg: tokens.color.text, pressed: tokens.color.bgMuted },
  accent: {
    bg: tokens.color.accent,
    fg: tokens.color.onAccent,
    pressed: tokens.color.accentPressed,
  },
  danger: { bg: tokens.color.dangerSubtle, fg: tokens.color.danger, pressed: '#F9CFCB' },
} as const;

export function IconButton({
  icon: Icon,
  label,
  tone = 'default',
  ...rest
}: Omit<PressableScaleProps, 'children' | 'accessibilityLabel'> & {
  icon: LucideIcon;
  label: string;
  /** `accent` für die bestätigende, `danger` für die ablehnende Aktion (z. B. ✓ und ✕). */
  tone?: keyof typeof TONES;
}) {
  const c = TONES[tone];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scale={0.92}
      {...rest}
      style={[
        styles.button,
        tone !== 'default' && { backgroundColor: c.bg, borderColor: c.bg },
        rest.style,
      ]}
      pressedStyle={{ backgroundColor: c.pressed }}
    >
      <Icon color={c.fg} size={20} strokeWidth={tone === 'default' ? 2.2 : 2.6} />
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
