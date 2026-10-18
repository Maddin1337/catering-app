import * as Haptics from 'expo-haptics';
import { ArrowRight, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

/*
 * Zum Bestätigen schieben – nach „Slide to confirm“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo
 * Cabra), für React Native mit Reanimated neu gebaut.
 *
 * Der Griff folgt dem Finger genau. Erst am Ende der Bahn gilt die Bestätigung: Ein Schieber, der
 * schon bei 60 % auslöst, lässt sich versehentlich anstoßen, und genau das soll er verhindern. Beim
 * Bestätigen entfaltet sich der Griff nach links über die ganze Bahn, der Pfeil wird zum Haken. Die
 * rechte Kante bleibt dabei rechnerisch stehen (Breite wächst um genau das, was der Versatz
 * verliert), damit nichts wackelt. Losgelassen vor dem Ende federt er etwas lebendiger zurück.
 */

const H = 56;
const PAD = 4;
const GRIP = H - PAD * 2;
// Kritisch gedämpft für das Bestätigen (Wand am Ende, kein Überschwingen), weicher für die Rückkehr.
const STIFF = 520;
const COMMIT = { stiffness: STIFF, damping: 2 * Math.sqrt(STIFF * 0.9), mass: 0.9 };
const HOME = { ...COMMIT, damping: COMMIT.damping * 0.62 };

const TONES = {
  accent: { fill: tokens.color.accent, track: tokens.color.accentSubtle, ink: tokens.color.accent },
  danger: { fill: tokens.color.danger, track: tokens.color.dangerSubtle, ink: tokens.color.danger },
  ink: { fill: tokens.color.ink, track: tokens.color.bgMuted, ink: tokens.color.text },
} as const;

export function SlideToConfirm({
  label,
  onConfirm,
  tone = 'accent',
  busy = false,
  disabled = false,
  hint = 'Zum Bestätigen nach rechts schieben',
}: {
  label: string;
  /** Gibt `false` zurück, wenn die Aktion nicht startet (z. B. Pflichtfeld fehlt): Der Griff rollt zurück. */
  onConfirm: () => void | boolean;
  tone?: keyof typeof TONES;
  /** Läuft die Aktion noch, dreht sich im ausgefüllten Griff ein Kreisel. */
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const c = TONES[tone];
  const [width, setWidth] = useState(0);
  const [done, setDone] = useState(false);
  const [wasBusy, setWasBusy] = useState(false);
  const travel = Math.max(0, width - PAD * 2 - GRIP);
  const x = useSharedValue(0);
  // 0 → 1: wie weit sich der Griff nach dem Bestätigen über die Bahn entfaltet hat.
  const fill = useSharedValue(0);
  const start = useSharedValue(0);

  // Schlägt die Aktion fehl (busy fällt zurück, ohne dass die Seite schließt), rollt der Griff zurück.
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy && done) setDone(false);
  }
  useEffect(() => {
    if (!done) {
      fill.set(withTiming(0, { duration: tokens.motion.base }));
      x.set(withSpring(0, HOME));
    }
  }, [done, fill, x]);

  const commit = () => {
    if (done || disabled) return;
    setDone(true);
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    x.set(withSpring(travel, COMMIT));
    fill.set(withSpring(1, COMMIT));
    // Erst entfalten, dann handeln: Die Bestätigung soll sichtbar „ankommen“.
    setTimeout(() => {
      if (onConfirm() === false) setDone(false);
    }, 280);
  };

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !done && !disabled,
    onMoveShouldSetPanResponder: (_, g) => !done && !disabled && Math.abs(g.dx) > 3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start.set(x.get());
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    },
    onPanResponderMove: (_, g) => x.set(Math.min(travel, Math.max(0, start.get() + g.dx))),
    onPanResponderRelease: () => {
      if (x.get() >= travel - 2) commit();
      else x.set(withSpring(0, HOME));
    },
    onPanResponderTerminate: () => x.set(withSpring(0, HOME)),
  });

  const grip = useAnimatedStyle(() => {
    const grow = travel * fill.get();
    return {
      left: PAD + x.get() - grow,
      width: GRIP + grow,
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: travel > 0 ? interpolate(x.get(), [0, travel * 0.6], [1, 0], 'clamp') : 1,
    transform: [{ translateX: interpolate(x.get(), [0, travel], [0, 24], 'clamp') }],
  }));
  const wash = useAnimatedStyle(() => ({
    width: PAD + x.get() + GRIP / 2,
    opacity: travel > 0 ? interpolate(x.get(), [0, travel], [0.15, 0.45], 'clamp') : 0,
  }));

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, busy }}
      // Ohne Schiebegeste (Bildschirmleser, Tastatur) bestätigt die Standardaktion direkt.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={commit}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: c.track }, disabled && styles.off]}
      {...pan.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.wash, { backgroundColor: c.fill }, wash]}
      />
      <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: c.ink }}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.grip, { backgroundColor: c.fill }, grip]}>
        {done ? (
          busy ? (
            <ActivityIndicator color={tokens.color.onAccent} />
          ) : (
            <Check color={tokens.color.onAccent} size={22} strokeWidth={3} />
          )
        ) : (
          <ArrowRight color={tokens.color.onAccent} size={22} strokeWidth={2.6} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: H,
    borderRadius: H / 2,
    justifyContent: 'center',
    overflow: 'hidden',
    // Im Web greift sonst die Seitenscroll-Geste statt des Schiebens.
    ...Platform.select({
      web: { touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' } as object,
    }),
  },
  off: { opacity: 0.45 },
  wash: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: H / 2 },
  labelWrap: { alignItems: 'center', paddingHorizontal: GRIP + PAD * 2 },
  grip: {
    position: 'absolute',
    top: PAD,
    height: GRIP,
    borderRadius: GRIP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: tokens.shadow.raised,
  },
});
