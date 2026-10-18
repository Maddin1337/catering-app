import { useQuery } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { RevenueOverview } from './revenue';

// Supabase-Aufrufe für die Startseite (docs/05 §3.2).

/**
 * Auftragswerte der Monate um heute (nur Admin). Fehlt die Funktion noch in der Datenbank
 * (SQL-Update nicht eingespielt), bleibt die Karte einfach weg.
 */
export function useRevenueOverview() {
  const membership = useMembership();
  const isAdmin = membership.data?.role === 'admin';
  return useQuery({
    queryKey: ['revenue-overview', membership.data?.company_id],
    enabled: isAdmin,
    retry: false,
    queryFn: async (): Promise<RevenueOverview> => {
      if (!supabase) throw new AppError('not_configured');
      const { data, error } = await supabase.rpc('revenue_overview');
      if (error) throw toAppError(error);
      return data as unknown as RevenueOverview;
    },
  });
}
