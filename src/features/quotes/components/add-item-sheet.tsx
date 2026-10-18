import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, Heading, PenLine, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { GroupRow, ListGroup } from '@/components/ui/list-group';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { formatCents } from '@/lib/money';
import { tints, tokens } from '@/theme/tokens';

import { AllergenCodes } from '../../catalog/components/allergen-codes';
import type { Dish, MenuPackage } from '../../catalog/types';
import type { TaxRate } from '../../company/types';
import type { ItemTemplate } from '../../settings/types';
import { buildItem, draftFrom, type ItemDraft } from '../item-draft';
import type { EditorItem, ItemType } from '../types';
import { ItemFields } from './item-fields';
import { ITEM_LOOK } from './item-look';

type Source = 'package' | 'dish' | 'template';
type Step =
  | { name: 'catalog' }
  | { name: 'kind' }
  | { name: 'details'; item: EditorItem; from: 'catalog' | 'kind' };

const FREE_TYPES: ItemType[] = [
  'service',
  'beverage',
  'equipment',
  'travel',
  'dish',
  'package',
  'custom',
];

/**
 * „Position hinzufügen“ als Blatt in Schritten:
 * 1. Katalog – Reiter Pakete | Gerichte | Vorlagen mit Suche. Das „+“ an der Zeile fügt sofort mit
 *    üblichen Werten hinzu (pro Gast, Katalogpreis) und das Blatt bleibt offen für die nächste.
 *    Tippen auf die Zeile führt zu „Menge und Preis“.
 * 2. Ohne Katalog – „Freie Position“ fragt nur nach der Art (Personal, Getränke …).
 * 3. Menge und Preis – dieselben Felder wie beim Bearbeiten, Seltenes zugeklappt.
 */
