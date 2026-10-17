import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useState } from 'react';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { tokens } from '@/theme/tokens';

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
    >
      <CatalogTabs active="packages" />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {isAdmin ? (
        <Button label={t('catalog.packages.add')} onPress={() => router.push('/packages/new')} />
      ) : null}
      <View style={{ flexDirection: 'row' }}>
        <Chip
          label={t('catalog.archive')}
          selected={archived}
          onPress={() => setArchived((a) => !a)}
        />
      </View>
      {!packages.isPending && (packages.data ?? []).length === 0 ? (
        <Banner tone="info">{t('catalog.packages.empty')}</Banner>
      ) : null}
      <View style={{ gap: 8 }}>
        {(packages.data ?? [])
          .filter((p) => !!p.archived_at === archived)
          .map((p) => {
            const price = prices.data?.find((x) => x.id === p.id)?.price_per_person_cents;
            const unreviewed = packageUnreviewed(p.id, dishLines.data ?? [], dishes.data ?? []);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/packages/[id]', params: { id: p.id } })}
                style={({ pressed }) => ({
                  gap: 6,
                  padding: tokens.space[3],
                  borderWidth: 1,
                  borderColor: tokens.color.border,
                  borderRadius: tokens.radius.md,
                  backgroundColor: pressed ? tokens.color.bgMuted : tokens.color.bg,
                })}
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
              </Pressable>
            );
          })}
      </View>
    </Screen>
  );
}
