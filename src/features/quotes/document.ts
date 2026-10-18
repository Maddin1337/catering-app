import { formatGermanDate } from '@/lib/berlin';
import { formatDate, formatTime } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { bpToPercentString } from '@/lib/percent';

import type { Allergen } from '@/lib/dietary';
import { ALLERGEN_LETTER } from '../catalog/types';
import type { QuoteSnapshot, SnapshotItem } from './snapshot';

type T = (key: string, options?: Record<string, unknown>) => string;

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const multiline = (value: string) => esc(value).replace(/\n/g, '<br>');

function num(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });
}

/** Menge der Zeile: „60 Person“, „3 × 6,5 h Person“. */
export function quantityText(i: SnapshotItem): string {
  if (i.hours != null) return `${num(i.quantity)} × ${num(i.hours)} h`;
  return `${num(i.quantity)} ${i.unit_label}`;
}

/** Akzentfarbe nur im Format #RRGGBB übernehmen, sonst Standard (verhindert Einschleusen in das Stylesheet). */
function accentOf(s: QuoteSnapshot): string {
  return s.company.accent_color && /^#[0-9a-fA-F]{6}$/.test(s.company.accent_color)
    ? s.company.accent_color
    : '#0F766E';
}

/** Gebrandetes Angebotsdokument als eigenständiges HTML (Druck/PDF); alle Texte kommen über `t`. */
export function renderQuoteHtml(s: QuoteSnapshot, t: T): string {
  const gross = s.quote.price_display === 'gross';
  const accent = accentOf(s);
  const used = new Set<string>();
  const money = (c: number | null) => (c === null ? '' : formatCents(c));

  const rows = s.items
    .map((i) => {
      if (i.is_heading) return `<tr class="heading"><td colspan="3">${esc(i.name)}</td></tr>`;
      i.allergens.forEach((a) => used.add(a));
      i.package_dishes.forEach((d) => d.allergens.forEach((a) => used.add(a)));
      const letters = i.allergens.map((a) => ALLERGEN_LETTER[a]).join(', ');
      const dishes = i.package_dishes
        .map((d) => {
          const l = d.allergens.map((a) => ALLERGEN_LETTER[a]).join(', ');
          return `<div class="dish">${esc(d.name)}${l ? ` <span class="letters">(${l})</span>` : ''}</div>`;
        })
        .join('');
      const unselected = !i.is_selected;
      const total = unselected ? '' : money(gross ? i.line_gross_cents : i.line_net_cents);
      const disc =
        i.discount_bp > 0
          ? ` <span class="muted">−${bpToPercentString(i.discount_bp)} %</span>`
          : '';
      return `<tr class="${unselected ? 'alt' : ''}">
<td><div class="name">${esc(i.name)}${letters ? ` <span class="letters">(${letters})</span>` : ''}</div>${
        i.description ? `<div class="muted">${multiline(i.description)}</div>` : ''
      }${dishes}${unselected ? `<div class="muted">${esc(t('quoteDoc.alternative'))}</div>` : ''}</td>
<td class="r">${esc(quantityText(i))}<div class="muted">${money(i.unit_price_display_cents)}${disc}</div></td>
<td class="r">${total}</td></tr>`;
    })
    .join('\n');

  const taxRows = s.totals.tax
    .map((x) =>
      gross
        ? `<tr><td>${esc(t('quoteDoc.vatIncluded', { rate: bpToPercentString(x.rate_bp), base: formatCents(x.base_cents + x.tax_cents) }))}</td><td class="r">${formatCents(x.tax_cents)}</td></tr>`
        : `<tr><td>${esc(t('quoteDoc.vatPlus', { rate: bpToPercentString(x.rate_bp), base: formatCents(x.base_cents) }))}</td><td class="r">${formatCents(x.tax_cents)}</td></tr>`,
    )
    .join('');
  const totals = `<table class="totals">
${
  s.totals.discount_cents > 0
    ? `<tr><td>${esc(t(gross ? 'quoteDoc.sumBeforeGross' : 'quoteDoc.sumBeforeNet'))}</td><td class="r">${formatCents(s.totals.sum_before_discount_cents)}</td></tr>
<tr><td>${esc(t('quoteDoc.discount'))}</td><td class="r">−${formatCents(s.totals.discount_cents)}</td></tr>`
    : ''
}
${gross ? '' : `<tr><td>${esc(t('quoteDoc.net'))}</td><td class="r">${formatCents(s.totals.net_cents)}</td></tr>`}
${taxRows}
<tr class="grand"><td>${esc(t('quoteDoc.total'))}</td><td class="r">${formatCents(s.totals.gross_cents)}</td></tr>
${
  s.quote.deposit.amount_cents
    ? `<tr><td>${esc(t('quoteDoc.deposit', { date: s.quote.deposit.due_on ? formatGermanDate(s.quote.deposit.due_on) : '–' }))}</td><td class="r">${formatCents(s.quote.deposit.amount_cents)}</td></tr>`
    : ''
}
</table>`;

  const legend =
    used.size > 0
      ? `<p class="legend"><strong>${esc(t('quoteDoc.allergens'))}:</strong> ${[...used]
          .sort((a, b) =>
            ALLERGEN_LETTER[a as Allergen].localeCompare(ALLERGEN_LETTER[b as Allergen]),
          )
          .map(
            (a) =>
              `${ALLERGEN_LETTER[a as keyof typeof ALLERGEN_LETTER]} = ${esc(t(`allergen.${a}`))}`,
          )
          .join(', ')}</p>`
      : '';

  const c = s.company;
  const addr = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const contact = [c.phone, c.contact_email].filter(Boolean).join(' · ');
  const e = s.event;
  const when = e.ends_at
    ? `${formatDate(e.starts_at)}, ${formatTime(e.starts_at)}–${formatTime(e.ends_at)}`
    : `${formatDate(e.starts_at)}, ${formatTime(e.starts_at)}`;
  const q = s.quote;

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(t('quoteDoc.title'))} ${esc(q.number)}</title>
<style>
@page { margin: 18mm 16mm; }
body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2933; font-size: 10.5pt; line-height: 1.4; }
h1 { font-size: 20pt; margin: 0; color: ${accent}; }
.top { display: flex; justify-content: space-between; border-bottom: 3px solid ${accent}; padding-bottom: 8px; margin-bottom: 16px; }
.muted { color: #667085; font-size: 9pt; }
.r { text-align: right; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; }
.items th { text-align: left; font-size: 9pt; color: #667085; border-bottom: 1px solid #d0d5dd; padding: 4px 0; }
.items th.r { text-align: right; }
.items td { padding: 6px 0; border-bottom: 1px solid #eaecf0; vertical-align: top; }
.items tr { page-break-inside: avoid; }
.items tr.heading td { font-weight: 700; color: ${accent}; padding-top: 14px; }
.items tr.alt td { color: #667085; }
.name { font-weight: 600; }
.dish { font-size: 9pt; color: #475467; padding-left: 10px; }
.letters { font-size: 8.5pt; color: #667085; font-weight: 400; }
.totals { width: 55%; margin-left: auto; margin-top: 12px; page-break-inside: avoid; }
.totals td { padding: 3px 0; }
.totals tr.grand td { font-weight: 700; font-size: 12pt; border-top: 2px solid ${accent}; padding-top: 6px; }
.info { display: flex; gap: 24px; margin-bottom: 14px; }
.info > div { flex: 1; }
.legend, .foot { font-size: 8.5pt; color: #667085; }
.foot { border-top: 1px solid #d0d5dd; margin-top: 22px; padding-top: 8px; }
.text { margin: 12px 0; }
</style></head><body>
<div class="top"><div><h1>${esc(c.name)}</h1><div class="muted">${esc(addr)}${contact ? `<br>${esc(contact)}` : ''}</div></div>
<div class="r"><strong>${esc(t('quoteDoc.title'))} ${esc(q.number)}</strong><div class="muted">${esc(t('quoteDoc.revision', { n: s.revision }))}<br>${esc(formatDate(s.frozen_at))}${
    q.valid_until
      ? `<br>${esc(t('quoteDoc.validUntil', { date: formatGermanDate(q.valid_until) }))}`
      : ''
  }</div></div></div>
<div class="info"><div><strong>${esc(s.customer.name)}</strong>${
    s.customer.contact_person ? `<br>${esc(s.customer.contact_person)}` : ''
  }${s.customer.billing_address ? `<br>${esc(s.customer.billing_address)}` : ''}${
    q.customer_reference
      ? `<br><span class="muted">${esc(t('quoteDoc.reference'))}: ${esc(q.customer_reference)}</span>`
      : ''
  }</div>
<div><strong>${esc(e.title)}</strong><br>${esc(when)}${e.venue ? `<br>${esc(e.venue)}` : ''}${
    e.guest_count ? `<br>${esc(t('quoteDoc.guests', { count: e.guest_count }))}` : ''
  }</div></div>
${q.intro_text ? `<div class="text">${multiline(q.intro_text)}</div>` : ''}
<table class="items"><thead><tr><th>${esc(t('quoteDoc.position'))}</th><th class="r">${esc(t('quoteDoc.quantity'))}</th><th class="r">${esc(t(gross ? 'quoteDoc.amountGross' : 'quoteDoc.amountNet'))}</th></tr></thead>
<tbody>
${rows}
</tbody></table>
${totals}
${q.terms_text ? `<div class="text"><strong>${esc(t('quoteDoc.terms'))}</strong><br>${multiline(q.terms_text)}</div>` : ''}
${q.closing_text ? `<div class="text">${multiline(q.closing_text)}</div>` : ''}
${legend}
<div class="foot">${c.footer_text ? `${multiline(c.footer_text)}<br>` : ''}${esc(c.name)}${addr ? ` · ${esc(addr)}` : ''}${
    c.vat_id ? ` · ${esc(t('quoteDoc.vatId'))} ${esc(c.vat_id)}` : ''
  }</div>
</body></html>`;
}
