import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ALLERGENS, DIETS, type Allergen, type Diet } from '@/lib/dietary';
import { formatCents } from '@/lib/money';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useMembership } from '../../company/api';
import { useDishes, useDishPrices } from '../api';
import { AllergenCodes, DietTags } from '../components/allergen-codes';
import { CatalogTabs } from '../components/catalog-tabs';
import { filterDishes, NO_FILTERS, type DishFilters } from '../filter';
import { DISH_CATEGORIES } from '../types';

const FILTER_DIETS: Diet[] = DIETS.filter((d) => d !== 'halal' && d !== 'kosher');

/** SC-38 Gerichte: Suche und Filter, Allergen-Codes, Prüfstatus, Preis (nur admin). */
export function DishesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useMembership().data?.role === 'admin';
  const dishes = useDishes();
  const prices = useDishPrices();
  const [filters, setFilters] = useState<DishFilters>(NO_FILTERS);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);

  const priceById = useMemo(
    () => new Map((prices.data ?? []).map((p) => [p.id, p.price_cents])),
    [prices.data],
  );
  const shown = useMemo(() => filterDishes(dishes.data ?? [], filters), [dishes.data, filters]);
  const set = <K extends keyof DishFilters>(k: K, v: DishFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const error = dishes.error ?? prices.error;

  return (
    <Screen
      title={t('catalog.dishes.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      <CatalogTabs active="dishes" />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <Button label={t('catalog.dishes.add')} onPress={() => router.push('/dishes/new')} />
      <TextField
        label={t('catalog.search')}
        value={filters.query}
        onChangeText={(v) => set('query', v)}
        autoCorrect={false}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label={t('catalog.all')}
          selected={filters.category === null}
          onPress={() => set('category', null)}
        />
        {DISH_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={t(`catalog.category.${c}`)}
            selected={filters.category === c}
            onPress={() => set('category', filters.category === c ? null : c)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTER_DIETS.map((d) => (
          <Chip
            key={d}
            label={t(`diet.${d}`)}
            selected={filters.diets.includes(d)}
            onPress={() => set('diets', toggle(filters.diets, d))}
          />
        ))}
        <Chip
          label={t('catalog.withoutAllergen')}
          selected={filters.without.length > 0 || showAllergenFilter}
          onPress={() => setShowAllergenFilter((s) => !s)}
        />
        <Chip
          label={t('catalog.unreviewed')}
          selected={filters.unreviewedOnly}
          onPress={() => set('unreviewedOnly', !filters.unreviewedOnly)}
        />
        <Chip
          label={t('catalog.archive')}
          selected={filters.showArchived}
          onPress={() => set('showArchived', !filters.showArchived)}
        />
      </View>
      {showAllergenFilter ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" color="textSecondary">
            {t('catalog.withoutAllergenHint')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(ALLERGENS as readonly Allergen[]).map((a) => (
              <Chip
                key={a}
                label={t(`allergen.${a}`)}
                selected={filters.without.includes(a)}
                onPress={() => set('without', toggle(filters.without, a))}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!dishes.isPending && (dishes.data ?? []).length === 0 ? (
        <EmptyState icon={UtensilsCrossed} tint="violet" text={t('catalog.dishes.empty')} />
      ) : null}
      <View style={{ gap: 8 }}>
        {shown.map((d) => {
          const price = priceById.get(d.id);
          return (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/dishes/[id]', params: { id: d.id } })}
              style={({ pressed }) => ({
                gap: 6,
                padding: tokens.space[3],
                ...surfaceStyle(),
                ...(pressed ? { backgroundColor: tokens.color.bgSubtle } : null),
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {d.name}
                </Text>
                {isAdmin && price != null ? (
                  <Text variant="body" tabular>
                    {formatCents(price)}
                  </Text>
                ) : null}
              </View>
              <Text variant="small" color="textSecondary">
                {t(`catalog.category.${d.category}`)}
              </Text>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <AllergenCodes allergens={d.allergens} />
                <DietTags diets={d.diets} />
                {d.allergens_reviewed_at === null ? (
                  <Text variant="caption" color="danger">
                    {t('catalog.unreviewedBadge')}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
