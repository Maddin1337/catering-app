import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ALLERGENS, DIETS, type Allergen, type Diet } from '@/lib/dietary';
import { tokens } from '@/theme/tokens';

import {
  portalErrorKey,
  usePortalDeleteDietary,
  usePortalSaveDietary,
  type PortalDietary,
} from '../api';

/** Sonderessen und Allergien des Kunden: gelten sofort, bis zum Änderungsschluss änderbar (R2-1). */
export function DietaryCard({
  token,
  rows,
  guests,
  canEdit,
}: {
  token: string;
  rows: PortalDietary[];
  guests: number | null;
  canEdit: boolean;
}) {
  const { t } = useTranslation('portal');
  const { t: tTeam } = useTranslation();
  const save = usePortalSaveDietary(token);
  const del = usePortalDeleteDietary(token);
  const [editing, setEditing] = useState<PortalDietary | 'new' | null>(null);
  const [count, setCount] = useState('1');
  const [diet, setDiet] = useState<Diet | null>(null);
  const [avoid, setAvoid] = useState<Allergen[]>([]);
  const [guest, setGuest] = useState('');
  const [table, setTable] = useState('');
  const [note, setNote] = useState('');
  const error = save.error ?? del.error;

  const open = (r: PortalDietary | 'new') => {
    save.reset();
    del.reset();
    setEditing(r);
    setCount(r === 'new' ? '1' : String(r.person_count));
    setDiet(r === 'new' ? null : r.diet);
    setAvoid(r === 'new' ? [] : r.avoid_allergens);
    setGuest(r === 'new' ? '' : (r.guest_name ?? ''));
    setTable(r === 'new' ? '' : (r.table_label ?? ''));
    setNote(r === 'new' ? '' : (r.note ?? ''));
  };
  const n = /^\d+$/.test(count.trim()) ? Number(count) : 0;
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const total = rows.reduce((s, r) => s + r.person_count, 0);

  return (
    <View
      style={{
        gap: 12,
        padding: tokens.space[4],
        borderWidth: 1,
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.lg,
      }}
    >
      <Text variant="title2">{t('dietary.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('dietary.body')}
      </Text>
      {error ? <Banner tone="danger">{t(portalErrorKey(error))}</Banner> : null}
      {editing === null ? (
        <>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              title={`${r.person_count}× ${r.diet ? tTeam(`diet.${r.diet}`) : t('dietary.allergy')}`}
              subtitle={[
                r.avoid_allergens.map((a) => tTeam(`allergen.${a}`)).join(', '),
                r.guest_name,
                r.table_label,
                r.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={canEdit ? () => open(r) : undefined}
            />
          ))}
          {rows.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('dietary.empty')}
            </Text>
          ) : null}
          {canEdit ? (
            <Button label={t('dietary.add')} variant="secondary" onPress={() => open('new')} />
          ) : null}
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField
            label={t('dietary.count')}
            helper={guests ? t('dietary.countHint', { total, guests }) : undefined}
            value={count}
            onChangeText={setCount}
            keyboardType="number-pad"
          />
          <Text variant="small" color="textSecondary">
            {t('dietary.diet')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DIETS.map((d) => (
              <Chip
                key={d}
                label={tTeam(`diet.${d}`)}
                selected={diet === d}
                onPress={() => setDiet(diet === d ? null : d)}
              />
            ))}
          </View>
          <Text variant="small" color="textSecondary">
            {t('dietary.avoid')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALLERGENS.map((a) => (
              <Chip
                key={a}
                label={tTeam(`allergen.${a}`)}
                selected={avoid.includes(a)}
                onPress={() => setAvoid((cur) => toggle(cur, a))}
              />
            ))}
          </View>
          <TextField
            label={t('dietary.guest')}
            helper={t('dietary.privacy')}
            value={guest}
            onChangeText={setGuest}
          />
          <TextField label={t('dietary.table')} value={table} onChangeText={setTable} />
          <TextField label={t('dietary.note')} value={note} onChangeText={setNote} multiline />
          <Button
            label={t('dietary.save')}
            loading={save.isPending}
            disabled={n < 1 || save.isPending}
            onPress={() =>
              save.mutate(
                {
                  id: editing === 'new' ? null : editing.id,
                  count: n,
                  diet,
                  avoid,
                  note,
                  guest,
                  table,
                },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
          {editing !== 'new' ? (
            <Button
              label={t('dietary.delete')}
              variant="secondary"
              loading={del.isPending}
              onPress={() => del.mutate(editing.id, { onSuccess: () => setEditing(null) })}
            />
          ) : null}
          <Button label={t('cancel')} variant="ghost" onPress={() => setEditing(null)} />
        </View>
      )}
    </View>
  );
}
