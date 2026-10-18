import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';

import { tokens } from '@/theme/tokens';

import type { SheetAction } from './action-sheet';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/*
 * Anlegen-Menü, das aus dem „+“ wächst – nach „Create menu“ (liq-create) von Bencho (bencho.dev,
 * MIT, © 2026 Lorenzo Cabra), für React Native neu gebaut.
 *
 * Der runde Knopf war das Menü schon immer: Beim Tippen wächst er an Ort und Stelle zur Karte,
 * die Farbe wechselt von Petrol zu Weiß, das Plus dreht sich weg und die Einträge kommen
 * nacheinander herein. Kein Schließen-Knopf – ein Tipp daneben legt es wieder zusammen. Die Feder
 * ist leicht elastisch (ζ ≈ 0,7), zusammen gelegt wird ohne Überschwingen.
 */

export type Origin = { x: number; y: number; width: number; height: number };

const ROW = 60;
const PAD = 8;
const HEAD = 44;
const OPEN = { damping: 17, stiffness: 230, mass: 0.85 };

export function CreateMorph({
  origin,
  title,
  actions,
  onClose,
}: {
  origin: Origin;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const screen = useWindowDimensions();
  const p = useSharedValue(0);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    p.set(withSpring(1, OPEN));
  }, [p]);

  const W = Math.min(340, screen.width - 32);
  const H = HEAD + actions.length * ROW + PAD * 2;
  const cx = origin.x + origin.width / 2;
  const bottom = origin.y + origin.height;
  const size = origin.width;
  const left = Math.min(Math.max(16, cx - W / 2), screen.width - 16 - W);

  const close = (then?: () => void) => {
    if (closing) return;
    setClosing(true);
    p.set(withTiming(0, { duration: 220 }));
    setTimeout(() => {
      onClose();
      then?.();
    }, 220);
  };

  const card = useAnimatedStyle(() => {
    const t = p.get();
    const w = size + (W - size) * t;
    const h = size + (H - size) * t;
    // Linke Kante wandert von der Knopfmitte zur Kartenkante; unten bleibt die Unterkante des Knopfs.
    return {
      width: w,
      height: h,
      left: cx - size / 2 + (left - (cx - size / 2)) * Math.min(1, t),
      top: bottom - h,
      borderRadius: interpolate(t, [0, 1], [size / 2, tokens.radius.xl], 'clamp'),
      backgroundColor: interpolateColor(
        Math.min(1, t),
        [0, 0.45, 1],
        [tokens.color.accent, tokens.color.bg, tokens.color.bg],
      ),
    };
  });
  const plus = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [0, 0.35], [1, 0], 'clamp'),
    transform: [{ rotate: `${interpolate(p.get(), [0, 1], [0, 135])}deg` }],
  }));
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, p.get()) }));

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        />
      </Animated.View>
      <Animated.View style={[styles.card, card]} accessibilityViewIsModal>
        <Animated.View
          pointerEvents="none"
          style={[styles.plus, { left: 0, bottom: 0, width: size, height: size }, plus]}
        >
          <Plus color={tokens.color.onAccent} size={24} strokeWidth={2.6} />
        </Animated.View>
        <View style={[styles.content, { width: W, height: H }]}>
          <Item index={-1} p={p}>
            <Text variant="title2" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </Item>
          {actions.map((a, i) => (
            <Item key={a.label} index={i} p={p}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={a.hint ? `${a.label}. ${a.hint}` : a.label}
                scale={0.97}
                onPress={() => close(a.onPress)}
                pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
                style={styles.row}
              >
                {a.icon ? (
                  <View style={styles.icon}>
                    <a.icon color={tokens.color.accent} size={20} strokeWidth={2.1} />
                  </View>
                ) : null}
                <View style={styles.texts}>
                  <Text variant="bodyStrong">{a.label}</Text>
                  {a.hint ? (
                    <Text variant="small" color="textSecondary" numberOfLines={1}>
                      {a.hint}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>
            </Item>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

/** Ein Eintrag erscheint, wenn die Karte weit genug offen ist – jeder ein wenig später als der vorige. */
function Item({
  index,
  p,
  children,
}: {
  index: number;
  p: ReturnType<typeof useSharedValue<number>>;
  children: React.ReactNode;
}) {
  // Spätestens bei p = 1 voll da: Die Feder schwingt zwar über 1 hinaus, ruht aber genau dort.
  const from = Math.min(0.45 + (index + 1) * 0.06, 0.8);
  const to = Math.min(from + 0.3, 1);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [from, to], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(p.get(), [from, to], [10, 0], 'clamp') }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: tokens.color.scrim },
  card: { position: 'absolute', overflow: 'hidden', boxShadow: tokens.shadow.float },
  plus: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Der Inhalt hat von Anfang an seine volle Größe und wird von der wachsenden Karte freigelegt.
  content: { position: 'absolute', left: 0, bottom: 0, padding: PAD },
  title: { height: HEAD, paddingHorizontal: tokens.space[3], paddingTop: tokens.space[2] },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accentSubtle,
  },
  texts: { flex: 1, gap: 1 },
});
