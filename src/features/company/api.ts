import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useSession } from '../auth/session-provider';
import { companyKeys } from './keys';
import type { CompanyProfile, Membership, SubscriptionInfo, TaxRate } from './types';

// Einziger Ort für Supabase-Aufrufe der Firma (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

/** Eigene Mitgliedschaft: Firma und Rolle. `null`, wenn der Nutzer (noch) keiner Firma angehört. */
export function useMembership() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: companyKeys.membership(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Membership | null> => {
      const { data, error } = await client()
        .from('company_members')
        .select('id, company_id, role, display_name, phone')
        .eq('user_id', userId!)
        .is('removed_at', null)
        .maybeSingle();
      if (error) throw toAppError(error);
      return data as Membership | null;
    },
  });
}

/** Firmenprofil aus der View: für alle Rollen lesbar, ohne Preise und Steuer-IDs. */
export function useCompanyProfile() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useQuery({
    queryKey: companyKeys.profile(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<CompanyProfile | null> => {
      const { data, error } = await client().from('company_profile').select('*').maybeSingle();
      if (error) throw toAppError(error);
      return data as CompanyProfile | null;
    },
  });
}

export function useSubscription() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  const isAdmin = membership.data?.role === 'admin';
  return useQuery({
    queryKey: companyKeys.subscription(companyId),
    enabled: !!companyId && isAdmin,
    queryFn: async (): Promise<SubscriptionInfo | null> => {
      const { data, error } = await client()
        .from('subscriptions')
        .select('status, trial_ends_at, writable_until')
        .maybeSingle();
      if (error) throw toAppError(error);
      return data as SubscriptionInfo | null;
    },
  });
}

export function useTaxRates() {
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useQuery({
    queryKey: companyKeys.taxRates(companyId),
    enabled: !!companyId && membership.data?.role === 'admin',
    queryFn: async (): Promise<TaxRate[]> => {
      const { data, error } = await client()
        .from('tax_rates')
        .select('id, name, rate_bp, category, reviewed_at')
        .is('archived_at', null)
        .order('category');
      if (error) throw toAppError(error);
      return (data ?? []) as TaxRate[];
    },
  });
}

export type CreateCompanyValues = { name: string; contactEmail: string; acceptAvv: boolean };

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: CreateCompanyValues) => {
      const { error } = await client().rpc('create_company', {
        p_name: v.name,
        p_contact_email: v.contactEmail,
        p_accept_avv: v.acceptAvv,
        p_country: 'DE',
      });
      if (error) throw toAppError(error);
    },
    // Mit der neuen Mitgliedschaft wechselt das Gate vom Willkommens-Bildschirm in das Onboarding.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  });
}

export type CompanyUpdate = Partial<{
  accent_color: string;
  default_pricing_mode: 'flat' | 'cost_based';
  shift_cancel_deadline_hours: number;
  portal_change_lead_hours: number;
  portal_change_lead_hours_business_lunch: number;
  onboarding_completed_at: string;
}>;

/** Firmendaten ändern (nur admin; die Datenbank erlaubt nur freigegebene Spalten). */
export function useUpdateCompany() {
  const queryClient = useQueryClient();
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useMutation({
    mutationFn: async (values: CompanyUpdate) => {
      const { error } = await client().from('companies').update(values).eq('id', companyId!);
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.profile(companyId) }),
  });
}

/** Alle noch nicht bestätigten Steuersätze als „von mir geprüft“ markieren. */
export function useMarkTaxRatesReviewed() {
  const queryClient = useQueryClient();
  const membership = useMembership();
  const companyId = membership.data?.company_id;
  return useMutation({
    mutationFn: async () => {
      const { error } = await client()
        .from('tax_rates')
        .update({ reviewed_at: new Date().toISOString() })
        .is('reviewed_at', null);
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.taxRates(companyId) }),
  });
}
