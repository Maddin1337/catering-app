import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { AppNotification } from './types';

// Supabase-Aufrufe der Mitteilungen (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

/**
 * Die letzten 50 eigenen Mitteilungen, neueste zuerst. Wird jede Minute und beim Zurückkehren in
 * die App neu geladen (kein Push, A-40). Fehlt das SQL-Update noch, bleibt die Liste leer.
 */
export function useNotifications() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['notifications', m?.id],
    enabled: !!m,
    retry: false,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await client()
        .from('notifications')
        .select('id, kind, event_id, shift_slot_id, payload, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw toAppError(error);
      return (data ?? []) as AppNotification[];
    },
  });
}

/** Anzahl ungelesener Mitteilungen (für die Glocke). */
export function useUnreadCount(): number {
  return (useNotifications().data ?? []).filter((n) => !n.read_at).length;
}

/** Markiert alle (ohne `ids`) oder die genannten eigenen Mitteilungen als gelesen. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await client().rpc('mark_notifications_read', { p_ids: ids ?? null });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
