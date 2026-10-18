import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tints, tokens, type Tint } from '@/theme/tokens';

import { Text } from './text';

const danger = { fg: tokens.color.danger, bg: tokens.color.dangerSubtle };

/** Kleine Markierung mit Text (und optional Symbol): nie nur Farbe, der Text trägt die Bedeutung. */
export function Pill({
  label,
  tone = 'slate',
  icon: Icon,
}: {
  label: string;
  tone?: Tint | 'danger';
  icon?: LucideIcon;
}) {
  const c = tone === 'danger' ? danger : tints[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {Icon ? <Icon color={c.fg} size={13} strokeWidth={2.4} /> : null}
      <Text variant="caption" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: tokens.space[2],
    borderRadius: tokens.radius.full,
  },
});
