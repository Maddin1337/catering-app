import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { surfaceStyle } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { formatCents } from '@/lib/money';
import { tints, tokens } from '@/theme/tokens';

import type { EditorItem } from '../types';
import { lookOf } from './item-look';

/**
 * Eine Position in der Liste: Symbol der Art, Bezeichnung, darunter „80 Gäste × 24,50 €“, rechts
 * der Betrag. Tippen öffnet das Blatt. Im Ordnen-Modus stehen rechts Pfeile statt des Betrags.
 * Zwischenüberschriften sind schlichte Abschnittstitel.
 */
export function ItemCard({
  item,
  quantityLabel,
  unitPriceCents,
  totalCents,
  ordering,
  first,
  last,
  onPress,
  onMove,
}: {
  item: EditorItem;
  /** Schon formatiert, z. B. „80 Gäste“ oder „2 Stück“. */
  quantityLabel: string;
  unitPriceCents: number | null;
  totalCents: number | null;
  ordering: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const look = lookOf(item);
  const arrows = ordering ? (
    <View style={styles.arrows}>
      <IconButton
        icon={ArrowUp}
        label={t('quote.list.up', { name: item.name })}
        disabled={first}
        onPress={() => onMove(-1)}
      />
      <IconButton
        icon={ArrowDown}
        label={t('quote.list.down', { name: item.name })}
        disabled={last}
        onPress={() => onMove(1)}
      />
    </View>
  ) : null;

  if (item.is_heading) {
    return (
      <View style={styles.headingRow}>
        {ordering ? (
          <View style={styles.heading}>
            <Text variant="caption" color="textTertiary" style={styles.headingText}>
              {item.name.toUpperCase()}
            </Text>
          </View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t('quote.heading')}: ${item.name}`}
            onPress={onPress}
            scale={0.98}
            style={styles.heading}
          >
            <Text variant="caption" color="textTertiary" style={styles.headingText}>
              {item.name.toUpperCase()}
            </Text>
          </PressableScale>
        )}
        {arrows}
      </View>
    );
  }

  const price = unitPriceCents !== null ? formatCents(unitPriceCents) : null;
  const hours =
    item.type === 'service' && item.hours
      ? t('quote.list.hours', { value: String(item.hours).replace('.', ',') })
      : null;
  const meta = [
    [quantityLabel, hours, price].filter(Boolean).join(' × '),
    item.discount_bp ? t('quote.list.discount', { value: item.discount_bp / 100 }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: tints[look.tint].bg }]}>
        <look.icon color={tints[look.tint].fg} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {item.name || t('quote.list.unnamed')}
        </Text>
        <Text variant="small" color="textSecondary" numberOfLines={2}>
          {meta}
        </Text>
        {item.choice_group.trim() || !item.tax_rate_id ? (
          <View style={styles.tags}>
            {item.choice_group.trim() ? (
              <Text variant="caption" style={styles.tag}>
                {item.is_selected
                  ? t('quote.list.chosen', { group: item.choice_group.trim() })
                  : t('quote.list.alternative', { group: item.choice_group.trim() })}
              </Text>
            ) : null}
            {!item.tax_rate_id ? (
              <Text variant="caption" style={[styles.tag, styles.tagDanger]}>
                {t('quote.noTax')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {arrows ??
        (totalCents !== null ? (
          <Text variant="bodyStrong" tabular>
            {formatCents(totalCents)}
          </Text>
        ) : null)}
    </>
  );

  // Im Ordnen-Modus ist die Karte kein Knopf, sonst wären die Pfeile darin mit gesperrt.
  if (ordering) {
    return <View style={[styles.card, !item.is_selected && styles.unselected]}>{body}</View>;
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${meta}${totalCents !== null ? `, ${formatCents(totalCents)}` : ''}`}
      accessibilityHint={t('quote.list.editHint')}
      onPress={onPress}
      scale={0.985}
      style={[styles.card, !item.is_selected && styles.unselected]}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaceStyle(),
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    padding: tokens.space[3],
    paddingRight: tokens.space[4],
    minHeight: 72,
  },
  unselected: { opacity: 0.6 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[1], marginTop: 4 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.bgMuted,
    color: tokens.color.textSecondary,
    overflow: 'hidden',
  },
  tagDanger: { backgroundColor: tokens.color.dangerSubtle, color: tokens.color.danger },
  arrows: { flexDirection: 'row', gap: tokens.space[1] },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    marginTop: tokens.space[2],
  },
  heading: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  headingText: { letterSpacing: 0.8 },
});
