import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EventStatus } from '@/lib/event-status';
import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { DietaryRow, EventRow, ScheduleItem, StatusChange } from './types';

// Einziger Ort für Supabase-Aufrufe der Aufträge (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

const KITCHEN_COLUMNS =
  'id, title, kind, status, starts_at, ends_at, event_date, guest_count, venue_name, street, postal_code, city, is_pickup, onsite_contact_name, onsite_contact_phone, meeting_point, dress_code, staff_notes, kitchen_notes';
const ADMIN_COLUMNS = `${KITCHEN_COLUMNS}, occasion, internal_notes, option_expires_at, changes_until, customer_id, cancellation_agreement, invoice_reference, invoiced_on, created_at, customers(name)`;

type RawEvent = EventRow & { customers?: { name: string } | null };
const normalize = (r: RawEvent): EventRow => {
  const { customers, ...rest } = r;
  return { ...rest, customer_name: customers?.name, occasion: r.occasion ?? null };
};

/** Alle Aufträge; Admins aus der Tabelle (mit Kunde), die Küche aus der View ab „optioniert“. */
export function useEvents() {
  const m = useMembership().data;
  const role = m?.role;
  return useQuery({
    queryKey: ['events', 'list', m?.company_id, role],
    enabled: role === 'admin' || role === 'kitchen',
    queryFn: async (): Promise<EventRow[]> => {
      const q =
        role === 'admin'
          ? client().from('events').select(ADMIN_COLUMNS)
          : client().from('kitchen_events').select(KITCHEN_COLUMNS);
      const { data, error } = await q.order('starts_at');
      if (error) throw toAppError(error);
      return ((data ?? []) as unknown as RawEvent[]).map(normalize);
    },
  });
}

export function useEvent(id: string | undefined) {
  const events = useEvents();
  return { ...events, data: events.data?.find((e) => e.id === id) };
}

export function useScheduleItems(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['events', 'schedule', eventId],
    enabled: !!eventId && (m?.role === 'admin' || m?.role === 'kitchen'),
    queryFn: async (): Promise<ScheduleItem[]> => {
      const { data, error } = await client()
        .from('event_schedule_items')
        .select('id, event_id, kind, label, starts_at, ends_at, notes')
        .eq('event_id', eventId!)
        .order('starts_at');
      if (error) throw toAppError(error);
      return (data ?? []) as ScheduleItem[];
    },
  });
}

export function useStatusHistory(eventId: string | undefined) {
  const isAdmin = useMembership().data?.role === 'admin';
  return useQuery({
    queryKey: ['events', 'history', eventId],
    enabled: !!eventId && isAdmin,
    queryFn: async (): Promise<StatusChange[]> => {
      const { data, error } = await client()
        .from('event_status_changes')
        .select('id, from_status, to_status, actor_kind, reason, confirmation_channel, created_at')
        .eq('event_id', eventId!)
        .order('created_at');
      if (error) throw toAppError(error);
      return (data ?? []) as StatusChange[];
    },
  });
}

