import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/*
 * Schalter mit „flüssigem“ Daumen – nach „Liquid toggle“ von Bencho (bencho.dev, MIT, © 2026
 * Lorenzo Cabra), für React Native neu gebaut.
 *
 * Ein Körper, keine Spur: Der Daumen dehnt sich auf halbem Weg in seine Laufrichtung und zieht sich
 * am Ziel wieder zusammen. Die Dehnung hängt nur am Fortschritt (0 an beiden Enden), deshalb kann
 * sie nie über die Bahn hinausschießen; die Feder für die Lage ist leicht unterdämpft.
 */

const W = 52;
const H = 32;
const PAD = 4;
const THUMB = H - PAD * 2;
const TRAVEL = W - PAD * 2 - THUMB;
// Wie weit sich der Tropfen in der Mitte des Wegs streckt (Anteil der Daumenbreite).
const STRETCH = 0.55;

/** Nur die Optik: Bahn und Daumen. Bedienbar ist die ganze `SwitchRow`. */
function Track({ value }: { value: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(value ? 1 : 0, { damping: 16, stiffness: 240, mass: 0.8 }));
  }, [value, p]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], [tokens.color.bgMuted, tokens.color.accent]),
  }));
  const thumb = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, p.get()));
    // 4·t·(1−t): 0 an den Enden, 1 in der Mitte.
    const grow = THUMB * STRETCH * 4 * t * (1 - t);
    return {
      width: THUMB + grow,
      // Die Dehnung zeigt nach vorn: beim Einschalten nach rechts, beim Ausschalten nach links.
      transform: [{ translateX: p.get() * TRAVEL - (value ? grow : 0) }],
    };
  });

  return (
    <Animated.View style={[styles.track, track]}>
      <Animated.View style={[styles.thumb, thumb]} />
    </Animated.View>
  );
}

/** Zeile mit Text links und Schalter rechts; die ganze Zeile schaltet (Tippfläche ≥ 48 dp). */
export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onChange(!value);
      }}
      style={styles.row}
    >
      <View style={styles.texts}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="small" color="textTertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={disabled && styles.off}>
        <Track value={value} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, padding: PAD, justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: tokens.color.bg,
    boxShadow: '0px 1px 3px rgba(20, 24, 31, 0.25)',
  },
  off: { opacity: 0.45 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  texts: { flex: 1, gap: 2 },
});
