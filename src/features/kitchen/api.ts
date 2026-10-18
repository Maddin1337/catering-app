import { useQuery } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { DietaryRowInput } from './plan';

// Einziger Ort für Supabase-Aufrufe der Küchenplanung (docs/05 §3.2). Admin und Küche, ohne Preise.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

export type KitchenLineRow = {
  event_id: string;
  basis: 'binding' | 'snapshot' | 'live';
  item_type: 'package' | 'dish';
  dish_id: string | null;
  menu_package_id: string | null;
  quantity: number;
};

/** Gerichte und Pakete der Aufträge aus dem verbindlichen Stand (Daten aus Angebot, nicht aus dem Live-Entwurf). */
export function useKitchenLines() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['kitchen', 'lines', m?.company_id],
    enabled: m?.role === 'admin' || m?.role === 'kitchen',
    queryFn: async (): Promise<KitchenLineRow[]> => {
      const { data, error } = await client()
        .from('kitchen_event_lines')
        .select('event_id, basis, item_type, dish_id, menu_package_id, quantity');
      if (error) throw toAppError(error);
      return (data ?? []).map((r) => ({
        ...(r as unknown as KitchenLineRow),
        quantity: Number(r.quantity),
      }));
    },
  });
}

/** Sonderessen aller Aufträge der Firma (mit Ersatzgerichten) für die Zeitraumsicht. */
export function useKitchenDietary() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['kitchen', 'dietary', m?.company_id],
    enabled: m?.role === 'admin' || m?.role === 'kitchen',
    queryFn: async (): Promise<DietaryRowInput[]> => {
      const { data, error } = await client()
        .from('event_dietary_requirements')
        .select(
          'id, event_id, person_count, diet, avoid_allergens, note, table_label, guest_name, substitutions',
        )
        .order('created_at');
      if (error) throw toAppError(error);
      return (data ?? []) as unknown as DietaryRowInput[];
    },
  });
}

export type KitchenEventRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  /** verbindliche Gästezahl (aus der angenommenen Fassung, sonst Entwurf) */
  guest_count: number | null;
  draft_guest_count: number | null;
  basis: 'binding' | 'snapshot' | 'live';
  has_open_change: boolean;
};

/** Aufträge für die Küchenplanung aus der View `kitchen_events` (verbindliche Gästezahl, Kennzeichen „Änderung offen“). */
export function useKitchenEvents() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['kitchen', 'events', m?.company_id],
    enabled: m?.role === 'admin' || m?.role === 'kitchen',
    queryFn: async (): Promise<KitchenEventRow[]> => {
      const { data, error } = await client()
        .from('kitchen_events')
        .select(
          'id, title, status, starts_at, guest_count, draft_guest_count, basis, has_open_change',
        )
        .order('starts_at');
      if (error) throw toAppError(error);
      return (data ?? []) as KitchenEventRow[];
    },
  });
}
