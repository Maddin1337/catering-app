import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, formatGermanDate, todayBerlin, weekday } from '@/lib/berlin';
import { monthGrid, shiftMonth } from '@/lib/month-grid';
import { tokens } from '@/theme/tokens';

import { Button } from './button';
import { IconButton } from './icon-button';
import { PickCard } from './pick-card';
import { PickerSheet } from './picker-sheet';
import { Text } from './text';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LONG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „Fr., 23.10.2026“ für die Anzeige im Feld. */
function display(iso: string): string {
  return `${LONG[weekday(iso)]}., ${formatGermanDate(iso)}`;
}

/**
 * Datum per Antippen wählen: ein Kalenderblatt statt Tastatur. Auf dem Handy fehlt im Zahlenblock der
 * Punkt, und Texteingaben („23.10.2026“) sind fehleranfällig. Wert ist „YYYY-MM-DD“ oder leer.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  optional,
  startMonthFrom,
  variant = 'field',
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  /** Erlaubt „Löschen“ (leeres Datum). */
  optional?: boolean;
  /** Monat, der ohne Wert zuerst gezeigt wird (z. B. Datum des Auftrags); sonst heute. */
  startMonthFrom?: string;
  /** `card`: große Karte mit Symbol (Anfrage-Chat) statt des schlichten Felds. */
  variant?: 'field' | 'card';
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const today = todayBerlin();
  const anchor = value || startMonthFrom || today;
  const [ym, setYm] = useState({
    year: Number(anchor.slice(0, 4)),
    month: Number(anchor.slice(5, 7)),
  });

  const openSheet = () => {
    const a = value || startMonthFrom || today;
    setYm({ year: Number(a.slice(0, 4)), month: Number(a.slice(5, 7)) });
    setOpen(true);
  };
  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };
  const monthName = new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleString('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <View style={{ gap: tokens.space[1] }}>
      {variant === 'card' ? (
        <PickCard
          icon={CalendarDays}
          tint="sky"
          label={label}
          value={value ? display(value) : undefined}
          placeholder={t('picker.chooseDate')}
          error={error}
          onPress={openSheet}
        />
      ) : (
        <>
          <Text variant="small" color="textSecondary">
            {label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ? display(value) : t('picker.choose')}`}
            onPress={openSheet}
            style={[
              styles.field,
              { borderColor: error ? tokens.color.danger : tokens.color.borderInput },
            ]}
          >
            <Text variant="body" color={value ? 'text' : 'textTertiary'}>
              {value ? display(value) : t('picker.chooseDate')}
            </Text>
          </Pressable>
          {error ? (
            <Text variant="small" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </>
      )}

      {open ? (
        <PickerSheet title={label} onClose={() => setOpen(false)}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <IconButton
              icon={ChevronLeft}
              label={t('calendar.prev')}
              onPress={() => setYm((c) => shiftMonth(c.year, c.month, -1))}
            />
            <Text variant="bodyStrong">{monthName}</Text>
            <IconButton
              icon={ChevronRight}
              label={t('calendar.next')}
              onPress={() => setYm((c) => shiftMonth(c.year, c.month, 1))}
            />
          </View>
          <View>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d) => (
                <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Text variant="caption" color="textTertiary">
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            {monthGrid(ym.year, ym.month).map((week) => (
              <View key={week[0]!.date} style={{ flexDirection: 'row' }}>
                {week.map((d) => {
                  const selected = d.date === value;
                  return (
                    <Pressable
                      key={d.date}
                      accessibilityRole="button"
                      accessibilityLabel={display(d.date)}
                      accessibilityState={{ selected }}
                      onPress={() => pick(d.date)}
                      style={[
                        styles.day,
                        selected && { backgroundColor: tokens.color.accent },
                        d.date === today &&
                          !selected && { borderWidth: 1, borderColor: tokens.color.accent },
                      ]}
                    >
                      <Text
                        variant="body"
                        color={selected ? 'onAccent' : d.inMonth ? 'text' : 'textTertiary'}
                      >
                        {Number(d.date.slice(8))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] }}>
            <Button label={t('picker.today')} variant="secondary" onPress={() => pick(today)} />
            <Button
              label={t('picker.tomorrow')}
              variant="secondary"
              onPress={() => pick(addDays(today, 1))}
            />
            {optional && value ? (
              <Button label={t('picker.clear')} variant="ghost" onPress={() => pick('')} />
            ) : null}
          </View>
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
        </PickerSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: tokens.touch.min,
    justifyContent: 'center',
    paddingHorizontal: tokens.space[4],
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.bg,
  },
  day: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
  },
});
