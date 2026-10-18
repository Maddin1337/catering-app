import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { transition } from '@/components/ui/transition';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { formatEuroRounded } from '@/lib/money';
import { tints, tokens } from '@/theme/tokens';

import type { RevenueSummary } from '../revenue';

const BAR_AREA = 88;
const COL_GAP = tokens.space[2];
// Heller Petrol-Ton für „im Angebot“; hebt sich vom weißen Grund noch ab.
const OPEN_COLOR = '#A9DDD3';

function monthName(iso: string, style: 'long' | 'short'): string {
  return new Intl.DateTimeFormat('de-DE', { month: style, timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace('.', '');
}

/**
 * Auftragswert des Monats: große Zahl, Vergleich zum Vormonat und Balken für sechs Monate (gebucht
 * und im Angebot). Mit dem Finger über die Balken fahren wählt einen Monat – nach „Stacked bars“ von
 * Bencho (bencho.dev, MIT, © 2026 Lorenzo Cabra): Der gewählte Balken bleibt kräftig, die anderen
 * treten zurück, ein Hinweis gleitet über ihm mit, und die große Zahl zählt auf den Monat um.
 */
export function RevenueCard({ summary }: { summary: RevenueSummary }) {
  const { t } = useTranslation();
  const { current: thisMonth, deltaPercent, max, months } = summary;
  const nowIndex = Math.max(
    0,
    months.findIndex((m) => m.month === thisMonth.month),
  );
  const [picked, setPicked] = useState(nowIndex);
  const [chartWidth, setChartWidth] = useState(0);
  const current = months[picked] ?? thisMonth;
  const isNow = picked === nowIndex;
  const up = deltaPercent !== null && deltaPercent >= 0;
  const name = monthName(current.month, 'long');

  // Spalten sind gleich breit, dazwischen der Abstand der Zeile.
  const col = chartWidth > 0 ? (chartWidth - COL_GAP * (months.length - 1)) / months.length : 0;
  const pick = (x: number) => {
    if (col <= 0) return;
    const i = Math.min(months.length - 1, Math.max(0, Math.floor(x / (col + COL_GAP))));
    if (i !== picked) {
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
      setPicked(i);
    }
  };
  const scrub = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
    onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
  });

  return (
    <Surface
      accessible
      accessibilityLabel={t('start.revenue.a11y', {
        month: name,
        booked: formatEuroRounded(current.booked_cents),
        open: formatEuroRounded(current.open_cents),
      })}
      style={styles.card}
    >
      <View style={styles.head}>
        <Text variant="title2" style={styles.title}>
          {t('start.revenue.title', { month: name })}
        </Text>
        {deltaPercent !== null && isNow ? (
          <View
            style={[styles.delta, { backgroundColor: up ? tints.teal.bg : tokens.color.bgMuted }]}
          >
            {up ? (
              <TrendingUp color={tints.teal.fg} size={14} strokeWidth={2.4} />
            ) : (
              <TrendingDown color={tokens.color.textSecondary} size={14} strokeWidth={2.4} />
            )}
            <Text
              variant="caption"
              style={{ color: up ? tints.teal.fg : tokens.color.textSecondary }}
            >
              {t(up ? 'start.revenue.deltaUp' : 'start.revenue.deltaDown', {
                value: deltaPercent,
              })}
            </Text>
          </View>
        ) : null}
      </View>

      <AnimatedNumber
        value={current.booked_cents}
        format={(n) => formatEuroRounded(Math.round(n))}
        variant="display"
        tabular
      />
      <Text variant="small" color="textSecondary">
        {t('start.revenue.booked', { count: current.booked_count })}
      </Text>
      {current.open_count > 0 ? (
        <Text variant="small" color="textSecondary">
          {t('start.revenue.open', {
            amount: formatEuroRounded(current.open_cents),
            count: current.open_count,
          })}
        </Text>
      ) : null}

      <View
        style={styles.chart}
        // Nur die Grafik selbst nimmt Berührungen an: So misst `locationX` immer ab ihrer linken
        // Kante und nicht ab dem Balken, auf dem der Finger gerade liegt.
        pointerEvents="box-only"
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        {...scrub.panHandlers}
      >
        {col > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              { width: col + 4, transform: [{ translateX: picked * (col + COL_GAP) - 2 }] },
              transition('transform', 260, 'cubic-bezier(0.34, 1.3, 0.64, 1)'),
            ]}
          />
        ) : null}
        {months.map((m, i) => {
          const isCurrent = i === picked;
          const booked = Math.round((m.booked_cents / max) * BAR_AREA);
          const open = Math.round((m.open_cents / max) * BAR_AREA);
          return (
            <View
              key={m.month}
              style={[styles.col, { opacity: isCurrent ? 1 : 0.5 }, transition('opacity', 200)]}
            >
              {/* Balken wachsen nacheinander von unten herein. */}
              <Animated.View style={[styles.barArea, grow(i)]}>
                {open > 0 ? <View style={[styles.open, { height: Math.max(open, 3) }]} /> : null}
                {booked > 0 ? (
                  <View style={[styles.booked, { height: Math.max(booked, 3) }]} />
                ) : null}
                {booked === 0 && open === 0 ? <View style={styles.empty} /> : null}
              </Animated.View>
              <Text
                variant="caption"
                color={isCurrent ? 'text' : 'textTertiary'}
                style={styles.label}
              >
                {monthName(m.month, 'short')}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: tokens.color.accent }]} />
          <Text variant="caption" color="textSecondary">
            {t('start.revenue.legendBooked')}
          </Text>
        </View>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: OPEN_COLOR }]} />
          <Text variant="caption" color="textSecondary">
            {t('start.revenue.legendOpen')}
          </Text>
        </View>
      </View>
      <Text variant="caption" color="textTertiary">
        {t('start.revenue.note')}
      </Text>
    </Surface>
  );
}

const grow = (i: number) =>
  ({
    transformOrigin: 'bottom',
    animationName: { from: { transform: [{ scaleY: 0 }] }, to: { transform: [{ scaleY: 1 }] } },
    animationDuration: 650,
    animationDelay: 120 + i * 70,
    animationFillMode: 'backwards',
    animationTimingFunction: tokens.motion.ease,
  }) as ViewStyle;

const styles = StyleSheet.create({
  card: { gap: tokens.space[1], padding: tokens.space[5] },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[2],
    marginBottom: tokens.space[1],
  },
  title: { flex: 1 },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: tokens.space[2],
    borderRadius: tokens.radius.full,
  },
  glow: {
    position: 'absolute',
    top: -6,
    bottom: -4,
    left: 0,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bgSubtle,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  chart: {
    ...Platform.select({
      web: { touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none' } as object,
    }),
    flexDirection: 'row',
    gap: tokens.space[2],
    marginTop: tokens.space[4],
  },
  col: { flex: 1, alignItems: 'center', gap: tokens.space[1] },
  barArea: { height: BAR_AREA, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  booked: {
    width: '70%',
    maxWidth: 36,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: tokens.color.accent,
  },
  open: {
    width: '70%',
    maxWidth: 36,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: OPEN_COLOR,
  },
  empty: {
    width: '70%',
    maxWidth: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: tokens.color.bgMuted,
  },
  label: { textAlign: 'center' },
  legend: { flexDirection: 'row', gap: tokens.space[4], marginTop: tokens.space[2] },
  key: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