export function AddItemSheet({
  dishes,
  packages,
  templates,
  rates,
  guests,
  entryLabel,
  make,
  suggestionFor,
  onAdd,
  onClose,
}: {
  dishes: Dish[];
  packages: MenuPackage[];
  templates: ItemTemplate[];
  rates: TaxRate[];
  guests: number | null;
  entryLabel: string;
  make: {
    package: (p: MenuPackage) => EditorItem;
    dish: (d: Dish) => EditorItem;
    template: (tpl: ItemTemplate) => EditorItem;
    blank: (type: ItemType) => EditorItem;
    heading: () => EditorItem;
  };
  suggestionFor: (item: EditorItem) => number | null;
  onAdd: (item: EditorItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const livePackages = packages.filter((p) => !p.archived_at);
  const liveDishes = dishes.filter((d) => !d.archived_at);
  const sources = (
    [
      ['package', livePackages.length],
      ['dish', liveDishes.length],
      ['template', templates.length],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([k]) => k);
  const [step, setStep] = useState<Step>(
    sources.length > 0 ? { name: 'catalog' } : { name: 'kind' },
  );
  const [source, setSource] = useState<Source>(sources[0] ?? 'package');
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState(0);
  // Zuletzt per „+“ hinzugefügt: Der Knopf zeigt kurz einen Haken (ein Toast läge hinter dem Blatt).
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [tried, setTried] = useState(false);

  const toDetails = (item: EditorItem, from: 'catalog' | 'kind') => {
    setDraft(draftFrom(item));
    setTried(false);
    setStep({ name: 'details', item, from });
  };
  const quickAdd = (key: string, item: EditorItem) => {
    onAdd(item);
    setAdded((n) => n + 1);
    setJustAdded(key);
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility(t('quote.add.added', { name: item.name }));
    setTimeout(() => setJustAdded((k) => (k === key ? null : k)), 1400);
  };

  const q = query.trim().toLowerCase();
  const rows: {
    key: string;
    item: () => EditorItem;
    title: string;
    subtitle: string;
    extra?: React.ReactNode;
  }[] =
    source === 'package'
      ? livePackages
          .filter((p) => p.name.toLowerCase().includes(q))
          .map((p) => ({
            key: p.id,
            item: () => make.package(p),
            title: p.name,
            subtitle: t('catalog.packages.dishCount', { count: p.dish_count }),
            extra: <AllergenCodes allergens={p.allergens} />,
          }))
      : source === 'dish'
        ? liveDishes
            .filter((d) => d.name.toLowerCase().includes(q))
            .map((d) => ({
              key: d.id,
              item: () => make.dish(d),
              title: d.name,
              subtitle: t(`catalog.category.${d.category}`),
              extra: <AllergenCodes allergens={d.allergens} />,
            }))
        : templates
            .filter((tpl) => tpl.name.toLowerCase().includes(q))
            .map((tpl, i) => ({
              key: `${tpl.name}-${i}`,
              item: () => make.template(tpl),
              title: tpl.name,
              subtitle: t(`quote.type.${tpl.type}`),
            }));

  const title =
    step.name === 'catalog'
      ? t('quote.add.title')
      : step.name === 'kind'
        ? t('quote.add.kindTitle')
        : step.item.is_heading
          ? t('quote.add.headingTitle')
          : t('quote.add.detailsTitle');

  const back =
    step.name === 'details' || (step.name === 'kind' && sources.length > 0) ? (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() =>
          setStep(
            step.name === 'details' && step.from === 'kind'
              ? { name: 'kind' }
              : { name: 'catalog' },
          )
        }
        scale={0.97}
        style={styles.back}
      >
        <ChevronLeft color={tokens.color.accent} size={20} strokeWidth={2.4} />
        <Text variant="bodyStrong" color="accent">
          {t('common.back')}
        </Text>
      </PressableScale>
    ) : null;

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={(close) =>
        step.name === 'details' ? (
          <Button
            label={t('quote.add.confirm')}
            icon={Plus}
            onPress={() => {
              if (!draft) return;
              setTried(true);
              const item = buildItem(step.item, draft);
              if (item) close(() => onAdd(item));
            }}
          />
        ) : added > 0 ? (
          <Button label={t('quote.add.done', { count: added })} onPress={() => close()} />
        ) : undefined
      }
    >
      <Animated.View
        key={step.name}
        entering={FadeIn.duration(tokens.motion.base)}
        style={styles.step}
      >
        {back}

        {step.name === 'catalog' ? (
          <>
            {sources.length > 1 ? (
              <SegmentedTabs
                items={sources.map((s) => ({ key: s, label: t(`quote.add.source.${s}`) }))}
                active={source}
                onChange={(s) => {
                  setSource(s);
                  setQuery('');
                }}
              />
            ) : null}
            <SearchField
              label={t(`quote.add.search.${source}`)}
              clearLabel={t('common.clear')}
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.list}>
              {rows.length === 0 ? (
                <Text variant="small" color="textSecondary" style={styles.empty}>
                  {t('quote.add.noMatch')}
                </Text>
              ) : null}
              {rows.slice(0, 40).map((r) => {
                const preview = r.item();
                const look = ITEM_LOOK[preview.type];
                return (
                  <View key={r.key} style={styles.row}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`${r.title}. ${t('quote.add.openHint')}`}
                      onPress={() => toDetails(r.item(), 'catalog')}
                      scale={0.985}
                      pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
                      style={styles.rowMain}
                    >
                      <View style={[styles.icon, { backgroundColor: tints[look.tint].bg }]}>
                        <look.icon color={tints[look.tint].fg} size={18} strokeWidth={2.2} />
                      </View>
                      <View style={styles.texts}>
                        <Text variant="bodyStrong" numberOfLines={2}>
                          {r.title}
                        </Text>
                        <Text variant="small" color="textSecondary" numberOfLines={1}>
                          {[
                            r.subtitle,
                            preview.unit_price_cents
                              ? t('quote.add.pricePer', {
                                  price: formatCents(preview.unit_price_cents),
                                  unit: preview.unit_label,
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        {r.extra}
                      </View>
                    </PressableScale>
                    <IconButton
                      icon={justAdded === r.key ? Check : Plus}
                      tone="accent"
                      label={t('quote.add.quick', { name: r.title })}
                      onPress={() => quickAdd(r.key, r.item())}
                    />
                  </View>
                );
              })}
            </View>
            <ListGroup title={t('quote.add.without')}>
              <GroupRow
                icon={PenLine}
                tint="slate"
                title={t('quote.add.free')}
                subtitle={t('quote.add.freeHint')}
                onPress={() => setStep({ name: 'kind' })}
              />
              <GroupRow
                icon={Heading}
                tint="slate"
                title={t('quote.add.heading')}
                subtitle={t('quote.add.headingHint')}
                onPress={() => toDetails(make.heading(), 'catalog')}
              />
            </ListGroup>
          </>
        ) : null}

        {step.name === 'kind' ? (
          <ListGroup>
            {FREE_TYPES.map((type) => (
              <GroupRow
                key={type}
                icon={ITEM_LOOK[type].icon}
                tint={ITEM_LOOK[type].tint}
                title={t(`quote.type.${type}`)}
                subtitle={t(`quote.add.kindHint.${type}`)}
                onPress={() => toDetails(make.blank(type), 'kind')}
              />
            ))}
            {sources.length === 0 ? (
              <GroupRow
                icon={Heading}
                tint="slate"
                title={t('quote.add.heading')}
                subtitle={t('quote.add.headingHint')}
                onPress={() => toDetails(make.heading(), 'kind')}
              />
            ) : null}
          </ListGroup>
        ) : null}

        {step.name === 'details' && draft ? (
          <ItemFields
            item={step.item}
            draft={draft}
            onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
            showErrors={tried}
            rates={rates}
            suggestion={suggestionFor(step.item)}
            entryLabel={entryLabel}
            guests={guests}
          />
        ) : null}
      </Animated.View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  step: { gap: tokens.space[4] },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingRight: tokens.space[3],
    marginTop: -tokens.space[2],
  },
  list: { gap: tokens.space[2] },
  empty: { paddingVertical: tokens.space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: 60,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.space[2],
    borderRadius: tokens.radius.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
