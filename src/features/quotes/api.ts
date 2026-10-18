import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
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
