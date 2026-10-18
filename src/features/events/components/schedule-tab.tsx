import {
  CircleDot,
  Clock,
  Hammer,
  PackageCheck,
  PackageOpen,
  Plus,
  Truck,
  UtensilsCrossed,
  Wand2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/ui/appear';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { berlinToIso, endIso, isoToBerlin } from '@/lib/berlin';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { Surface } from '@/components/ui/surface';
import { tints, tokens, type Tint } from '@/theme/tokens';

import { useDeleteScheduleItem, useSaveScheduleItem, useScheduleItems } from '../api';
import { defaultSchedule } from '../schedule-default';
import { SCHEDULE_KINDS, type EventRow, type ScheduleItem } from '../types';

type Editing = { mode: 'new' } | { mode: 'edit'; item: ScheduleItem };

/** SC-26 Zeitplan: Zeitleiste mit Typ, Beginn–Ende und Notiz; admin bearbeitet, Küche liest. */
export function ScheduleTab({ event, isAdmin }: { event: EventRow; isAdmin: boolean }) {
  const { t } = useTranslation();
  const items = useScheduleItems(event.id);
  const save = useSaveScheduleItem();
  const del = useDeleteScheduleItem();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [seeding, setSeeding] = useState(false);
  const editable = isAdmin && !['declined', 'cancelled', 'invoiced'].includes(event.status);

  const seed = async () => {
    setSeeding(true);
    try {
      for (const i of defaultSchedule(event.starts_at, event.ends_at)) {
        await save.mutateAsync({
          eventId: event.id,
          values: {
            kind: i.kind,
            label: null,
            starts_at: i.starts_at,
            ends_at: i.ends_at,
            notes: null,
          },
        });
      }
    } catch {
      // Fehler steht in save.error
    } finally {
      setSeeding(false);
    }
  };

  const error = items.error ?? save.error ?? del.error;
  const list = items.data ?? [];
  // Datum nur zeigen, wenn der Ablauf über mehrere Tage geht.
  const multiDay = new Set(list.map((i) => isoToBerlin(i.starts_at).date)).size > 1;

  return (
    <View style={styles.tab}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {list.length === 0 ? (
        <EmptyState icon={Clock} tint="sky" text={t('events.schedule.empty')} />
      ) : null}

      {list.length > 0 ? (
        <Surface style={styles.timeline}>
          {list.map((i, n) => {
            const look = KIND_LOOK[i.kind];
            const last = n === list.length - 1;
            return (
              <Appear key={i.id} index={n}>
                <PressableScale
                  accessibilityRole={editable ? 'button' : undefined}
                  accessibilityLabel={`${formatTime(i.starts_at)} ${t(`events.schedule.kind.${i.kind}`)}${i.label ? ` ${i.label}` : ''}`}
                  disabled={!editable}
                  onPress={() => setEditing({ mode: 'edit', item: i })}
                  scale={0.985}
                  pressedStyle={{ backgroundColor: tokens.color.bgSubtle }}
                  style={styles.entry}
                >
                  <View style={styles.timeCol}>
                    <Text variant="bodyStrong" tabular>
                      {formatTime(i.starts_at)}
                    </Text>
                    {i.ends_at ? (
                      <Text variant="small" color="textTertiary" tabular>
                        {formatTime(i.ends_at)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: tints[look.tint].bg }]}>
                      <look.icon color={tints[look.tint].fg} size={16} strokeWidth={2.2} />
                    </View>
                    {!last ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.entryText}>
                    <Text variant="bodyStrong">
                      {t(`events.schedule.kind.${i.kind}`)}
                      {i.label ? ` · ${i.label}` : ''}
                    </Text>
                    {multiDay ? (
                      <Text variant="small" color="textSecondary">
                        {formatDate(i.starts_at)}
                      </Text>
                    ) : null}
                    {i.notes ? (
                      <Text variant="small" color="textSecondary">
                        {i.notes}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              </Appear>
            );
          })}
        </Surface>
      ) : null}

      {editable ? (
        <View style={styles.actions}>
          <Button
            label={t('events.schedule.add')}
            icon={Plus}
            variant="tonal"
            style={styles.flex}
            onPress={() => setEditing({ mode: 'new' })}
          />
          {list.length === 0 ? (
            <Button
              label={t('events.schedule.default')}
              icon={Wand2}
              variant="secondary"
              style={styles.flex}
              loading={seeding}
              onPress={() => void seed()}
            />
          ) : null}
        </View>
      ) : null}

      {editing ? (
        <ItemForm
          key={editing.mode === 'edit' ? editing.item.id : 'new'}
          event={event}
          editing={editing}
          busy={save.isPending || del.isPending}
          onCancel={() => setEditing(null)}
          onSave={(values, close) =>
            save.mutate(
              {
                eventId: event.id,
                id: editing.mode === 'edit' ? editing.item.id : undefined,
                values,
              },
              { onSuccess: () => close() },
            )
          }
          onDelete={
            editing.mode === 'edit'
              ? (close) => del.mutate(editing.item.id, { onSuccess: () => close() })
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function ItemForm({
  event,
  editing,
  busy,
  onCancel,
  onSave,
  onDelete,
}: {
  event: EventRow;
  editing: Editing;
  busy: boolean;
  onCancel: () => void;
  onSave: (
    v: {
      kind: ScheduleItem['kind'];
      label: string | null;
      starts_at: string;
      ends_at: string | null;
      notes: string | null;
    },
    close: () => void,
  ) => void;
  onDelete?: (close: () => void) => void;
}) {
  const { t } = useTranslation();
  const item = editing.mode === 'edit' ? editing.item : null;
  const s = isoToBerlin(item?.starts_at ?? event.starts_at);
  const e = item?.ends_at ? isoToBerlin(item.ends_at) : null;
  const [kind, setKind] = useState<ScheduleItem['kind']>(item?.kind ?? 'setup');
  const [label, setLabel] = useState(item?.label ?? '');
  const [date, setDate] = useState(s.date);
  const [start, setStart] = useState(s.time);
  const [end, setEnd] = useState(e?.time ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [tried, setTried] = useState(false);

  const isoDate = date || null;
  const startOk = start || null;
  const endOk = end || null;
  const invalid = !isoDate || !startOk;

  const submit = (close: () => void) => {
    setTried(true);
    if (invalid || !isoDate || !startOk) return;
    onSave(
      {
        kind,
        label: label.trim() || null,
        starts_at: berlinToIso(isoDate, startOk),
        ends_at: endOk ? endIso(isoDate, startOk, endOk) : null,
        notes: notes.trim() || null,
      },
      close,
    );
  };

  return (
    <Sheet
      title={item ? t('events.schedule.edit') : t('events.schedule.add')}
      onClose={onCancel}
      footer={(close) => (
        <>
          <Button
            label={t('events.schedule.save')}
            loading={busy}
            onPress={() => submit(() => close())}
          />
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
      <View style={styles.chips}>
        {SCHEDULE_KINDS.map((k) => (
          <Chip
            key={k}
            label={t(`events.schedule.kind.${k}`)}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <TextField label={t('events.schedule.label')} value={label} onChangeText={setLabel} />
      <DateField
        label={t('events.schedule.date')}
        value={date}
        onChange={setDate}
        error={tried && !isoDate ? t('events.schedule.error') : undefined}
      />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <TimeField
            label={t('events.schedule.start')}
            value={start}
            onChange={setStart}
            error={tried && !startOk ? t('events.schedule.error') : undefined}
          />
        </View>
        <View style={styles.flex}>
          <TimeField
            label={t('events.schedule.end')}
            value={end}
            onChange={setEnd}
            optional
            defaultHour={14}
          />
        </View>
      </View>
      <TextField
        label={t('events.schedule.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
    </Sheet>
  );
}

// Symbol und Ton je Art des Eintrags: Die Zeitleiste lässt sich so auf einen Blick lesen.
const KIND_LOOK: Record<ScheduleItem['kind'], { icon: LucideIcon; tint: Tint }> = {
  departure: { icon: Truck, tint: 'indigo' },
  delivery: { icon: PackageCheck, tint: 'sky' },
  setup: { icon: Hammer, tint: 'amber' },
  service: { icon: UtensilsCrossed, tint: 'teal' },
  teardown: { icon: PackageOpen, tint: 'slate' },
  other: { icon: CircleDot, tint: 'violet' },
};

const styles = StyleSheet.create({
  tab: { gap: tokens.space[3] },
  flex: { flex: 1 },
  timeline: { paddingVertical: tokens.space[2], paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  entry: {
    flexDirection: 'row',
    gap: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    minHeight: 64,
  },
  timeCol: { width: 52, paddingTop: tokens.space[2], alignItems: 'flex-end' },
  rail: { width: 32, alignItems: 'center' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.space[1],
  },
  line: { flex: 1, width: 2, backgroundColor: tokens.color.border, marginVertical: 2 },
  entryText: { flex: 1, gap: 2, paddingTop: tokens.space[2], paddingBottom: tokens.space[4] },
  actions: { flexDirection: 'row', gap: tokens.space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
});
