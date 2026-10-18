import { unitPriceOnCalcSide, type CalcResult } from '@/lib/calc';
import type { Allergen, Diet } from '@/lib/dietary';

import type { Dish, MenuPackage, PackageDishLine } from '../catalog/types';
import type { TaxRate } from '../company/types';
import { effectiveQuantity } from './model';
import type { EditorItem, QuoteHeader } from './types';

// Eingefrorener Stand einer Revision (docs/03 §3.3, schema_version 1). Enthält keine Kalkulationsdaten
// (Wareneinsatz, Aufschlag) und ist damit für PDF und Portal geeignet.

export type SnapshotItem = {
  id: string;
  type: EditorItem['type'];
  sort_order: number;
  name: string;
  description: string | null;
  menu_package_id: string | null;
  dish_id: string | null;
  quantity: number;
  quantity_mode: 'fixed' | 'per_guest';
  unit_label: string;
  hours: number | null;
  unit_price_cents: number | null;
  unit_price_display_cents: number | null;
  price_is_manual: boolean;
  discount_bp: number;
  tax_rate_id: string | null;
  tax_rate_bp: number;
  line_net_cents: number | null;
  line_tax_cents: number | null;
  line_gross_cents: number | null;
  choice_group: string | null;
  is_selected: boolean;
  is_heading: boolean;
  customer_can_edit_quantity: boolean;
  allergens: Allergen[];
  diets: Diet[];
  package_dishes: { name: string; portion_factor: number; allergens: Allergen[]; diets: Diet[] }[];
};

export type QuoteSnapshot = {
  schema_version: 1;
  revision: number;
  frozen_at: string;
  company: {
    name: string;
    logo_path?: string | null;
    accent_color: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    phone: string | null;
    contact_email: string;
    vat_id: string | null;
    footer_text: string | null;
  };
  customer: {
    type: 'business' | 'private';
    name: string;
    contact_person: string | null;
    email: string | null;
    billing_address: string | null;
  };
  event: {
    title: string;
    kind: string;
    starts_at: string;
    ends_at: string | null;
    guest_count: number | null;
    venue: string | null;
    option_expires_at: string | null;
  };
  quote: {
    number: string;
    price_display: 'net' | 'gross';
    valid_until: string | null;
    customer_reference: string | null;
    intro_text: string | null;
    terms_text: string | null;
    closing_text: string | null;
    discount_bp: number;
    discount_cents: number;
    deposit: {
      bp: number | null;
      cents: number | null;
      due_on: string | null;
      amount_cents: number | null;
    };
  };
  items: SnapshotItem[];
  totals: {
    /** Summe der Positionen vor Rabatten auf der Anzeigeseite (netto oder brutto, je nach `price_display`). */
    sum_before_discount_cents: number;
    discount_cents: number;
    net_cents: number;
    tax: { rate_bp: number; base_cents: number; tax_cents: number }[];
    gross_cents: number;
    per_guest_cents: number | null;
  };
};

export type SnapshotCompany = QuoteSnapshot['company'];
export type SnapshotCustomer = QuoteSnapshot['customer'];
export type SnapshotEvent = QuoteSnapshot['event'];

export type CatalogLookup = {
  dishes: Dish[];
  packages: MenuPackage[];
  packageLines: PackageDishLine[];
};

function addressOf(c: {
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
}): string | null {
  const city = [c.billing_postal_code, c.billing_city].filter(Boolean).join(' ');
  const parts = [c.billing_street, city].filter((p): p is string => !!p && p.trim() !== '');
  return parts.length > 0 ? parts.join(', ') : null;
}

export function snapshotCustomer(c: {
  type: 'business' | 'private';
  name: string;
  contact_person: string | null;
  email: string | null;
  billing_street: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
}): SnapshotCustomer {
  return {
    type: c.type,
    name: c.name,
    contact_person: c.contact_person,
    email: c.email,
    billing_address: addressOf(c),
  };
}

