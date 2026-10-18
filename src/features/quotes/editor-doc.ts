import { formatDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import { itemFromStored } from './model';
import type { EditorItem, QuoteHeader, StoredItem } from './types';

/** Stand des Angebotseditors, Eingaben als Text wie getippt. */
export type Doc = {
  items: EditorItem[];
  price_display: 'net' | 'gross';
  pricing_mode: 'flat' | 'cost_based';
  markup: string;
  valid_until: string;
  customer_reference: string;
  intro: string;
  terms: string;
  closing: string;
  discountMode: 'bp' | 'cents';
  discount: string;
  depositMode: 'none' | 'bp' | 'cents';
  deposit: string;
  deposit_due_on: string;
};

export function toDoc(h: QuoteHeader, items: StoredItem[]): Doc {
  return {
    items: items.map(itemFromStored),
    price_display: h.price_display,
    pricing_mode: h.pricing_mode,
    markup: bpToPercentString(h.markup_bp),
    valid_until: h.valid_until ?? '',
    customer_reference: h.customer_reference ?? '',
    intro: h.intro_text ?? '',
    terms: h.terms_text ?? '',
    closing: h.closing_text ?? '',
    discountMode: h.discount_cents > 0 ? 'cents' : 'bp',
    discount:
      h.discount_cents > 0
        ? centsToEuroInput(h.discount_cents)
        : h.discount_bp > 0
          ? bpToPercentString(h.discount_bp)
          : '',
    depositMode: h.deposit_cents != null ? 'cents' : h.deposit_bp != null ? 'bp' : 'none',
    deposit:
      h.deposit_cents != null
        ? centsToEuroInput(h.deposit_cents)
        : h.deposit_bp != null
          ? bpToPercentString(h.deposit_bp)
          : '',
    deposit_due_on: h.deposit_due_on ?? '',
  };
}

/** Rabatt, Anzahlung und Aufschlag als Zahlen; `null` heißt: Eingabe ungültig. */
export function parseDoc(d: Doc) {
  const disc =
    d.discount.trim() === ''
      ? 0
      : d.discountMode === 'bp'
        ? parsePercentToBp(d.discount, 0, 100)
        : parseEuroToCents(d.discount);
  const dep =
    d.depositMode === 'none' || d.deposit.trim() === ''
      ? null
      : d.depositMode === 'bp'
        ? parsePercentToBp(d.deposit, 0, 100)
        : parseEuroToCents(d.deposit);
  const markup = parsePercentToBp(d.markup, 0, 1000);
  return { disc, dep, markup };
}

type T = (key: string, o?: Record<string, unknown>) => string;

/** Kurzwerte rechts an den Einstellungszeilen des Editors. */
export function docSummaries(d: Doc, t: T) {
  const p = parseDoc(d);
  const discount =
    d.discount.trim() === '' || p.disc === 0
      ? t('quote.settings.none')
      : p.disc === null
        ? t('quote.settings.invalid')
        : d.discountMode === 'bp'
          ? `${bpToPercentString(p.disc)} %`
          : formatCents(p.disc);
  const deposit =
    d.depositMode === 'none' || d.deposit.trim() === ''
      ? t('quote.settings.none')
      : p.dep === null
        ? t('quote.settings.invalid')
        : d.depositMode === 'bp'
          ? `${bpToPercentString(p.dep)} %`
          : formatCents(p.dep);
  const texts = [d.intro, d.terms, d.closing].filter((x) => x.trim()).length;
  return {
    pricing:
      d.pricing_mode === 'flat'
        ? t('quote.settings.flat')
        : p.markup === null
          ? t('quote.settings.invalid')
          : t('quote.settings.markupShort', { value: bpToPercentString(p.markup) }),
    display: t(
      d.price_display === 'net' ? 'quote.settings.pricesNet' : 'quote.settings.pricesGross',
    ),
    discount,
    deposit,
    validity: d.valid_until
      ? t('quote.settings.until', { date: formatDate(`${d.valid_until}T12:00:00Z`) })
      : t('quote.settings.open'),
    texts: texts === 0 ? t('quote.settings.none') : t('quote.settings.texts', { count: texts }),
  };
}
