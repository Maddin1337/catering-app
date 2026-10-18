import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { RadioList } from '@/components/ui/radio-list';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { costRatioBp } from '@/lib/costing';
import { formatCents } from '@/lib/money';
import { bpToPercentString } from '@/lib/percent';
import { tokens } from '@/theme/tokens';

import { parseDoc, type Doc } from '../editor-doc';

export type SettingsKind = 'pricing' | 'discount' | 'deposit' | 'details' | 'texts';

/**
 * Ein Blatt je Einstellung des Angebots. Änderungen gelten sofort (und werden wie alles im Editor
 * automatisch gespeichert); „Fertig“ schließt nur.
 */
export function SettingsSheet({
  kind,
  doc,
  change,
  netCents,
  cost,
  onClose,
}: {
  kind: SettingsKind;
  doc: Doc;
  change: (fn: (d: Doc) => Doc) => void;
  netCents: number;
  cost: { cents: number | null; incomplete: boolean };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const p = parseDoc(doc);
  const set = (patch: Partial<Doc>) => change((d) => ({ ...d, ...patch }));

  return (
    <Sheet
      title={t(`quote.settings.title.${kind}`)}
      onClose={onClose}
      footer={(close) => <Button label={t('common.done')} onPress={() => close()} />}
    >
      {kind === 'pricing' ? (
        <>
          <View style={styles.block}>
            <Text variant="small" color="textSecondary">
              {t('quote.display')}
            </Text>
            <SegmentedTabs
              items={[
                { key: 'net', label: t('quote.net') },
                { key: 'gross', label: t('quote.gross') },
              ]}
              active={doc.price_display}
              onChange={(k) => set({ price_display: k })}
            />
            <Text variant="small" color="textTertiary">
              {t('quote.settings.displayHint')}
            </Text>
          </View>
          <RadioList
            label={t('quote.calculation')}
            value={doc.pricing_mode}
            onChange={(v) => set({ pricing_mode: v })}
            options={[
              { value: 'flat', label: t('quote.mode.flat'), hint: t('quote.settings.flatHint') },
              {
                value: 'cost_based',
                label: t('quote.mode.cost_based'),
                hint: t('quote.markupHint'),
              },
            ]}
          />
          {doc.pricing_mode === 'cost_based' ? (
            <TextField
              label={t('quote.markup')}
              value={doc.markup}
              onChangeText={(v) => set({ markup: v })}
              error={p.markup === null ? t('settings.defaults.errors.markup') : undefined}
              inputMode="decimal"
              keyboardType="decimal-pad"
            />
          ) : null}
          <View style={styles.facts}>
            {cost.cents !== null ? (
              <Text variant="small" color="textSecondary">
                {t('quote.cost', { cost: formatCents(cost.cents) })}
              </Text>
            ) : null}
            {cost.cents !== null && !cost.incomplete && netCents > 0 ? (
              <Text variant="small" color="textSecondary">
                {t('quote.profit', {
                  profit: formatCents(netCents - cost.cents),
                  quote: bpToPercentString(
                    costRatioBp({ micro: cost.cents * 100000, complete: true }, netCents) ?? 0,
                  ),
                })}
              </Text>
            ) : null}
            {cost.incomplete || cost.cents === null ? (
              <Text variant="small" color="textTertiary">
                {t(
                  cost.incomplete ? 'quote.warning.cost_incomplete' : 'quote.settings.costUnknown',
                )}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      {kind === 'discount' ? (
        <>
          <SegmentedTabs
            items={[
              { key: 'bp', label: t('quote.discountPercent') },
              { key: 'cents', label: t('quote.discountAmount') },
            ]}
            active={doc.discountMode}
            onChange={(k) => set({ discountMode: k, discount: '' })}
          />
          <TextField
            label={
              doc.discountMode === 'bp'
                ? t('quote.discountPercentLabel')
                : t('quote.discountAmountLabel')
            }
            value={doc.discount}
            onChangeText={(v) => set({ discount: v })}
            error={p.disc === null ? t('quote.errors.discount') : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          {doc.discount.trim() ? (
            <Button
              label={t('quote.settings.removeDiscount')}
              variant="ghost"
              onPress={() => set({ discount: '' })}
            />
          ) : null}
        </>
      ) : null}

      {kind === 'deposit' ? (
        <>
          <SegmentedTabs
            items={[
              { key: 'none', label: t('quote.depositNone') },
              { key: 'bp', label: t('quote.discountPercent') },
              { key: 'cents', label: t('quote.discountAmount') },
            ]}
            active={doc.depositMode}
            onChange={(k) => set({ depositMode: k, deposit: '' })}
          />
          {doc.depositMode !== 'none' ? (
            <>
              <TextField
                label={
                  doc.depositMode === 'bp'
                    ? t('quote.depositPercentLabel')
                    : t('quote.depositAmountLabel')
                }
                value={doc.deposit}
                onChangeText={(v) => set({ deposit: v })}
                error={
                  doc.deposit.trim() !== '' && p.dep === null
                    ? t('quote.errors.discount')
                    : undefined
                }
                inputMode="decimal"
                keyboardType="decimal-pad"
              />
              <DateField
                label={t('quote.depositDue')}
                value={doc.deposit_due_on}
                onChange={(v) => set({ deposit_due_on: v })}
                optional
              />
            </>
          ) : (
            <Text variant="small" color="textTertiary">
              {t('quote.settings.depositHint')}
            </Text>
          )}
        </>
      ) : null}

      {kind === 'details' ? (
        <>
          <DateField
            label={t('quote.validUntil')}
            value={doc.valid_until}
            onChange={(v) => set({ valid_until: v })}
            optional
          />
          <TextField
            label={t('quote.reference')}
            value={doc.customer_reference}
            onChangeText={(v) => set({ customer_reference: v })}
          />
        </>
      ) : null}

      {kind === 'texts' ? (
        <>
          <Text variant="small" color="textTertiary">
            {t('quote.settings.textsHint')}
          </Text>
          <TextField
            label={t('settings.quoteTexts.quote_intro_text')}
            value={doc.intro}
            onChangeText={(v) => set({ intro: v })}
            multiline
          />
          <TextField
            label={t('settings.quoteTexts.quote_terms_text')}
            value={doc.terms}
            onChangeText={(v) => set({ terms: v })}
            multiline
          />
          <TextField
            label={t('settings.quoteTexts.quote_closing_text')}
            value={doc.closing}
            onChangeText={(v) => set({ closing: v })}
            multiline
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.space[2] },
  facts: {
    gap: 4,
    padding: tokens.space[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bgSubtle,
  },
});
