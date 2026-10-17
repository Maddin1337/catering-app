import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { fg: string; bg: string }> = {
  info: { fg: tokens.color.info, bg: tokens.color.infoSubtle },
  success: { fg: tokens.color.success, bg: tokens.color.successSubtle },
  warning: { fg: tokens.color.warning, bg: tokens.color.warningSubtle },
  danger: { fg: tokens.color.danger, bg: tokens.color.dangerSubtle },
};

export function Banner({ tone = 'info', children }: { tone?: Tone; children: string }) {
  const t = tones[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.fg }]}
    >
      <Text variant="small" style={{ color: t.fg }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
  },
});
