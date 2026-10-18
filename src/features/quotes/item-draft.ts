import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import type { TaxRate } from '../company/types';
import type { EditorItem } from './types';

// Eingabestand einer Position im Blatt „Position bearbeiten“ bzw. im letzten Schritt von
// „Position hinzufügen“. Alles als Text, wie getippt; `buildItem` prüft und rechnet um.

export type ItemDraft = {
  name: string;
  description: string;
  qty: string;
  perGuest: boolean;
  unit: string;
  hours: string;
  price: string;
  taxId: string;
  discount: string;
  group: string;
  selected: boolean;
  custQty: boolean;
  manual: boolean;
};

export type DraftErrors = Partial<Record<'name' | 'qty' | 'hours' | 'price' | 'discount', true>>;

const decimal = (n: number) => String(n).replace('.', ',');

export function parseQty(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

/** Stunden in Viertelstunden (6,5 ja, 6,3 nein). */
export function parseHours(input: string): number | null {
  const h = parseQty(input);
  return h !== null && (h * 4) % 1 === 0 ? h : null;
}

export function draftFrom(item: EditorItem): ItemDraft {
  return {
    name: item.name,
    description: item.description,
    qty: decimal(item.quantity),
    perGuest: item.quantity_mode === 'per_guest',
    unit: item.unit_label,
    hours: item.hours ? decimal(item.hours) : '',
    price: item.unit_price_cents != null ? centsToEuroInput(item.unit_price_cents) : '',
    taxId: item.tax_rate_id ?? '',
    discount: item.discount_bp ? bpToPercentString(item.discount_bp) : '',
    group: item.choice_group,
    selected: item.is_selected,
    custQty: item.customer_can_edit_quantity,
    manual: item.price_is_manual,
  };
}

export function draftErrors(item: EditorItem, d: ItemDraft): DraftErrors {
  const e: DraftErrors = {};
  if (d.name.trim() === '') e.name = true;
  if (item.is_heading) return e;
  if (!d.perGuest && parseQty(d.qty) === null) e.qty = true;
  if (item.type === 'service' && parseHours(d.hours) === null) e.hours = true;
  if (d.price.trim() === '' || parseEuroToCents(d.price) === null) e.price = true;
  if (d.discount.trim() !== '' && parsePercentToBp(d.discount, 0, 100) === null) e.discount = true;
  return e;
}

/** Fertige Position aus dem Entwurf; `null`, solange etwas nicht stimmt. */
export function buildItem(item: EditorItem, d: ItemDraft): EditorItem | null {
  if (Object.keys(draftErrors(item, d)).length > 0) return null;
  const heading = item.is_heading;
  return {
    ...item,
    name: d.name.trim(),
    description: heading ? '' : d.description,
    unit_label: d.unit,
    quantity_mode: !heading && d.perGuest ? 'per_guest' : 'fixed',
    quantity: heading ? 1 : d.perGuest ? item.quantity : (parseQty(d.qty) ?? 1),
    hours: item.type === 'service' ? parseHours(d.hours) : null,
    unit_price_cents: heading ? null : parseEuroToCents(d.price),
    price_is_manual: d.manual,
    discount_bp: d.discount.trim() === '' ? 0 : (parsePercentToBp(d.discount, 0, 100) ?? 0),
    tax_rate_id: heading ? null : d.taxId || null,
    choice_group: d.group,
    is_selected: d.group.trim() ? d.selected : true,
    customer_can_edit_quantity: d.custQty,
  };
}

/**
 * Kurze Rechnung unter dem Preis, damit man sieht, was die Eingabe ergibt:
 * „80 × 12,50 € = 1.000,00 €“ (Rabatt der Position eingerechnet). `null` bei unvollständiger Eingabe.
 */
export function linePreview(item: EditorItem, d: ItemDraft, guests: number | null): string | null {
  if (item.is_heading) return null;
  const qty = d.perGuest ? guests : parseQty(d.qty);
  const price = parseEuroToCents(d.price);
  if (!qty || price === null) return null;
  const hours = item.type === 'service' ? parseHours(d.hours) : 1;
  if (!hours) return null;
  const discount = d.discount.trim() === '' ? 0 : (parsePercentToBp(d.discount, 0, 100) ?? 0);
  const total = Math.round(qty * hours * price * (1 - discount / 10000));
  const parts = [decimal(qty), formatCents(price)];
  if (item.type === 'service') parts.splice(1, 0, `${decimal(hours)} h`);
  return `${parts.join(' × ')} = ${formatCents(total)}`;
}

/** Was unter „Weitere Optionen“ vom Üblichen abweicht – als Hinweis an der zugeklappten Zeile. */
export function advancedSummary(
  d: ItemDraft,
  rates: TaxRate[],
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];
  const rate = rates.find((r) => r.id === d.taxId);
  parts.push(rate ? rate.name : t('quote.noTax'));
  if (d.discount.trim()) parts.push(t('quote.item.discountShort', { value: d.discount.trim() }));
  if (d.group.trim()) parts.push(t('quote.item.groupShort', { name: d.group.trim() }));
  if (d.custQty) parts.push(t('quote.item.customerQtyShort'));
  return parts.join(' · ');
}
