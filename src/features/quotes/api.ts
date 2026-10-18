import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { QuoteSnapshot } from './snapshot';
import type { QuoteHeader, StoredItem } from './types';

// Einziger Ort für Supabase-Aufrufe der Angebote (docs/05 §3.2). Nur admin.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

const HEADER =
  'id, event_id, number, status, revision, pricing_mode, markup_bp, price_display, discount_bp, discount_cents, deposit_bp, deposit_cents, deposit_due_on, customer_reference, intro_text, terms_text, closing_text, valid_until, total_net_cents, total_tax_cents, total_gross_cents, cost_total_cents, cost_incomplete, has_unsent_changes';
const ITEM =
  'id, type, sort_order, menu_package_id, dish_id, name, description, unit_label, quantity_mode, quantity, hours, unit_price_cents, price_is_manual, markup_bp, unit_cost, discount_bp, tax_rate_id, choice_group, is_selected, customer_can_edit_quantity, is_heading';

/** Vorhandenes Angebot eines Auftrags (legt keines an): für die Anzeige im Auftrag. */
export function useExistingQuote(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['quotes', 'existing', eventId],
    enabled: !!eventId && m?.role === 'admin',
    queryFn: async (): Promise<QuoteHeader | null> => {
      const { data, error } = await client()
        .from('quotes')
        .select(HEADER)
        .eq('event_id', eventId!)
        .maybeSingle();
      if (error) throw toAppError(error);
      return (data as QuoteHeader | null) ?? null;
    },
  });
}

/** Öffnet den Entwurf zum Bearbeiten und legt ihn beim ersten Mal an. */
export function useQuoteForEditing(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['quotes', 'editing', eventId],
    enabled: !!eventId && m?.role === 'admin',
    // Der Editor hält den Stand selbst; ein Neuladen im Hintergrund würde Eingaben überschreiben.
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async (): Promise<{ header: QuoteHeader; items: StoredItem[] }> => {
      const ensured = await client().rpc('ensure_quote', { p_event_id: eventId });
      if (ensured.error) throw toAppError(ensured.error);
      const quoteId = ensured.data as string;
      const [header, items] = await Promise.all([
        client().from('quotes').select(HEADER).eq('id', quoteId).single(),
        client().from('quote_items').select(ITEM).eq('quote_id', quoteId).order('sort_order'),
      ]);
      if (header.error) throw toAppError(header.error);
      if (items.error) throw toAppError(items.error);
      return { header: header.data as QuoteHeader, items: (items.data ?? []) as StoredItem[] };
    },
  });
}

export function useSaveQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await client().rpc('save_quote', { p: payload });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes', 'existing'] }),
  });
}

// ---------- Versand (M5) ----------

/** Frischer Stand des Angebots für Prüfliste und Versand (kein Zwischenspeicher, kein Anlegen). */
export function useQuoteForSend(eventId: string | undefined) {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['quotes', 'send', eventId],
    enabled: !!eventId && m?.role === 'admin',
    gcTime: 0,
    queryFn: async (): Promise<{ header: QuoteHeader; items: StoredItem[] } | null> => {
      const header = await client()
        .from('quotes')
        .select(HEADER)
        .eq('event_id', eventId!)
        .maybeSingle();
      if (header.error) throw toAppError(header.error);
      if (!header.data) return null;
      const h = header.data as unknown as QuoteHeader;
      const items = await client()
        .from('quote_items')
        .select(ITEM)
        .eq('quote_id', h.id)
        .order('sort_order');
      if (items.error) throw toAppError(items.error);
      return { header: h, items: (items.data ?? []) as unknown as StoredItem[] };
    },
  });
}

export type RevisionRow = {
  revision: number;
  sent_at: string;
  sent_via: 'email' | 'link';
  send_mode: 'confirm_required' | 'info_only' | null;
  snapshot: QuoteSnapshot;
};

/** Alle versendeten Fassungen, neueste zuerst. */
export function useRevisions(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quotes', 'revisions', quoteId],
    enabled: !!quoteId,
    queryFn: async (): Promise<RevisionRow[]> => {
      const { data, error } = await client()
        .from('quote_revisions')
        .select('revision, sent_at, sent_via, send_mode, snapshot')
        .eq('quote_id', quoteId!)
        .order('revision', { ascending: false });
      if (error) throw toAppError(error);
      return (data ?? []) as unknown as RevisionRow[];
    },
  });
}

/** Speichert den berechneten Entwurf und versendet ihn als neue Revision (zwei Aufrufe, Reihenfolge fest). */
export function useSendQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      quoteId: string;
      expectedRevision: number;
      savePayload: Record<string, unknown>;
      snapshot: QuoteSnapshot;
      via: 'email' | 'link';
      sendMode: 'confirm_required' | 'info_only' | null;
    }) => {
      const saved = await client().rpc('save_quote', { p: v.savePayload });
      if (saved.error) throw toAppError(saved.error);
      const { data, error } = await client().rpc('send_quote', {
        p_quote_id: v.quoteId,
        p_expected_revision: v.expectedRevision,
        p_snapshot: v.snapshot,
        p_via: v.via,
        p_send_mode: v.sendMode,
      });
      if (error) throw toAppError(error);
      return data as { revision: number; token: string; snapshot_hash: string };
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Neuen Portal-Link ausgeben („Link kopieren“). */
export function useIssueToken() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await client().rpc('issue_portal_token', { p_quote_id: quoteId });
      if (error) throw toAppError(error);
      return data as string;
    },
  });
}

export function useDiscardChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await client().rpc('discard_quote_changes', { p_quote_id: quoteId });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export type PortalInfo = {
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  acceptance_name: string | null;
  acceptance_revision: number | null;
  acceptance_comment: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  decline_comment: string | null;
  pending_change: {
    requested_at: string;
    revision: number;
    name: string;
    comment: string | null;
    guest_count: number | null;
  } | null;
};

/** Was der Kunde im Portal getan hat (Aufruf, Annahme, Ablehnung, Änderungswunsch). */
export function usePortalInfo(quoteId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['quotes', 'portal-info', quoteId],
    enabled: !!quoteId && enabled,
    queryFn: async (): Promise<PortalInfo> => {
      const { data, error } = await client()
        .from('quotes')
        .select(
          'first_viewed_at, last_viewed_at, accepted_at, acceptance_name, acceptance_revision, acceptance_comment, declined_at, decline_reason, decline_comment, pending_change',
        )
        .eq('id', quoteId!)
        .single();
      if (error) throw toAppError(error);
      return data as unknown as PortalInfo;
    },
  });
}

export function useResolveChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await client().rpc('resolve_pending_change', { p_quote_id: quoteId });
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });
}
