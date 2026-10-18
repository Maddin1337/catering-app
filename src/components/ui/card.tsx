import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { tints, tokens, type Tint } from '@/theme/tokens';

import { Surface } from './surface';
import { Text } from './text';

/** Tippbare Karte mit Titel und Erklärung (z. B. „Neue Firma anlegen“). */
export function ActionCard({
  title,
  body,
  onPress,
  disabled,
  icon: Icon,
  tint = 'teal',
}: {
  title: string;
  body: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  tint?: Tint;
}) {
  return (
    <Surface
      accessibilityLabel={`${title}. ${body}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      elevation="raised"
      style={[styles.card, disabled && { opacity: 0.5 }]}
    >
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: tints[tint].bg }]}>
          <Icon color={tints[tint].fg} size={24} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text variant="title2">{title}</Text>
        <Text variant="small" color="textSecondary">
          {body}
        </Text>
      </View>
      <ChevronRight color={tokens.color.textTertiary} size={22} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: tokens.space[4],
    paddingVertical: tokens.space[5],
    minHeight: 84,
    alignItems: 'center',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: tokens.space[1] },
});
