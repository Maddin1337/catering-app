import { ChevronDown, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { SwitchRow } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { transition } from '@/components/ui/transition';
import { formatCents } from '@/lib/money';
import { centsToEuroInput } from '@/lib/money-input';
import { tokens } from '@/theme/tokens';

import type { TaxRate } from '../../company/types';
import { advancedSummary, draftErrors, linePreview, type ItemDraft } from '../item-draft';
import type { EditorItem } from '../types';

/**
 * Felder einer Position: oben nur, was man fast immer braucht (Bezeichnung, Menge, Preis), darunter
 * eine Rechnung, die zeigt, was herauskommt. Steuersatz, Rabatt, Alternativen und Seltenes liegen
 * zugeklappt unter „Weitere Optionen“; die Zeile nennt, was dort eingestellt ist.
 */
export function ItemFields({
  item,
  draft,
  onChange,
  showErrors,
  rates,
  suggestion,
  entryLabel,
  guests,
}: {
  item: EditorItem;
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  showErrors: boolean;
  rates: TaxRate[];
  /** Preisvorschlag aus dem Wareneinsatz in Cent (nur Katalogpositionen mit vollständigen Kosten). */
  suggestion: number | null;
  entryLabel: string;
  guests: number | null;
}) {
  const { t } = useTranslation();
  const errors = showErrors ? draftErrors(item, draft) : {};
  // Fehlt der Steuersatz oder ist hier ein Fehler, ist der Bereich gleich offen.
  const [more, setMore] = useState(!item.is_heading && !draft.taxId);
  const open = more || !!errors.discount;

  if (item.is_heading) {
    return (
      <TextField
        label={t('quote.item.headingName')}
        value={draft.name}
        onChangeText={(v) => onChange({ name: v })}
        error={errors.name ? t('quote.item.errors.name') : undefined}
        maxLength={200}
      />
    );
  }

  const preview = linePreview(item, draft, guests);
  const unit = draft.unit.trim() || t('quote.item.unitFallback');

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('quote.item.name')}
        value={draft.name}
        onChangeText={(v) => onChange({ name: v })}
        error={errors.name ? t('quote.item.errors.name') : undefined}
        maxLength={200}
      />

      <View style={styles.block}>
        <Text variant="small" color="textSecondary">
          {t('quote.item.amount')}
        </Text>
        <SegmentedTabs
          items={[
            {
              key: 'guest',
              label: guests
                ? t('quote.item.perGuestCount', { count: guests })
                : t('quote.item.perGuestShort'),
            },
            { key: 'fixed', label: t('quote.item.fixed') },
          ]}
          active={draft.perGuest ? 'guest' : 'fixed'}
          onChange={(k) => onChange({ perGuest: k === 'guest' })}
        />
        {draft.perGuest ? (
          <Text variant="small" color="textTertiary">
            {t('quote.item.perGuestHint')}
          </Text>
        ) : (
          <TextField
            label={unit === 'Person' ? t('quote.item.qtyPersons') : t('quote.item.qtyIn', { unit })}
            value={draft.qty}
            onChangeText={(v) => onChange({ qty: v })}
            error={errors.qty ? t('quote.item.errors.qty') : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
        )}
      </View>

      {item.type === 'service' ? (
        <TextField
          label={t('quote.item.hours')}
          helper={t('quote.item.hoursHint')}
          value={draft.hours}
          onChangeText={(v) => onChange({ hours: v })}
          error={errors.hours ? t('quote.item.errors.hours') : undefined}
          inputMode="decimal"
          keyboardType="decimal-pad"
        />
      ) : null}

      <View style={styles.block}>
        <TextField
          label={t('quote.item.priceShort', { unit, basis: entryLabel })}
          value={draft.price}
          onChangeText={(v) => onChange({ price: v, manual: true })}
          error={errors.price ? t('quote.item.errors.price') : undefined}
          inputMode="decimal"
          keyboardType="decimal-pad"
        />
        {suggestion !== null && draft.price !== centsToEuroInput(suggestion) ? (
          <View style={styles.row}>
            <Chip
              icon={Sparkles}
              label={t('quote.item.useSuggestion', { price: formatCents(suggestion) })}
              onPress={() => onChange({ price: centsToEuroInput(suggestion), manual: false })}
            />
          </View>
        ) : null}
        {preview ? (
          <View style={styles.preview} accessibilityLiveRegion="polite">
            <Text variant="small" color="textSecondary">
              {t('quote.item.lineTotal')}
            </Text>
            <Text variant="bodyStrong" tabular style={styles.previewValue}>
              {preview}
            </Text>
          </View>
        ) : null}
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('quote.item.more')}
        onPress={() => setMore(!open)}
        scale={0.985}
        pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
        style={styles.moreRow}
      >
        <View style={styles.moreTexts}>
          <Text variant="bodyStrong">{t('quote.item.more')}</Text>
          <Text variant="small" color={draft.taxId ? 'textSecondary' : 'danger'} numberOfLines={2}>
            {advancedSummary(draft, rates, t)}
          </Text>
        </View>
        <View
          style={[
            { transform: [{ rotate: open ? '180deg' : '0deg' }] },
            transition('transform', tokens.motion.base),
          ]}
        >
          <ChevronDown color={tokens.color.textSecondary} size={20} strokeWidth={2.2} />
        </View>
      </PressableScale>

      {open ? (
        <View style={styles.more}>
          <View style={styles.block}>
            <Text variant="small" color="textSecondary">
              {t('quote.item.tax')}
            </Text>
            <View style={styles.chips}>
              {rates.map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  selected={draft.taxId === r.id}
                  onPress={() => onChange({ taxId: r.id })}
                />
              ))}
            </View>
          </View>
          <TextField
            label={t('quote.item.description')}
            value={draft.description}
            onChangeText={(v) => onChange({ description: v })}
            multiline
          />
          <TextField
            label={t('quote.item.unit')}
            value={draft.unit}
            onChangeText={(v) => onChange({ unit: v })}
          />
          <TextField
            label={t('quote.item.discount')}
            value={draft.discount}
            onChangeText={(v) => onChange({ discount: v })}
            error={errors.discount ? t('quote.item.errors.discount') : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('quote.item.group')}
            helper={t('quote.item.groupHint')}
            value={draft.group}
            onChangeText={(v) => onChange({ group: v })}
          />
          {draft.group.trim() ? (
            <SwitchRow
              label={t('quote.item.selected')}
              value={draft.selected}
              onChange={(v) => onChange({ selected: v })}
            />
          ) : null}
          <SwitchRow
            label={t('quote.item.customerQty')}
            value={draft.custQty}
            onChange={(v) => onChange({ custQty: v })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[5] },
  block: { gap: tokens.space[2] },
  row: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accentSubtle,
  },
  previewValue: { flexShrink: 1, textAlign: 'right', color: tokens.color.accent },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: 56,
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  moreTexts: { flex: 1, gap: 2 },
  more: { gap: tokens.space[5] },
});
