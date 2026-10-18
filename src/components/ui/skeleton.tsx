import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { surfaceStyle } from './surface';

// Sanftes Pulsieren statt Drehkreisel: der Platz für den Inhalt ist schon sichtbar.
const pulse = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0.45 } },
  animationDuration: '900ms',
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

/** Platzhalterbalken, solange Daten laden. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = tokens.radius.sm,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: tokens.color.skeleton },
        pulse,
      ]}
    />
  );
}

/** Karten-Platzhalter für Listen: Plakette links, zwei Textzeilen. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel="Lädt"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[surfaceStyle('none'), styles.row]}>
          <Skeleton width={44} height={44} radius={tokens.radius.md} />
          <View style={styles.texts}>
            <Skeleton width={i % 2 ? '55%' : '70%'} height={16} />
            <Skeleton width={i % 2 ? '35%' : '45%'} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    padding: tokens.space[4],
  },
  texts: { flex: 1, gap: tokens.space[2] },
});
