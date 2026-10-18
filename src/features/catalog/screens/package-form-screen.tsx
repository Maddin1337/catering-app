import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { RadioList } from '@/components/ui/radio-list';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { costRatioBp, microToCents, suggestPriceCents } from '@/lib/costing';
import { packageAllergens, packageDiets } from '@/lib/dietary';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';
import { bpToPercentString, parsePercentToBp } from '@/lib/percent';
import { tokens } from '@/theme/tokens';

import { useMembership, useTaxRates } from '../../company/api';
import { useCompanySettings } from '../../settings/api';
import {
  packageCostFor,
  useDishCosts,
  useDishes,
  usePackageDishLines,
  usePackagePrices,
  usePackages,
  useSaveMenuPackage,
} from '../api';
import { AllergenCodes, DietTags } from '../components/allergen-codes';
import type { Dish, MenuPackage, PackagePrice } from '../types';

type Line = { dishId: string; factor: string };

/** SC-41 Paket anlegen/bearbeiten. Die Küche sieht das Paket ohne Preise und ohne Bearbeitung. */
export function PackageFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isAdmin = useMembership().data?.role === 'admin';
  const packages = usePackages();
  const prices = usePackagePrices();
  const dishes = useDishes();
  const lines = usePackageDishLines();
  const pkg = id ? packages.data?.find((p) => p.id === id) : undefined;

  if (packages.isPending || dishes.isPending || lines.isPending || (isAdmin && prices.isPending)) {
    return (
      <Screen
        title={t('catalog.package.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <Text>{t('common.loading')}</Text>
      </Screen>
    );
  }
  if (id && !pkg) {
    return (
      <Screen
        title={t('catalog.package.title')}
        onBack={() => router.back()}
        backLabel={t('common.back')}
      >
        <Banner tone="info">{t('catalog.package.gone')}</Banner>
      </Screen>
    );
  }
  return (
    <PackageForm
      key={id ?? 'new'}
      pkg={pkg}
      price={prices.data?.find((p) => p.id === id)}
      initialLines={(lines.data ?? [])
        .filter((l) => l.menu_package_id === id)
        .map((l) => ({ dishId: l.dish_id, factor: String(l.portion_factor).replace('.', ',') }))}
      dishes={dishes.data ?? []}
      isAdmin={isAdmin}
    />
  );
}

function parseFactor(input: string): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n < 100 ? n : null;
}

