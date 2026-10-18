import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { SearchField } from '@/components/ui/search-field';
import { toAppError } from '@/lib/errors';
import { surfaceStyle } from '@/components/ui/surface';
import { tokens } from '@/theme/tokens';

import { useSaveIngredient } from '../api';
import type { Ingredient, IngredientUnit } from '../types';

const UNITS: IngredientUnit[] = ['g', 'ml', 'piece'];

/**
 * Zutat suchen und hinzufügen, oder eine neue Zutat inline anlegen (SC-43). Ähnliche Namen werden
 * vorgeschlagen, damit „Zwiebel“ und „Zwiebeln“ nicht doppelt entstehen (US-19.5).
 */
export function IngredientPicker({
  ingredients,
  onPick,
  onClose,
}: {
  ingredients: Ingredient[];
  onPick: (i: Ingredient) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveIngredient();
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<IngredientUnit>('g');

  const q = query.trim().toLowerCase();
  const matches = q
    ? ingredients.filter((i) => !i.archived_at && i.name.toLowerCase().includes(q)).slice(0, 8)
    : ingredients.filter((i) => !i.archived_at).slice(0, 8);
  const exact = ingredients.some((i) => i.name.toLowerCase() === q);

  const create = async () => {
    try {
      const id = await save.mutateAsync({ name: query.trim(), unit });
      onPick({ id, name: query.trim(), unit, product_group: null, archived_at: null });
    } catch {
      // Fehler steht in save.error
    }
  };

  return (
    <View
      style={{
        gap: tokens.space[3],
        padding: tokens.space[3],
        ...surfaceStyle(),
      }}
    >
      <SearchField
        label={t('catalog.picker.search')}
        clearLabel={t('common.clear')}
        value={query}
        onChangeText={setQuery}
      />
      {save.error ? <Banner tone="danger">{toAppError(save.error).message}</Banner> : null}
      {matches.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          onPress={() => onPick(i)}
          style={({ pressed }) => ({
            minHeight: tokens.touch.min,
            justifyContent: 'center',
            paddingHorizontal: tokens.space[2],
            backgroundColor: pressed ? tokens.color.bgMuted : undefined,
          })}
        >
          <Text variant="body">
            {i.name}{' '}
            <Text variant="small" color="textTertiary">
              ({t(`catalog.unit.${i.unit}`)})
            </Text>
          </Text>
        </Pressable>
      ))}
      {q && !exact ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" color="textSecondary">
            {t('catalog.picker.createHint', { name: query.trim() })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {UNITS.map((u) => (
              <Chip
                key={u}
                label={t(`catalog.unit.${u}`)}
                selected={unit === u}
                onPress={() => setUnit(u)}
              />
            ))}
          </View>
          <Button
            label={t('catalog.picker.create', { name: query.trim() })}
            variant="secondary"
            loading={save.isPending}
            onPress={() => void create()}
          />
        </View>
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
    </View>
  );
}
