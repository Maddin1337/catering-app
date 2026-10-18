import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { EventStatus } from '@/lib/event-status';
import { eventStatusStyle, tokens } from '@/theme/tokens';

/** Statusbadge mit Text und Farbe aus den Design-Tokens (nie nur Farbe, docs/04 §4.3). */
export function StatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation();
  const s = eventStatusStyle[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text variant="caption" style={{ color: s.fg }}>
        {t(`events.status.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space[2],
    height: 24,
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
  },
});
