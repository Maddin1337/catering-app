import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Avatar } from './avatar';
import { Text } from './text';

/*
 * Gestapelte Gesichter in einer Pille – nach „Assignees“ (picker) von Bencho (bencho.dev, MIT,
 * © 2026 Lorenzo Cabra), für React Native neu gebaut. Jedes Gesicht trägt einen weißen Ring, damit
 * die Überlappung lesbar bleibt; neue springen mit einer Feder hinein, ab `max` zählt ein „+n“.
 */
export function AvatarStack({
  names,
  max = 4,
  size = 32,
  label,
}: {
  names: string[];
  max?: number;
  size?: number;
  /** Zugänglicher Text, z. B. „Eingeplant: Anna, Sven“. */
  label: string;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <View style={styles.pill} accessible accessibilityLabel={label}>
      {shown.map((n, i) => (
        <Animated.View
          key={`${n}-${i}`}
          entering={ZoomIn.springify()
            .damping(12)
            .delay(i * 60)}
          style={[styles.face, { marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: max - i }]}
        >
          <Avatar name={n} size={size} />
        </Animated.View>
      ))}
      {rest > 0 ? (
        <View style={[styles.more, { height: size, minWidth: size, marginLeft: -size * 0.32 }]}>
          <Text variant="caption" color="textSecondary">
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  face: { borderRadius: tokens.radius.full, borderWidth: 2, borderColor: tokens.color.bg },
  more: {
    paddingHorizontal: 6,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.bgMuted,
    borderWidth: 2,
    borderColor: tokens.color.bg,
  },
});
