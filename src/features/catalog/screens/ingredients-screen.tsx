import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/components/ui/search-field';
import { TextField } from '@/components/ui/text-field';
import { toAppError } from '@/lib/errors';
import { formatCents } from '@/lib/money';
import { centsToEuroInput, parseEuroToCents } from '@/lib/money-input';

import { useMembership } from '../../company/api';
import {
  useDishIngredientLines,
  useIngredientPrices,
  useIngredients,
  useSaveIngredient,
} from '../api';
import { CatalogTabs } from '../components/catalog-tabs';
import type { Ingredient, IngredientUnit } from '../types';

const UNITS: IngredientUnit[] = ['g', 'ml', 'piece'];
type Editing = { mode: 'new' } | { mode: 'edit'; row: Ingredient };

/** SC-42 Zutaten mit SC-43 als eingebettetem Formular. Einkaufspreise sehen und ändern nur Admins. */
export function IngredientsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = useMembership().data?.role === 'admin';
  const ingredients = useIngredients();
  const prices = useIngredientPrices();
  const lines = useDishIngredientLines();
  const save = useSaveIngredient();
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const priceById = useMemo(
    () => new Map((prices.data ?? []).map((p) => [p.id, p.price_cents])),
    [prices.data],
  );
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines.data ?? []) m.set(l.ingredient_id, (m.get(l.ingredient_id) ?? 0) + 1);
    return m;
  }, [lines.data]);
  const shown = (ingredients.data ?? []).filter(
    (i) =>
      !!i.archived_at === archived && i.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const error = ingredients.error ?? prices.error ?? save.error;

  return (
    <Screen
      title={t('catalog.ingredients.title')}
      onBack={() => router.back()}
      backLabel={t('common.back')}
    >
      <CatalogTabs active="ingredients" />
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <IngredientForm
          key={editing.mode === 'edit' ? editing.row.id : 'new'}
          editing={editing}
          isAdmin={isAdmin}
          price={editing.mode === 'edit' ? (priceById.get(editing.row.id) ?? null) : null}
          inUse={editing.mode === 'edit' && (usage.get(editing.row.id) ?? 0) > 0}
          busy={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(payload) => save.mutate(payload, { onSuccess: () => setEditing(null) })}
        />
      ) : (
        <>
          <Button
            label={t('catalog.ingredients.add')}
            onPress={() => {
              save.reset();
              setEditing({ mode: 'new' });
            }}
          />
          <SearchField
            label={t('catalog.search')}
            clearLabel={t('common.clear')}
            value={query}
            onChangeText={setQuery}
          />
          <View style={{ flexDirection: 'row' }}>
            <Chip
              label={t('catalog.archive')}
              selected={archived}
              onPress={() => setArchived((a) => !a)}
            />
          </View>
          <View style={{ gap: 8 }}>
            {shown.map((i) => {
              const price = priceById.get(i.id);
              return (
                <ListRow
                  key={i.id}
                  title={i.name}
                  subtitle={[
                    t(`catalog.unit.${i.unit}`),
                    i.product_group,
                    t('catalog.ingredients.usedIn', { count: usage.get(i.id) ?? 0 }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    isAdmin ? (
                      <Text
                        variant="small"
                        color={price == null ? 'danger' : 'textSecondary'}
                        tabular
                      >
                        {price == null
                          ? t('catalog.ingredients.noPrice')
                          : `${formatCents(price)} ${t(`catalog.perUnit.${i.unit}`)}`}
                      </Text>
                    ) : undefined
                  }
                  onPress={() => {
                    save.reset();
                    setEditing({ mode: 'edit', row: i });
                  }}
                />
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

function IngredientForm({
  editing,
  isAdmin,
  price,
  inUse,
  busy,
  onCancel,
  onSave,
}: {
  editing: Editing;
  isAdmin: boolean;
  price: number | null;
  inUse: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const row = editing.mode === 'edit' ? editing.row : null;
  const [name, setName] = useState(row?.name ?? '');
  const [unit, setUnit] = useState<IngredientUnit>(row?.unit ?? 'g');
  const [group, setGroup] = useState(row?.product_group ?? '');
  const [priceInput, setPriceInput] = useState(price != null ? centsToEuroInput(price) : '');
  const [tried, setTried] = useState(false);

  const priceCents = priceInput.trim() === '' ? null : parseEuroToCents(priceInput);
  const nameError = name.trim() === '' ? t('catalog.ingredients.nameError') : undefined;
  const priceError =
    isAdmin && priceInput.trim() !== '' && priceCents === null
      ? t('catalog.dish.priceError')
      : undefined;

  const submit = (archive?: boolean) => {
    setTried(true);
    if (nameError || priceError) return;
    const payload: Record<string, unknown> = {
      ...(row ? { id: row.id } : {}),
      name: name.trim(),
      unit,
      product_group: group.trim(),
    };
    if (isAdmin) payload.price_cents = priceCents;
    if (isAdmin && archive !== undefined) payload.archived = archive;
    onSave(payload);
  };

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label={t('catalog.ingredients.name')}
        value={name}
        onChangeText={setName}
        error={tried ? nameError : undefined}
        maxLength={120}
      />
      <View style={{ gap: 8 }}>
        <Text variant="small" color="textSecondary">
          {t('catalog.ingredients.unit')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {UNITS.map((u) => (
            <Chip
              key={u}
              label={t(`catalog.unit.${u}`)}
              selected={unit === u}
              onPress={inUse ? undefined : () => setUnit(u)}
            />
          ))}
        </View>
        {inUse ? (
          <Text variant="small" color="textTertiary">
            {t('catalog.ingredients.unitLocked')}
          </Text>
        ) : null}
      </View>
      <TextField
        label={t('catalog.ingredients.group')}
        value={group}
        onChangeText={setGroup}
        maxLength={60}
      />
      {isAdmin ? (
        <TextField
          label={t('catalog.ingredients.price', { unit: t(`catalog.perUnit.${unit}`) })}
          value={priceInput}
          onChangeText={setPriceInput}
          error={tried ? priceError : undefined}
          inputMode="decimal"
          keyboardType="decimal-pad"
        />
      ) : null}
      <Button label={t('common.save')} loading={busy} onPress={() => submit()} />
      {row && isAdmin ? (
        <Button
          label={row.archived_at ? t('catalog.dish.unarchive') : t('catalog.dish.archive')}
          variant="secondary"
          onPress={() => submit(!row.archived_at)}
        />
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
