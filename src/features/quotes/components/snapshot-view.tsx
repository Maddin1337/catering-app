import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatGermanDate } from '@/lib/berlin';
import { formatCents } from '@/lib/money';
import { bpToPercentString } from '@/lib/percent';
import { tokens } from '@/theme/tokens';

import { AllergenCodes } from '../../catalog/components/allergen-codes';
import { ALLERGEN_LETTER } from '../../catalog/types';
import { quantityText } from '../document';
import type { QuoteSnapshot } from '../snapshot';

/** Positionen und Summen einer Revision (Portal und Vorschau); Preise in der Anzeigeart des Angebots. */
export function SnapshotView({ snapshot: s }: { snapshot: QuoteSnapshot }) {
  const { t } = useTranslation();
  const gross = s.quote.price_display === 'gross';
  const used = new Set<string>();
  s.items.forEach((i) => {
    i.allergens.forEach((a) => used.add(a));
    i.package_dishes.forEach((d) => d.allergens.forEach((a) => used.add(a)));
  });

  return (
    <View style={{ gap: 12 }}>
      {s.items.map((i) =>
        i.is_heading ? (
          <Text key={i.id} variant="title2" color="accent">
            {i.name}
          </Text>
        ) : (
          <View
            key={i.id}
            style={{
              gap: 4,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: tokens.color.border,
              opacity: i.is_selected ? 1 : 0.55,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {i.name}
              </Text>
              {i.is_selected ? (
                <Text variant="bodyStrong" tabular>
                  {formatCents((gross ? i.line_gross_cents : i.line_net_cents) ?? 0)}
                </Text>
              ) : null}
            </View>
            <Text variant="small" color="textSecondary">
              {quantityText(i)} · {formatCents(i.unit_price_display_cents ?? 0)}
            </Text>
            {i.description ? (
              <Text variant="small" color="textSecondary">
                {i.description}
              </Text>
            ) : null}
            {i.package_dishes.map((d) => (
              <Text key={d.name} variant="small" color="textSecondary">
                · {d.name}
                {d.allergens.length > 0
                  ? ` (${d.allergens.map((a) => ALLERGEN_LETTER[a]).join(', ')})`
                  : ''}
              </Text>
            ))}
            <AllergenCodes allergens={i.allergens} />
            {!i.is_selected ? (
              <Text variant="small" color="textSecondary">
                {t('quoteDoc.alternative')}
              </Text>
            ) : null}
          </View>
        ),
      )}

      <View style={{ gap: 4 }}>
        {s.totals.discount_cents > 0 ? (
          <>
            <Row
              label={t(gross ? 'quoteDoc.sumBeforeGross' : 'quoteDoc.sumBeforeNet')}
              value={formatCents(s.totals.sum_before_discount_cents)}
            />
            <Row
              label={t('quoteDoc.discount')}
              value={`−${formatCents(s.totals.discount_cents)}`}
            />
          </>
        ) : null}
        {gross ? null : <Row label={t('quoteDoc.net')} value={formatCents(s.totals.net_cents)} />}
        {s.totals.tax.map((x) => (
          <Row
            key={x.rate_bp}
            muted
            label={
              gross
                ? t('quoteDoc.vatIncluded', {
                    rate: bpToPercentString(x.rate_bp),
                    base: formatCents(x.base_cents + x.tax_cents),
                  })
                : t('quoteDoc.vatPlus', {
                    rate: bpToPercentString(x.rate_bp),
                    base: formatCents(x.base_cents),
                  })
            }
            value={formatCents(x.tax_cents)}
          />
        ))}
        <Row strong label={t('quoteDoc.total')} value={formatCents(s.totals.gross_cents)} />
        {s.quote.deposit.amount_cents ? (
          <Row
            muted
            label={t('quoteDoc.deposit', {
              date: s.quote.deposit.due_on ? formatGermanDate(s.quote.deposit.due_on) : '–',
            })}
            value={formatCents(s.quote.deposit.amount_cents)}
          />
        ) : null}
      </View>

      {used.size > 0 ? (
        <Text variant="small" color="textSecondary">
          {t('quoteDoc.allergens')}:{' '}
          {[...used]
            .sort((a, b) =>
              (ALLERGEN_LETTER as Record<string, string>)[a]!.localeCompare(
                (ALLERGEN_LETTER as Record<string, string>)[b]!,
              ),
            )
            .map((a) => `${(ALLERGEN_LETTER as Record<string, string>)[a]} = ${t(`allergen.${a}`)}`)
            .join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text
        variant={strong ? 'bodyStrong' : 'body'}
        color={muted ? 'textSecondary' : 'text'}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Text
        variant={strong ? 'bodyStrong' : 'body'}
        color={muted ? 'textSecondary' : 'text'}
        tabular
      >
        {value}
      </Text>
    </View>
  );
}
