import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { Text } from './text';
import { transition } from './transition';

type Tone = 'success' | 'danger';
type Toast = { id: number; text: string; tone: Tone };

const VISIBLE_MS = 2600;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Kurze Rückmeldung oben am Rand („Gespeichert“), verschwindet von selbst. Überall aufrufbar. */
export function showToast(text: string, tone: Tone = 'success') {
  const toast = { id: nextId++, text, tone };
  // Höchstens drei gleichzeitig; die älteste weicht.
  toasts = [...toasts.slice(-2), toast];
  emit();
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(
      tone === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    emit();
  }, VISIBLE_MS);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => toasts;

/*
 * Toast-Stapel – nach „Toast stack“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo Cabra), für React
 * Native neu gebaut: Die neueste Meldung liegt vorn, ältere gucken gestaffelt und etwas kleiner
 * darunter hervor. Ein Tipp fächert den Stapel zur Liste auf, ein zweiter legt ihn wieder zusammen.
 */
const GAP = 8;
const ROW = 48;

/** Zeigt die Meldungen; einmal im Wurzel-Layout eingebunden. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const insets = useSafeAreaInsets();
  const [spread, setSpread] = useState(false);
  if (list.length === 0) return null;
  // Neueste zuerst: Tiefe 0 liegt vorn.
  const ordered = [...list].reverse();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + tokens.space[2] }]}
      accessibilityLiveRegion="polite"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ordered.map((t) => t.text).join('. ')}
        onPress={() => setSpread((v) => !v)}
        style={[
          styles.stack,
          { height: spread ? ordered.length * (ROW + GAP) : ROW + GAP * (ordered.length - 1) },
        ]}
      >
        {ordered.map((t, depth) => {
          const Icon = t.tone === 'success' ? CircleCheck : CircleAlert;
          const fg = t.tone === 'success' ? '#5EE0B4' : '#FCA5A5';
          return (
            <Animated.View
              key={t.id}
              entering={FadeInUp.springify().damping(tokens.motion.spring.damping)}
              exiting={FadeOutUp.duration(tokens.motion.base)}
              style={[
                styles.slot,
                { zIndex: 10 - depth },
                {
                  opacity: spread ? 1 : 1 - depth * 0.25,
                  transform: [
                    { translateY: spread ? depth * (ROW + GAP) : depth * GAP },
                    { scale: spread ? 1 : 1 - depth * 0.05 },
                  ],
                },
                transition(['transform', 'opacity'], 320, 'cubic-bezier(0.34, 1.3, 0.64, 1)'),
              ]}
            >
              <View style={styles.toast} accessibilityRole="alert">
                <Icon color={fg} size={20} strokeWidth={2.4} />
                <Text variant="small" color="onAccent" numberOfLines={1} style={styles.text}>
                  {t.text}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: tokens.space[4],
    right: tokens.space[4],
    alignItems: 'center',
    zIndex: 1000,
  },
  stack: { width: '100%', maxWidth: 440 },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  toast: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    maxWidth: 440,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.ink,
    boxShadow: tokens.shadow.float,
  },
  text: { flexShrink: 1, fontFamily: tokens.font.semibold },
});
