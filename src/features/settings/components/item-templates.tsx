import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents, parseQuantityToHundredths } from '@/lib/money-input';
import { tokens } from '@/theme/tokens';

import type { ItemTemplate } from '../types';

const TYPES: ItemTemplate['type'][] = ['service', 'beverage', 'equipment', 'travel', 'custom'];
const DEFAULT_UNIT: Record<ItemTemplate['type'], string> = {
  service: 'Person',
  beverage: 'Person',
  equipment: 'Stück',
  travel: 'pauschal',
  custom: 'Stück',
};

type Draft = {
  type: ItemTemplate['type'];
  name: string;
  unit: string;
  price: string;
  hours: string;
  perGuest: boolean;
};

function toDraft(tpl?: ItemTemplate): Draft {
  if (!tpl) {
    return {
      type: 'service',
      name: '',
      unit: DEFAULT_UNIT.service,
      price: '',
      hours: '4',
      perGuest: false,
    };
  }
  return {
    type: tpl.type,
    name: tpl.name,
    unit: tpl.unit_label,
    price: centsToEuroInput(tpl.unit_price_cents),
    hours: tpl.hours === null ? '' : String(tpl.hours).replace('.', ','),
    perGuest: tpl.quantity_mode === 'per_guest',
  };
}

/** Eingabe → Vorlage; `null` bei fehlender Bezeichnung oder ungültigem Preis. */
export function templateFromDraft(d: Draft): ItemTemplate | null {
  const price = parseEuroToCents(d.price);
  const name = d.name.trim();
  if (!name || price === null) return null;
  let hours: number | null = null;
  if (d.type === 'service') {
    const h = parseQuantityToHundredths(d.hours);
    if (h === null) return null;
    hours = h / 100;
  }
  return {
    type: d.type,
    name,
    unit_label: d.unit.trim() || DEFAULT_UNIT[d.type],
    unit_price_cents: price,
    quantity_mode: d.perGuest ? 'per_guest' : 'fixed',
    hours,
  };
}

/** Positionsvorlagen: Liste mit Formular zum Anlegen und Bearbeiten; die Änderung geht sofort an `onChange`. */
export function ItemTemplates({
  value,
  saving,
  onChange,
}: {
  value: ItemTemplate[];
  saving: boolean;
  onChange: (next: ItemTemplate[]) => void;
}) {
  const { t } = useTranslation();
  // `index === value.length` bedeutet: neue Vorlage
  const [editing, setEditing] = useState<{ index: number; draft: Draft } | null>(null);
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    if (!editing) return;
    const tpl = templateFromDraft(editing.draft);
    if (!tpl) {
      setInvalid(true);
      return;
    }
    const next = [...value];
    next[editing.index] = tpl;
    onChange(next);
    setEditing(null);
    setInvalid(false);
  };

  const set = (patch: Partial<Draft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <View style={{ gap: 12 }}>
      <Text variant="title2">{t('settings.quoteTexts.templatesTitle')}</Text>
      <Text variant="small" color="textSecondary">
        {t('settings.quoteTexts.templatesBody')}
      </Text>
      {value.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('settings.quoteTexts.templatesEmpty')}
        </Text>
      ) : (
        value.map((tpl, i) => (
          <ListRow
            key={`${tpl.name}-${i}`}
            title={tpl.name}
            subtitle={`${t(`quote.type.${tpl.type}`)} · ${formatCents(tpl.unit_price_cents)} / ${tpl.unit_label}`}
            onPress={() => {
              setInvalid(false);
              setEditing({ index: i, draft: toDraft(tpl) });
            }}
          />
        ))
      )}
      {editing ? (
        <View
          style={{
            gap: 12,
            padding: tokens.space[3],
            borderWidth: 1,
            borderColor: tokens.color.borderInput,
            borderRadius: tokens.radius.md,
          }}
        >
          <Text variant="title2">
            {editing.index === value.length
              ? t('settings.quoteTexts.templateAdd')
              : t('settings.quoteTexts.templateEdit')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map((x) => (
              <Chip
                key={x}
                label={t(`quote.type.${x}`)}
                selected={editing.draft.type === x}
                onPress={() =>
                  set({
                    type: x,
                    unit:
                      editing.draft.unit === DEFAULT_UNIT[editing.draft.type]
                        ? DEFAULT_UNIT[x]
                        : editing.draft.unit,
                    perGuest: x === 'beverage' ? true : editing.draft.perGuest,
                  })
                }
              />
            ))}
          </View>
          <TextField
            label={t('settings.quoteTexts.templateName')}
            value={editing.draft.name}
            onChangeText={(v) => set({ name: v })}
          />
          <TextField
            label={t('settings.quoteTexts.templatePrice')}
            value={editing.draft.price}
            onChangeText={(v) => set({ price: v })}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('settings.quoteTexts.templateUnit')}
            value={editing.draft.unit}
            onChangeText={(v) => set({ unit: v })}
          />
          {editing.draft.type === 'service' ? (
            <TextField
              label={t('settings.quoteTexts.templateHours')}
              value={editing.draft.hours}
              onChangeText={(v) => set({ hours: v })}
              keyboardType="decimal-pad"
            />
          ) : null}
          <Checkbox
            label={t('settings.quoteTexts.templatePerGuest')}
            checked={editing.draft.perGuest}
            onChange={(c) => set({ perGuest: c })}
          />
          {invalid ? (
            <Text variant="small" color="danger" accessibilityRole="alert">
              {t('settings.quoteTexts.templateInvalid')}
            </Text>
          ) : null}
          <Button label={t('common.save')} loading={saving} onPress={submit} />
          {editing.index < value.length ? (
            <Button
              label={t('settings.quoteTexts.templateDelete')}
              variant="secondary"
              onPress={() => {
                onChange(value.filter((_, i) => i !== editing.index));
                setEditing(null);
              }}
            />
          ) : null}
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(null)} />
        </View>
      ) : (
        <Button
          label={t('settings.quoteTexts.templateAdd')}
          variant="secondary"
          onPress={() => {
            setInvalid(false);
            setEditing({ index: value.length, draft: toDraft() });
          }}
        />
      )}
    </View>
  );
}
