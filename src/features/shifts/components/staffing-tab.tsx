import {
  Ban,
  Check,
  ChevronDown,
  Clock,
  Ellipsis,
  Pencil,
  Plus,
  Send,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ActionSheet, type SheetAction } from '@/components/ui/action-sheet';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Appear } from '@/components/ui/appear';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { DateTile } from '@/components/ui/date-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Pill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { showToast } from '@/components/ui/toast';
import { transition } from '@/components/ui/transition';
import { berlinToIso, endIso, isoToBerlin } from '@/lib/berlin';
import { confirm } from '@/lib/confirm';
import { formatTime } from '@/lib/dates';
import { toAppError } from '@/lib/errors';
import { tints, tokens, type Tint } from '@/theme/tokens';

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
import { FILLED, seatsFor, slotState, staffingSummary, type SlotState } from '../staffing';
import type { Application, Slot } from '../types';

const STATE_LOOK: Record<SlotState, { tone: Tint | 'danger'; icon: typeof Send }> = {
  published: { tone: 'teal', icon: Send },
  draft: { tone: 'amber', icon: Pencil },
  waiting: { tone: 'slate', icon: Clock },
  cancelled: { tone: 'danger', icon: Ban },
};

/**
 * SC-21 – SC-24 Personal je Auftrag. Oben die Besetzung auf einen Blick, darunter je Schicht eine
 * Karte: Plätze als Kreise (besetzt mit Initialen, frei gestrichelt zum Einplanen), offene
 * Bewerbungen mit ✓/✕, alles Weitere hinter „⋯“. Neue Schichten gehen ab „optioniert“ sofort in
 * die Schichtbörse.
 */
