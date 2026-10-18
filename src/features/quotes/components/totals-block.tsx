import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { CalcResult } from '@/lib/calc';
import { formatCents } from '@/lib/money';
import { bpToPercentString } from '@/lib/percent';
import { tokens } from '@/theme/tokens';

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

/** Summenblock nach Anzeigeart (docs/02 §3.6): netto mit USt je Satz, brutto mit „darin enthaltene USt“. */
export function TotalsBlock({
  calc,
  display,
  guests,
}: {
  calc: CalcResult;
  display: 'net' | 'gross';
  guests: number | null;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        gap: 6,
        padding: tokens.space[4],
        borderWidth: 1,
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.lg,
      }}
    >
      {display === 'net' ? (
        <>
          <Row label={t('quote.totals.sumNet')} value={formatCents(calc.sumBeforeDiscountCents)} />
          {calc.discountCents > 0 ? (
            <Row label={t('quote.totals.discount')} value={`−${formatCents(calc.discountCents)}`} />
          ) : null}
          <Row label={t('quote.totals.net')} value={formatCents(calc.netCents)} strong />
          {calc.taxes.map((x) => (
            <Row
              key={x.rateBp}
              label={t('quote.totals.taxOn', {
                rate: bpToPercentString(x.rateBp),
                base: formatCents(x.baseCents),
              })}
              value={formatCents(x.taxCents)}
              muted
            />
          ))}
          <Row label={t('quote.totals.gross')} value={formatCents(calc.grossCents)} strong />
        </>
      ) : (
        <>
          {calc.discountCents > 0 ? (
            <Row
              label={t('quote.totals.discountIncl')}
              value={`−${formatCents(calc.discountCents)}`}
              muted
            />
          ) : null}
          <Row label={t('quote.totals.gross')} value={formatCents(calc.grossCents)} strong />
          {calc.taxes.map((x) => (
            <Row
              key={x.rateBp}
              label={t('quote.totals.taxIncl', { rate: bpToPercentString(x.rateBp) })}
              value={formatCents(x.taxCents)}
              muted
            />
          ))}
        </>
      )}
      {calc.depositCents != null ? (
        <Row label={t('quote.totals.deposit')} value={formatCents(calc.depositCents)} muted />
      ) : null}
      {guests && calc.perGuestCents != null ? (
        <Text variant="small" color="textSecondary">
          {t('quote.totals.perGuest', { value: formatCents(calc.perGuestCents) })}
        </Text>
      ) : null}
    </View>
  );
}
