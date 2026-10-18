import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calculator,
  CalendarClock,
  Check,
  CircleAlert,
  FileText,
  ListPlus,
  Percent,
  Plus,
  Wallet,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { Pill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { suggestPriceCents } from '@/lib/costing';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { unitPriceOnCalcSide } from '@/lib/calc';
import { newId } from '@/lib/uuid';
import { tokens } from '@/theme/tokens';

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
import { AddItemSheet } from '../components/add-item-sheet';
import { ItemCard } from '../components/item-card';
import { ItemSheet } from '../components/item-sheet';
import { SettingsSheet, type SettingsKind } from '../components/settings-sheet';
import { TotalsBlock } from '../components/totals-block';
import { docSummaries, parseDoc, toDoc, type Doc } from '../editor-doc';
import {
  blankItem,
  buildSavePayload,
  costTotal,
  effectiveQuantity,
  itemFromTemplate,
  quoteWarnings,
  runCalc,
} from '../model';
import type { EditorItem, QuoteHeader } from '../types';

const AUTOSAVE_MS = 1500;
const clock = { now: () => Date.now() };

/** Zählt aktive Editorzeit (Kennzahl K-01): Pausen über einer Minute zählen nicht mit. */
function trackActiveTime(last: number | null, acc: { current: number }): number {
  const now = clock.now();
  if (last) acc.current += Math.min((now - last) / 1000, 60);
  return now;
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
        <SkeletonList rows={3} />
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
  const router = useRouter();
  const save = useSaveQuote();
  const dishPrices = useDishPrices().data;
  const packagePrices = usePackagePrices().data;
  const dishCosts = useDishCosts();
  const packageLines = usePackageDishLines().data ?? [];

  const [doc, setDoc] = useState<Doc>(initial);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [sheet, setSheet] = useState<SettingsKind | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const seconds = useRef(0);
  const lastChange = useRef<number | null>(null);

  const compute = (d: Doc) => {
    const p = parseDoc(d);
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

  /** Speichert den wartenden Stand sofort; `true`, wenn nichts mehr aussteht. Speichervorgänge laufen nacheinander. */
  const flush = async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (inflight.current) await inflight.current;
    const payload = pending.current;
    if (!payload) return true;
    pending.current = null;
    // Die Datenbank zählt ganze Sekunden; der Rest bleibt für das nächste Speichern stehen.
    const sent = Math.floor(seconds.current);
    setStatus('saving');
    const run = (async () => {
      try {
        await save.mutateAsync({ ...payload, editor_seconds: sent });
        seconds.current = Math.max(0, seconds.current - sent);
        setStatus(pending.current ? 'saving' : 'saved');
        return true;
      } catch {
        // der Stand geht nicht verloren: beim nächsten Speichern (oder vor dem Versand) wird er erneut gesendet
        pending.current ??= payload;
        setStatus('error');
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    inflight.current = null;
    return ok;
  };

  // Neuester Stand auch zwischen zwei Renderings (z. B. mehrere Positionen schnell hintereinander).
  const latest = useRef(initial);
  const change = (fn: (d: Doc) => Doc) => {
    const next = fn(latest.current);
    latest.current = next;
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
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  };

  const { p: parsedValues, calc, cost } = compute(doc);
  const warnings = quoteWarnings(doc.items, guests, calc, cost.incomplete, rates).filter(
    // Leere Liste zeigt die Seite selbst; der Wareneinsatz steht bei „Kalkulation“.
    (w) => w !== 'no_items' && w !== 'cost_incomplete',
  );
  const lineById = new Map(calc.lines.map((l) => [l.id, l]));
  const entryLabel = t(entryMode === 'net' ? 'quote.item.basisNet' : 'quote.item.basisGross');
  const markupBp = parsedValues.markup ?? header.markup_bp;
  const summary = docSummaries(doc, t);
  const net = doc.price_display === 'net';

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

  const fromDish = (d: Dish): EditorItem => {
    const price = dishPrices?.find((x) => x.id === d.id);
    const c = dishCosts.get(d.id);
    const base = blankItem('dish', rates);
    const suggested =
      doc.pricing_mode === 'cost_based' && c ? suggestPriceCents(c, markupBp, rounding) : null;
    return {
      ...base,
      dish_id: d.id,
      name: d.name,
      description: d.description ?? '',
      unit_label: d.portion_label,
      // Ein Gericht für den Auftrag ist fast immer „pro Gast“; ohne Gästezahl eine feste Menge.
      quantity_mode: guests ? 'per_guest' : 'fixed',
      unit_price_cents: suggested ?? price?.price_cents ?? 0,
      unit_cost: c?.complete ? c.micro / 100000 : null,
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
    void flush();
    onBack();
  };
  const toSend = async () => {
    if (await flush())
      router.push({ pathname: '/events/[id]/quote-send', params: { id: header.event_id } });
  };

  const unitPrice = (it: EditorItem) =>
    lineById.get(it.key)?.unitPriceDisplayCents ??
    unitPriceOnCalcSide(
      it.unit_price_cents ?? 0,
      rates.find((r) => r.id === it.tax_rate_id)?.rate_bp ?? 0,
      entryMode,
      doc.price_display,
    );
  const qtyLabel = (it: EditorItem) =>
    it.quantity_mode === 'per_guest'
      ? t('quote.list.guests', { count: guests ?? 0 })
      : unitCount(effectiveQuantity(it, guests), it.unit_label, t);
  const editingItem = doc.items.find((x) => x.key === editing) ?? null;
  const priced = doc.items.filter((i) => !i.is_heading).length;

  const statusPill =
    status === 'error' ? (
      <Pill label={t('quote.status.errorShort')} tone="danger" icon={CircleAlert} />
    ) : status === 'saving' ? (
      <Pill label={t('quote.status.saving')} tone="sky" />
    ) : (
      <Pill label={t('quote.status.saved')} tone="slate" icon={Check} />
    );

  return (
    <Screen
      title={t('quote.title')}
      subtitle={`${header.number} · ${eventTitle}`}
      onBack={finish}
      backLabel={t('common.back')}
      actions={<View accessibilityLiveRegion="polite">{statusPill}</View>}
      footer={
        <>
          <View style={styles.footerTotal}>
            <Text variant="caption" color="textSecondary">
              {net ? t('quote.totals.net') : t('quote.totals.gross')}
            </Text>
            <AnimatedNumber
              value={net ? calc.netCents : calc.grossCents}
              format={(n) => formatCents(Math.round(n))}
              variant="title2"
              tabular
            />
          </View>
          <Button
            label={header.revision > 0 ? t('quote.toSendAgain') : t('quote.toSend')}
            disabled={save.isPending || priced === 0}
            onPress={() => void toSend()}
            style={styles.footerButton}
          />
        </>
      }
    >
      {header.revision > 0 ? (
        <Banner tone="info">{t('quoteSend.editFirst', { n: header.revision })}</Banner>
      ) : null}
      {status === 'error' && save.error ? (
        <Banner tone="danger">
          {`${t('quote.status.error')} ${toAppError(save.error).message}`}
        </Banner>
      ) : null}
      {warnings.map((w) => (
        <Banner key={w} tone="warning">
          {t(`quote.warning.${w}`)}
        </Banner>
      ))}

      <Appear index={0}>
        <ListGroup>
          <GroupRow
            icon={CalendarClock}
            tint="sky"
            title={summary.validity}
            subtitle={
              doc.customer_reference.trim()
                ? t('quote.settings.referenceValue', { value: doc.customer_reference.trim() })
                : t('quote.settings.noReference')
            }
            onPress={() => setSheet('details')}
          />
        </ListGroup>
      </Appear>

      <Appear index={1} style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitle}>
            <Text variant="title2">{t('quote.items')}</Text>
            {guests ? (
              <Text variant="small" color="textSecondary">
                {t('quote.guests', { count: guests })}
              </Text>
            ) : null}
          </View>
          {doc.items.length > 1 ? (
            <Button
              label={ordering ? t('common.done') : t('quote.list.order')}
              variant={ordering ? 'tonal' : 'ghost'}
              size="sm"
              onPress={() => setOrdering((o) => !o)}
            />
          ) : null}
        </View>

        {doc.items.length === 0 ? <EmptyState icon={ListPlus} text={t('quote.empty')} /> : null}
        {doc.items.map((it, idx) => {
          const line = lineById.get(it.key);
          return (
            <ItemCard
              key={it.key}
              item={it}
              quantityLabel={qtyLabel(it)}
              unitPriceCents={it.is_heading ? null : unitPrice(it)}
              // Menge × Preis abzüglich nur des eigenen Positionsrabatts; der Gesamtrabatt
              // steht unten in der Summe (sonst passt die Karte nicht zu „80 × 24,50 €“).
              totalCents={
                line ? line.baseCents - Math.round((line.baseCents * it.discount_bp) / 10000) : null
              }
              ordering={ordering}
              first={idx === 0}
              last={idx === doc.items.length - 1}
              onPress={() => setEditing(it.key)}
              onMove={(dir) => move(idx, dir)}
            />
          );
        })}

        {!ordering ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('quote.addItem')}
            onPress={() => setAdding(true)}
            scale={0.98}
            pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
            style={styles.addRow}
          >
            <View style={styles.addIcon}>
              <Plus color={tokens.color.onAccent} size={18} strokeWidth={2.6} />
            </View>
            <Text variant="bodyStrong" color="accent">
              {t('quote.addItem')}
            </Text>
          </PressableScale>
        ) : null}
      </Appear>

      <Appear index={2} style={styles.section}>
        <ListGroup title={t('quote.settings.sumTitle')}>
          <GroupRow
            icon={Calculator}
            tint="teal"
            title={t('quote.calculation')}
            subtitle={summary.display}
            value={summary.pricing}
            onPress={() => setSheet('pricing')}
          />
          <GroupRow
            icon={Percent}
            tint="rose"
            title={t('quote.settings.title.discount')}
            value={summary.discount}
            onPress={() => setSheet('discount')}
          />
          <GroupRow
            icon={Wallet}
            tint="amber"
            title={t('quote.settings.title.deposit')}
            value={summary.deposit}
            onPress={() => setSheet('deposit')}
          />
        </ListGroup>
        {priced > 0 ? (
          <TotalsBlock calc={calc} display={doc.price_display} guests={guests} />
        ) : null}
      </Appear>

      <Appear index={3}>
        <ListGroup>
          <GroupRow
            icon={FileText}
            tint="violet"
            title={t('quote.settings.title.texts')}
            subtitle={t('quote.settings.textsSub')}
            value={summary.texts}
            onPress={() => setSheet('texts')}
          />
        </ListGroup>
      </Appear>

      {adding ? (
        <AddItemSheet
          dishes={dishes}
          packages={packages}
          templates={templates}
          rates={rates}
          guests={guests}
          entryLabel={entryLabel}
          make={{
            package: fromPackage,
            dish: fromDish,
            template: (tpl) => itemFromTemplate(tpl, rates),
            // Freies Gericht/Paket ohne Katalogeintrag: als freie Position mit dem Satz für
            // Speisen, Einheit und Menge wie beim Katalog (siehe storedType).
            blank: (type) =>
              type === 'dish' || type === 'package'
                ? {
                    ...blankItem('custom', rates),
                    unit_label: type === 'dish' ? 'Portion' : 'Person',
                    quantity_mode: guests ? 'per_guest' : 'fixed',
                    tax_rate_id: blankItem(type, rates).tax_rate_id,
                  }
                : blankItem(type, rates),
            heading: () => blankItem('custom', rates, { heading: true }),
          }}
          suggestionFor={suggestionFor}
          onAdd={(item) => setItems((items) => [...items, item])}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editingItem ? (
        <ItemSheet
          key={editingItem.key}
          item={editingItem}
          rates={rates}
          suggestion={suggestionFor(editingItem)}
          entryLabel={entryLabel}
          guests={guests}
          onSave={(v) => setItems((items) => items.map((x) => (x.key === v.key ? v : x)))}
          onDuplicate={(current) =>
            setItems((items) => {
              const i = items.findIndex((x) => x.key === current.key);
              // Eine Kopie in einer Wahlgruppe ist eine weitere Alternative, nicht die gewählte.
              const copy = {
                ...current,
                key: newId(),
                is_selected: current.choice_group.trim() ? false : current.is_selected,
              };
              return [...items.slice(0, i).concat(current), copy, ...items.slice(i + 1)];
            })
          }
          onRemove={() => setItems((items) => items.filter((x) => x.key !== editingItem.key))}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {sheet ? (
        <SettingsSheet
          kind={sheet}
          doc={doc}
          change={change}
          netCents={calc.netCents}
          cost={cost}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}

/** „3 Personen“, „2 Stück“, „0,5 kg“ – für die übliche Einheit „Person“ mit richtiger Mehrzahl. */
function unitCount(
  qty: number,
  unit: string,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  if (unit.trim() === 'Person')
    return t('quote.list.persons', { count: qty, value: String(qty).replace('.', ',') });
  return `${String(qty).replace('.', ',')} ${unit}`.trim();
}

const styles = StyleSheet.create({
  section: { gap: tokens.space[3] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  sectionTitle: { flex: 1, gap: 2 },
  addRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[2],
    borderRadius: tokens.radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.accent,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accent,
  },
  footerTotal: { flex: 1, justifyContent: 'center' },
  footerButton: { flex: 1.4 },
});