function useEventMutation<V, R = void>(fn: (v: V, companyId: string) => Promise<R>) {
  const queryClient = useQueryClient();
  const companyId = useMembership().data?.company_id;
  return useMutation({
    mutationFn: (v: V) => fn(v, companyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export type EventInput = {
  customer_id: string;
  kind: 'event_catering' | 'business_lunch';
  title: string;
  occasion: string | null;
  starts_at: string;
  ends_at: string | null;
  guest_count: number | null;
  venue_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  is_pickup: boolean;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  meeting_point: string | null;
  dress_code: string | null;
  staff_notes: string | null;
  kitchen_notes: string | null;
  internal_notes: string | null;
  changes_until: string | null;
  cancellation_agreement: string | null;
};

export const useCreateEvent = () =>
  useEventMutation(async (v: EventInput, companyId): Promise<string> => {
    const { data, error } = await client()
      .from('events')
      .insert({ company_id: companyId, ...v })
      .select('id')
      .single();
    if (error) throw toAppError(error);
    return data.id as string;
  });

export const useUpdateEvent = () =>
  useEventMutation(async (v: { id: string; values: EventInput }) => {
    const { error } = await client().from('events').update(v.values).eq('id', v.id);
    if (error) throw toAppError(error);
  });

export const useDeleteEvent = () =>
  useEventMutation(async (id: string) => {
    const { error } = await client().from('events').delete().eq('id', id);
    if (error) throw toAppError(error);
  });

export type StatusChangeInput = {
  eventId: string;
  status: EventStatus;
  reason?: string;
  channel?: 'phone' | 'email' | 'in_person';
  optionExpiresAt?: string;
  invoiceReference?: string;
  invoicedOn?: string;
};

export const useSetEventStatus = () =>
  useEventMutation(async (v: StatusChangeInput) => {
    const { error } = await client().rpc('set_event_status', {
      p_event_id: v.eventId,
      p_new_status: v.status,
      p_reason: v.reason ?? null,
      p_confirmation_channel: v.channel ?? null,
      p_option_expires_at: v.optionExpiresAt ?? null,
      p_invoice_reference: v.invoiceReference ?? null,
      p_invoiced_on: v.invoicedOn ?? null,
    });
    if (error) throw toAppError(error);
  });

export const useCopyEvent = () =>
  useEventMutation(
    async (v: {
      eventId: string;
      startsAt: string[];
      copyDietary: boolean;
      startStatus: 'inquiry' | 'confirmed';
      channel?: 'phone' | 'email' | 'in_person';
    }): Promise<string[]> => {
      const { data, error } = await client().rpc('copy_event', {
        p_event_id: v.eventId,
        p_new_starts_at: v.startsAt,
        p_copy_dietary: v.copyDietary,
        p_start_status: v.startStatus,
        p_confirmation_channel: v.channel ?? null,
      });
      if (error) throw toAppError(error);
      return (data ?? []) as string[];
    },
  );

export type ScheduleInput = {
  kind: ScheduleItem['kind'];
  label: string | null;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
};

export const useSaveScheduleItem = () =>
  useEventMutation(
    async (v: { eventId: string; id?: string; values: ScheduleInput }, companyId) => {
      if (v.id) {
        const { error } = await client()
          .from('event_schedule_items')
          .update(v.values)
          .eq('id', v.id);
        if (error) throw toAppError(error);
      } else {
        const { error } = await client()
          .from('event_schedule_items')
          .insert({ company_id: companyId, event_id: v.eventId, ...v.values });
        if (error) throw toAppError(error);
      }
    },
  );

export const useDeleteScheduleItem = () =>
  useEventMutation(async (id: string) => {
    const { error } = await client().from('event_schedule_items').delete().eq('id', id);
    if (error) throw toAppError(error);
  });

export function useDietary(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['events', 'dietary', eventId],
    enabled: !!eventId && (m?.role === 'admin' || m?.role === 'kitchen'),
    queryFn: async (): Promise<DietaryRow[]> => {
      const { data, error } = await client()
        .from('event_dietary_requirements')
        .select(
          'id, event_id, person_count, diet, avoid_allergens, guest_name, table_label, note, source, is_short_notice, substitutions',
        )
        .eq('event_id', eventId!)
        .order('created_at');
      if (error) throw toAppError(error);
      return (data ?? []) as DietaryRow[];
    },
  });
}

export type DietaryInput = Pick<
  DietaryRow,
  | 'person_count'
  | 'diet'
  | 'avoid_allergens'
  | 'guest_name'
  | 'table_label'
  | 'note'
  | 'source'
  | 'substitutions'
>;

export const useSaveDietary = () =>
  useEventMutation(async (v: { eventId: string; id?: string; values: DietaryInput }, companyId) => {
    if (v.id) {
      const { error } = await client()
        .from('event_dietary_requirements')
        .update(v.values)
        .eq('id', v.id);
      if (error) throw toAppError(error);
    } else {
      const { error } = await client()
        .from('event_dietary_requirements')
        .insert({ company_id: companyId, event_id: v.eventId, ...v.values });
      if (error) throw toAppError(error);
    }
  });

export const useDeleteDietary = () =>
  useEventMutation(async (id: string) => {
    const { error } = await client().from('event_dietary_requirements').delete().eq('id', id);
    if (error) throw toAppError(error);
  });
