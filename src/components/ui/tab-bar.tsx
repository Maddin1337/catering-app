import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Schwebende Pillen-Leiste: Der aktive Tab zeigt Symbol und Beschriftung auf dunkler Pille, die
 * übrigen nur das Symbol. Die Leiste nimmt Platz im Layout ein, damit nichts darunter verschwindet.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, tokens.space[3]) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          // Ausgeblendete Tabs (href: null) haben keinen Platz in der Leiste.
          if ((options as { href?: string | null }).href === null) return null;
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const color = focused ? tokens.color.onAccent : tokens.color.textTertiary;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Animated.View
              key={route.key}
              layout={LinearTransition.duration(tokens.motion.base)}
              style={focused ? styles.slotOn : styles.slot}
            >
              <PressableScale
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                scale={0.92}
                style={[styles.tab, focused && styles.tabOn]}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {focused ? (
                  <Text variant="small" color="onAccent" numberOfLines={1} style={styles.label}>
                    {label}
                  </Text>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: tokens.space[4],
    paddingTop: tokens.space[2],
    alignItems: 'center',
    backgroundColor: tokens.color.canvas,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 440,
    padding: tokens.space[2],
    gap: tokens.space[1],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    boxShadow: tokens.shadow.float,
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } as object, default: {} }),
  },
  slot: { flex: 1 },
  slotOn: { flex: 2.2 },
  tab: {
    minHeight: 48,
    borderRadius: tokens.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.space[3],
  },
  tabOn: { backgroundColor: tokens.color.ink },
  label: { fontFamily: tokens.font.semibold },
});
