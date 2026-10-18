import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '@/theme/tokens';

import { Button } from './button';
import { PickerSheet } from './picker-sheet';
import { Text } from './text';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

function Cell({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.cell,
        selected && { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
      ]}
    >
      <Text variant="body" color={selected ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Uhrzeit per Antippen wählen: Stunden und Minuten (5er-Schritte) als Raster. Der Wert ist „HH:mm“
 * oder leer. Kein Tastaturwechsel nötig, kein Doppelpunkt zu suchen.
 */
export function TimeField({
  label,
  value,
  onChange,
  error,
  optional,
  defaultHour = 12,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  error?: string;
  optional?: boolean;
  defaultHour?: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState(0);

  const openSheet = () => {
    if (value) {
      setHour(Number(value.slice(0, 2)));
      setMinute(Number(value.slice(3, 5)));
    } else {
      setHour(defaultHour);
      setMinute(0);
    }
    setOpen(true);
  };
  const preview = `${pad(hour)}:${pad(minute)}`;
  // Minuten außerhalb des 5er-Rasters (aus alten Daten) bleiben erhalten und werden angezeigt
  const minuteList = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => a - b);

  return (
    <View style={{ gap: tokens.space[1] }}>
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || t('picker.choose')}`}
        onPress={openSheet}
        style={[
          styles.field,
          { borderColor: error ? tokens.color.danger : tokens.color.borderInput },
        ]}
      >
        <Text variant="body" color={value ? 'text' : 'textTertiary'}>
          {value ? `${value} ${t('picker.oclock')}` : t('picker.chooseTime')}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="small" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {open ? (
        <PickerSheet title={`${label}: ${preview}`} onClose={() => setOpen(false)}>
          <Text variant="small" color="textSecondary">
            {t('picker.hour')}
          </Text>
          <View style={styles.grid}>
            {HOURS.map((h) => (
              <Cell key={h} label={pad(h)} selected={h === hour} onPress={() => setHour(h)} />
            ))}
          </View>
          <Text variant="small" color="textSecondary">
            {t('picker.minute')}
          </Text>
          <View style={styles.grid}>
            {minuteList.map((m) => (
              <Cell key={m} label={pad(m)} selected={m === minute} onPress={() => setMinute(m)} />
            ))}
          </View>
          <Button
            label={t('picker.apply', { time: preview })}
            onPress={() => {
              onChange(preview);
              setOpen(false);
            }}
          />
          {optional && value ? (
            <Button
              label={t('picker.clear')}
              variant="ghost"
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
            />
          ) : null}
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
    paddingHorizontal: tokens.space[3],
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.bg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  cell: {
    width: '14%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderInput,
    flexGrow: 1,
  },
});
