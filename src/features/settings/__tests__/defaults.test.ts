import { parseDefaults, toDefaultsForm } from '../defaults';
import type { CompanySettings } from '../types';

const settings: CompanySettings = {
  name: 'X',
  phone: null,
  contact_email: 'a@b.de',
  website: null,
  street: null,
  postal_code: null,
  city: null,
  vat_id: null,
  tax_number: null,
  footer_text: null,
  privacy_policy_url: null,
  imprint_url: null,
  accent_color: null,
  price_entry_mode: 'net',
  default_pricing_mode: 'flat',
  default_markup_bp: 20000,
  price_rounding_cents: 10,
  quote_validity_days: 14,
  portal_change_lead_hours: 72,
  portal_change_lead_hours_business_lunch: 24,
  shift_cancel_deadline_hours: 48,
  shopping_buffer_bp: 500,
  quote_intro_text: null,
  quote_terms_text: null,
  quote_closing_text: null,
  quote_item_templates: [],
};

describe('Fristen & Standardwerte', () => {
  it('übernimmt die Standardwerte und gibt sie unverändert zurück', () => {
    const form = toDefaultsForm(settings);
    expect(form.markupPercent).toBe('200');
    expect(form.bufferPercent).toBe('5');
    const r = parseDefaults(form);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.default_markup_bp).toBe(20000);
      expect(r.value.shopping_buffer_bp).toBe(500);
      expect(r.value.shift_cancel_deadline_hours).toBe(48);
      expect(r.value.price_rounding_cents).toBe(10);
    }
  });

  it('erlaubt leere Änderungsschlüsse (kein Schluss)', () => {
    const r = parseDefaults({ ...toDefaultsForm(settings), leadHours: '', leadHoursLunch: ' ' });
    expect(r.ok && r.value.portal_change_lead_hours).toBeNull();
    expect(r.ok && r.value.portal_change_lead_hours_business_lunch).toBeNull();
  });

  it('meldet Werte außerhalb der Grenzen je Feld', () => {
    const r = parseDefaults({
      ...toDefaultsForm(settings),
      cancelHours: '169',
      leadHours: '721',
      validityDays: '0',
      bufferPercent: '51',
      markupPercent: 'viel',
      rounding: 5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        [
          'bufferPercent',
          'cancelHours',
          'leadHours',
          'markupPercent',
          'rounding',
          'validityDays',
        ].sort(),
      );
    }
  });
});
