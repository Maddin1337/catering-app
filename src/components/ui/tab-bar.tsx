import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Schlanke, schwebende Leiste: Symbol über kleiner Beschriftung, der aktive Tab liegt in einer
 * weichen Kapsel. Die Leiste nimmt Platz im Layout ein, damit nichts darunter verschwindet.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom - 12, tokens.space[2]) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          // Ausgeblendete Tabs (href: null) haben keinen Platz in der Leiste.
          if ((options as { href?: string | null }).href === null) return null;
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const color = focused ? tokens.color.accent : tokens.color.textTertiary;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              scale={0.92}
              style={[styles.tab, focused && styles.tabOn]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text variant="caption" numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: tokens.space[4],
    paddingTop: tokens.space[1],
    alignItems: 'center',
    backgroundColor: tokens.color.canvas,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    padding: tokens.space[1],
    gap: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    boxShadow: tokens.shadow.raised,
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } as object, default: {} }),
  },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabOn: { backgroundColor: tokens.color.accentSubtle },
  label: { fontSize: 11, lineHeight: 13 },
});
