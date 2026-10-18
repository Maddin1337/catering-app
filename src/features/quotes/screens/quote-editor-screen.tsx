import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { costRatioBp, suggestPriceCents } from '@/lib/costing';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import {
  packageCostFor,
  useDishCosts,
  useDishes,
  useDishPrices,
  usePackageDishLines,
  usePackagePrices,
  usePackages,
} from '../../catalog/api';
import type { Dish, MenuPackage } from '../../catalog/types';
import { useTaxRates } from '../../company/api';
import type { TaxRate } from '../../company/types';
import { useEvent } from '../../events/api';
import { useCompanySettings } from '../../settings/api';
import type { ItemTemplate } from '../../settings/types';
import { useQuoteForEditing, useSaveQuote } from '../api';
import { AddItem } from '../components/add-item';
import { ItemForm } from '../components/item-form';
import { TotalsBlock } from '../components/totals-block';
import {
  blankItem,
  itemFromTemplate,
  buildSavePayload,
  costTotal,
  effectiveQuantity,
  itemFromStored,
  quoteWarnings,
  runCalc,
} from '../model';
import type { EditorItem, ItemType, QuoteHeader, StoredItem } from '../types';

const AUTOSAVE_MS = 1500;
const clock = { now: () => Date.now() };

/** Zählt aktive Editorzeit (Kennzahl K-01): Pausen über einer Minute zählen nicht mit. */
function trackActiveTime(last: number | null, acc: { current: number }): number {
  const now = clock.now();
  if (last) acc.current += Math.min((now - last) / 1000, 60);
  return now;
}

