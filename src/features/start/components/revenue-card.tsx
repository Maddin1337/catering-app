import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { formatEuroRounded } from '@/lib/money';
import { tints, tokens } from '@/theme/tokens';

import type { RevenueSummary } from '../revenue';

const BAR_AREA = 88;
// Heller Petrol-Ton für „im Angebot“; hebt sich vom weißen Grund noch ab.
const OPEN_COLOR = '#A9DDD3';

function monthName(iso: string, style: 'long' | 'short'): string {
  return new Intl.DateTimeFormat('de-DE', { month: style, timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace('.', '');
}

/** Auftragswert des Monats: große Zahl, Vergleich zum Vormonat und Balken für sechs Monate (gebucht und im Angebot). */
export function RevenueCard({ summary }: { summary: RevenueSummary }) {
  const { t } = useTranslation();
  const { current, deltaPercent, max, months } = summary;
  const up = deltaPercent !== null && deltaPercent >= 0;
  const name = monthName(current.month, 'long');

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
        {deltaPercent !== null ? (
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

      <Text variant="display" tabular>
        {formatEuroRounded(current.booked_cents)}
      </Text>
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

      <View style={styles.chart} importantForAccessibility="no-hide-descendants">
        {months.map((m) => {
          const isCurrent = m.month === current.month;
          const booked = Math.round((m.booked_cents / max) * BAR_AREA);
          const open = Math.round((m.open_cents / max) * BAR_AREA);
          return (
            <View key={m.month} style={styles.col}>
              <View style={styles.barArea}>
                {open > 0 ? <View style={[styles.open, { height: Math.max(open, 3) }]} /> : null}
                {booked > 0 ? (
                  <View
                    style={[
                      styles.booked,
                      { height: Math.max(booked, 3) },
                      !isCurrent && styles.bookedMuted,
                    ]}
                  />
                ) : null}
                {booked === 0 && open === 0 ? <View style={styles.empty} /> : null}
              </View>
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
  chart: {
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
  bookedMuted: { opacity: 0.55 },
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
