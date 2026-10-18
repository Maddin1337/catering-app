import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, UtensilsCrossed } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ChipRow } from '@/components/ui/chip-row';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { SkeletonList } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { SearchToggle } from '@/components/ui/search-toggle';
import { ALLERGENS, DIETS, type Allergen, type Diet } from '@/lib/dietary';
import { formatCents } from '@/lib/money';
import { toAppError } from '@/lib/errors';

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
  const [filterOpen, setFilterOpen] = useState(false);

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

  // Seltenere Filter liegen in einem Blatt; die Zahl am Filter-Chip zeigt, wie viele aktiv sind.
  const extraFilters =
    filters.diets.length +
    filters.without.length +
    (filters.unreviewedOnly ? 1 : 0) +
    (filters.showArchived ? 1 : 0);

  return (
    <Screen
      title={t('catalog.dishes.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        <IconButton
          icon={Plus}
          label={t('catalog.dishes.add')}
          onPress={() => router.push('/dishes/new')}
        />
      }
      onRefresh={() => void dishes.refetch()}
      refreshing={dishes.isRefetching}
    >
      <CatalogTabs active="dishes" />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <SearchToggle
        label={t('catalog.search')}
        clearLabel={t('common.clear')}
        openLabel={t('common.search')}
        value={filters.query}
        onChangeText={(v) => set('query', v)}
      >
        <ChipRow bleedLeft={false}>
          <Chip
            label={
              extraFilters > 0
                ? t('catalog.filterCount', { count: extraFilters })
                : t('catalog.filter')
            }
            selected={extraFilters > 0}
            icon={SlidersHorizontal}
            onPress={() => setFilterOpen(true)}
          />
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
        </ChipRow>
      </SearchToggle>
      {filterOpen ? (
        <Sheet
          title={t('catalog.filterTitle')}
          onClose={() => setFilterOpen(false)}
          footer={
            <>
              <Button
                label={t('catalog.filterReset')}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  setFilters((f) => ({ ...NO_FILTERS, query: f.query, category: f.category }))
                }
              />
              <Button
                label={t('common.done')}
                style={{ flex: 1 }}
                onPress={() => setFilterOpen(false)}
              />
            </>
          }
        >
          <Text variant="small" color="textSecondary">
            {t('catalog.filterDiet')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FILTER_DIETS.map((d) => (
              <Chip
                key={d}
                label={t(`diet.${d}`)}
                selected={filters.diets.includes(d)}
                onPress={() => set('diets', toggle(filters.diets, d))}
              />
            ))}
          </View>
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
          <Text variant="small" color="textSecondary">
            {t('catalog.filterMore')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
        </Sheet>
      ) : null}

      {dishes.isPending ? <SkeletonList /> : null}
      {!dishes.isPending && (dishes.data ?? []).length === 0 ? (
        <EmptyState icon={UtensilsCrossed} tint="violet" text={t('catalog.dishes.empty')} />
      ) : null}
      <View style={{ gap: 8 }}>
        {shown.map((d, i) => {
          const price = priceById.get(d.id);
          return (
            <Appear key={d.id} index={i}>
              <Surface
                accessibilityLabel={d.name}
                onPress={() => router.push({ pathname: '/dishes/[id]', params: { id: d.id } })}
                style={{ gap: 6 }}
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
              </Surface>
            </Appear>
          );
        })}
      </View>
    </Screen>
  );
}