type Doc = {
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

function toDoc(h: QuoteHeader, items: StoredItem[]): Doc {
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

/** SC-32 Angebots-Editor: Positionen, Kalkulation, Summen, Texte; speichert automatisch (nur online). */
export function QuoteEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id).data;
  const quote = useQuoteForEditing(id);
  const rates = useTaxRates();
  const settings = useCompanySettings();
  const dishes = useDishes();
  const packages = usePackages();

  const back = () => router.back();
  if (quote.error) {
    return (
      <Screen title={t('quote.title')} onBack={back} backLabel={t('common.back')}>
        <Banner tone="danger">{toAppError(quote.error).message}</Banner>
      </Screen>
    );
  }
  if (!event || !quote.data || !rates.data || !settings.data || !dishes.data || !packages.data) {
    return (
      <Screen title={t('quote.title')} onBack={back} backLabel={t('common.back')}>
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }
  return (
    <Editor
      key={quote.data.header.id}
      header={quote.data.header}
      doc={toDoc(quote.data.header, quote.data.items)}
      eventTitle={event.title}
      guests={event.guest_count}
      rates={rates.data}
      templates={settings.data.quote_item_templates ?? []}
      entryMode={settings.data.price_entry_mode}
      rounding={settings.data.price_rounding_cents}
      dishes={dishes.data}
      packages={packages.data}
      onBack={back}
    />
  );
}

function Editor({
  header,
  doc: initial,
  eventTitle,
  guests,
  rates,
  templates,
  entryMode,
  rounding,
  dishes,
  packages,
  onBack,
}: {
  header: QuoteHeader;
  doc: Doc;
  eventTitle: string;
  guests: number | null;
  rates: TaxRate[];
  templates: ItemTemplate[];
  entryMode: 'net' | 'gross';
  rounding: number;
  dishes: Dish[];
  packages: MenuPackage[];
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveQuote();
  const dishPrices = useDishPrices().data;
  const packagePrices = usePackagePrices().data;
  const dishCosts = useDishCosts();
  const packageLines = usePackageDishLines().data ?? [];

  const [doc, setDoc] = useState<Doc>(initial);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showTexts, setShowTexts] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const seconds = useRef(0);
  const lastChange = useRef<number | null>(null);

  const parsed = (d: Doc) => {
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
  };

  const compute = (d: Doc) => {
    const p = parsed(d);
    const s = {
      entryMode,
      display: d.price_display,
      discountBp: d.discountMode === 'bp' ? (p.disc ?? 0) : 0,
      discountCents: d.discountMode === 'cents' ? (p.disc ?? 0) : 0,
      depositBp: d.depositMode === 'bp' ? p.dep : null,
      depositCents: d.depositMode === 'cents' ? p.dep : null,
    };
    const calc = runCalc(d.items, rates, guests, s);
    const cost = costTotal(d.items, guests);
    return { p, s, calc, cost };
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const payload = pending.current;
    if (!payload) return;
    pending.current = null;
    const sent = seconds.current;
    setStatus('saving');
    save.mutate(
      { ...payload, editor_seconds: sent },
      {
        onSuccess: () => {
          seconds.current = Math.max(0, seconds.current - sent);
          setStatus('saved');
        },
        onError: () => setStatus('error'),
      },
    );
  };

  const change = (fn: (d: Doc) => Doc) => {
    const next = fn(doc);
    setDoc(next);
    lastChange.current = trackActiveTime(lastChange.current, seconds);
    const { p, s, calc, cost } = compute(next);
    // Ungültige Eingaben (Rabatt, Aufschlag) werden nicht gespeichert, bis sie stimmen
    if (
      p.disc === null ||
      p.markup === null ||
      (next.depositMode !== 'none' && next.deposit.trim() !== '' && p.dep === null)
    )
      return;
    pending.current = buildSavePayload({
      quoteId: header.id,
      header: {
        pricing_mode: next.pricing_mode,
        markup_bp: p.markup,
        price_display: next.price_display,
        deposit_due_on: next.deposit_due_on || null,
        customer_reference: next.customer_reference || null,
        intro_text: next.intro || null,
        terms_text: next.terms || null,
        closing_text: next.closing || null,
        valid_until: next.valid_until || null,
      },
      settings: s,
      items: next.items,
      guests,
      calc,
      cost,
      editorSeconds: 0,
    });
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const { p: parsedValues, calc, cost } = compute(doc);
  const warnings = quoteWarnings(doc.items, guests, calc, cost.incomplete);
  const lineById = new Map(calc.lines.map((l) => [l.id, l]));
  const entryLabel = entryMode === 'net' ? t('quote.net') : t('quote.gross');
  const markupBp = parsedValues.markup ?? header.markup_bp;

  const setItems = (fn: (items: EditorItem[]) => EditorItem[]) =>
    change((d) => ({ ...d, items: fn(d.items) }));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((items) => {
      const j = idx + dir;
      if (j < 0 || j >= items.length) return items;
      const next = [...items];
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });

  const addItem = (item: EditorItem) => {
    setItems((items) => [...items, item]);
    setAdding(false);
    setEditing(item.key);
  };

  const fromDish = (d: Dish): EditorItem => {
    const price = dishPrices?.find((x) => x.id === d.id);
    const c = dishCosts.get(d.id);
    const unitCost = c?.complete ? c.micro / 100000 : null;
    const base = blankItem('dish', rates);
    const suggested =
      doc.pricing_mode === 'cost_based' && c ? suggestPriceCents(c, markupBp, rounding) : null;
    return {
      ...base,
      dish_id: d.id,
      name: d.name,
      description: d.description ?? '',
      unit_label: d.portion_label,
      unit_price_cents: suggested ?? price?.price_cents ?? 0,
      unit_cost: unitCost,
      markup_bp: price?.markup_bp ?? null,
      tax_rate_id: price?.tax_rate_id ?? base.tax_rate_id,
    };
  };
  const fromPackage = (pk: MenuPackage): EditorItem => {
    const price = packagePrices?.find((x) => x.id === pk.id);
    const lines = packageLines
      .filter((l) => l.menu_package_id === pk.id)
      .map((l) => ({ dishId: l.dish_id, factor: l.portion_factor }));
    const c = lines.length > 0 ? packageCostFor(lines, dishCosts) : null;
    const base = blankItem('package', rates);
    const suggested =
      doc.pricing_mode === 'cost_based' && c ? suggestPriceCents(c, markupBp, rounding) : null;
    return {
      ...base,
      menu_package_id: pk.id,
      name: pk.name,
      description: pk.description ?? '',
      unit_price_cents: suggested ?? price?.price_per_person_cents ?? 0,
      unit_cost: c?.complete ? c.micro / 100000 : null,
      markup_bp: price?.markup_bp ?? null,
      tax_rate_id: price?.tax_rate_id ?? base.tax_rate_id,
    };
  };

  const suggestionFor = (it: EditorItem): number | null => {
    if (it.unit_cost === null || (it.type !== 'dish' && it.type !== 'package')) return null;
    return suggestPriceCents(
      { micro: Math.round(it.unit_cost * 100000), complete: true },
      it.markup_bp ?? markupBp,
      rounding,
    );
  };

  const finish = () => {
    flush();
    onBack();
  };

  const rohertrag =
    cost.cents !== null && !cost.incomplete
      ? (doc.price_display === 'net' ? calc.netCents : calc.netCents) - cost.cents
      : null;

  return (
    <Screen
      title={t('quote.title')}
      subtitle={`${header.number} · ${eventTitle}`}
      onBack={finish}
      backLabel={t('common.back')}
    >
      <Text
        variant="small"
        color={status === 'error' ? 'danger' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {t(`quote.status.${status}`)}
      </Text>
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      {warnings.map((w) => (
        <Banner key={w} tone="warning">
          {t(`quote.warning.${w}`)}
        </Banner>
      ))}

      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text variant="small" color="textSecondary">
            {t('quote.display')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              label={t('quote.net')}
              selected={doc.price_display === 'net'}
              onPress={() => change((d) => ({ ...d, price_display: 'net' }))}
            />
            <Chip
              label={t('quote.gross')}
              selected={doc.price_display === 'gross'}
              onPress={() => change((d) => ({ ...d, price_display: 'gross' }))}
            />
          </View>
        </View>
        <DateField
          label={t('quote.validUntil')}
          value={doc.valid_until}
          onChange={(v) => change((d) => ({ ...d, valid_until: v }))}
          optional
        />
        <TextField
          label={t('quote.reference')}
          value={doc.customer_reference}
          onChangeText={(v) => change((d) => ({ ...d, customer_reference: v }))}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('quote.items')}</Text>
        {guests ? (
          <Text variant="small" color="textSecondary">
            {t('quote.guests', { count: guests })}
          </Text>
        ) : null}
        {doc.items.length === 0 ? (
          <Text variant="body" color="textSecondary">
            {t('quote.empty')}
          </Text>
        ) : null}
        {doc.items.map((it, idx) => {
          const line = lineById.get(it.key);
          if (editing === it.key) {
            return (
              <ItemForm
                key={it.key}
                item={it}
                rates={rates}
                suggestion={suggestionFor(it)}
                entryLabel={entryLabel}
                onCancel={() => setEditing(null)}
                onRemove={() => {
                  setItems((items) => items.filter((x) => x.key !== it.key));
                  setEditing(null);
                }}
                onSave={(v) => {
                  setItems((items) => items.map((x) => (x.key === it.key ? v : x)));
                  setEditing(null);
                }}
              />
            );
          }
          const qty = effectiveQuantity(it, guests);
          return (
            <View key={it.key} style={{ gap: 4 }}>
              <ListRow
                title={it.is_heading ? it.name : `${it.name}`}
                subtitle={
                  it.is_heading
                    ? t('quote.heading')
                    : [
                        `${String(qty).replace('.', ',')} × ${formatCents(line?.unitPriceDisplayCents ?? it.unit_price_cents ?? 0)}${it.type === 'service' && it.hours ? ` × ${String(it.hours).replace('.', ',')} h` : ''}`,
                        it.choice_group
                          ? `${t('quote.group')}: ${it.choice_group}${it.is_selected ? '' : ` (${t('quote.notSelected')})`}`
                          : null,
                        !it.tax_rate_id ? t('quote.noTax') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                right={
                  !it.is_heading && line ? (
                    <Text variant="bodyStrong" tabular>
                      {formatCents(
                        doc.price_display === 'net' ? line.lineNetCents : line.lineGrossCents,
                      )}
                    </Text>
                  ) : undefined
                }
                onPress={() => setEditing(it.key)}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label={t('catalog.package.up')}
                  variant="ghost"
                  disabled={idx === 0}
                  onPress={() => move(idx, -1)}
                />
                <Button
                  label={t('catalog.package.down')}
                  variant="ghost"
                  disabled={idx === doc.items.length - 1}
                  onPress={() => move(idx, 1)}
                />
              </View>
            </View>
          );
        })}
        {adding ? (
          <AddItem
            dishes={dishes}
            packages={packages}
            templates={templates}
            onTemplate={(tpl) => addItem(itemFromTemplate(tpl, rates))}
            onClose={() => setAdding(false)}
            onBlank={(type: ItemType) => addItem(blankItem(type, rates))}
            onHeading={() => addItem({ ...blankItem('custom', rates, { heading: true }) })}
            onDish={(d) => addItem(fromDish(d))}
            onPackage={(pk) => addItem(fromPackage(pk))}
          />
        ) : (
          <Button label={t('quote.addItem')} onPress={() => setAdding(true)} />
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('quote.calculation')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip
            label={t('quote.mode.flat')}
            selected={doc.pricing_mode === 'flat'}
            onPress={() => change((d) => ({ ...d, pricing_mode: 'flat' }))}
          />
          <Chip
            label={t('quote.mode.cost_based')}
            selected={doc.pricing_mode === 'cost_based'}
            onPress={() => change((d) => ({ ...d, pricing_mode: 'cost_based' }))}
          />
        </View>
        {doc.pricing_mode === 'cost_based' ? (
          <TextField
            label={t('quote.markup')}
            helper={t('quote.markupHint')}
            value={doc.markup}
            onChangeText={(v) => change((d) => ({ ...d, markup: v }))}
            error={parsedValues.markup === null ? t('settings.defaults.errors.markup') : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip
            label={t('quote.discountPercent')}
            selected={doc.discountMode === 'bp'}
            onPress={() => change((d) => ({ ...d, discountMode: 'bp', discount: '' }))}
          />
          <Chip
            label={t('quote.discountAmount')}
            selected={doc.discountMode === 'cents'}
            onPress={() => change((d) => ({ ...d, discountMode: 'cents', discount: '' }))}
          />
        </View>
        <TextField
          label={
            doc.discountMode === 'bp'
              ? t('quote.discountPercentLabel')
              : t('quote.discountAmountLabel')
          }
          value={doc.discount}
          onChangeText={(v) => change((d) => ({ ...d, discount: v }))}
          error={parsedValues.disc === null ? t('quote.errors.discount') : undefined}
          inputMode="decimal"
          keyboardType="decimal-pad"
        />
      </View>

      <TotalsBlock calc={calc} display={doc.price_display} guests={guests} />
      {cost.cents !== null ? (
        <View style={{ gap: 4 }}>
          <Text variant="small" color="textSecondary">
            {t('quote.cost', { cost: formatCents(cost.cents) })}
            {cost.incomplete ? ` (${t('catalog.dish.costIncomplete')})` : ''}
          </Text>
          {rohertrag !== null && calc.netCents > 0 ? (
            <Text variant="small" color="textSecondary">
              {t('quote.profit', {
                profit: formatCents(rohertrag),
                quote: bpToPercentString(
                  costRatioBp({ micro: cost.cents * 100000, complete: true }, calc.netCents) ?? 0,
                ),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('quote.depositTitle')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip
            label={t('quote.depositNone')}
            selected={doc.depositMode === 'none'}
            onPress={() => change((d) => ({ ...d, depositMode: 'none', deposit: '' }))}
          />
          <Chip
            label={t('quote.discountPercent')}
            selected={doc.depositMode === 'bp'}
            onPress={() => change((d) => ({ ...d, depositMode: 'bp', deposit: '' }))}
          />
          <Chip
            label={t('quote.discountAmount')}
            selected={doc.depositMode === 'cents'}
            onPress={() => change((d) => ({ ...d, depositMode: 'cents', deposit: '' }))}
          />
        </View>
        {doc.depositMode !== 'none' ? (
          <>
            <TextField
              label={
                doc.depositMode === 'bp'
                  ? t('quote.depositPercentLabel')
                  : t('quote.depositAmountLabel')
              }
              value={doc.deposit}
              onChangeText={(v) => change((d) => ({ ...d, deposit: v }))}
              error={
                doc.deposit.trim() !== '' && parsedValues.dep === null
                  ? t('quote.errors.discount')
                  : undefined
              }
              inputMode="decimal"
              keyboardType="decimal-pad"
            />
            <DateField
              label={t('quote.depositDue')}
              value={doc.deposit_due_on}
              onChange={(v) => change((d) => ({ ...d, deposit_due_on: v }))}
              optional
            />
          </>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <Button
          label={showTexts ? t('quote.hideTexts') : t('quote.showTexts')}
          variant="secondary"
          onPress={() => setShowTexts((s) => !s)}
        />
        {showTexts ? (
          <>
            <TextField
              label={t('settings.quoteTexts.quote_intro_text')}
              value={doc.intro}
              onChangeText={(v) => change((d) => ({ ...d, intro: v }))}
              multiline
            />
            <TextField
              label={t('settings.quoteTexts.quote_terms_text')}
              value={doc.terms}
              onChangeText={(v) => change((d) => ({ ...d, terms: v }))}
              multiline
            />
            <TextField
              label={t('settings.quoteTexts.quote_closing_text')}
              value={doc.closing}
              onChangeText={(v) => change((d) => ({ ...d, closing: v }))}
              multiline
            />
          </>
        ) : null}
      </View>
      <Button label={t('quote.done')} onPress={finish} />
    </Screen>
  );
}
