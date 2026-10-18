import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { fg: string; bg: string; Icon: LucideIcon }> = {
  info: { fg: tokens.color.info, bg: tokens.color.infoSubtle, Icon: Info },
  success: { fg: tokens.color.success, bg: tokens.color.successSubtle, Icon: CircleCheck },
  warning: { fg: tokens.color.warning, bg: tokens.color.warningSubtle, Icon: TriangleAlert },
  danger: { fg: tokens.color.danger, bg: tokens.color.dangerSubtle, Icon: CircleAlert },
};

export function Banner({ tone = 'info', children }: { tone?: Tone; children: string }) {
  const t = tones[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[styles.box, { backgroundColor: t.bg }]}
    >
      <t.Icon color={t.fg} size={20} style={styles.icon} />
      <Text variant="small" style={[styles.text, { color: t.fg }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[3],
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
  },
  icon: { marginTop: 2 },
  text: { flex: 1 },
});
