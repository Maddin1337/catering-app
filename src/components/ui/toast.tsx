import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

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
  // Höchstens zwei gleichzeitig; die älteste weicht.
  toasts = [...toasts.slice(-1), toast];
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

/** Zeigt die Meldungen; einmal im Wurzel-Layout eingebunden. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const insets = useSafeAreaInsets();
  if (list.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + tokens.space[2] }]}
      accessibilityLiveRegion="polite"
    >
      {list.map((t) => {
        const Icon = t.tone === 'success' ? CircleCheck : CircleAlert;
        const fg = t.tone === 'success' ? '#5EE0B4' : '#FCA5A5';
        return (
          <Animated.View
            key={t.id}
            entering={FadeInUp.springify().damping(tokens.motion.spring.damping)}
            exiting={FadeOutUp.duration(tokens.motion.base)}
            style={styles.toast}
            accessibilityRole="alert"
          >
            <Icon color={fg} size={20} strokeWidth={2.4} />
            <Text variant="small" color="onAccent" style={styles.text}>
              {t.text}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: tokens.space[4],
    right: tokens.space[4],
    alignItems: 'center',
    gap: tokens.space[2],
    zIndex: 1000,
  },
  toast: {
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
