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
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import { AllergenCodes } from '../../catalog/components/allergen-codes';
import { useDeleteDietary, useDietary, useSaveDietary, type DietaryInput } from '../api';
import type { DietaryRow, EventRow } from '../types';

type Editing = { mode: 'new' } | { mode: 'edit'; row: DietaryRow };

/** SC-25/SC-27 Tab Küche: Hinweise und Sonderessen. Admin und Küche erfassen; Gesundheitsdaten (Art. 9 DSGVO). */
export function KitchenTab({ event }: { event: EventRow }) {
  const { t } = useTranslation();
  const list = useDietary(event.id);
  const save = useSaveDietary();
  const del = useDeleteDietary();
  const [editing, setEditing] = useState<Editing | null>(null);
  const rows = list.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.person_count, 0);
  const error = list.error ?? save.error ?? del.error;
  const writable = !['declined', 'invoiced'].includes(event.status);

  return (
    <View style={{ gap: 12 }}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {event.kitchen_notes ? (
        <View style={{ gap: 2 }}>
          <Text variant="small" color="textSecondary">
            {t('events.detail.kitchenNotes')}
          </Text>
          <Text variant="body">{event.kitchen_notes}</Text>
        </View>
      ) : null}
      <Text variant="title2">{t('events.kitchen.title')}</Text>
      {event.guest_count ? (
        <Text variant="small" color="textSecondary">
          {t('events.kitchen.sum', { count: total, guests: event.guest_count })}
        </Text>
      ) : null}
      {editing ? (
        <DietaryForm
          key={editing.mode === 'edit' ? editing.row.id : 'new'}
          editing={editing}
          busy={save.isPending || del.isPending}
          onCancel={() => setEditing(null)}
          onSave={(values) =>
            save.mutate(
              {
                eventId: event.id,
                id: editing.mode === 'edit' ? editing.row.id : undefined,
                values,
              },
              { onSuccess: () => setEditing(null) },
            )
          }
          onDelete={
            editing.mode === 'edit'
              ? () => del.mutate(editing.row.id, { onSuccess: () => setEditing(null) })
              : undefined
          }
        />
      ) : (
        <>
          {rows.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('events.kitchen.empty')}
            </Text>
          ) : null}
          {rows.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <ListRow
                title={`${r.person_count}× ${r.diet ? t(`diet.${r.diet}`) : t('events.kitchen.allergy')}`}
                subtitle={
                  [r.guest_name, r.table_label, r.note].filter(Boolean).join(' · ') || undefined
                }
                right={
                  r.is_short_notice ? (
                    <Text variant="caption" color="danger">
                      {t('events.kitchen.shortNotice')}
                    </Text>
                  ) : undefined
                }
                onPress={writable ? () => setEditing({ mode: 'edit', row: r }) : undefined}
              />
              <AllergenCodes allergens={r.avoid_allergens} />
            </View>
          ))}
          {writable ? (
            <Button label={t('events.kitchen.add')} onPress={() => setEditing({ mode: 'new' })} />
          ) : null}
        </>
      )}
    </View>
  );
}

function DietaryForm({
  editing,
  busy,
  onCancel,
  onSave,
  onDelete,
}: {
  editing: Editing;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: DietaryInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const row = editing.mode === 'edit' ? editing.row : null;
  const [count, setCount] = useState(row ? String(row.person_count) : '1');
  const [diet, setDiet] = useState<Diet | null>(row?.diet ?? null);
  const [avoid, setAvoid] = useState<Allergen[]>(row?.avoid_allergens ?? []);
  const [guest, setGuest] = useState(row?.guest_name ?? '');
  const [table, setTable] = useState(row?.table_label ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  const [source, setSource] = useState<'customer' | 'internal'>(row?.source ?? 'internal');
  const [tried, setTried] = useState(false);

  const n = /^\d+$/.test(count.trim()) ? Number(count) : 0;
  const countError = n < 1 ? t('events.kitchen.countError') : undefined;
  const contentError =
    !diet && avoid.length === 0 && note.trim() === ''
      ? t('events.kitchen.contentError')
      : undefined;
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const submit = () => {
    setTried(true);
    if (countError || contentError) return;
    onSave({
      person_count: n,
      diet,
      avoid_allergens: avoid,
      guest_name: guest.trim() || null,
      table_label: table.trim() || null,
      note: note.trim() || null,
      source,
    });
  };

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
      <TextField
        label={t('events.kitchen.count')}
        value={count}
        onChangeText={setCount}
        error={tried ? countError : undefined}
        inputMode="numeric"
        keyboardType="number-pad"
      />
      <Text variant="small" color="textSecondary">
        {t('events.kitchen.diet')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DIETS.map((d) => (
          <Chip
            key={d}
            label={t(`diet.${d}`)}
            selected={diet === d}
            onPress={() => setDiet(diet === d ? null : d)}
          />
        ))}
      </View>
      <Text variant="small" color="textSecondary">
        {t('events.kitchen.avoid')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ALLERGENS.map((a) => (
          <Chip
            key={a}
            label={t(`allergen.${a}`)}
            selected={avoid.includes(a)}
            onPress={() => setAvoid((cur) => toggle(cur, a))}
          />
        ))}
      </View>
      <TextField
        label={t('events.kitchen.guest')}
        helper={t('events.kitchen.privacy')}
        value={guest}
        onChangeText={setGuest}
      />
      <TextField label={t('events.kitchen.table')} value={table} onChangeText={setTable} />
      <TextField label={t('events.kitchen.note')} value={note} onChangeText={setNote} multiline />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip
          label={t('events.kitchen.sourceInternal')}
          selected={source === 'internal'}
          onPress={() => setSource('internal')}
        />
        <Chip
          label={t('events.kitchen.sourceCustomer')}
          selected={source === 'customer'}
          onPress={() => setSource('customer')}
        />
      </View>
      {tried && contentError ? (
        <Text variant="small" color="danger">
          {contentError}
        </Text>
      ) : null}
      <Button label={t('common.save')} loading={busy} onPress={submit} />
      {onDelete ? (
        <Button label={t('events.schedule.delete')} variant="danger" onPress={onDelete} />
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
