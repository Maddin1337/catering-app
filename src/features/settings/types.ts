export type PricingMode = 'flat' | 'cost_based';

/** Firmendaten und Standardwerte für die Einstellungen (nur admin liest die Basistabelle `companies`). */
export type CompanySettings = {
  name: string;
  logo_path: string | null;
  phone: string | null;
  contact_email: string;
  website: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  vat_id: string | null;
  tax_number: string | null;
  footer_text: string | null;
  privacy_policy_url: string | null;
  imprint_url: string | null;
  accent_color: string | null;
  price_entry_mode: 'net' | 'gross';
  default_pricing_mode: PricingMode;
  default_markup_bp: number;
  price_rounding_cents: number;
  quote_validity_days: number;
  portal_change_lead_hours: number | null;
  portal_change_lead_hours_business_lunch: number | null;
  shift_cancel_deadline_hours: number;
  shopping_buffer_bp: number;
  quote_intro_text: string | null;
  quote_terms_text: string | null;
  quote_closing_text: string | null;
  quote_item_templates: ItemTemplate[];
};

/** Positionsvorlage für Zusatzpositionen (companies.quote_item_templates). */
export type ItemTemplate = {
  type: 'service' | 'equipment' | 'travel' | 'beverage' | 'custom';
  name: string;
  unit_label: string;
  unit_price_cents: number;
  quantity_mode: 'fixed' | 'per_guest';
  hours: number | null;
};

export type TaxCategory = 'food' | 'beverage' | 'service' | 'equipment' | 'travel' | 'other';

export const TAX_CATEGORIES: TaxCategory[] = [
  'food',
  'beverage',
  'service',
  'equipment',
  'travel',
  'other',
];

export type TaxRateRow = {
  id: string;
  name: string;
  rate_bp: number;
  category: TaxCategory;
  is_default: boolean;
  reviewed_at: string | null;
};

export type QualificationRow = { id: string; name: string; memberCount: number };
