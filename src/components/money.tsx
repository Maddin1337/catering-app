import { formatCents } from '@/lib/money';

import { Text, type TextProps } from './ui/text';

/** Betrag in Cent als „1.234,56 €“ mit tabellarischen Ziffern. */
export function Money({
  cents,
  ...rest
}: { cents: number } & Omit<TextProps, 'children' | 'tabular'>) {
  return (
    <Text tabular {...rest}>
      {formatCents(cents)}
    </Text>
  );
}
