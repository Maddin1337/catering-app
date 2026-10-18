import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

const PAD = 4;
const glide = {
  transitionProperty: 'transform',
  transitionDuration: 340,
  transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
} as const;

/** Segmentierte Umschaltung: eine weiße Pille gleitet mit leichtem Nachfedern zum aktiven Eintrag. */
export function SegmentedTabs<K extends string>({
  items,
  active,
  onChange,
}: {
  items: readonly { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = items.findIndex((i) => i.key === active);
  const segment = width > 0 ? (width - PAD * 2) / items.length : 0;
  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {segment > 0 && index >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segment,
              transform: [{ translateX: index * segment }],
              ...glide,
            },
          ]}
        />
      ) : null}
      {items.map((item) => {
        const on = item.key === active;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onChange(item.key);
            }}
            scale={0.95}
            style={styles.segment}
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
    padding: PAD,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bgMuted,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bg,
    boxShadow: tokens.shadow.card,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: tokens.space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
  },
  label: { fontFamily: tokens.font.semibold },
});
