import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { formatDate, formatTime } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

import { StatusBadge } from '../../events/components/status-badge';
import type { EventRow } from '../../events/types';

const SOFT = 'rgba(255, 255, 255, 0.74)';

/** Hero-Karte „Als Nächstes“: der nächste feststehende Auftrag auf einen Blick, oder ein ruhiger Leerzustand. */
export function NextEventCard({
  event,
  days,
  onPress,
}: {
  event: EventRow | null;
  /** Tage bis zum Beginn (0 = heute). */
  days: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const where = event ? [event.venue_name, event.city].filter(Boolean).join(', ') : '';
  const when = !event
    ? ''
    : days <= 0
      ? t('start.next.today')
      : days === 1
        ? t('start.next.tomorrow')
        : t('start.next.inDays', { count: days });

  const body = (
    <>
      <View style={styles.top}>
        <Text variant="caption" style={styles.eyebrow}>
          {t('start.next.label')}
        </Text>
        {event ? (
          <View style={styles.when}>
            <Text variant="caption" style={styles.whenText}>
              {when}
            </Text>
          </View>
        ) : null}
      </View>
      {event ? (
        <>
          <Text variant="title1" color="onAccent" numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.facts}>
            <Fact icon={CalendarDays}>
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
            </Fact>
            {where ? <Fact icon={MapPin}>{where}</Fact> : null}
            {event.guest_count ? (
              <Fact icon={Users}>{t('events.detail.guests', { count: event.guest_count })}</Fact>
            ) : null}
          </View>
          <StatusBadge status={event.status} />
        </>
      ) : (
        <>
          <Text variant="title1" color="onAccent">
            {t('start.next.none')}
          </Text>
          <Text variant="small" style={{ color: SOFT }}>
            {t('start.next.noneBody')}
          </Text>
        </>
      )}
    </>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={event ? `${t('start.next.label')}: ${event.title}` : t('start.next.none')}
      disabled={!event}
      onPress={onPress}
      scale={0.985}
      style={styles.card}
    >
      <LinearGradient
        colors={[tokens.color.inkPressed, tokens.color.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>{body}</View>
    </PressableScale>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <View style={styles.fact}>
      <Icon color={SOFT} size={16} strokeWidth={2} />
      <Text variant="small" style={[styles.factText, { color: SOFT }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    overflow: 'hidden',
    backgroundColor: tokens.color.ink,
    boxShadow: tokens.shadow.ink,
  },
  inner: { padding: tokens.space[5], gap: tokens.space[3] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: SOFT, textTransform: 'uppercase', letterSpacing: 0.8 },
  when: {
    height: 26,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
  },
  whenText: { color: tokens.color.onAccent },
  facts: { gap: tokens.space[2] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  factText: { flex: 1 },
});
