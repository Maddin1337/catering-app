import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import type { QuoteSnapshot } from '../quotes/snapshot';

// Einziger Ort für Supabase-Aufrufe des Kundenportals (docs/05 §3.2). Ohne Anmeldung: Der Link ist das Geheimnis.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

export type PortalCompany = {
  name: string;
  accent_color?: string | null;
  phone: string | null;
  contact_email: string;
  website?: string | null;
  imprint_url?: string | null;
  privacy_policy_url?: string | null;
};

export type PortalData =
  | { state: 'invalid' }
  | { state: 'revoked'; company: PortalCompany }
  | {
      state: 'ok';
      company: PortalCompany;
      quote: {
        number: string;
        revision: number;
        status: 'draft' | 'sent' | 'accepted' | 'declined';
        valid_until: string | null;
        expired: boolean;
        sent_at: string;
        send_mode: 'confirm_required' | 'info_only' | null;
        accepted_at: string | null;
        acceptance_revision: number | null;
        acceptance_name: string | null;
        declined_at: string | null;
      };
      event: { status: string; changes_until: string; changes_locked: boolean };
      snapshot: QuoteSnapshot;
      selection: Record<string, string>;
      has_pending_change: boolean;
    };

export function usePortal(token: string | undefined) {
  return useQuery({
    queryKey: ['portal', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<PortalData> => {
      const { data, error } = await client().rpc('portal_get', { p_token: token });
      if (error) throw toAppError(error);
      return data as PortalData;
    },
  });
}

function usePortalAction<V>(fn: (v: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal'] }),
  });
}

export function usePortalAccept(token: string) {
  return usePortalAction(
    async (v: { revision: number; name: string; email: string; comment: string }) => {
      const { error } = await client().rpc('portal_accept_quote', {
        p_token: token,
        p_revision: v.revision,
        p_name: v.name,
        p_email: v.email || null,
        p_comment: v.comment || null,
      });
      if (error) throw error;
    },
  );
}

export function usePortalDecline(token: string) {
  return usePortalAction(async (v: { revision: number; reason: string; comment: string }) => {
    const { error } = await client().rpc('portal_decline_quote', {
      p_token: token,
      p_revision: v.revision,
      p_reason: v.reason || null,
      p_comment: v.comment || null,
    });
    if (error) throw error;
  });
}

export function usePortalSelect(token: string) {
  return usePortalAction(async (v: { revision: number; group: string; itemId: string }) => {
    const { error } = await client().rpc('portal_select_choice', {
      p_token: token,
      p_revision: v.revision,
      p_group: v.group,
      p_item_id: v.itemId,
    });
    if (error) throw error;
  });
}

export function usePortalChange(token: string) {
  return usePortalAction(
    async (v: { revision: number; name: string; comment: string; guests: number | null }) => {
      const { error } = await client().rpc('portal_request_change', {
        p_token: token,
        p_revision: v.revision,
        p_name: v.name,
        p_comment: v.comment || null,
        p_guest_count: v.guests,
      });
      if (error) throw error;
    },
  );
}

/** Schlüssel der Kundenmeldung (Namensraum `portal`, Sie-Form) zu einem Fehler der Datenbank. */
export function portalErrorKey(error: unknown): string {
  const hint = (error as { hint?: string | null } | null)?.hint;
  switch (hint) {
    case 'portal_invalid':
    case 'revision_outdated':
    case 'name_required':
    case 'invalid_email':
    case 'quote_expired':
    case 'not_acceptable':
    case 'changes_locked':
      return `errors.${hint}`;
  }
  const code = toAppError(error).code;
  return code === 'offline' ? 'errors.offline' : 'errors.unknown';
}
