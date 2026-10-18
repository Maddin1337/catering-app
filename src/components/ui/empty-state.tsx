import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tints, tokens, type Tint } from '@/theme/tokens';

import { Text } from './text';

/** Leerer Zustand: runde Symbol-Plakette über einem ruhigen Hinweistext. */
export function EmptyState({
  icon: Icon,
  text,
  tint = 'teal',
}: {
  icon: LucideIcon;
  text: string;
  tint?: Tint;
}) {
  return (
    <View style={styles.box}>
      <View style={[styles.badge, { backgroundColor: tints[tint].bg }]}>
        <Icon color={tints[tint].fg} size={28} strokeWidth={1.9} />
      </View>
      <Text variant="body" color="textSecondary" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[4],
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
});
