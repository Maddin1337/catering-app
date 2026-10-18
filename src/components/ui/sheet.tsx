import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/theme/tokens';

import { Text } from './text';

// Ab dieser Zugstrecke (oder einem schnellen Wisch) schließt das Blatt.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.9;

/**
 * Unteres Blatt: gleitet mit einer Feder herein, der Hintergrund dunkelt weich ab. Schließt per
 * Tippen daneben, Zurück-Taste oder Herunterziehen am Griff.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title?: string;
  onClose: () => void;
  /** Inhalt; als Funktion bekommt er `close`, um animiert zu schließen und danach zu handeln. */
  children: ReactNode | ((close: (then?: () => void) => void) => ReactNode);
  /** Fester Bereich unter dem scrollenden Inhalt (z. B. „Übernehmen“). */
  footer?: ReactNode | ((close: (then?: () => void) => void) => ReactNode);
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const offset = useSharedValue(height);
  const closing = useSharedValue(false);

  useEffect(() => {
    offset.set(withSpring(0, tokens.motion.spring));
  }, [offset]);

  const close = (then?: () => void) => {
    if (closing.get()) return;
    closing.set(true);
    offset.set(withTiming(height, { duration: tokens.motion.base }));
    setTimeout(() => {
      onClose();
      then?.();
    }, tokens.motion.base);
  };

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => offset.set(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) close();
      else offset.set(withSpring(0, tokens.motion.spring));
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, height * 0.6], [1, 0], 'clamp'),
  }));

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => close()}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
          />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: tokens.space[4] + insets.bottom }, sheetStyle]}
          accessibilityViewIsModal
        >
          <View {...pan.panHandlers} style={styles.grab}>
            <View style={styles.handle} />
            {title ? (
              <Text variant="title2" accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            ) : null}
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {typeof children === 'function' ? children(close) : children}
          </ScrollView>
          {footer ? (
            <View style={styles.footer}>
              {typeof footer === 'function' ? footer(close) : footer}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { backgroundColor: tokens.color.scrim },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: tokens.color.bg,
    borderTopLeftRadius: tokens.radius.xxl,
    borderTopRightRadius: tokens.radius.xxl,
    boxShadow: tokens.shadow.float,
  },
  grab: { paddingTop: tokens.space[2], paddingHorizontal: tokens.space[5] },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.color.border,
    marginBottom: tokens.space[3],
  },
  title: { paddingBottom: tokens.space[3] },
  body: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[2],
  },
  footer: { paddingHorizontal: tokens.space[5], paddingTop: tokens.space[3], gap: tokens.space[2] },
});
