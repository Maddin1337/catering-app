export type ItemType =
  'package' | 'dish' | 'service' | 'equipment' | 'travel' | 'beverage' | 'custom';
export const ITEM_TYPES: ItemType[] = [
  'package',
  'dish',
  'service',
  'beverage',
  'equipment',
  'travel',
  'custom',
];

export type QuoteHeader = {
  id: string;
  event_id: string;
  number: string;
  status: string;
  revision: number;
  pricing_mode: 'flat' | 'cost_based';
  markup_bp: number;
  price_display: 'net' | 'gross';
  discount_bp: number;
  discount_cents: number;
  deposit_bp: number | null;
  deposit_cents: number | null;
  deposit_due_on: string | null;
  customer_reference: string | null;
  intro_text: string | null;
  terms_text: string | null;
  closing_text: string | null;
  valid_until: string | null;
  total_net_cents: number;
  total_tax_cents: number;
  total_gross_cents: number;
  cost_total_cents: number | null;
  cost_incomplete: boolean;
  has_unsent_changes: boolean;
};

/** Position im Editor. Mengen und Preise bleiben als Zahlen, Eingaben prüft das Formular. */
export type EditorItem = {
  key: string;
  type: ItemType;
  menu_package_id: string | null;
  dish_id: string | null;
  name: string;
  description: string;
  unit_label: string;
  quantity_mode: 'fixed' | 'per_guest';
  quantity: number;
  hours: number | null;
  unit_price_cents: number | null;
  price_is_manual: boolean;
  markup_bp: number | null;
  /** Wareneinsatz je Einheit in Cent mit Nachkommastellen (nur admin). */
  unit_cost: number | null;
  discount_bp: number;
  tax_rate_id: string | null;
  choice_group: string;
  is_selected: boolean;
  customer_can_edit_quantity: boolean;
  is_heading: boolean;
};

export type StoredItem = Omit<EditorItem, 'key' | 'description' | 'choice_group'> & {
  id: string;
  sort_order: number;
  description: string | null;
  choice_group: string | null;
  quantity: number | string;
  hours: number | string | null;
  unit_cost: number | string | null;
};
