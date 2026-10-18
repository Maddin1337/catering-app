import type { Dish } from '../catalog/types';
import type { TaxRate } from '../company/types';
import { quoteWarnings } from './model';
import type { EditorItem } from './types';
import type { CalcResult } from '@/lib/calc';

export type Blocker =
  | 'status_closed'
  | 'no_items'
  | 'no_guests'
  | 'missing_tax'
  | 'discount_exceeds'
  | 'choice_group_empty'
  | 'no_email';
export type SendWarning = 'no_valid_until' | 'allergens_unreviewed' | 'tax_unreviewed';

const OPEN_STATUSES = ['inquiry', 'quoted', 'optioned', 'confirmed'];

/**
 * Prüfliste vor dem Versand (SC-34). Blockierend: alles, was ein unbrauchbares Angebot ergäbe; Hinweise
 * für ungeprüfte Allergene und Steuersätze, fehlende Gültigkeit. Die E-Mail-Adresse blockiert nur den
 * Versandweg „E-Mail“, nicht den Link.
 */
export function sendChecklist(args: {
  eventStatus: string;
  items: EditorItem[];
  guests: number | null;
  calc: CalcResult;
  customerEmail: string | null;
  validUntil: string | null;
  dishes: Dish[];
  rates: TaxRate[];
  via: 'email' | 'link';
}): { blockers: Blocker[]; warnings: SendWarning[] } {
  const blockers: Blocker[] = [];
  const warnings: SendWarning[] = [];
  if (!OPEN_STATUSES.includes(args.eventStatus)) blockers.push('status_closed');
  for (const w of quoteWarnings(args.items, args.guests, args.calc, false)) {
    if (
      w === 'no_items' ||
      w === 'no_guests' ||
      w === 'missing_tax' ||
      w === 'discount_exceeds' ||
      w === 'choice_group_empty'
    )
      blockers.push(w);
  }
  if (args.via === 'email' && !(args.customerEmail ?? '').trim()) blockers.push('no_email');
  if (!args.validUntil) warnings.push('no_valid_until');

  const used = new Set(args.items.map((i) => i.dish_id).filter((x): x is string => !!x));
  if (args.dishes.some((d) => used.has(d.id) && !d.allergens_reviewed_at))
    warnings.push('allergens_unreviewed');
  const usedRates = new Set(args.items.map((i) => i.tax_rate_id).filter((x): x is string => !!x));
  if (args.rates.some((r) => usedRates.has(r.id) && !r.reviewed_at))
    warnings.push('tax_unreviewed');
  return { blockers, warnings };
}
