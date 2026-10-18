import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChefHat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { SwitchRow } from '@/components/ui/switch';
import { addDays, formatGermanDate, todayBerlin } from '@/lib/berlin';
import { toAppError } from '@/lib/errors';
import { parsePercentToBp } from '@/lib/percent';
import { shareText } from '@/lib/share';
import { tokens } from '@/theme/tokens';

import {
  useDishes,
  useDishIngredientLines,
  useIngredients,
  usePackageDishLines,
} from '../../catalog/api';
import { AllergenCodes } from '../../catalog/components/allergen-codes';
import { useMembership } from '../../company/api';
import { useCompanySettings } from '../../settings/api';
import { useKitchenDietary, useKitchenEvents, useKitchenLines } from '../api';
import { buildPlan, type Plan } from '../plan';

type Tab = 'production' | 'special' | 'shopping';

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

/** SC-44/45/46 Küchenplanung: Produktion, Sonderessen und Einkauf für einen Zeitraum, ohne Preise. */
export function KitchenPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useMembership().data?.role;
  const events = useKitchenEvents();
  const lines = useKitchenLines();
  const dietary = useKitchenDietary();
  const dishes = useDishes();
  const packageDishes = usePackageDishLines();
  const dishIngredients = useDishIngredientLines();
  const ingredients = useIngredients();
  const settings = useCompanySettings(); // nur admin; die Küche rechnet mit 5 %

  const [from, setFrom] = useState(todayBerlin());
  const [to, setTo] = useState(addDays(todayBerlin(), 6));
  const [options, setOptions] = useState(false);
  const [tab, setTab] = useState<Tab>('production');
  const [bufferText, setBufferText] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const error = [events, lines, dietary, dishes, packageDishes, dishIngredients, ingredients].find(
    (q) => q.error,
  )?.error;
  const ready =
    events.data &&
    lines.data &&
    dietary.data &&
    dishes.data &&
    packageDishes.data &&
    dishIngredients.data &&
    ingredients.data;

  const defaultBp = role === 'admin' ? (settings.data?.shopping_buffer_bp ?? 500) : 500;
  const parsedBuffer = parsePercentToBp(
    bufferText ?? (defaultBp / 100).toString().replace('.', ','),
    0,
    50,
  );
  const bufferBp = parsedBuffer ?? defaultBp;

  let plan: Plan | null = null;
  if (ready) {
    const basis = new Map(lines.data!.map((l) => [l.event_id, l.basis]));
    plan = buildPlan({
      events: events.data!.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        starts_at: e.starts_at,
        guest_count: e.guest_count,
        basis: basis.get(e.id) ?? e.basis,
        has_open_change: e.has_open_change,
      })),
      lines: lines.data!.map((l) => ({
        eventId: l.event_id,
        dishId: l.item_type === 'dish' ? l.dish_id : null,
        packageId: l.item_type === 'package' ? l.menu_package_id : null,
        quantity: l.quantity,
      })),
      packageDishes: packageDishes.data!.map((p) => ({
        packageId: p.menu_package_id,
        dishId: p.dish_id,
        portionFactor: p.portion_factor,
      })),
      dietary: dietary.data!,
      dishes: dishes.data!.map((d) => ({
        id: d.id,
        name: d.name,
        allergens: d.allergens,
        diets: d.diets,
      })),
      dishIngredients: dishIngredients.data!.map((l) => ({
        dishId: l.dish_id,
        ingredientId: l.ingredient_id,
        quantityPerPerson: l.quantity_per_person,
      })),
      ingredients: ingredients.data!.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        group: i.product_group,
      })),
      from,
      to,
      includeOptions: options,
      bufferBp,
    });
  }

  const shoppingText = (p: Plan) =>
    p.shopping.items
      .map((i) => `${fmt(i.value)} ${t(`kitchenPlan.unit.${i.displayUnit}`)} ${i.name}`)
      .join('\n');

  return (
    <Screen
      title={t('kitchenPlan.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      <View style={{ gap: 12 }}>
        <DateField label={t('kitchenPlan.from')} value={from} onChange={(v) => v && setFrom(v)} />
        <DateField label={t('kitchenPlan.to')} value={to} onChange={(v) => v && setTo(v)} />
        <SwitchRow label={t('kitchenPlan.options')} value={options} onChange={setOptions} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(['production', 'special', 'shopping'] as Tab[]).map((x) => (
          <Chip
            key={x}
            label={t(`kitchenPlan.tab.${x}`)}
            selected={tab === x}
            onPress={() => setTab(x)}
          />
        ))}
      </View>

      {!plan ? (
        <Text variant="body" color="textSecondary">
          {t('common.loading')}
        </Text>
      ) : plan.days.length === 0 ? (
        <EmptyState icon={ChefHat} text={t('kitchenPlan.empty')} />
      ) : tab === 'production' ? (
        <View style={{ gap: 16 }}>
          {plan.days.map((day) => (
            <View key={day.date} style={{ gap: 8 }}>
              <Text variant="title2">{formatGermanDate(day.date)}</Text>
              {day.events.map((e) => (
                <Text key={e.id} variant="small" color="textSecondary">
                  {e.title}
                  {e.guest_count ? ` · ${t('kitchenPlan.guests', { count: e.guest_count })}` : ''}
                  {e.basis === 'snapshot' ? ` · ${t('kitchenPlan.provisional')}` : ''}
                  {e.has_open_change ? ` · ${t('kitchenPlan.openChange')}` : ''}
                </Text>
              ))}
              {day.withoutLines.map((e) => (
                <Banner key={e.id} tone="warning">
                  {t('kitchenPlan.noLines', { title: e.title })}
                </Banner>
              ))}
              {day.dishes.map((d) => (
                <View
                  key={d.dishId}
                  style={{
                    gap: 4,
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: tokens.color.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {d.name}
                    </Text>
                    <Text variant="bodyStrong" tabular>
                      {t('kitchenPlan.portions', { count: d.portions })}
                    </Text>
                  </View>
                  <AllergenCodes allergens={d.allergens} />
                  {d.byEvent.length > 1 ? (
                    <Text variant="small" color="textSecondary">
                      {d.byEvent
                        .map((b) => t('kitchenPlan.byEvent', { title: b.title, count: b.portions }))
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : tab === 'special' ? (
        <View style={{ gap: 16 }}>
          {plan.special.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('kitchenPlan.specialNone')}
            </Text>
          ) : null}
          {plan.special.map(({ event, entries }) => (
            <View key={event.id} style={{ gap: 8 }}>
              <Text variant="title2">{event.title}</Text>
              {entries.map((en) => (
                <View
                  key={
                    en.row.id ??
                    `${en.row.event_id}-${en.row.note}-${en.row.person_count}-${en.row.diet}`
                  }
                  style={{ gap: 4 }}
                >
                  <Text variant="bodyStrong">
                    {t('kitchenPlan.persons', { count: en.row.person_count })}{' '}
                    {en.row.diet ? t(`diet.${en.row.diet}`) : ''}
                    {en.row.avoid_allergens.length > 0
                      ? ` · ${en.row.avoid_allergens.map((a) => t(`allergen.${a}`)).join(', ')}`
                      : ''}
                  </Text>
                  {en.row.note || en.row.table_label || en.row.guest_name ? (
                    <Text variant="small" color="textSecondary">
                      {[en.row.guest_name, en.row.table_label, en.row.note]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                  {en.substitutes.length === 0 ? (
                    <Text variant="small" color="textSecondary">
                      {t('kitchenPlan.chefDecides')}
                    </Text>
                  ) : (
                    en.substitutes.map((s) => (
                      <Text
                        key={s.fromName + s.toName}
                        variant="small"
                        color={s.toConflict ? 'danger' : 'text'}
                      >
                        {s.toConflict
                          ? t('kitchenPlan.substituteConflict', { to: s.toName })
                          : t('kitchenPlan.substitute', { to: s.toName, from: s.fromName })}
                      </Text>
                    ))
                  )}
                  {en.conflicts.map((c) => (
                    <Text key={c.dishId} variant="small" color="danger">
                      {t('kitchenPlan.unsuitable', { name: c.name })}
                      {' ('}
                      {[
                        c.allergens.length > 0
                          ? t('kitchenPlan.contains', {
                              list: c.allergens.map((a) => t(`allergen.${a}`)).join(', '),
                            })
                          : null,
                        c.diet ? t('kitchenPlan.notDiet', { diet: t(`diet.${c.diet}`) }) : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      {')'}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField
            label={t('kitchenPlan.buffer')}
            helper={t('kitchenPlan.bufferHint')}
            value={bufferText ?? (defaultBp / 100).toString().replace('.', ',')}
            onChangeText={setBufferText}
            keyboardType="decimal-pad"
          />
          {plan.shopping.items.length === 0 && plan.shopping.withoutIngredients.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('kitchenPlan.shopNone')}
            </Text>
          ) : null}
          {groupItems(plan).map(([group, items]) => (
            <View key={group ?? '_'} style={{ gap: 4 }}>
              <Text variant="title2">{group ?? t('kitchenPlan.noGroup')}</Text>
              {items.map((i) => (
                <Checkbox
                  key={i.ingredientId}
                  strike
                  label={`${fmt(i.value)} ${t(`kitchenPlan.unit.${i.displayUnit}`)} ${i.name}`}
                  checked={checked.has(i.ingredientId)}
                  onChange={(c) =>
                    setChecked((cur) => {
                      const next = new Set(cur);
                      if (c) next.add(i.ingredientId);
                      else next.delete(i.ingredientId);
                      return next;
                    })
                  }
                />
              ))}
            </View>
          ))}
          {plan.shopping.withoutIngredients.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text variant="title2">{t('kitchenPlan.withoutIngredients')}</Text>
              {plan.shopping.withoutIngredients.map((w) => (
                <Text key={w.dishId} variant="body">
                  {t('kitchenPlan.portions', { count: w.portions })} ·{' '}
                  {dishes.data?.find((d) => d.id === w.dishId)?.name ?? '?'}
                </Text>
              ))}
            </View>
          ) : null}
          {plan.shopping.items.length > 0 ? (
            <Button
              label={t('kitchenPlan.share')}
              variant="secondary"
              onPress={async () => {
                const r = await shareText(shoppingText(plan));
                setNotice(
                  r === 'copied'
                    ? t('kitchenPlan.copied')
                    : r === 'failed'
                      ? t('kitchenPlan.shareFailed')
                      : null,
                );
              }}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function groupItems(plan: Plan) {
  const map = new Map<string | null, Plan['shopping']['items']>();
  for (const i of plan.shopping.items) map.set(i.group, [...(map.get(i.group) ?? []), i]);
  return [...map];
}
