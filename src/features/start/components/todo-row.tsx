import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { tints, tokens, type Tint } from '@/theme/tokens';

/** Aufgabe in „Zu erledigen“: farbige Symbol-Plakette, Text und Pfeil. */
export function TodoRow({
  icon: Icon,
  tint,
  title,
  onPress,
}: {
  icon: LucideIcon;
  tint: Tint;
  title: string;
  onPress: () => void;
}) {
  return (
    <Surface onPress={onPress} accessibilityLabel={title} style={styles.row}>
      <View style={[styles.badge, { backgroundColor: tints[tint].bg }]}>
        <Icon color={tints[tint].fg} size={20} strokeWidth={2.1} />
      </View>
      <Text variant="body" style={styles.title}>
        {title}
      </Text>
      <ChevronRight color={tokens.color.textTertiary} size={20} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: 64,
    paddingVertical: tokens.space[3],
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1 },
});
