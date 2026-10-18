import { calculate, type CalcResult } from '@/lib/calc';
import { newId } from '@/lib/uuid';

import type { TaxRate } from '../company/types';
import type { ItemTemplate } from '../settings/types';
import type { EditorItem, ItemType, QuoteHeader, StoredItem } from './types';

/** Steuerkategorie je Positionstyp (docs/02 §3.5); die Position darf einen anderen Satz wählen. */
export function taxCategoryFor(type: ItemType): TaxRate['category'] {
  switch (type) {
    case 'package':
    case 'dish':
      return 'food';
    case 'beverage':
      return 'beverage';
    case 'service':
      return 'service';
    case 'equipment':
      return 'equipment';
    case 'travel':
      return 'travel';
    default:
      return 'other';
  }
}

export function defaultTaxRateId(type: ItemType, rates: TaxRate[]): string | null {
  const cat = taxCategoryFor(type);
  return rates.find((r) => r.category === cat)?.id ?? null;
}

const UNIT: Record<ItemType, string> = {
  package: 'Person',
  dish: 'Portion',
  service: 'Person',
  beverage: 'Person',
  equipment: 'Stück',
  travel: 'pauschal',
  custom: 'Stück',
};

export function blankItem(
  type: ItemType,
  rates: TaxRate[],
  opts: { heading?: boolean } = {},
): EditorItem {
  const perGuest = type === 'package' || type === 'beverage';
  return {
    key: newId(),
    type: opts.heading ? 'custom' : type,
    menu_package_id: null,
    dish_id: null,
    name: '',
    description: '',
    unit_label: UNIT[type],
    quantity_mode: perGuest ? 'per_guest' : 'fixed',
    quantity: 1,
    hours: type === 'service' ? 4 : null,
    unit_price_cents: opts.heading ? null : 0,
    price_is_manual: false,
    markup_bp: null,
    unit_cost: null,
    discount_bp: 0,
    tax_rate_id: opts.heading ? null : defaultTaxRateId(type, rates),
    choice_group: '',
    is_selected: true,
    customer_can_edit_quantity: false,
    is_heading: !!opts.heading,
  };
}

/** Position aus einer Firmenvorlage (Servicekraft, Anfahrt, Getränkepauschale …). */
export function itemFromTemplate(tpl: ItemTemplate, rates: TaxRate[]): EditorItem {
  const base = blankItem(tpl.type, rates);
  return {
    ...base,
    name: tpl.name,
    unit_label: tpl.unit_label || base.unit_label,
    unit_price_cents: tpl.unit_price_cents,
    quantity_mode: tpl.quantity_mode,
    hours: tpl.type === 'service' ? (tpl.hours ?? base.hours) : null,
  };
}

export function itemFromStored(s: StoredItem): EditorItem {
  return {
    key: s.id,
    type: s.type,
    menu_package_id: s.menu_package_id,
    dish_id: s.dish_id,
    name: s.name,
    description: s.description ?? '',
    unit_label: s.unit_label,
    quantity_mode: s.quantity_mode,
    quantity: Number(s.quantity),
    hours: s.hours === null ? null : Number(s.hours),
    unit_price_cents: s.unit_price_cents,
    price_is_manual: s.price_is_manual,
    markup_bp: s.markup_bp,
    unit_cost: s.unit_cost === null ? null : Number(s.unit_cost),
    discount_bp: s.discount_bp,
    tax_rate_id: s.tax_rate_id,
    choice_group: s.choice_group ?? '',
    is_selected: s.is_selected,
    customer_can_edit_quantity: s.customer_can_edit_quantity,
    is_heading: s.is_heading,
  };
}

/** Wirksame Menge: bei „pro Person“ folgt sie der Gästezahl des Auftrags. */
export function effectiveQuantity(item: EditorItem, guests: number | null): number {
  return item.quantity_mode === 'per_guest' ? (guests ?? 0) : item.quantity;
}

export type QuoteSettings = {
  entryMode: 'net' | 'gross';
  display: 'net' | 'gross';
  discountBp: number;
  discountCents: number;
  depositBp: number | null;
  depositCents: number | null;
};

export function runCalc(
  items: EditorItem[],
  rates: TaxRate[],
  guests: number | null,
  s: QuoteSettings,
): CalcResult {
  const rateBp = new Map(rates.map((r) => [r.id, r.rate_bp]));
  return calculate({
    entryMode: s.entryMode,
    displayMode: s.display,
    discountBp: s.discountBp,
    discountCents: s.discountCents,
    depositBp: s.depositBp,
    depositCents: s.depositCents,
    guestCount: guests,
    items: items.map((i) => ({
      id: i.key,
      isHeading: i.is_heading,
      isSelected: i.is_selected,
      quantityHundredths: Math.round(effectiveQuantity(i, guests) * 100),
      hoursQuarters: i.type === 'service' && i.hours ? Math.round(i.hours * 4) : null,
      unitPriceCents: i.is_heading ? null : (i.unit_price_cents ?? 0),
      taxRateBp: rateBp.get(i.tax_rate_id ?? '') ?? 0,
      discountBp: i.discount_bp,
    })),
  });
}

