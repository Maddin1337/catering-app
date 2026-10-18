import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/*
 * Checkbox mit gezeichnetem Haken – nach „Checklist“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo
 * Cabra), für React Native neu gebaut.
 *
 * Eine Feder je Zeile, alles hängt daran: Das Kästchen füllt sich und schwingt dabei ein wenig über,
 * der Haken zeichnet sich danach (ohne Überschwingen – ein Strich, der über sein Ende hinausläuft,
 * sähe falsch aus), und mit `strike` folgt die Durchstreichung dem Haken, statt mit ihm zu rennen.
 */

const BOX = 24;
// Länge des Hakens im 24er-Raster (zwei Strecken), für das Zeichnen per Strichmuster.
const TICK = 18;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Checkbox mit Text daneben; die ganze Zeile ist tippbar (Ziel ≥ 48 dp). */
export function Checkbox({
  label,
  checked,
  onChange,
  error,
  strike,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  /** Erledigtes durchstreichen (Einkaufs- und Aufgabenlisten). */
  strike?: boolean;
}) {
  const fill = useSharedValue(checked ? 1 : 0);
  const draw = useSharedValue(checked ? 1 : 0);
  const rule = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    fill.set(withSpring(checked ? 1 : 0, { damping: 11, stiffness: 320, mass: 0.7 }));
    draw.set(
      checked
        ? withDelay(70, withTiming(1, { duration: 220 }))
        : withTiming(0, { duration: tokens.motion.fast }),
    );
    rule.set(
      checked
        ? withDelay(180, withTiming(1, { duration: 260 }))
        : withTiming(0, { duration: tokens.motion.fast }),
    );
  }, [checked, fill, draw, rule]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.min(1, fill.get()),
      [0, 1],
      [tokens.color.bg, tokens.color.accent],
    ),
    borderColor: error
      ? tokens.color.danger
      : interpolateColor(
          Math.min(1, fill.get()),
          [0, 1],
          [tokens.color.borderInput, tokens.color.accent],
        ),
    // Leichtes Überschwingen der Füllung gibt dem Kästchen einen „Druckpunkt“.
    transform: [{ scale: interpolate(fill.get(), [0, 0.5, 1, 1.2], [1, 0.88, 1, 1.06]) }],
  }));
  const tick = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - draw.get()) }));
  const line = useAnimatedStyle(() => ({ width: `${rule.get() * 100}%` }));
  const words = useAnimatedStyle(() => ({ opacity: strike ? 1 - 0.45 * rule.get() : 1 }));

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onChange(!checked);
        }}
        style={styles.row}
      >
        <Animated.View style={[styles.box, box]}>
          <Svg width={BOX - 4} height={BOX - 4} viewBox="0 0 24 24">
            <AnimatedPath
              d="M5.5 12.5 L10 17 L18.5 7.5"
              stroke={tokens.color.onAccent}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={TICK}
              animatedProps={tick}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.label, words]}>
          <View style={styles.labelInner}>
            <Text variant="body">{label}</Text>
            {strike ? <Animated.View pointerEvents="none" style={[styles.strike, line]} /> : null}
          </View>
        </Animated.View>
      </Pressable>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1] },
  row: {
    minHeight: tokens.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  labelInner: { alignSelf: 'flex-start', justifyContent: 'center' },
  strike: {
    position: 'absolute',
    left: 0,
    top: '50%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: tokens.color.textSecondary,
  },
});
