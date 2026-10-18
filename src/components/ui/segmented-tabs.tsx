import { StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** Segmentierte Umschaltung (Reiter auf Detailseiten): die aktive Pille hebt sich weiß ab. */
export function SegmentedTabs<K extends string>({
  items,
  active,
  onChange,
}: {
  items: readonly { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && onChange(item.key)}
            scale={0.95}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text
              variant="small"
              color={on ? 'text' : 'textSecondary'}
              numberOfLines={1}
              style={styles.label}
            >
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: tokens.space[1],
    gap: tokens.space[1],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bgMuted,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: tokens.space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
  },
  segmentOn: { backgroundColor: tokens.color.bg, boxShadow: tokens.shadow.card },
  label: { fontFamily: tokens.font.semibold },
});