function PackageForm({
  pkg,
  price,
  initialLines,
  dishes,
  isAdmin,
}: {
  pkg: MenuPackage | undefined;
  price: PackagePrice | undefined;
  initialLines: Line[];
  dishes: Dish[];
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const save = useSaveMenuPackage();
  const dishCosts = useDishCosts();
  const taxRates = useTaxRates().data ?? [];
  const company = useCompanySettings().data;

  const [name, setName] = useState(pkg?.name ?? '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [adding, setAdding] = useState(false);
  const [priceInput, setPriceInput] = useState(
    price?.price_per_person_cents != null ? centsToEuroInput(price.price_per_person_cents) : '',
  );
  const [markupInput, setMarkupInput] = useState(
    price?.markup_bp != null ? bpToPercentString(price.markup_bp) : '',
  );
  const [taxRateId, setTaxRateId] = useState(price?.tax_rate_id ?? '');
  const [tried, setTried] = useState(false);

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const chosen = lines.map((l) => byId.get(l.dishId)).filter((d): d is Dish => !!d);
  const readOnly = !isAdmin;

  const nameError = name.trim() === '' ? t('catalog.dish.nameError') : undefined;
  const factorErrors = lines.map((l) =>
    parseFactor(l.factor) === null ? t('catalog.package.factorError') : undefined,
  );
  const priceCents = priceInput.trim() === '' ? null : parseEuroToCents(priceInput);
  const priceError =
    priceInput.trim() !== '' && priceCents === null ? t('catalog.dish.priceError') : undefined;
  const markupBp = markupInput.trim() === '' ? null : parsePercentToBp(markupInput, 0, 1000);
  const markupError =
    markupInput.trim() !== '' && markupBp === null
      ? t('settings.defaults.errors.markup')
      : undefined;

  const cost = packageCostFor(
    lines.map((l) => ({ dishId: l.dishId, factor: parseFactor(l.factor) ?? 0 })),
    dishCosts,
  );
  const suggestion =
    lines.length > 0
      ? suggestPriceCents(
          cost,
          markupBp ?? company?.default_markup_bp ?? 20000,
          company?.price_rounding_cents ?? 10,
        )
      : null;
  const unreviewed = chosen.some((d) => d.allergens_reviewed_at === null);

  const submit = () => {
    setTried(true);
    if (nameError || factorErrors.some(Boolean) || priceError || markupError) return;
    save.mutate(
      {
        ...(pkg ? { id: pkg.id } : {}),
        name: name.trim(),
        description: description.trim(),
        price_per_person_cents: priceCents,
        markup_bp: markupBp,
        tax_rate_id: taxRateId || null,
        dishes: lines.map((l) => ({ dish_id: l.dishId, portion_factor: parseFactor(l.factor) })),
      },
      { onSuccess: () => router.back() },
    );
  };

  const move = (idx: number, dir: -1 | 1) =>
    setLines((cur) => {
      const next = [...cur];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });

  return (
    <Screen
      title={pkg ? t('catalog.package.edit') : t('catalog.package.new')}
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
          editable={!readOnly}
          maxLength={120}
        />
        <TextField
          label={t('catalog.dish.description')}
          value={description}
          onChangeText={setDescription}
          editable={!readOnly}
          multiline
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="title2">{t('catalog.package.dishesTitle')}</Text>
        {lines.map((l, idx) => {
          const d = byId.get(l.dishId);
          return (
            <View
              key={l.dishId}
              style={{
                gap: 8,
                padding: tokens.space[3],
                borderWidth: 1,
                borderColor: tokens.color.border,
                borderRadius: tokens.radius.md,
              }}
            >
              <Text variant="bodyStrong">{d?.name ?? '?'}</Text>
              {d ? <AllergenCodes allergens={d.allergens} /> : null}
              <TextField
                label={t('catalog.package.factor')}
                value={l.factor}
                onChangeText={(v) =>
                  setLines((cur) => cur.map((x, i) => (i === idx ? { ...x, factor: v } : x)))
                }
                error={tried ? factorErrors[idx] : undefined}
                editable={!readOnly}
                inputMode="decimal"
                keyboardType="decimal-pad"
              />
              {!readOnly ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    label={t('catalog.package.up')}
                    variant="ghost"
                    onPress={() => move(idx, -1)}
                  />
                  <Button
                    label={t('catalog.package.down')}
                    variant="ghost"
                    onPress={() => move(idx, 1)}
                  />
                  <Button
                    label={t('common.remove')}
                    variant="ghost"
                    onPress={() => setLines((cur) => cur.filter((_, i) => i !== idx))}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        {!readOnly ? (
          adding ? (
            <View
              style={{
                gap: 4,
                padding: tokens.space[2],
                borderWidth: 1,
                borderColor: tokens.color.borderInput,
                borderRadius: tokens.radius.md,
              }}
            >
              {dishes
                .filter((d) => !d.archived_at && !lines.some((l) => l.dishId === d.id))
                .map((d) => (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setLines((cur) => [...cur, { dishId: d.id, factor: '1' }]);
                      setAdding(false);
                    }}
                    style={({ pressed }) => ({
                      minHeight: tokens.touch.min,
                      justifyContent: 'center',
                      paddingHorizontal: tokens.space[2],
                      backgroundColor: pressed ? tokens.color.bgMuted : undefined,
                    })}
                  >
                    <Text variant="body">{d.name}</Text>
                  </Pressable>
                ))}
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
            </View>
          ) : (
            <Button
              label={t('catalog.package.addDish')}
              variant="secondary"
              onPress={() => setAdding(true)}
            />
          )
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="title2">{t('catalog.package.derived')}</Text>
        <AllergenCodes allergens={packageAllergens(chosen)} />
        <DietTags diets={packageDiets(chosen)} />
        {unreviewed ? <Banner tone="warning">{t('catalog.packages.unreviewed')}</Banner> : null}
      </View>

      {isAdmin ? (
        <View style={{ gap: 12 }}>
          <Text variant="title2">{t('catalog.dish.priceTitle')}</Text>
          <Banner tone={cost.complete || lines.length === 0 ? 'info' : 'warning'}>
            {lines.length === 0
              ? t('catalog.dish.costNone')
              : cost.complete
                ? t('catalog.package.cost', { cost: formatCents(microToCents(cost.micro)) })
                : t('catalog.dish.costIncomplete')}
          </Banner>
          <TextField
            label={t('catalog.package.price')}
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
          {priceCents !== null && cost.complete && lines.length > 0 ? (
            <Text variant="small" color="textSecondary">
              {t('catalog.package.margin', {
                margin: formatCents(priceCents - microToCents(cost.micro)),
                quote: bpToPercentString(costRatioBp(cost, priceCents) ?? 0),
              })}
            </Text>
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
                ...taxRates.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          ) : null}
        </View>
      ) : null}

      {!readOnly ? (
        <Button label={t('common.save')} loading={save.isPending} onPress={submit} />
      ) : null}
      {pkg && isAdmin ? (
        <Button
          label={pkg.archived_at ? t('catalog.dish.unarchive') : t('catalog.dish.archive')}
          variant="secondary"
          onPress={() =>
            save.mutate(
              { id: pkg.id, archived: !pkg.archived_at },
              { onSuccess: () => router.back() },
            )
          }
        />
      ) : null}
    </Screen>
  );
}
