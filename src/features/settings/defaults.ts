import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import type { CompanySettings, PricingMode } from './types';

/** Formularstand „Fristen & Standardwerte“ (SC-62): Zahlen als Text, damit halbe Eingaben möglich sind. */
export type DefaultsForm = {
  cancelHours: string;
  leadHours: string;
  leadHoursLunch: string;
  validityDays: string;
  markupPercent: string;
  bufferPercent: string;
  pricingMode: PricingMode;
  rounding: number;
};

export type DefaultsErrors = Partial<Record<keyof DefaultsForm, string>>;

export type DefaultsUpdate = Pick<
  CompanySettings,
  | 'shift_cancel_deadline_hours'
  | 'portal_change_lead_hours'
  | 'portal_change_lead_hours_business_lunch'
  | 'quote_validity_days'
  | 'default_markup_bp'
  | 'shopping_buffer_bp'
  | 'default_pricing_mode'
  | 'price_rounding_cents'
>;

export const ROUNDING_STEPS = [1, 10, 50, 100] as const;

export function toDefaultsForm(s: CompanySettings): DefaultsForm {
  return {
    cancelHours: String(s.shift_cancel_deadline_hours),
    leadHours: s.portal_change_lead_hours === null ? '' : String(s.portal_change_lead_hours),
    leadHoursLunch:
      s.portal_change_lead_hours_business_lunch === null
        ? ''
        : String(s.portal_change_lead_hours_business_lunch),
    validityDays: String(s.quote_validity_days),
    markupPercent: bpToPercentString(s.default_markup_bp),
    bufferPercent: bpToPercentString(s.shopping_buffer_bp),
    pricingMode: s.default_pricing_mode,
    rounding: s.price_rounding_cents,
  };
}

function wholeNumber(input: string, min: number, max: number): number | null {
  const v = input.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

/** Prüft das Formular gegen die Grenzen der Datenbank (docs/03 §3.1 `companies`). */
export function parseDefaults(
  f: DefaultsForm,
): { ok: true; value: DefaultsUpdate } | { ok: false; errors: DefaultsErrors } {
  const errors: DefaultsErrors = {};

  const cancel = wholeNumber(f.cancelHours, 0, 168);
  if (cancel === null) errors.cancelHours = 'settings.defaults.errors.cancelHours';

  // Leer = kein Änderungsschluss
  const lead = f.leadHours.trim() === '' ? null : wholeNumber(f.leadHours, 0, 720);
  if (f.leadHours.trim() !== '' && lead === null)
    errors.leadHours = 'settings.defaults.errors.leadHours';
  const lunch = f.leadHoursLunch.trim() === '' ? null : wholeNumber(f.leadHoursLunch, 0, 720);
  if (f.leadHoursLunch.trim() !== '' && lunch === null) {
    errors.leadHoursLunch = 'settings.defaults.errors.leadHours';
  }

  const validity = wholeNumber(f.validityDays, 1, 365);
  if (validity === null) errors.validityDays = 'settings.defaults.errors.validityDays';

  const markup = parsePercentToBp(f.markupPercent, 0, 1000);
  if (markup === null) errors.markupPercent = 'settings.defaults.errors.markup';
  const buffer = parsePercentToBp(f.bufferPercent, 0, 50);
  if (buffer === null) errors.bufferPercent = 'settings.defaults.errors.buffer';

  if (!ROUNDING_STEPS.includes(f.rounding as (typeof ROUNDING_STEPS)[number])) {
    errors.rounding = 'settings.defaults.errors.rounding';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      shift_cancel_deadline_hours: cancel!,
      portal_change_lead_hours: lead,
      portal_change_lead_hours_business_lunch: lunch,
      quote_validity_days: validity!,
      default_markup_bp: markup!,
      shopping_buffer_bp: buffer!,
      default_pricing_mode: f.pricingMode,
      price_rounding_cents: f.rounding,
    },
  };
}
