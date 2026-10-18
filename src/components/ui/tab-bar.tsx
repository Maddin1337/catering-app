import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tabs } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const PAD = 4;
const GAP = 2;
const springy = {
  transitionDuration: 380,
  transitionTimingFunction: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
} as const;

/**
 * Schlanke, schwebende Leiste: Symbol über kleiner Beschriftung. Eine weiche Kapsel gleitet mit
 * leichtem Überschwingen zum aktiven Tab, dessen Symbol kurz größer wird. Mit `onCreate` sitzt
 * in der Mitte ein runder „+“-Knopf für die Schnellanlage.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  onCreate,
  createLabel = 'Neu anlegen',
}: TabBarProps & { onCreate?: () => void; createLabel?: string }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);

  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    // Ausgeblendete Tabs (href: null) haben keinen Platz in der Leiste.
    .filter(
      ({ route }) => (descriptors[route.key]!.options as { href?: string | null }).href !== null,
    );
  const slots: ({ kind: 'tab'; route: (typeof tabs)[number] } | { kind: 'create' })[] = tabs.map(
    (route) => ({ kind: 'tab' as const, route }),
  );
  if (onCreate) slots.splice(Math.floor(slots.length / 2), 0, { kind: 'create' });

  const activeSlot = slots.findIndex((s) => s.kind === 'tab' && s.route.index === state.index);
  const slotWidth = width > 0 ? (width - PAD * 2 - GAP * (slots.length - 1)) / slots.length : 0;

  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom - 12, tokens.space[2]) }]}
      pointerEvents="box-none"
    >
      <View
        style={styles.bar}
        accessibilityRole="tablist"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {slotWidth > 0 && activeSlot >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: slotWidth,
                transform: [{ translateX: activeSlot * (slotWidth + GAP) }],
                transitionProperty: 'transform',
                ...springy,
              },
            ]}
          />
        ) : null}
        {slots.map((slot) => {
          if (slot.kind === 'create') {
            return (
              <View key="create" style={styles.slot}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={createLabel}
                  scale={0.88}
                  onPress={() => {
                    if (Platform.OS !== 'web')
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onCreate?.();
                  }}
                  style={styles.create}
                >
                  <LinearGradient
                    colors={[tokens.color.accentGradientFrom, tokens.color.accentGradientTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Eigene Ebene: im Web läge der Verlauf sonst über dem Symbol. */}
                  <View>
                    <Plus color={tokens.color.onAccent} size={24} strokeWidth={2.6} />
                  </View>
                </PressableScale>
              </View>
            );
          }
          const { route, index } = slot.route;
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const color = focused ? tokens.color.accent : tokens.color.textTertiary;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              navigateToTab(route.key);
            }
          };
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              scale={0.9}
              style={styles.slot}
            >
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }, { translateY: focused ? -1 : 0 }],
                  transitionProperty: 'transform',
                  ...springy,
                }}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </Animated.View>
              <Text
                variant="caption"
                numberOfLines={1}
                style={[styles.label, { color }, focused && styles.labelOn]}
              >
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
    maxWidth: 420,
    padding: PAD,
    gap: GAP,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    boxShadow: tokens.shadow.raised,
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } as object, default: {} }),
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.accentSubtle,
  },
  slot: {
    flex: 1,
    minHeight: 50,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  create: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: tokens.shadow.accent,
  },
  label: { fontSize: 11, lineHeight: 13, fontFamily: tokens.font.medium },
  labelOn: { fontFamily: tokens.font.semibold },
});
