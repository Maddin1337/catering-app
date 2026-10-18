import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

import { StatusBadge } from '../../events/components/status-badge';
import type { EventRow } from '../../events/types';

/** Zeile der Tagesübersicht: Uhrzeit links, Titel und Kunde in der Mitte, Status rechts. */
export function AgendaRow({ event, onPress }: { event: EventRow; onPress: () => void }) {
  return (
    <Surface onPress={onPress} accessibilityLabel={event.title} style={styles.row}>
      <View style={styles.time}>
        <Text variant="bodyStrong" tabular>
          {formatTime(event.starts_at)}
        </Text>
      </View>
      <View style={styles.rule} />
      <View style={styles.texts}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {event.title}
        </Text>
        {event.customer_name ? (
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {event.customer_name}
          </Text>
        ) : null}
      </View>
      <StatusBadge status={event.status} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: 68,
    paddingVertical: tokens.space[3],
  },
  time: { width: 46 },
  rule: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: tokens.color.accent },
  texts: { flex: 1, gap: 2 },
});