/** Wareneinsatz gesamt in Cent (nur Positionen mit bekanntem Wareneinsatz); `incomplete`, wenn bei Katalogpositionen er fehlt. */
export function costTotal(
  items: EditorItem[],
  guests: number | null,
): { cents: number | null; incomplete: boolean } {
  let sum = 0;
  let known = false;
  let incomplete = false;
  for (const i of items) {
    if (i.is_heading || !i.is_selected) continue;
    if (i.unit_cost !== null) {
      sum += effectiveQuantity(i, guests) * i.unit_cost;
      known = true;
    } else if (i.type === 'dish' || i.type === 'package') {
      incomplete = true;
    }
  }
  return { cents: known ? Math.round(sum) : null, incomplete };
}

export type Warning =
  | 'no_items'
  | 'no_guests'
  | 'missing_tax'
  | 'cost_incomplete'
  | 'discount_exceeds'
  | 'choice_group_empty';

export function quoteWarnings(
  items: EditorItem[],
  guests: number | null,
  calc: CalcResult,
  incomplete: boolean,
  rates?: TaxRate[],
): Warning[] {
  const w: Warning[] = [];
  const priced = items.filter((i) => !i.is_heading);
  if (priced.length === 0) w.push('no_items');
  if (!guests && priced.some((i) => i.quantity_mode === 'per_guest')) w.push('no_guests');
  // fehlender oder inzwischen archivierter Steuersatz (sonst würde er stillschweigend als 0 % gerechnet)
  const known = rates ? new Set(rates.map((r) => r.id)) : null;
  if (priced.some((i) => !i.tax_rate_id || (known && !known.has(i.tax_rate_id))))
    w.push('missing_tax');
  if (incomplete) w.push('cost_incomplete');
  if (calc.errors.includes('discount_exceeds_total')) w.push('discount_exceeds');
  // genau eine Alternative je Wahlgruppe gewählt
  const groups = new Map<string, number>();
  for (const i of priced)
    if (i.choice_group.trim())
      groups.set(
        i.choice_group.trim(),
        (groups.get(i.choice_group.trim()) ?? 0) + (i.is_selected ? 1 : 0),
      );
  if ([...groups.values()].some((n) => n !== 1)) w.push('choice_group_empty');
  return w;
}

/** Nutzlast für `save_quote`: Kopfdaten, Positionen mit berechneten Beträgen und Summen. */
export function buildSavePayload(args: {
  quoteId: string;
  header: Pick<
    QuoteHeader,
    | 'pricing_mode'
    | 'markup_bp'
    | 'price_display'
    | 'deposit_due_on'
    | 'customer_reference'
    | 'intro_text'
    | 'terms_text'
    | 'closing_text'
    | 'valid_until'
  >;
  settings: QuoteSettings;
  items: EditorItem[];
  guests: number | null;
  calc: CalcResult;
  cost: { cents: number | null; incomplete: boolean };
  editorSeconds: number;
}) {
  const line = new Map(args.calc.lines.map((l) => [l.id, l]));
  return {
    quote_id: args.quoteId,
    editor_seconds: args.editorSeconds,
    header: {
      ...args.header,
      discount_bp: args.settings.discountBp,
      discount_cents: args.settings.discountCents,
      deposit_bp: args.settings.depositBp,
      deposit_cents: args.settings.depositCents,
      totals: { net: args.calc.netCents, tax: args.calc.taxCents, gross: args.calc.grossCents },
      cost_total_cents: args.cost.cents,
      cost_incomplete: args.cost.incomplete,
    },
    items: args.items.map((i) => {
      const l = line.get(i.key);
      return {
        id: i.key,
        type: i.type,
        menu_package_id: i.menu_package_id,
        dish_id: i.dish_id,
        name: i.name.trim(),
        description: i.description.trim() || null,
        unit_label: i.unit_label.trim() || 'Stück',
        quantity_mode: i.quantity_mode,
        quantity: effectiveQuantity(i, args.guests),
        hours: i.type === 'service' ? i.hours : null,
        unit_price_cents: i.is_heading ? null : (i.unit_price_cents ?? 0),
        price_is_manual: i.price_is_manual,
        markup_bp: i.markup_bp,
        unit_cost: i.unit_cost,
        discount_bp: i.discount_bp,
        tax_rate_id: i.tax_rate_id,
        line_net_cents: l?.lineNetCents ?? null,
        line_tax_cents: l?.lineTaxCents ?? null,
        line_gross_cents: l?.lineGrossCents ?? null,
        choice_group: i.choice_group.trim() || null,
        is_selected: i.is_selected,
        customer_can_edit_quantity: i.customer_can_edit_quantity,
        is_heading: i.is_heading,
      };
    }),
  };
}
