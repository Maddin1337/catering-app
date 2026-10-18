import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { RadioList } from '@/components/ui/radio-list';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';
import { surfaceStyle } from '@/components/ui/surface';
import { SwitchRow } from '@/components/ui/switch';
import { tokens } from '@/theme/tokens';

import type { TaxRate } from '../../company/types';
import type { EditorItem } from '../types';

function parseQty(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Number(v);
}

/** SC-33 Position bearbeiten: Bezeichnung, Menge, Preis, Steuersatz, Rabatt, Wahlgruppe. */
export function ItemForm({
  item,
  rates,
  suggestion,
  entryLabel,
  onSave,
  onCancel,
  onRemove,
}: {
  item: EditorItem;
  rates: TaxRate[];
  /** Preisvorschlag aus dem Wareneinsatz in Cent (nur bei Katalogpositionen mit vollständigen Kosten). */
  suggestion: number | null;
  entryLabel: string;
  onSave: (i: EditorItem) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [qty, setQty] = useState(String(item.quantity).replace('.', ','));
  const [perGuest, setPerGuest] = useState(item.quantity_mode === 'per_guest');
  const [unit, setUnit] = useState(item.unit_label);
  const [hours, setHours] = useState(item.hours ? String(item.hours).replace('.', ',') : '');
  const [price, setPrice] = useState(
    item.unit_price_cents != null ? centsToEuroInput(item.unit_price_cents) : '',
  );
  const [taxId, setTaxId] = useState(item.tax_rate_id ?? '');
  const [discount, setDiscount] = useState(
    item.discount_bp ? bpToPercentString(item.discount_bp) : '',
  );
  const [group, setGroup] = useState(item.choice_group);
  const [selected, setSelected] = useState(item.is_selected);
  const [custQty, setCustQty] = useState(item.customer_can_edit_quantity);
  const [manual, setManual] = useState(item.price_is_manual);
  const [tried, setTried] = useState(false);

  const heading = item.is_heading;
  const qtyN = parseQty(qty);
  const hoursN =
    item.type === 'service'
      ? (() => {
          const h = parseQty(hours);
          return h !== null && h > 0 && (h * 4) % 1 === 0 ? h : null;
        })()
      : null;
  const priceN = price.trim() === '' ? null : parseEuroToCents(price);
  const discountBp = discount.trim() === '' ? 0 : parsePercentToBp(discount, 0, 100);
  const errors = {
    name: name.trim() === '' ? t('quote.item.errors.name') : undefined,
    qty: !heading && !perGuest && qtyN === null ? t('quote.item.errors.qty') : undefined,
    hours: item.type === 'service' && hoursN === null ? t('quote.item.errors.hours') : undefined,
    price: !heading && priceN === null ? t('quote.item.errors.price') : undefined,
    discount: discountBp === null ? t('quote.item.errors.discount') : undefined,
  };
  const bad = Object.values(errors).some(Boolean);

  const submit = () => {
    setTried(true);
    if (bad) return;
    onSave({
      ...item,
      name: name.trim(),
      description,
      unit_label: unit,
      quantity_mode: perGuest ? 'per_guest' : 'fixed',
      quantity: perGuest ? item.quantity : (qtyN ?? 1),
      hours: item.type === 'service' ? hoursN : null,
      unit_price_cents: heading ? null : priceN,
      price_is_manual: manual,
      discount_bp: discountBp ?? 0,
      tax_rate_id: heading ? null : taxId || null,
      choice_group: group,
      is_selected: selected,
      customer_can_edit_quantity: custQty,
    });
  };

  return (
    <View
      style={{
        gap: 16,
        padding: tokens.space[3],
        ...surfaceStyle(),
      }}
    >
      <TextField
        label={t('quote.item.name')}
        value={name}
        onChangeText={setName}
        error={tried ? errors.name : undefined}
        maxLength={200}
      />
      {!heading ? (
        <>
          <TextField
            label={t('quote.item.description')}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <SwitchRow label={t('quote.item.perGuest')} value={perGuest} onChange={setPerGuest} />
          {!perGuest ? (
            <TextField
              label={t('quote.item.qty')}
              value={qty}
              onChangeText={setQty}
              error={tried ? errors.qty : undefined}
              inputMode="decimal"
              keyboardType="decimal-pad"
            />
          ) : null}
          {item.type === 'service' ? (
            <TextField
              label={t('quote.item.hours')}
              helper={t('quote.item.hoursHint')}
              value={hours}
              onChangeText={setHours}
              error={tried ? errors.hours : undefined}
              inputMode="decimal"
              keyboardType="decimal-pad"
            />
          ) : null}
          <TextField label={t('quote.item.unit')} value={unit} onChangeText={setUnit} />
          <TextField
            label={t('quote.item.price', { basis: entryLabel })}
            value={price}
            onChangeText={(v) => {
              setPrice(v);
              setManual(true);
            }}
            error={tried ? errors.price : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          {manual && (item.type === 'dish' || item.type === 'package') ? (
            <Text variant="caption" color="textTertiary">
              {t('quote.item.manual')}
            </Text>
          ) : null}
          {suggestion !== null ? (
            <View style={{ gap: 8 }}>
              <Text variant="small" color="textSecondary">
                {t('quote.item.suggestion', { price: formatCents(suggestion) })}
              </Text>
              <Button
                label={t('catalog.dish.applySuggestion')}
                variant="secondary"
                onPress={() => {
                  setPrice(centsToEuroInput(suggestion));
                  setManual(false);
                }}
              />
            </View>
          ) : null}
          <RadioList
            label={t('quote.item.tax')}
            value={taxId}
            onChange={setTaxId}
            options={[
              { value: '', label: t('quote.item.noTax') },
              ...rates.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <TextField
            label={t('quote.item.discount')}
            value={discount}
            onChangeText={setDiscount}
            error={tried ? errors.discount : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('quote.item.group')}
            helper={t('quote.item.groupHint')}
            value={group}
            onChangeText={setGroup}
          />
          {group.trim() ? (
            <SwitchRow label={t('quote.item.selected')} value={selected} onChange={setSelected} />
          ) : null}
          <SwitchRow label={t('quote.item.customerQty')} value={custQty} onChange={setCustQty} />
        </>
      ) : null}
      <Button label={t('common.save')} onPress={submit} />
      <Button label={t('quote.item.remove')} variant="danger" onPress={onRemove} />
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