export function StaffingTab({ event }: { event: EventRow }) {
  const { t } = useTranslation();
  const slots = useSlots(event.id);
  const list = slots.data ?? [];
  const apps = useApplications(list.map((s) => s.id));
  const allApps = apps.data ?? [];
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
  const [slotMenu, setSlotMenu] = useState<Slot | null>(null);
  const [seatMenu, setSeatMenu] = useState<Application | null>(null);

  const error = [slots, apps, save, publish, cancel, decide, assign, late].find(
    (q) => q.error,
  )?.error;
  const qName = (id: string) => qualifications.find((q) => q.id === id)?.name ?? '?';
  const mName = (id: string) => members.find((m) => m.id === id)?.display_name ?? '?';
  const open = ['optioned', 'confirmed'].includes(event.status);
  const writable = !['declined', 'cancelled', 'completed', 'invoiced'].includes(event.status);
  const summary = staffingSummary(list, allApps, open);
  const drafts = list.filter((s) => slotState(s, open) === 'draft');
  const busy = decide.isPending || late.isPending;

  const askCancel = async (s: Slot) => {
    const ok = await confirm(
      t('shifts.cancelSlotTitle'),
      t('shifts.cancelSlotBody'),
      t('shifts.cancelSlotAction'),
      t('common.cancel'),
    );
    if (ok) cancel.mutate({ id: s.id, reason: '' });
  };

  const slotActions = (s: Slot): SheetAction[] => {
    const free = seatsFor(s, allApps).some((x) => x.kind === 'free');
    return [
      { label: t('shifts.edit'), icon: Pencil, onPress: () => setEditing(s) },
      ...(free
        ? [{ label: t('shifts.assign'), icon: UserPlus, onPress: () => setAssigning(s) }]
        : []),
      ...(slotState(s, open) === 'draft'
        ? [{ label: t('shifts.publish'), icon: Send, onPress: () => publish.mutate([s.id]) }]
        : []),
      {
        label: t('shifts.cancelSlot'),
        icon: Ban,
        destructive: true,
        onPress: () => void askCancel(s),
      },
    ];
  };

  return (
    <View style={styles.tab}>
      {error ? <Banner tone="danger">{toAppError(error).message}</Banner> : null}

      {list.length > 0 ? <Overview summary={summary} /> : null}

      {drafts.length > 0 && writable ? (
        <Surface style={styles.draftBox}>
          <Text variant="small" style={{ color: tints.amber.fg }}>
            {t('shifts.draftsBanner', { count: drafts.length })}
          </Text>
          <Button
            label={t('shifts.publishNow')}
            icon={Send}
            size="sm"
            loading={publish.isPending}
            onPress={() => publish.mutate(drafts.map((s) => s.id))}
          />
        </Surface>
      ) : null}
      {!open && writable && list.some((s) => !s.cancelled_at) ? (
        <Banner tone="info">{t('shifts.waitingHint')}</Banner>
      ) : null}

      {list.length === 0 ? (
        <EmptyState icon={UserPlus} tint="indigo" text={t('shifts.slotsEmpty')} />
      ) : null}

      {list.map((s, i) => (
        <Appear key={s.id} index={i}>
          <SlotCard
            slot={s}
            state={slotState(s, open)}
            qualification={qName(s.qualification_id)}
            apps={allApps.filter((a) => a.shift_slot_id === s.id)}
            nameOf={mName}
            editable={writable && !s.cancelled_at}
            busy={busy}
            onMenu={() => setSlotMenu(s)}
            onAssign={() => setAssigning(s)}
            onSeat={setSeatMenu}
            onDecide={(a, accept) => decide.mutate({ id: a.id, accept })}
          />
        </Appear>
      ))}

      {writable ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('shifts.add')}
          onPress={() => setEditing('new')}
          scale={0.98}
          pressedStyle={{ backgroundColor: tokens.color.bgMuted }}
          style={styles.addRow}
        >
          <View style={styles.addIcon}>
            <Plus color={tokens.color.onAccent} size={18} strokeWidth={2.6} />
          </View>
          <Text variant="bodyStrong" color="accent">
            {t('shifts.add')}
          </Text>
        </PressableScale>
      ) : null}

      {editing ? (
        <SlotSheet
          key={editing === 'new' ? 'new' : editing.id}
          event={event}
          slot={editing === 'new' ? null : editing}
          qualifications={qualifications}
          busy={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(v, close) => {
            const isNew = editing === 'new';
            const publishNow = open && (isNew || !editing.published_at);
            save.mutate(
              { ...v, publish: publishNow },
              {
                onSuccess: () => {
                  showToast(
                    publishNow
                      ? t('shifts.savedPublished')
                      : isNew
                        ? t('shifts.savedWaiting')
                        : t('common.saved'),
                  );
                  close();
                },
              },
            );
          }}
        />
      ) : null}

      {slotMenu ? (
        <ActionSheet
          title={slotMenu.title}
          actions={slotActions(slotMenu)}
          onClose={() => setSlotMenu(null)}
        />
      ) : null}

      {seatMenu ? (
        <ActionSheet
          title={mName(seatMenu.member_id)}
          onClose={() => setSeatMenu(null)}
          actions={[
            {
              label: t('shifts.unassign'),
              icon: UserMinus,
              onPress: () => decide.mutate({ id: seatMenu.id, accept: false }),
            },
            {
              label: t('shifts.lateCancel'),
              icon: Clock,
              destructive: true,
              onPress: () => late.mutate({ id: seatMenu.id, reason: '' }),
            },
          ]}
        />
      ) : null}

      {assigning ? (
        <AssignSheet
          slot={assigning}
          qualificationName={qName(assigning.qualification_id)}
          members={members.filter((m) => m.role !== 'admin')}
          memberQuals={memberQuals}
          taken={allApps
            .filter(
              (a) =>
                a.shift_slot_id === assigning.id &&
                (FILLED as readonly string[]).includes(a.status),
            )
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

/** Besetzung auf einen Blick: Fortschritt und drei Zähler (besetzt, offene Bewerbungen, frei). */
function Overview({ summary }: { summary: ReturnType<typeof staffingSummary> }) {
  const { t } = useTranslation();
  const ratio = summary.seats > 0 ? summary.filled / summary.seats : 0;
  const counters: { key: string; label: string; value: number; tint: Tint; on: boolean }[] = [
    {
      key: 'filled',
      label: t('shifts.countFilled'),
      value: summary.filled,
      tint: 'teal',
      on: true,
    },
    {
      key: 'pending',
      label: t('shifts.countPending'),
      value: summary.pending,
      tint: 'amber',
      on: summary.pending > 0,
    },
    { key: 'free', label: t('shifts.countFree'), value: summary.free, tint: 'slate', on: true },
  ];
  return (
    <Surface style={styles.overview}>
      <View style={styles.overviewHead}>
        <Text variant="title2">{t('shifts.overview')}</Text>
        <Text variant="small" color="textSecondary">
          {summary.seats > 0
            ? t('shifts.filledOf', { filled: summary.filled, seats: summary.seats })
            : t('shifts.noSeats')}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            { width: `${Math.round(ratio * 100)}%` },
            transition('width', tokens.motion.slow),
          ]}
        />
      </View>
      <View style={styles.counters}>
        {counters.map((c) => (
          <View
            key={c.key}
            style={styles.counter}
            accessible
            accessibilityLabel={`${c.label}: ${c.value}`}
          >
            <View
              style={[
                styles.circle,
                { backgroundColor: c.on ? tints[c.tint].bg : tokens.color.bgMuted },
              ]}
            >
              <AnimatedNumber
                value={c.value}
                variant="title1"
                tabular
                style={{ color: c.on ? tints[c.tint].fg : tokens.color.textTertiary }}
              />
            </View>
            <Text variant="caption" color="textSecondary">
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

function SlotCard({
  slot,
  state,
  qualification,
  apps,
  nameOf,
  editable,
  busy,
  onMenu,
  onAssign,
  onSeat,
  onDecide,
}: {
  slot: Slot;
  state: SlotState;
  qualification: string;
  apps: Application[];
  nameOf: (memberId: string) => string;
  editable: boolean;
  busy: boolean;
  onMenu: () => void;
  onAssign: () => void;
  onSeat: (a: Application) => void;
  onDecide: (a: Application, accept: boolean) => void;
}) {
  const { t } = useTranslation();
  const [showPast, setShowPast] = useState(false);
  const seats = seatsFor(slot, apps);
  const filled = seats.filter((s) => s.kind === 'filled').length;
  const pending = apps.filter((a) => a.status === 'applied');
  const past = apps.filter(
    (a) => a.status !== 'applied' && !(FILLED as readonly string[]).includes(a.status),
  );
  const look = STATE_LOOK[state];
  const cancelled = state === 'cancelled';

  return (
    <Surface style={[styles.card, cancelled && styles.cardOff]}>
      <View style={styles.cardHead}>
        <DateTile date={isoToBerlin(slot.starts_at).date} muted={cancelled} />
        <View style={styles.cardTexts}>
          <Text variant="bodyStrong">{slot.title}</Text>
          <Text variant="small" color="textSecondary">
            {qualification} · {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
          </Text>
          <Pill label={t(`shifts.state.${state}`)} tone={look.tone} icon={look.icon} />
        </View>
        {editable ? (
          <IconButton
            icon={Ellipsis}
            label={t('shifts.slotActions', { title: slot.title })}
            onPress={onMenu}
          />
        ) : null}
      </View>

      <View style={styles.seatsRow}>
        <View style={styles.seats}>
          {seats.map((seat, i) =>
            seat.kind === 'filled' ? (
              <PressableScale
                key={seat.application.id}
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(seat.application.member_id)}, ${t(`shifts.status.${seat.application.status}`)}`}
                disabled={!editable}
                onPress={() => onSeat(seat.application)}
                scale={0.9}
                style={styles.seatHit}
              >
                <Avatar name={nameOf(seat.application.member_id)} size={40} />
              </PressableScale>
            ) : (
              <PressableScale
                key={`free-${i}`}
                accessibilityRole="button"
                accessibilityLabel={t('shifts.freeSeat')}
                disabled={!editable}
                onPress={onAssign}
                scale={0.9}
                style={styles.seatHit}
              >
                <View style={styles.freeSeat}>
                  {editable ? (
                    <Plus color={tokens.color.textTertiary} size={18} strokeWidth={2.2} />
                  ) : null}
                </View>
              </PressableScale>
            ),
          )}
        </View>
        <Text variant="small" color="textSecondary" tabular>
          {t('shifts.seatsTaken', { taken: filled, seats: slot.seats })}
        </Text>
      </View>

      {pending.length > 0 ? (
        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            {t('shifts.applicants').toUpperCase()}
          </Text>
          {pending.map((a) => (
            <Appear key={a.id}>
              <View style={styles.applicant}>
                <Avatar name={nameOf(a.member_id)} size={36} />
                <View style={styles.cardTexts}>
                  <Text variant="bodyStrong">{nameOf(a.member_id)}</Text>
                  {a.comment ? (
                    <Text variant="small" color="textSecondary">
                      {t('shifts.comment', { text: a.comment })}
                    </Text>
                  ) : null}
                </View>
                {editable ? (
                  <>
                    <IconButton
                      icon={X}
                      tone="danger"
                      label={t('shifts.rejectA11y', { name: nameOf(a.member_id) })}
                      disabled={busy}
                      onPress={() => onDecide(a, false)}
                    />
                    <IconButton
                      icon={Check}
                      tone="accent"
                      label={t('shifts.acceptA11y', { name: nameOf(a.member_id) })}
                      disabled={busy || filled >= slot.seats}
                      onPress={() => onDecide(a, true)}
                    />
                  </>
                ) : null}
              </View>
            </Appear>
          ))}
        </View>
      ) : null}

      {past.length > 0 ? (
        <View style={styles.section}>
          <Button
            label={t('shifts.pastApplications', { count: past.length })}
            variant="ghost"
            size="sm"
            icon={ChevronDown}
            style={styles.pastToggle}
            onPress={() => setShowPast((v) => !v)}
          />
          {showPast
            ? past.map((a) => (
                <Appear key={a.id}>
                  <View style={styles.applicant}>
                    <Avatar name={nameOf(a.member_id)} size={32} />
                    <View style={styles.cardTexts}>
                      <Text variant="body">{nameOf(a.member_id)}</Text>
                      <Text variant="small" color="textSecondary">
                        {a.late_cancellation
                          ? t('shifts.lateCancelled')
                          : t(
                              a.status === 'cancelled_by_staff'
                                ? 'shifts.adminCancelled'
                                : `shifts.status.${a.status}`,
                            )}
                      </Text>
                    </View>
                    {editable && a.status === 'rejected' && filled < slot.seats ? (
                      <Button
                        label={t('shifts.accept')}
                        size="sm"
                        variant="tonal"
                        disabled={busy}
                        onPress={() => onDecide(a, true)}
                      />
                    ) : null}
                  </View>
                </Appear>
              ))
            : null}
        </View>
      ) : null}
    </Surface>
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
    <Sheet title={t('shifts.assignTitle')} onClose={onClose}>
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
          leading={<Avatar name={m.display_name} size={40} />}
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
              leading={<Avatar name={m.display_name} size={40} />}
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
    </Sheet>
  );
}

type SlotValues = {
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
};

/** Schicht anlegen oder bearbeiten als Blatt von unten; Plätze mit − und +. */
function SlotSheet({
  event,
  slot,
  qualifications,
  busy,
  onClose,
  onSave,
}: {
  event: EventRow;
  slot: Slot | null;
  qualifications: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onSave: (v: SlotValues, close: () => void) => void;
}) {
  const { t } = useTranslation();
  const s = isoToBerlin(slot?.starts_at ?? event.starts_at);
  const e = slot ? isoToBerlin(slot.ends_at) : null;
  const [title, setTitle] = useState(slot?.title ?? '');
  const [qual, setQual] = useState(slot?.qualification_id ?? qualifications[0]?.id ?? '');
  const [date, setDate] = useState(s.date);
  const [start, setStart] = useState(s.time);
  const [end, setEnd] = useState(e?.time ?? '');
  const [seats, setSeats] = useState(slot?.seats ?? 1);
  const [meeting, setMeeting] = useState(slot?.meeting_point ?? '');
  const [dress, setDress] = useState(slot?.dress_code ?? '');
  const [notes, setNotes] = useState(slot?.notes ?? '');
  const [more, setMore] = useState(!!(slot?.meeting_point || slot?.dress_code || slot?.notes));
  const [tried, setTried] = useState(false);

  const invalid = !title.trim() || !qual || !date || !start || !end;

  const submit = (close: () => void) => {
    setTried(true);
    if (invalid) return;
    onSave(
      {
        id: slot?.id,
        event_id: event.id,
        qualification_id: qual,
        title: title.trim(),
        starts_at: berlinToIso(date, start),
        ends_at: endIso(date, start, end),
        seats,
        meeting_point: meeting,
        dress_code: dress,
        notes,
      },
      close,
    );
  };

  return (
    <Sheet
      title={slot ? t('shifts.edit') : t('shifts.add')}
      onClose={onClose}
      footer={(close) => (
        <Button label={t('common.save')} loading={busy} onPress={() => submit(() => close())} />
      )}
    >
      <TextField label={t('shifts.slotTitle')} value={title} onChangeText={setTitle} />
      <Text variant="small" color="textSecondary">
        {t('shifts.qualification')}
      </Text>
      {qualifications.length === 0 ? (
        <Text variant="small" color="danger">
          {t('shifts.noQualifications')}
        </Text>
      ) : (
        <View style={styles.chips}>
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
      <Text variant="small" color="textTertiary">
        {t('shifts.qualificationHint')}
      </Text>
      <Stepper
        label={t('shifts.seats')}
        value={seats}
        onChange={setSeats}
        min={Math.max(1, slot?.taken_seats ?? 1)}
        decreaseLabel={t('shifts.fewer')}
        increaseLabel={t('shifts.more')}
      />
      <DateField label={t('shifts.date')} value={date} onChange={setDate} />
      <View style={styles.times}>
        <View style={styles.time}>
          <TimeField label={t('shifts.start')} value={start} onChange={setStart} />
        </View>
        <View style={styles.time}>
          <TimeField label={t('shifts.end')} value={end} onChange={setEnd} />
        </View>
      </View>
      {more ? (
        <>
          <TextField label={t('shifts.meeting')} value={meeting} onChangeText={setMeeting} />
          <TextField label={t('shifts.dress')} value={dress} onChangeText={setDress} />
          <TextField label={t('shifts.notes')} value={notes} onChangeText={setNotes} multiline />
        </>
      ) : (
        <Button
          label={t('shifts.details')}
          variant="ghost"
          size="sm"
          icon={ChevronDown}
          onPress={() => setMore(true)}
        />
      )}
      {tried && invalid ? (
        <Text variant="small" color="danger">
          {t('shifts.invalid')}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tab: { gap: tokens.space[3] },
  overview: { gap: tokens.space[3], padding: tokens.space[4] },
  overviewHead: { gap: 2 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.bgMuted,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4, backgroundColor: tokens.color.accent },
  counters: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: tokens.space[1] },
  counter: { alignItems: 'center', gap: tokens.space[1] },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBox: {
    gap: tokens.space[2],
    padding: tokens.space[4],
    backgroundColor: tints.amber.bg,
    borderColor: tints.amber.bg,
  },
  card: { gap: tokens.space[3], padding: tokens.space[4] },
  cardOff: { opacity: 0.65 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space[3] },
  cardTexts: { flex: 1, gap: 4 },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[2],
    paddingTop: tokens.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
  },
  seats: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  // Kreise 40 dp, Tippfläche 44 dp.
  seatHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  freeSeat: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: tokens.space[2] },
  applicant: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  pastToggle: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  addRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[2],
    borderRadius: tokens.radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.accent,
    backgroundColor: 'transparent',
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.accent,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  times: { flexDirection: 'row', gap: tokens.space[3] },
  time: { flex: 1 },
});
