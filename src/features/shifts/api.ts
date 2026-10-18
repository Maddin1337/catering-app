import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { Application, BoardSlot, MyShift, Slot } from './types';

// Einziger Ort für Supabase-Aufrufe der Schichtbörse (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw toAppError(error);
  return data as T;
}

const SLOT =
  'id, event_id, qualification_id, title, starts_at, ends_at, seats, taken_seats, meeting_point, dress_code, notes, published_at, cancelled_at, cancel_reason';

/** Schichten eines Auftrags (admin). */
export function useSlots(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'slots', eventId],
    enabled: !!eventId && m?.role === 'admin',
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await client()
        .from('shift_slots')
        .select(SLOT)
        .eq('event_id', eventId!)
        .order('starts_at');
      if (error) throw toAppError(error);
      return (data ?? []) as Slot[];
    },
  });
}

/** Bewerbungen und Einplanungen zu den Schichten eines Auftrags (admin). */
export function useApplications(slotIds: string[]) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'applications', slotIds.join(',')],
    enabled: slotIds.length > 0 && m?.role === 'admin',
    queryFn: async (): Promise<Application[]> => {
      const { data, error } = await client()
        .from('shift_applications')
        .select(
          'id, shift_slot_id, member_id, status, comment, applied_at, late_cancellation, status_note',
        )
        .in('shift_slot_id', slotIds)
        .order('applied_at');
      if (error) throw toAppError(error);
      return (data ?? []) as Application[];
    },
  });
}

/** Qualifikationen aller Mitglieder (admin): zeigt beim Einplanen, wer passt. */
export function useAllMemberQualifications() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'member-qualifications', m?.company_id],
    enabled: m?.role === 'admin',
    queryFn: async (): Promise<{ member_id: string; qualification_id: string }[]> => {
      const { data, error } = await client()
        .from('member_qualifications')
        .select('member_id, qualification_id');
      if (error) throw toAppError(error);
      return (data ?? []) as { member_id: string; qualification_id: string }[];
    },
  });
}

export function useShiftBoard() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'board', m?.id],
    enabled: m?.role === 'staff' || m?.role === 'kitchen',
    queryFn: async (): Promise<BoardSlot[]> => {
      const { data, error } = await client().from('shift_board').select('*').order('starts_at');
      if (error) throw toAppError(error);
      return (data ?? []) as BoardSlot[];
    },
  });
}

export function useMyShifts() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'mine', m?.id],
    enabled: !!m,
    queryFn: async (): Promise<MyShift[]> => {
      const { data, error } = await client().from('my_shifts').select('*').order('starts_at');
      if (error) throw toAppError(error);
      return (data ?? []) as MyShift[];
    },
  });
}

function useShiftMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export type SlotInput = {
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

/**
 * Speichert eine Schicht. Mit `publish` geht sie gleich in die Schichtbörse (nur ab „optioniert“
 * möglich); so entsteht für den Normalfall kein Entwurf mehr, auf den man achten muss.
 */
export const useSaveSlot = () =>
  useShiftMutation(async ({ publish, ...v }: SlotInput & { publish?: boolean }) => {
    const id = await rpc<string>('save_slot', { p: v });
    if (publish) await rpc<number>('publish_slots', { p_slot_ids: [id] });
    return id;
  });

/**
 * Veröffentlicht alle noch nicht veröffentlichten Schichten eines Auftrags, z. B. sobald er
 * optioniert oder bestätigt wird. Liefert die Anzahl.
 */
export const usePublishEventDrafts = () =>
  useShiftMutation(async (eventId: string) => {
    const { data, error } = await client()
      .from('shift_slots')
      .select('id')
      .eq('event_id', eventId)
      .is('published_at', null)
      .is('cancelled_at', null);
    if (error) throw toAppError(error);
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return 0;
    return rpc<number>('publish_slots', { p_slot_ids: ids });
  });
export const usePublishSlots = () =>
  useShiftMutation((ids: string[]) => rpc<number>('publish_slots', { p_slot_ids: ids }));
export const useCancelSlot = () =>
  useShiftMutation((v: { id: string; reason: string }) =>
    rpc('cancel_slot', { p_slot_id: v.id, p_reason: v.reason || null }),
  );
export const useDecideApplication = () =>
  useShiftMutation((v: { id: string; accept: boolean }) =>
    rpc('decide_application', { p_application_id: v.id, p_accept: v.accept, p_note: null }),
  );
export const useAssignMember = () =>
  useShiftMutation((v: { slotId: string; memberId: string; ignoreQualification: boolean }) =>
    rpc('assign_member', {
      p_slot_id: v.slotId,
      p_member_id: v.memberId,
      p_ignore_qualification: v.ignoreQualification,
    }),
  );
export const useLateCancellation = () =>
  useShiftMutation((v: { id: string; reason: string }) =>
    rpc('record_late_cancellation', { p_application_id: v.id, p_reason: v.reason || null }),
  );
export const useApply = () =>
  useShiftMutation((v: { slotId: string; comment: string }) =>
    rpc('apply_for_slot', { p_slot_id: v.slotId, p_comment: v.comment || null }),
  );
export const useCancelMine = () =>
  useShiftMutation((v: { id: string; reason: string }) =>
    rpc('cancel_my_application', { p_application_id: v.id, p_reason: v.reason || null }),
  );

/** Kommende Schichten und offene Bewerbungen für die Startseite (admin). */
export function useStaffingOverview() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['shifts', 'overview', m?.company_id],
    enabled: m?.role === 'admin',
    queryFn: async (): Promise<{
      unfilled: { event_id: string; open: number }[];
      applications: { event_id: string; count: number }[];
    }> => {
      const now = new Date().toISOString();
      const slots = await client()
        .from('shift_slots')
        .select('id, event_id, seats, taken_seats, published_at')
        .is('cancelled_at', null)
        .gt('starts_at', now);
      if (slots.error) throw toAppError(slots.error);
      const rows = slots.data ?? [];
      const apps = await client()
        .from('shift_applications')
        .select('shift_slot_id')
        .eq('status', 'applied');
      if (apps.error) throw toAppError(apps.error);
      const slotEvent = new Map(rows.map((s) => [s.id as string, s.event_id as string]));
      const perEvent = new Map<string, number>();
      for (const a of apps.data ?? []) {
        const ev = slotEvent.get(a.shift_slot_id as string);
        if (ev) perEvent.set(ev, (perEvent.get(ev) ?? 0) + 1);
      }
      const unfilled = new Map<string, number>();
      for (const s of rows)
        if (s.published_at && (s.taken_seats as number) < (s.seats as number))
          unfilled.set(
            s.event_id as string,
            (unfilled.get(s.event_id as string) ?? 0) +
              (s.seats as number) -
              (s.taken_seats as number),
          );
      return {
        unfilled: [...unfilled].map(([event_id, open]) => ({ event_id, open })),
        applications: [...perEvent].map(([event_id, count]) => ({ event_id, count })),
      };
    },
  });
}
