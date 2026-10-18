import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { weekday } from '@/lib/berlin';
import { formatDate } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

import type { StripDay } from '../overview';

/** Sieben Tage ab heute: Wochentag, Datum und ein Punkt, wenn Aufträge anstehen. Tippen öffnet den Kalender. */
export function WeekStrip({ days }: { days: StripDay[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const names = t('start.week.days', { returnObjects: true }) as string[];
  return (
    <View style={styles.row}>
      {days.map((d) => (
        <PressableScale
          key={d.date}
          accessibilityRole="button"
          accessibilityLabel={
            d.count > 0
              ? t('start.week.dayLabel', { date: formatDate(d.date), count: d.count })
              : t('start.week.dayLabelEmpty', { date: formatDate(d.date) })
          }
          onPress={() => router.push('/calendar')}
          scale={0.94}
          style={[styles.day, d.isToday && styles.today]}
        >
          <Text variant="caption" color={d.isToday ? 'onAccent' : 'textTertiary'}>
            {names[weekday(d.date)]}
          </Text>
          <Text variant="bodyStrong" color={d.isToday ? 'onAccent' : 'text'}>
            {Number(d.date.slice(8))}
          </Text>
          <View
            style={[
              styles.dot,
              d.count > 0 && {
                backgroundColor: d.isToday ? tokens.color.onAccent : tokens.color.accent,
              },
            ]}
          />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.space[1] },
  day: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  today: {
    backgroundColor: tokens.color.ink,
    borderColor: tokens.color.ink,
    boxShadow: tokens.shadow.ink,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
