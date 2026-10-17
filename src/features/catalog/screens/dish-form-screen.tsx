import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { dishCost, microToCents, suggestPriceCents, costRatioBp } from '@/lib/costing';
import { ALLERGENS, DIETS, veganConflicts, type Allergen, type Diet } from '@/lib/dietary';
import { formatDateTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import {
  centsToEuroInput,
  hundredthsToInput,
  parseEuroToCents,
  parseQuantityToHundredths,
} from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';

import { useMembership, useTaxRates } from '../../company/api';
import { useCompanySettings } from '../../settings/api';
import {
  useDishes,
  useDishIngredientLines,
  useDishPrices,
  useIngredientPrices,
  useIngredients,
  useSaveDish,
} from '../api';
import { IngredientPicker } from '../components/ingredient-picker';
import {
  DISH_CATEGORIES,
  type Dish,
  type DishCategory,
  type DishPrice,
  type Ingredient,
} from '../types';

type Line = { ingredientId: string; qty: string };

/** SC-39 Gericht anlegen/bearbeiten. Lädt die Daten und startet das Formular mit dem gespeicherten Stand. */
export function DishFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isAdmin = useMembership().data?.role === 'admin';
  const dishes = useDishes();
  const prices = useDishPrices();
  const lines = useDishIngredientLines();
  const ingredients = useIngredients();

  const loading =
    dishes.isPending || ingredients.isPending || lines.isPending || (isAdmin && prices.isPending);
  const dish = id ? dishes.data?.find((d) => d.id === id) : undefined;

  if (loading) {
    return (
      <Screen
        title={t('catalog.dish.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }
  if (id && !dish) {
    return (
      <Screen
        title={t('catalog.dish.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <Banner tone="info">{t('catalog.dish.gone')}</Banner>
      </Screen>
    );
  }
  return (
    <DishForm
      key={id ?? 'new'}
      dish={dish}
      price={prices.data?.find((p) => p.id === id)}
      initialLines={(lines.data ?? [])
        .filter((l) => l.dish_id === id)
        .map((l) => ({
          ingredientId: l.ingredient_id,
          qty: hundredthsToInput(Math.round(l.quantity_per_person * 100)),
        }))}
      ingredients={ingredients.data ?? []}
      isAdmin={isAdmin}
    />
  );
}

function DishForm({
  dish,
  price,
  initialLines,
  ingredients,
  isAdmin,
}: {
  dish: Dish | undefined;
  price: DishPrice | undefined;
  initialLines: Line[];
  ingredients: Ingredient[];
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveDish();
  const ingredientPrices = useIngredientPrices().data;
  const taxRates = useTaxRates().data ?? [];
  const company = useCompanySettings().data;

  const [name, setName] = useState(dish?.name ?? '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [category, setCategory] = useState<DishCategory>(dish?.category ?? 'main');
  const [portionLabel, setPortionLabel] = useState(dish?.portion_label ?? 'Portion');
  const [diets, setDiets] = useState<Diet[]>(dish?.diets ?? []);
  const [allergens, setAllergens] = useState<Allergen[]>(dish?.allergens ?? []);
  const [confirm, setConfirm] = useState(false);
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [extra, setExtra] = useState<Ingredient[]>([]);
  const [picking, setPicking] = useState(false);
  const [priceInput, setPriceInput] = useState(
    price?.price_cents != null ? centsToEuroInput(price.price_cents) : '',
  );
  const [markupInput, setMarkupInput] = useState(
    price?.markup_bp != null ? bpToPercentString(price.markup_bp) : '',
  );
  const [taxRateId, setTaxRateId] = useState<string>(price?.tax_rate_id ?? '');
  const [tried, setTried] = useState(false);

  const allIngredients = [
    ...ingredients,
    ...extra.filter((e) => !ingredients.some((i) => i.id === e.id)),
  ];
  const byId = new Map(allIngredients.map((i) => [i.id, i]));
  const priceById = new Map((ingredientPrices ?? []).map((p) => [p.id, p.price_cents]));

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const initialAllergens = dish?.allergens ?? [];
  const allergensChanged =
    allergens.length !== initialAllergens.length ||
    allergens.some((a) => !initialAllergens.includes(a));
  const reviewed = !!dish?.allergens_reviewed_at;

  const nameError = name.trim() === '' ? t('catalog.dish.nameError') : undefined;
  const qtyErrors = lines.map((l) =>
    parseQuantityToHundredths(l.qty) === null ? t('catalog.dish.qtyError') : undefined,
  );
  const priceCents = priceInput.trim() === '' ? null : parseEuroToCents(priceInput);
  const priceError =
    isAdmin && priceInput.trim() !== '' && priceCents === null
      ? t('catalog.dish.priceError')
      : undefined;
  const markupBp = markupInput.trim() === '' ? null : parsePercentToBp(markupInput, 0, 1000);
  const markupError =
    isAdmin && markupInput.trim() !== '' && markupBp === null
      ? t('settings.defaults.errors.markup')
      : undefined;

  const conflicts = veganConflicts({ allergens, diets });

  // Wareneinsatz live (nur admin; ohne Preise der Zutaten „unvollständig“)
  const cost = dishCost(
    lines.map((l) => ({
      quantityHundredths: parseQuantityToHundredths(l.qty) ?? 0,
      unit: byId.get(l.ingredientId)?.unit ?? 'g',
      priceCents: priceById.get(l.ingredientId) ?? null,
    })),
  );
  const effectiveMarkup = markupBp ?? company?.default_markup_bp ?? 20000;
  const suggestion =
    lines.length > 0
      ? suggestPriceCents(cost, effectiveMarkup, company?.price_rounding_cents ?? 10)
      : null;

  const hasErrors = !!nameError || qtyErrors.some(Boolean) || !!priceError || !!markupError;

  const submit = () => {
    setTried(true);
    if (hasErrors) return;
    const payload: Record<string, unknown> = {
      ...(dish ? { id: dish.id } : {}),
      name: name.trim(),
      description: description.trim(),
      category,
      portion_label: portionLabel.trim() || 'Portion',
      diets,
      allergens,
      allergens_confirmed: confirm,
      ingredients: lines.map((l) => ({
        ingredient_id: l.ingredientId,
        quantity_per_person: (parseQuantityToHundredths(l.qty) ?? 0) / 100,
      })),
    };
    if (isAdmin) {
      payload.price_cents = priceCents;
      payload.markup_bp = markupBp;
      payload.tax_rate_id = taxRateId || null;
    }
    save.mutate(payload, { onSuccess: () => router.back() });
  };

  const archive = () => {
    if (!dish) return;
    save.mutate({ id: dish.id, archived: !dish.archived_at }, { onSuccess: () => router.back() });
  };

  return (
    <Screen
      title={dish ? t('catalog.dish.edit') : t('catalog.dish.new')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      <View style={{ gap: 16 }}>
        <TextField
          label={t('catalog.dish.name')}
          value={name}
          onChangeText={setName}
          error={tried ? nameError : undefined}
          maxLength={120}
        />
        <TextField
          label={t('catalog.dish.description')}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <RadioList
          label={t('catalog.dish.category')}
          value={category}
          onChange={setCategory}
          options={DISH_CATEGORIES.map((c) => ({ value: c, label: t(`catalog.category.${c}`) }))}
        />
        <TextField
          label={t('catalog.dish.portionLabel')}
          value={portionLabel}
          onChangeText={setPortionLabel}
          maxLength={30}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('catalog.dish.dietsTitle')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DIETS.map((d) => (
            <Chip
              key={d}
              label={t(`diet.${d}`)}
              selected={diets.includes(d)}
              onPress={() => setDiets((cur) => toggle(cur, d))}
            />
          ))}
        </View>
        {conflicts.length > 0 ? (
          <Banner tone="warning">
            {t('catalog.dish.veganConflict', {
              list: conflicts.map((a) => t(`allergen.${a}`)).join(', '),
            })}
          </Banner>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('catalog.dish.allergensTitle')}</Text>
        <Text variant="small" color="textSecondary">
          {t('catalog.dish.allergensHint')}
        </Text>
        <Text variant="small" color={reviewed && !allergensChanged ? 'textSecondary' : 'danger'}>
          {reviewed && !allergensChanged
            ? t('catalog.dish.reviewedOn', { date: formatDateTime(dish!.allergens_reviewed_at!) })
            : t('catalog.dish.notReviewed')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ALLERGENS.map((a) => (
            <Chip
              key={a}
              label={t(`allergen.${a}`)}
              selected={allergens.includes(a)}
              onPress={() => setAllergens((cur) => toggle(cur, a))}
            />
          ))}
        </View>
        <Checkbox label={t('catalog.dish.confirm')} checked={confirm} onChange={setConfirm} />
        {allergensChanged && !confirm && reviewed ? (
          <Banner tone="warning">{t('catalog.dish.resetWarning')}</Banner>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('catalog.dish.ingredientsTitle')}</Text>
        <Text variant="small" color="textSecondary">
          {t('catalog.dish.ingredientsHint')}
        </Text>
        {lines.map((l, idx) => {
          const ing = byId.get(l.ingredientId);
          return (
            <View
              key={l.ingredientId}
              style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
            >
              <View style={{ flex: 1 }}>
                <TextField
                  label={`${ing?.name ?? '?'} (${t(`catalog.unit.${ing?.unit ?? 'g'}`)} ${t('catalog.dish.perPerson')})`}
                  value={l.qty}
                  onChangeText={(v) =>
                    setLines((cur) => cur.map((x, i) => (i === idx ? { ...x, qty: v } : x)))
                  }
                  error={tried ? qtyErrors[idx] : undefined}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ paddingTop: 22 }}>
                <Button
                  label={t('common.remove')}
                  variant="ghost"
                  onPress={() => setLines((cur) => cur.filter((_, i) => i !== idx))}
                />
              </View>
            </View>
          );
        })}
        {picking ? (
          <IngredientPicker
            ingredients={allIngredients.filter((i) => !lines.some((l) => l.ingredientId === i.id))}
            onClose={() => setPicking(false)}
            onPick={(i) => {
              setExtra((cur) => [...cur, i]);
              setLines((cur) => [...cur, { ingredientId: i.id, qty: '' }]);
              setPicking(false);
            }}
          />
        ) : (
          <Button
            label={t('catalog.dish.addIngredient')}
            variant="secondary"
            onPress={() => setPicking(true)}
          />
        )}
      </View>

      {isAdmin ? (
        <View style={{ gap: 12 }}>
          <Text variant="title2">{t('catalog.dish.priceTitle')}</Text>
          <Banner tone={cost.complete || lines.length === 0 ? 'info' : 'warning'}>
            {lines.length === 0
              ? t('catalog.dish.costNone')
              : cost.complete
                ? t('catalog.dish.cost', { cost: formatCents(microToCents(cost.micro)) })
                : t('catalog.dish.costIncomplete')}
          </Banner>
          <TextField
            label={t('catalog.dish.price')}
            value={priceInput}
            onChangeText={setPriceInput}
            error={tried ? priceError : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          {suggestion !== null ? (
            <View style={{ gap: 8 }}>
              <Text variant="small" color="textSecondary">
                {t('catalog.dish.suggestion', {
                  price: formatCents(suggestion),
                  quote: bpToPercentString(costRatioBp(cost, suggestion) ?? 0),
                })}
              </Text>
              <Button
                label={t('catalog.dish.applySuggestion')}
                variant="secondary"
                onPress={() => setPriceInput(centsToEuroInput(suggestion))}
              />
            </View>
          ) : null}
          <TextField
            label={t('catalog.dish.markup')}
            helper={t('catalog.dish.markupHint', {
              value: bpToPercentString(company?.default_markup_bp ?? 20000),
            })}
            value={markupInput}
            onChangeText={setMarkupInput}
            error={tried ? markupError : undefined}
            inputMode="decimal"
            keyboardType="decimal-pad"
          />
          {taxRates.length > 0 ? (
            <RadioList
              label={t('catalog.dish.taxRate')}
              value={taxRateId}
              onChange={setTaxRateId}
              options={[
                { value: '', label: t('catalog.dish.taxDefault') },
                ...taxRates.map((r) => ({ value: r.id, label: `${r.name}` })),
              ]}
            />
          ) : null}
        </View>
      ) : null}

      <Button label={t('common.save')} loading={save.isPending} onPress={submit} />
      {dish && isAdmin ? (
        <Button
          label={dish.archived_at ? t('catalog.dish.unarchive') : t('catalog.dish.archive')}
          variant="secondary"
          onPress={archive}
        />
      ) : null}
    </Screen>
  );
}
