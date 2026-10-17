import { formatDate, formatDateTime, formatTime } from '@/lib/dates';

import { Text, type TextProps } from './ui/text';

const formatters = { date: formatDate, time: formatTime, dateTime: formatDateTime } as const;

/** Zeitpunkt (ISO-String, Millisekunden oder Date) in Europe/Berlin, unabhängig vom Gerät. */
export function DateTimeText({
  value,
  mode = 'dateTime',
  ...rest
}: {
  value: string | number | Date;
  mode?: keyof typeof formatters;
} & Omit<TextProps, 'children'>) {
  return <Text {...rest}>{formatters[mode](value)}</Text>;
}
