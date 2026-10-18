import type { TFunction } from 'i18next';
import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HeroCard, type HeroFact } from '@/components/ui/hero-card';
import { formatDate, formatTime } from '@/lib/dates';

import { StatusBadge } from '../../events/components/status-badge';
import type { EventRow } from '../../events/types';

/** Zeitmarke der Hero-Karte: heute, morgen oder „in n Tagen“. */
export function whenLabel(days: number, t: TFunction): string {
  if (days <= 0) return t('start.next.today');
  if (days === 1) return t('start.next.tomorrow');
  return t('start.next.inDays', { count: days });
}

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
  if (!event) {
    return (
      <HeroCard
        eyebrow={t('start.next.label')}
        title={t('start.next.none')}
        body={t('start.next.noneBody')}
        accessibilityLabel={t('start.next.none')}
      />
    );
  }
  const where = [event.venue_name, event.city].filter(Boolean).join(', ');
  const facts: HeroFact[] = [
    { icon: CalendarDays, text: `${formatDate(event.starts_at)} · ${formatTime(event.starts_at)}` },
  ];
  if (where) facts.push({ icon: MapPin, text: where });
  if (event.guest_count) {
    facts.push({ icon: Users, text: t('events.detail.guests', { count: event.guest_count }) });
  }
  return (
    <HeroCard
      eyebrow={t('start.next.label')}
      when={whenLabel(days, t)}
      title={event.title}
      facts={facts}
      badge={<StatusBadge status={event.status} />}
      accessibilityLabel={`${t('start.next.label')}: ${event.title}`}
      onPress={onPress}
    />
  );
}
