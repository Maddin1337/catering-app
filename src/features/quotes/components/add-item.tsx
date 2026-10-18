import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { formatCents } from '@/lib/money';
import { tokens } from '@/theme/tokens';

import type { ItemTemplate } from '../../settings/types';
import { AllergenCodes } from '../../catalog/components/allergen-codes';
import type { Dish, MenuPackage } from '../../catalog/types';
import { ITEM_TYPES, type ItemType } from '../types';

/** SC-33 Typwahl (sieben Kacheln) mit Katalogsuche für Pakete und Gerichte. */
export function AddItem({
  dishes,
  packages,
  templates,
  onTemplate,
  onBlank,
  onHeading,
  onDish,
  onPackage,
  onClose,
}: {
  dishes: Dish[];
  packages: MenuPackage[];
  templates: ItemTemplate[];
  onTemplate: (tpl: ItemTemplate) => void;
  onBlank: (type: ItemType) => void;
  onHeading: () => void;
  onDish: (d: Dish) => void;
  onPackage: (p: MenuPackage) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<ItemType | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  return (
    <View
      style={{
        gap: 12,
        padding: tokens.space[3],
        borderWidth: 1,
        borderColor: tokens.color.borderInput,
        borderRadius: tokens.radius.md,
      }}
    >
      <Text variant="title2">{t('quote.add.title')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ITEM_TYPES.map((x) => (
          <Chip
            key={x}
            label={t(`quote.type.${x}`)}
            selected={type === x}
            onPress={() => {
              setType(x);
              setQuery('');
            }}
          />
        ))}
        <Chip label={t('quote.add.heading')} onPress={onHeading} />
      </View>
      {templates.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="small" color="textSecondary">
            {t('quote.add.templates')}
          </Text>
          {templates.map((tpl, i) => (
            <ListRow
              key={`${tpl.name}-${i}`}
              title={tpl.name}
              subtitle={`${t(`quote.type.${tpl.type}`)} · ${formatCents(tpl.unit_price_cents)} / ${tpl.unit_label}`}
              onPress={() => onTemplate(tpl)}
            />
          ))}
        </View>
      ) : null}
      {type === 'package' || type === 'dish' ? (
        <View style={{ gap: 8 }}>
          <TextField
            label={t('catalog.search')}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {type === 'package'
            ? packages
                .filter((p) => !p.archived_at && p.name.toLowerCase().includes(q))
                .slice(0, 12)
                .map((p) => (
                  <ListRow
                    key={p.id}
                    title={p.name}
                    subtitle={t('catalog.packages.dishCount', { count: p.dish_count })}
                    right={<AllergenCodes allergens={p.allergens} />}
                    onPress={() => onPackage(p)}
                  />
                ))
            : dishes
                .filter((d) => !d.archived_at && d.name.toLowerCase().includes(q))
                .slice(0, 12)
                .map((d) => (
                  <ListRow
                    key={d.id}
                    title={d.name}
                    subtitle={t(`catalog.category.${d.category}`)}
                    right={<AllergenCodes allergens={d.allergens} />}
                    onPress={() => onDish(d)}
                  />
                ))}
          <Button
            label={t('quote.add.free', { type: t(`quote.type.${type}`) })}
            variant="secondary"
            onPress={() => onBlank(type)}
          />
        </View>
      ) : type ? (
        <Button
          label={t('quote.add.create', { type: t(`quote.type.${type}`) })}
          onPress={() => onBlank(type)}
        />
      ) : (
        <Text variant="small" color="textSecondary">
          {t('quote.add.hint')}
        </Text>
      )}
      <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
    </View>
  );
}
