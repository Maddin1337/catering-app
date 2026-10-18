import { ChevronRight, Plus, Salad, StickyNote } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { Appear } from '@/components/ui/appear';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { PickerSheet } from '@/components/ui/picker-sheet';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ALLERGENS, DIETS, type Allergen, type Diet } from '@/lib/dietary';
import { toAppError } from '@/lib/errors';
import { Surface } from '@/components/ui/surface';
import { transition } from '@/components/ui/transition';
import { tints, tokens } from '@/theme/tokens';

import { useDishes, usePackageDishLines } from '../../catalog/api';
import { AllergenCodes } from '../../catalog/components/allergen-codes';
import { useKitchenLines } from '../../kitchen/api';
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

  const guests = event.guest_count ?? 0;

  return (
    <View style={styles.tab}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {event.kitchen_notes ? (
        <Surface style={styles.note}>
          <View style={styles.noteHead}>
            <StickyNote color={tints.amber.fg} size={18} strokeWidth={2.2} />
            <Text variant="caption" style={{ color: tints.amber.fg }}>
              {t('events.detail.kitchenNotes').toUpperCase()}
            </Text>
          </View>
          <Text variant="body">{event.kitchen_notes}</Text>
        </Surface>
      ) : null}

      <Surface style={styles.summary}>
        <View style={styles.summaryHead}>
          <View style={styles.flex}>
            <Text variant="title2">{t('events.kitchen.title')}</Text>
            {guests > 0 ? (
              <Text variant="small" color="textSecondary">
                {t('events.kitchen.sum', { count: total, guests })}
              </Text>
            ) : null}
          </View>
          <View style={[styles.bubble, { backgroundColor: tints.rose.bg }]}>
            <AnimatedNumber
              value={total}
              variant="title1"
              tabular
              style={{ color: tints.rose.fg }}
            />
          </View>
        </View>
        {guests > 0 ? (
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.bar,
                { width: `${Math.min(100, Math.round((total / guests) * 100))}%` },
                transition('width', tokens.motion.slow),
              ]}
            />
          </View>
        ) : null}
      </Surface>

      {rows.length === 0 ? (
        <EmptyState icon={Salad} tint="rose" text={t('events.kitchen.empty')} />
      ) : (
        <Surface padded={false} style={styles.list}>
          {rows.map((r, i) => (
            <Appear key={r.id} index={i}>
              <PressableScale
                accessibilityRole={writable ? 'button' : undefined}
                disabled={!writable}
                onPress={() => setEditing({ mode: 'edit', row: r })}
                scale={0.985}
                pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
                style={[styles.row, i > 0 && styles.divider]}
              >
                <View
                  style={[styles.count, { backgroundColor: tints[r.diet ? 'teal' : 'rose'].bg }]}
                >
                  <Text
                    variant="bodyStrong"
                    tabular
                    style={{ color: tints[r.diet ? 'teal' : 'rose'].fg }}
                  >
                    {`${r.person_count}×`}
                  </Text>
                </View>
                <View style={styles.flexGap}>
                  <Text variant="bodyStrong">
                    {r.diet ? t(`diet.${r.diet}`) : t('events.kitchen.allergy')}
                  </Text>
                  {[r.guest_name, r.table_label, r.note].some(Boolean) ? (
                    <Text variant="small" color="textSecondary">
                      {[r.guest_name, r.table_label, r.note].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {r.avoid_allergens.length > 0 || r.is_short_notice ? (
                    <View style={styles.tags}>
                      <AllergenCodes allergens={r.avoid_allergens} />
                      {r.is_short_notice ? (
                        <Pill label={t('events.kitchen.shortNotice')} tone="danger" />
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {writable ? (
                  <ChevronRight color={tokens.color.textTertiary} size={18} strokeWidth={2.2} />
                ) : null}
              </PressableScale>
            </Appear>
          ))}
        </Surface>
      )}

      {writable ? (
        <Button
          label={t('events.kitchen.add')}
          icon={Plus}
          variant="tonal"
          onPress={() => setEditing({ mode: 'new' })}
        />
      ) : null}

      {editing ? (
        <DietaryForm
          key={editing.mode === 'edit' ? editing.row.id : 'new'}
          editing={editing}
          busy={save.isPending || del.isPending}
          onCancel={() => setEditing(null)}
          eventId={event.id}
          onSave={(values, close) =>
            save.mutate(
              {
                eventId: event.id,
                id: editing.mode === 'edit' ? editing.row.id : undefined,
                values,
              },
              { onSuccess: () => close() },
            )
          }
          onDelete={
            editing.mode === 'edit'
              ? (close) => del.mutate(editing.row.id, { onSuccess: () => close() })
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function DietaryForm({
  eventId,
  editing,
  busy,
  onCancel,
  onSave,
  onDelete,
}: {
  eventId: string;
  editing: Editing;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: DietaryInput, close: () => void) => void;
  onDelete?: (close: () => void) => void;
}) {
  const { t } = useTranslation();
  const row = editing.mode === 'edit' ? editing.row : null;
  const [count, setCount] = useState(row?.person_count ?? 1);
  const [diet, setDiet] = useState<Diet | null>(row?.diet ?? null);
  const [avoid, setAvoid] = useState<Allergen[]>(row?.avoid_allergens ?? []);
  const [guest, setGuest] = useState(row?.guest_name ?? '');
  const [table, setTable] = useState(row?.table_label ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  const [source, setSource] = useState<'customer' | 'internal'>(row?.source ?? 'internal');
  const [subs, setSubs] = useState(row?.substitutions ?? []);
  const [tried, setTried] = useState(false);

  const n = count;
  const contentError =
    !diet && avoid.length === 0 && note.trim() === ''
      ? t('events.kitchen.contentError')
      : undefined;
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const submit = (close: () => void) => {
    setTried(true);
    if (contentError) return;
    onSave(
      {
        person_count: n,
        diet,
        avoid_allergens: avoid,
        guest_name: guest.trim() || null,
        table_label: table.trim() || null,
        note: note.trim() || null,
        source,
        substitutions: subs,
      },
      close,
    );
  };

  return (
    <Sheet
      title={row ? t('events.kitchen.edit') : t('events.kitchen.add')}
      onClose={onCancel}
      footer={(close) => (
        <>
          <Button label={t('common.save')} loading={busy} onPress={() => submit(() => close())} />
          {onDelete ? (
            <Button
              label={t('events.schedule.delete')}
              variant="danger"
              onPress={() => onDelete(() => close())}
            />
          ) : null}
        </>
      )}
    >
      <Stepper
        label={t('events.kitchen.count')}
        value={count}
        onChange={setCount}
        decreaseLabel={t('shifts.fewer')}
        increaseLabel={t('shifts.more')}
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
      <Substitutions eventId={eventId} value={subs} onChange={setSubs} />
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
    </Sheet>
  );
}

/** Ersatzgerichte: „statt Gericht A gibt es Gericht B“; A stammt aus dem Angebot des Auftrags, B aus dem Katalog. */
function Substitutions({
  eventId,
  value,
  onChange,
}: {
  eventId: string;
  value: DietaryRow['substitutions'];
  onChange: (v: DietaryRow['substitutions']) => void;
}) {
  const { t } = useTranslation();
  const dishes = useDishes().data ?? [];
  const lines = useKitchenLines().data ?? [];
  const packageLines = usePackageDishLines().data ?? [];
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const name = (id: string) => dishes.find((d) => d.id === id)?.name ?? '?';

  const orderedIds = new Set<string>();
  for (const l of lines.filter((x) => x.event_id === eventId)) {
    if (l.dish_id) orderedIds.add(l.dish_id);
    else if (l.menu_package_id)
      packageLines
        .filter((p) => p.menu_package_id === l.menu_package_id)
        .forEach((p) => orderedIds.add(p.dish_id));
  }
  const fromOptions = dishes.filter((d) => orderedIds.has(d.id));
  const toOptions = dishes.filter((d) => !d.archived_at && d.id !== from);

  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" color="textSecondary">
        {t('events.kitchen.substitutes')}
      </Text>
      {value.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('events.kitchen.substitutesNone')}
        </Text>
      ) : null}
      {value.map((s, i) => (
        <View
          key={`${s.from_dish_id}-${s.to_dish_id}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Text variant="body" style={{ flex: 1 }}>
            {t('events.kitchen.substitute', { to: name(s.to_dish_id), from: name(s.from_dish_id) })}
          </Text>
          <Button
            label={t('events.kitchen.substituteRemove')}
            variant="ghost"
            onPress={() => onChange(value.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <Button
        label={t('events.kitchen.substituteAdd')}
        variant="secondary"
        onPress={() => setOpen(true)}
      />
      {open ? (
        <PickerSheet
          title={from ? t('events.kitchen.substituteTo') : t('events.kitchen.substituteFrom')}
          onClose={() => {
            setOpen(false);
            setFrom(null);
          }}
        >
          {from === null ? (
            fromOptions.length === 0 ? (
              <Text variant="body" color="textSecondary">
                {t('events.kitchen.substituteNoDishes')}
              </Text>
            ) : (
              fromOptions.map((d) => (
                <ListRow key={d.id} title={d.name} onPress={() => setFrom(d.id)} />
              ))
            )
          ) : (
            toOptions.map((d) => (
              <ListRow
                key={d.id}
                title={d.name}
                right={<AllergenCodes allergens={d.allergens} />}
                onPress={() => {
                  if (!value.some((s) => s.from_dish_id === from && s.to_dish_id === d.id))
                    onChange([...value, { from_dish_id: from, to_dish_id: d.id }]);
                  setOpen(false);
                  setFrom(null);
                }}
              />
            ))
          )}
        </PickerSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: tokens.space[3] },
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: 4 },
  note: {
    gap: tokens.space[1],
    padding: tokens.space[4],
    backgroundColor: tints.amber.bg,
    borderColor: tints.amber.bg,
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  summary: { gap: tokens.space[3], padding: tokens.space[4] },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 8, borderRadius: 4, backgroundColor: tokens.color.bgMuted, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: tints.rose.fg },
  list: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    minHeight: 64,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.border },
  count: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2], alignItems: 'center' },
});
