import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { ListRow } from '@/components/ui/list-row';
import { PickerSheet } from '@/components/ui/picker-sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { berlinToIso, endIso, isoToBerlin } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import { formatDate, formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tokens } from '@/theme/tokens';

import type { EventRow } from '../../events/types';
import { useQualifications, useTeamMembers } from '../../team/api';
import {
  useAllMemberQualifications,
  useApplications,
  useAssignMember,
  useCancelSlot,
  useDecideApplication,
  useLateCancellation,
  usePublishSlots,
  useSaveSlot,
  useSlots,
} from '../api';
import type { Application, Slot } from '../types';

const ACTIVE = ['accepted', 'assigned'];

/** SC-21 – SC-24 Personal je Auftrag: Schichten anlegen, veröffentlichen, Bewerbungen entscheiden, einplanen. */
export function StaffingTab({ event }: { event: EventRow }) {
  const { t } = useTranslation();
  const slots = useSlots(event.id);
  const list = slots.data ?? [];
  const apps = useApplications(list.map((s) => s.id));
  const qualifications = useQualifications().data ?? [];
  const members = useTeamMembers().data ?? [];
  const memberQuals = useAllMemberQualifications().data ?? [];
  const save = useSaveSlot();
  const publish = usePublishSlots();
  const cancel = useCancelSlot();
  const decide = useDecideApplication();
  const assign = useAssignMember();
  const late = useLateCancellation();
  const [editing, setEditing] = useState<Slot | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Slot | null>(null);

  const error = [slots, apps, save, publish, cancel, decide, assign, late].find(
    (q) => q.error,
  )?.error;
  const qName = (id: string) => qualifications.find((q) => q.id === id)?.name ?? '?';
  const mName = (id: string) => members.find((m) => m.id === id)?.display_name ?? '?';
  const open = ['optioned', 'confirmed'].includes(event.status);
  const writable = !['declined', 'cancelled', 'completed', 'invoiced'].includes(event.status);
  const drafts = list.filter((s) => !s.published_at && !s.cancelled_at);

  return (
    <View style={{ gap: 12 }}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}
      {editing ? (
        <SlotForm
          key={editing === 'new' ? 'new' : editing.id}
          event={event}
          slot={editing === 'new' ? null : editing}
          qualifications={qualifications}
          busy={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(v) => save.mutate(v, { onSuccess: () => setEditing(null) })}
        />
      ) : (
        <>
          {list.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('shifts.slotsEmpty')}
            </Text>
          ) : null}
          {list.map((s) => {
            const forSlot = (apps.data ?? []).filter((a) => a.shift_slot_id === s.id);
            return (
              <View
                key={s.id}
                style={{
                  gap: 8,
                  padding: tokens.space[3],
                  borderWidth: 1,
                  borderColor: tokens.color.border,
                  borderRadius: tokens.radius.md,
                }}
              >
                <ListRow
                  title={`${s.title} · ${qName(s.qualification_id)}`}
                  subtitle={`${formatDate(s.starts_at)} · ${formatTime(s.starts_at)}–${formatTime(s.ends_at)} · ${t('shifts.seatsTaken', { taken: s.taken_seats, seats: s.seats })}`}
                  right={
                    <Text variant="caption" color={s.cancelled_at ? 'danger' : 'textSecondary'}>
                      {s.cancelled_at
                        ? t('shifts.calledOff')
                        : s.published_at
                          ? t('shifts.published')
                          : t('shifts.draft')}
                    </Text>
                  }
                  onPress={!s.cancelled_at && writable ? () => setEditing(s) : undefined}
                />
                {forSlot.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text variant="small" color="textSecondary">
                      {t('shifts.applicants')}
                    </Text>
                    {forSlot.map((a) => (
                      <ApplicationRow
                        key={a.id}
                        app={a}
                        name={mName(a.member_id)}
                        disabled={!!s.cancelled_at || !writable}
                        busy={decide.isPending || late.isPending}
                        onAccept={() => decide.mutate({ id: a.id, accept: true })}
                        onReject={() => decide.mutate({ id: a.id, accept: false })}
                        onLate={() => late.mutate({ id: a.id, reason: '' })}
                      />
                    ))}
                  </View>
                ) : null}
                {!s.cancelled_at && writable ? (
                  <View style={{ gap: 8 }}>
                    {open ? (
                      <Button
                        label={t('shifts.assign')}
                        variant="secondary"
                        onPress={() => setAssigning(s)}
                      />
                    ) : null}
                    {!s.published_at ? (
                      <Button
                        label={t('shifts.publish')}
                        disabled={!open}
                        loading={publish.isPending}
                        onPress={() => publish.mutate([s.id])}
                      />
                    ) : null}
                    <Button
                      label={t('shifts.cancelSlot')}
                      variant="ghost"
                      onPress={async () => {
                        const ok = await confirm(
                          t('shifts.cancelSlotTitle'),
                          t('shifts.cancelSlotBody'),
                          t('shifts.cancelSlotAction'),
                          t('common.cancel'),
                        );
                        if (ok) cancel.mutate({ id: s.id, reason: '' });
                      }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          {drafts.length > 1 && open ? (
            <Button
              label={t('shifts.publishAll')}
              loading={publish.isPending}
              onPress={() => publish.mutate(drafts.map((s) => s.id))}
            />
          ) : null}
          {!open && drafts.length > 0 ? (
            <Text variant="small" color="textSecondary">
              {t('shifts.publishHint')}
            </Text>
          ) : null}
          {writable ? <Button label={t('shifts.add')} onPress={() => setEditing('new')} /> : null}
        </>
      )}

      {assigning ? (
        <AssignSheet
          slot={assigning}
          qualificationName={qName(assigning.qualification_id)}
          members={members.filter((m) => m.role !== 'admin')}
          memberQuals={memberQuals}
          taken={(apps.data ?? [])
            .filter((a) => a.shift_slot_id === assigning.id && ACTIVE.includes(a.status))
            .map((a) => a.member_id)}
          onClose={() => setAssigning(null)}
          onAssign={(memberId, ignore) =>
            assign.mutate(
              { slotId: assigning.id, memberId, ignoreQualification: ignore },
              { onSuccess: () => setAssigning(null) },
            )
          }
        />
      ) : null}
    </View>
  );
}

function ApplicationRow({
  app,
  name,
  disabled,
  busy,
  onAccept,
  onReject,
  onLate,
}: {
  app: Application;
  name: string;
  disabled: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onLate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {name}
        </Text>
        <Text variant="small" color="textSecondary">
          {app.late_cancellation
            ? t('shifts.lateCancelled')
            : t(
                app.status === 'cancelled_by_staff'
                  ? 'shifts.adminCancelled'
                  : `shifts.status.${app.status}`,
              )}
        </Text>
      </View>
      {app.comment ? (
        <Text variant="small" color="textSecondary">
          {t('shifts.comment', { text: app.comment })}
        </Text>
      ) : null}
      {!disabled ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {app.status === 'applied' || app.status === 'rejected' ? (
            <Button label={t('shifts.accept')} disabled={busy} onPress={onAccept} />
          ) : null}
          {app.status === 'applied' ? (
            <Button
              label={t('shifts.reject')}
              variant="secondary"
              disabled={busy}
              onPress={onReject}
            />
          ) : null}
          {ACTIVE.includes(app.status) ? (
            <>
              <Button
                label={t('shifts.unassign')}
                variant="secondary"
                disabled={busy}
                onPress={onReject}
              />
              <Button
                label={t('shifts.lateCancel')}
                variant="ghost"
                disabled={busy}
                onPress={onLate}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AssignSheet({
  slot,
  qualificationName,
  members,
  memberQuals,
  taken,
  onClose,
  onAssign,
}: {
  slot: Slot;
  qualificationName: string;
  members: { id: string; display_name: string }[];
  memberQuals: { member_id: string; qualification_id: string }[];
  taken: string[];
  onClose: () => void;
  onAssign: (memberId: string, ignoreQualification: boolean) => void;
}) {
  const { t } = useTranslation();
  const has = (memberId: string) =>
    memberQuals.some(
      (q) => q.member_id === memberId && q.qualification_id === slot.qualification_id,
    );
  const free = members.filter((m) => !taken.includes(m.id));
  const fitting = free.filter((m) => has(m.id));
  const others = free.filter((m) => !has(m.id));
  return (
    <PickerSheet title={t('shifts.assignTitle')} onClose={onClose}>
      {fitting.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('shifts.assignNoMatch')}
        </Text>
      ) : null}
      {fitting.map((m) => (
        <ListRow
          key={m.id}
          title={m.display_name}
          subtitle={qualificationName}
          onPress={() => onAssign(m.id, false)}
        />
      ))}
      {others.length > 0 ? (
        <>
          <Text variant="small" color="textSecondary">
            {t('shifts.assignOther')}
          </Text>
          {others.map((m) => (
            <ListRow
              key={m.id}
              title={m.display_name}
              onPress={async () => {
                const ok = await confirm(
                  t('shifts.assignOverrideTitle'),
                  t('shifts.assignOverrideBody', {
                    name: m.display_name,
                    qualification: qualificationName,
                  }),
                  t('shifts.assignOverrideAction'),
                  t('common.cancel'),
                );
                if (ok) onAssign(m.id, true);
              }}
            />
          ))}
        </>
      ) : null}
    </PickerSheet>
  );
}

function SlotForm({
  event,
  slot,
  qualifications,
  busy,
  onCancel,
  onSave,
}: {
  event: EventRow;
  slot: Slot | null;
  qualifications: { id: string; name: string }[];
  busy: boolean;
  onCancel: () => void;
  onSave: (v: {
    id?: string;
    event_id: string;
    qualification_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    seats: number;
    meeting_point: string;
    dress_code: string;
    notes: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const s = isoToBerlin(slot?.starts_at ?? event.starts_at);
  const e = slot ? isoToBerlin(slot.ends_at) : null;
  const [title, setTitle] = useState(slot?.title ?? '');
  const [qual, setQual] = useState(slot?.qualification_id ?? '');
  const [date, setDate] = useState(s.date);
  const [start, setStart] = useState(s.time);
  const [end, setEnd] = useState(e?.time ?? '');
  const [seats, setSeats] = useState(String(slot?.seats ?? 1));
  const [meeting, setMeeting] = useState(slot?.meeting_point ?? '');
  const [dress, setDress] = useState(slot?.dress_code ?? '');
  const [notes, setNotes] = useState(slot?.notes ?? '');
  const [tried, setTried] = useState(false);

  const n = /^\d+$/.test(seats.trim()) ? Number(seats) : 0;
  const invalid = !title.trim() || !qual || !date || !start || !end || n < 1 || n > 100;

  const submit = () => {
    setTried(true);
    if (invalid) return;
    onSave({
      id: slot?.id,
      event_id: event.id,
      qualification_id: qual,
      title: title.trim(),
      starts_at: berlinToIso(date, start),
      ends_at: endIso(date, start, end),
      seats: n,
      meeting_point: meeting,
      dress_code: dress,
      notes,
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
      <Text variant="title2">{slot ? t('shifts.edit') : t('shifts.add')}</Text>
      <TextField label={t('shifts.slotTitle')} value={title} onChangeText={setTitle} />
      <Text variant="small" color="textSecondary">
        {t('shifts.qualification')}
      </Text>
      {qualifications.length === 0 ? (
        <Text variant="small" color="danger">
          {t('shifts.noQualifications')}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {qualifications.map((q) => (
            <Chip
              key={q.id}
              label={q.name}
              selected={qual === q.id}
              onPress={() => setQual(q.id)}
            />
          ))}
        </View>
      )}
      <Text variant="small" color="textSecondary">
        {t('shifts.qualificationHint')}
      </Text>
      <DateField label={t('shifts.date')} value={date} onChange={setDate} />
      <TimeField label={t('shifts.start')} value={start} onChange={setStart} />
      <TimeField label={t('shifts.end')} value={end} onChange={setEnd} />
      <TextField
        label={t('shifts.seats')}
        value={seats}
        onChangeText={setSeats}
        keyboardType="number-pad"
      />
      <TextField label={t('shifts.meeting')} value={meeting} onChangeText={setMeeting} />
      <TextField label={t('shifts.dress')} value={dress} onChangeText={setDress} />
      <TextField label={t('shifts.notes')} value={notes} onChangeText={setNotes} multiline />
      {tried && invalid ? (
        <Text variant="small" color="danger">
          {t('shifts.invalid')}
        </Text>
      ) : null}
      <Button label={t('common.save')} loading={busy} onPress={submit} />
      <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </View>
  );
}
