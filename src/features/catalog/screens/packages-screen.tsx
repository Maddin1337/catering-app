import { useRouter } from 'expo-router';
import { Package, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useState } from 'react';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SkeletonList } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';

import { useMembership } from '../../company/api';
import { useDishes, usePackageDishLines, usePackagePrices, usePackages } from '../api';
import { packageUnreviewed } from '../package-status';
import { AllergenCodes, DietTags } from '../components/allergen-codes';
import { CatalogTabs } from '../components/catalog-tabs';

/** SC-40 Pakete: Preis (nur admin), Anzahl Gerichte, abgeleitete Allergene und Diätformen. */
export function PackagesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useMembership().data?.role === 'admin';
  const packages = usePackages();
  const prices = usePackagePrices();
  const dishes = useDishes();
  const dishLines = usePackageDishLines();
  const [archived, setArchived] = useState(false);
  const error = packages.error ?? prices.error;

  return (
    <Screen
      title={t('catalog.packages.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
      actions={
        isAdmin ? (
          <IconButton
            icon={Plus}
            label={t('catalog.packages.add')}
            onPress={() => router.push('/packages/new')}
          />
        ) : null
      }
      onRefresh={() => void packages.refetch()}
      refreshing={packages.isRefetching}
    >
      <CatalogTabs active="packages" />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      <View style={{ flexDirection: 'row' }}>
        <Chip
          label={t('catalog.archive')}
          selected={archived}
          onPress={() => setArchived((a) => !a)}
        />
      </View>
      {packages.isPending ? <SkeletonList /> : null}
      {!packages.isPending && (packages.data ?? []).length === 0 ? (
        <EmptyState icon={Package} tint="violet" text={t('catalog.packages.empty')} />
      ) : null}
      <View style={{ gap: 8 }}>
        {(packages.data ?? [])
          .filter((p) => !!p.archived_at === archived)
          .map((p, i) => {
            const price = prices.data?.find((x) => x.id === p.id)?.price_per_person_cents;
            const unreviewed = packageUnreviewed(p.id, dishLines.data ?? [], dishes.data ?? []);
            return (
              <Appear key={p.id} index={i}>
                <Surface
                  accessibilityLabel={p.name}
                  onPress={() => router.push({ pathname: '/packages/[id]', params: { id: p.id } })}
                  style={{ gap: 6 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {p.name}
                    </Text>
                    {isAdmin && price != null ? (
                      <Text variant="body" tabular>
                        {formatCents(price)} {t('catalog.packages.perPerson')}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="small" color="textSecondary">
                    {t('catalog.packages.dishCount', { count: p.dish_count })}
                  </Text>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
                  >
                    <AllergenCodes allergens={p.allergens} />
                    <DietTags diets={p.diets} />
                    {unreviewed ? (
                      <Text variant="caption" color="danger">
                        {t('catalog.packages.unreviewed')}
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
