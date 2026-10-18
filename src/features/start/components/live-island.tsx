import * as Haptics from 'expo-haptics';
import { ArrowRight, Clock, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { transition } from '@/components/ui/transition';
import { formatTime } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

import { clock, pickLive, type LiveSource } from '../live';

/*
 * Live-Insel – nach „Dynamic island“ von Bencho (bencho.dev, MIT, © 2026 Lorenzo Cabra), für React
 * Native neu gebaut.
 *
 * Eine schwarze Pille oben auf der Startseite, solange ein Auftrag oder eine Schicht läuft oder in
 * den nächsten drei Stunden beginnt: pulsierender Punkt, Titel und Restzeit. Ein Tipp lässt sie zur
 * ganzen Karte wachsen (Zeit, Ort, Fortschritt, Öffnen), ein zweiter legt sie wieder zusammen.
 */

const PILL = 48;
const FULL = 176;

export function LiveIsland({
  items,
  onOpen,
}: {
  items: LiveSource[];
  /** Ohne `onOpen` fehlt der Knopf „Öffnen“ (z. B. beim Personal: alles steht schon in der Karte). */
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const grow = useSharedValue(0);

  // Minutengenau reicht: alle 30 Sekunden neu rechnen.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    grow.set(withSpring(open ? 1 : 0, { damping: 18, stiffness: 210, mass: 0.9 }));
  }, [open, grow]);

  const card = useAnimatedStyle(() => ({
    height: PILL + (FULL - PILL) * grow.get(),
    borderRadius: interpolate(grow.get(), [0, 1], [PILL / 2, tokens.radius.xl], 'clamp'),
  }));
  const details = useAnimatedStyle(() => ({
    opacity: interpolate(grow.get(), [0.4, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(grow.get(), [0, 1], [8, 0], 'clamp') }],
  }));

  const live = pickLive(items, now);
  if (!live) return null;
  const running = live.phase === 'running';
  const c = clock(live.minutes);
  const left = t(running ? 'start.live.left' : 'start.live.in', {
    value: c.value,
    unit: t(`start.live.unit.${c.unit}`),
  });

  return (
    <Animated.View entering={FadeIn.duration(tokens.motion.slow)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t(running ? 'start.live.running' : 'start.live.soon')}: ${live.title}, ${left}`}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen((v) => !v);
        }}
      >
        <Animated.View style={[styles.island, card]}>
          <View style={styles.pillRow}>
            <Animated.View
              style={[styles.dot, { backgroundColor: running ? '#34D399' : '#FBBF24' }, pulse]}
            />
            <Text variant="caption" style={styles.state}>
              {t(running ? 'start.live.running' : 'start.live.soon').toUpperCase()}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {live.title}
            </Text>
            <Text variant="bodyStrong" tabular style={styles.time}>
              {left}
            </Text>
          </View>
          <Animated.View style={[styles.details, details]} pointerEvents={open ? 'auto' : 'none'}>
            <View style={styles.fact}>
              <Clock color="#9CA3AF" size={16} strokeWidth={2.2} />
              <Text variant="small" style={styles.muted}>
                {formatTime(live.starts_at)}–{formatTime(live.end)}
              </Text>
            </View>
            {live.place ? (
              <View style={styles.fact}>
                <MapPin color="#9CA3AF" size={16} strokeWidth={2.2} />
                <Text variant="small" numberOfLines={1} style={styles.muted}>
                  {live.place}
                </Text>
              </View>
            ) : null}
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.round(live.progress * 100)}%` },
                  transition('width', tokens.motion.slow),
                ]}
              />
            </View>
            {onOpen ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('start.live.open')}
                onPress={() => onOpen(live.id)}
                style={styles.open}
              >
                <Text variant="small" style={styles.openText}>
                  {t('start.live.open')}
                </Text>
                <ArrowRight color={tokens.color.ink} size={16} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const pulse = {
  animationName: {
    '0%': { opacity: 1, transform: [{ scale: 1 }] },
    '50%': { opacity: 0.45, transform: [{ scale: 0.8 }] },
    '100%': { opacity: 1, transform: [{ scale: 1 }] },
  },
  animationDuration: '1600ms',
  animationIterationCount: 'infinite',
} as ViewStyle;

const styles = StyleSheet.create({
  island: {
    backgroundColor: '#0B0D12',
    overflow: 'hidden',
    paddingHorizontal: tokens.space[4],
    boxShadow: tokens.shadow.float,
  },
  pillRow: { height: PILL, flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { color: '#9CA3AF', letterSpacing: 0.6 },
  title: { flex: 1, color: '#F9FAFB' },
  time: { color: '#F9FAFB' },
  details: { gap: tokens.space[2], paddingBottom: tokens.space[4] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  muted: { color: '#D1D5DB', flex: 1 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
    marginTop: 4,
  },
  bar: { height: 4, borderRadius: 2, backgroundColor: '#34D399' },
  open: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.full,
    backgroundColor: '#F9FAFB',
    marginTop: 4,
  },
  openText: { color: tokens.color.ink, fontFamily: tokens.font.semibold },
});
