import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/** Tippbare Karte mit Titel und Erklärung (z. B. „Neue Firma anlegen“). */
export function ActionCard({
  title,
  body,
  onPress,
  disabled,
  icon,
}: {
  title: string;
  body: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { backgroundColor: tokens.color.bgMuted },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.texts}>
        <Text variant="title2">{title}</Text>
        <Text variant="small" color="textSecondary">
          {body}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: tokens.space[4],
    padding: tokens.space[4],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bg,
    minHeight: 72,
    alignItems: 'center',
  },
  icon: { width: 40, alignItems: 'center' },
  texts: { flex: 1, gap: tokens.space[1] },
});
