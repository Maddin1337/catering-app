import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { Customer } from './types';

// Einziger Ort für Supabase-Aufrufe der Kunden (docs/05 §3.2). Kunden sieht nur admin.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

const COLUMNS =
  'id, type, name, contact_person, email, phone, billing_street, billing_postal_code, billing_city, vat_id, notes';

export function useCustomers() {
  const m = useMembership().data;
  return useQuery({
    queryKey: ['customers', m?.company_id],
    enabled: m?.role === 'admin',
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await client().from('customers').select(COLUMNS).order('name');
      if (error) throw toAppError(error);
      return (data ?? []) as Customer[];
    },
  });
}

export type CustomerInput = Omit<Customer, 'id'>;

function clean(v: CustomerInput) {
  const n = (s: string | null) => (s && s.trim() !== '' ? s.trim() : null);
  return {
    type: v.type,
    name: v.name.trim(),
    contact_person: n(v.contact_person),
    email: n(v.email),
    phone: n(v.phone),
    billing_street: n(v.billing_street),
    billing_postal_code: n(v.billing_postal_code),
    billing_city: n(v.billing_city),
    vat_id: n(v.vat_id),
    notes: n(v.notes),
  };
}

export function useSaveCustomer() {
  const queryClient = useQueryClient();
  const companyId = useMembership().data?.company_id;
  return useMutation({
    mutationFn: async (v: { id?: string; values: CustomerInput }): Promise<string> => {
      if (v.id) {
        const { error } = await client().from('customers').update(clean(v.values)).eq('id', v.id);
        if (error) throw toAppError(error);
        return v.id;
      }
      const { data, error } = await client()
        .from('customers')
        .insert({ company_id: companyId!, ...clean(v.values) })
        .select('id')
        .single();
      if (error) throw toAppError(error);
      return data.id as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client().from('customers').delete().eq('id', id);
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}
