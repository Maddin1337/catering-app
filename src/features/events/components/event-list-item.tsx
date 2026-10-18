import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DateTile } from '@/components/ui/date-tile';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { isoToBerlin } from '@/lib/berlin';
import { formatDate, formatTime } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

import type { EventRow } from '../types';
import { StatusBadge } from './status-badge';

/**
 * Auftrag in Listen: Datumskachel, Zeit und Gäste, Titel, Kunde, Status.
 * `timeLabel` ersetzt die Zeitangabe (z. B. „Fortsetzung vom Vortag“ im Kalender).
 */
export function EventListItem({
  event,
  onPress,
  timeLabel,
  showTile = true,
}: {
  event: EventRow;
  onPress: () => void;
  timeLabel?: string;
  showTile?: boolean;
}) {
  const { t } = useTranslation();
  const meta = [
    timeLabel ?? formatTime(event.starts_at),
    event.guest_count ? t('events.detail.guests', { count: event.guest_count }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Surface
      onPress={onPress}
      accessibilityLabel={`${event.title}, ${formatDate(event.starts_at)}`}
      style={styles.card}
    >
      {showTile ? <DateTile date={isoToBerlin(event.starts_at).date} /> : null}
      <View style={styles.texts}>
        <Text variant="small" color="textSecondary" tabular>
          {meta}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {event.title}
        </Text>
        {event.customer_name ? (
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {event.customer_name}
          </Text>
        ) : null}
        <View style={styles.badges}>
          <StatusBadge status={event.status} />
          {event.status === 'optioned' && event.option_expires_at ? (
            <Text variant="caption" color="textSecondary">
              {t('events.badge.optionExpires', { date: formatDate(event.option_expires_at) })}
            </Text>
          ) : null}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: tokens.space[3], padding: tokens.space[3] },
  texts: { flex: 1, gap: 2 },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space[2],
    marginTop: tokens.space[1],
  },
});
