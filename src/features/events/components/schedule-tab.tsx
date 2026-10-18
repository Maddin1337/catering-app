import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import {
  berlinToIso,
  endIso,
  formatGermanDate,
  isoToBerlin,
  parseGermanDate,
  parseTime,
} from '@/lib/berlin';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

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

  return (
    <View style={{ gap: 12 }}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <ItemForm
          key={editing.mode === 'edit' ? editing.item.id : 'new'}
          event={event}
          editing={editing}
          busy={save.isPending || del.isPending}
          onCancel={() => setEditing(null)}
          onSave={(values) =>
            save.mutate(
              {
                eventId: event.id,
                id: editing.mode === 'edit' ? editing.item.id : undefined,
                values,
              },
              { onSuccess: () => setEditing(null) },
            )
          }
          onDelete={
            editing.mode === 'edit'
              ? () => del.mutate(editing.item.id, { onSuccess: () => setEditing(null) })
              : undefined
          }
        />
      ) : (
        <>
          {list.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('events.schedule.empty')}
            </Text>
          ) : null}
          {list.map((i) => (
            <ListRow
              key={i.id}
              title={`${t(`events.schedule.kind.${i.kind}`)}${i.label ? ` · ${i.label}` : ''}`}
              subtitle={`${formatDate(i.starts_at)} · ${formatTime(i.starts_at)}${i.ends_at ? `–${formatTime(i.ends_at)}` : ''}${i.notes ? ` · ${i.notes}` : ''}`}
              onPress={editable ? () => setEditing({ mode: 'edit', item: i }) : undefined}
            />
          ))}
          {editable ? (
            <Button label={t('events.schedule.add')} onPress={() => setEditing({ mode: 'new' })} />
          ) : null}
          {editable && list.length === 0 ? (
            <Button
              label={t('events.schedule.default')}
              variant="secondary"
              loading={seeding}
              onPress={() => void seed()}
            />
          ) : null}
        </>
      )}
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
  onSave: (v: {
    kind: ScheduleItem['kind'];
    label: string | null;
    starts_at: string;
    ends_at: string | null;
    notes: string | null;
  }) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const item = editing.mode === 'edit' ? editing.item : null;
  const s = isoToBerlin(item?.starts_at ?? event.starts_at);
  const e = item?.ends_at ? isoToBerlin(item.ends_at) : null;
  const [kind, setKind] = useState<ScheduleItem['kind']>(item?.kind ?? 'setup');
  const [label, setLabel] = useState(item?.label ?? '');
  const [date, setDate] = useState(formatGermanDate(s.date));
  const [start, setStart] = useState(s.time);
  const [end, setEnd] = useState(e?.time ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [tried, setTried] = useState(false);

  const isoDate = parseGermanDate(date);
  const startOk = parseTime(start);
  const endOk = end.trim() === '' ? null : parseTime(end);
  const invalid = !isoDate || !startOk || (end.trim() !== '' && !endOk);

  const submit = () => {
    setTried(true);
    if (invalid || !isoDate || !startOk) return;
    onSave({
      kind,
      label: label.trim() || null,
      starts_at: berlinToIso(isoDate, startOk),
      ends_at: endOk ? endIso(isoDate, startOk, endOk) : null,
      notes: notes.trim() || null,
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
      <TextField
        label={t('events.schedule.date')}
        value={date}
        onChangeText={setDate}
        error={tried && !isoDate ? t('events.schedule.error') : undefined}
      />
      <TextField
        label={t('events.schedule.start')}
        value={start}
        onChangeText={setStart}
        error={tried && !startOk ? t('events.schedule.error') : undefined}
      />
      <TextField
        label={t('events.schedule.end')}
        value={end}
        onChangeText={setEnd}
        error={tried && end.trim() !== '' && !endOk ? t('events.schedule.error') : undefined}
      />
      <TextField
        label={t('events.schedule.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Button label={t('events.schedule.save')} loading={busy} onPress={submit} />
      {onDelete ? (
        <Button label={t('events.schedule.delete')} variant="danger" onPress={onDelete} />
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