/** Baut den Snapshot aus dem gespeicherten Entwurf; Beträge stammen aus dem Rechenmodul (`calc`). */
export function buildSnapshot(args: {
  revision: number;
  frozenAt: string;
  company: SnapshotCompany;
  customer: SnapshotCustomer;
  event: SnapshotEvent;
  header: QuoteHeader;
  items: EditorItem[];
  calc: CalcResult;
  rates: TaxRate[];
  catalog: CatalogLookup;
  guests: number | null;
  entryMode: 'net' | 'gross';
  display: 'net' | 'gross';
}): QuoteSnapshot {
  const line = new Map(args.calc.lines.map((l) => [l.id, l]));
  const rateBp = new Map(args.rates.map((r) => [r.id, r.rate_bp]));
  const dish = new Map(args.catalog.dishes.map((d) => [d.id, d]));
  const pkg = new Map(args.catalog.packages.map((p) => [p.id, p]));

  const items: SnapshotItem[] = args.items.map((i, idx) => {
    const l = line.get(i.key);
    const d = i.dish_id ? dish.get(i.dish_id) : undefined;
    const p = i.menu_package_id ? pkg.get(i.menu_package_id) : undefined;
    const dishes = i.menu_package_id
      ? args.catalog.packageLines
          .filter((x) => x.menu_package_id === i.menu_package_id)
          .flatMap((x) => {
            const dd = dish.get(x.dish_id);
            return dd
              ? [
                  {
                    name: dd.name,
                    portion_factor: x.portion_factor,
                    allergens: dd.allergens,
                    diets: dd.diets,
                  },
                ]
              : [];
          })
      : [];
    return {
      id: i.key,
      type: i.type,
      sort_order: idx,
      name: i.name.trim(),
      description: i.description.trim() || null,
      menu_package_id: i.menu_package_id,
      dish_id: i.dish_id,
      quantity: effectiveQuantity(i, args.guests),
      quantity_mode: i.quantity_mode,
      unit_label: i.unit_label.trim() || 'Stück',
      hours: i.type === 'service' ? i.hours : null,
      unit_price_cents: i.is_heading ? null : (i.unit_price_cents ?? 0),
      // nicht gewählte Alternativen stehen nicht in der Rechnung, der Kunde braucht ihren Preis trotzdem
      unit_price_display_cents: l
        ? l.unitPriceDisplayCents
        : i.is_heading
          ? null
          : unitPriceOnCalcSide(
              i.unit_price_cents ?? 0,
              rateBp.get(i.tax_rate_id ?? '') ?? 0,
              args.entryMode,
              args.display,
            ),
      price_is_manual: i.price_is_manual,
      discount_bp: i.discount_bp,
      tax_rate_id: i.tax_rate_id,
      tax_rate_bp: rateBp.get(i.tax_rate_id ?? '') ?? 0,
      line_net_cents: l?.lineNetCents ?? null,
      line_tax_cents: l?.lineTaxCents ?? null,
      line_gross_cents: l?.lineGrossCents ?? null,
      choice_group: i.choice_group.trim() || null,
      is_selected: i.is_selected,
      is_heading: i.is_heading,
      customer_can_edit_quantity: i.customer_can_edit_quantity,
      allergens: d?.allergens ?? p?.allergens ?? [],
      diets: d?.diets ?? p?.diets ?? [],
      package_dishes: dishes,
    };
  });

  const h = args.header;
  return {
    schema_version: 1,
    revision: args.revision,
    frozen_at: args.frozenAt,
    company: args.company,
    customer: args.customer,
    event: args.event,
    quote: {
      number: h.number,
      price_display: args.display,
      valid_until: h.valid_until,
      customer_reference: h.customer_reference,
      intro_text: h.intro_text,
      terms_text: h.terms_text,
      closing_text: h.closing_text,
      discount_bp: h.discount_bp,
      discount_cents: h.discount_cents,
      deposit: {
        bp: h.deposit_bp,
        cents: h.deposit_cents,
        due_on: h.deposit_due_on,
        amount_cents: args.calc.depositCents,
      },
    },
    items,
    totals: {
      sum_before_discount_cents: args.calc.sumBeforeDiscountCents,
      discount_cents: args.calc.discountCents,
      net_cents: args.calc.netCents,
      tax: args.calc.taxes.map((t) => ({
        rate_bp: t.rateBp,
        base_cents: t.baseCents,
        tax_cents: t.taxCents,
      })),
      gross_cents: args.calc.grossCents,
      per_guest_cents: args.calc.perGuestCents,
    },
  };
}
