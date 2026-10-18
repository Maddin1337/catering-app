import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';
import type { CompanySettings, QualificationRow, TaxCategory, TaxRateRow } from './types';

// Einziger Ort für Supabase-Aufrufe der Einstellungen (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

const COLUMNS =
  'name, phone, contact_email, website, street, postal_code, city, vat_id, tax_number, footer_text, ' +
  'privacy_policy_url, imprint_url, accent_color, price_entry_mode, default_pricing_mode, default_markup_bp, ' +
  'price_rounding_cents, quote_validity_days, portal_change_lead_hours, ' +
  'portal_change_lead_hours_business_lunch, shift_cancel_deadline_hours, shopping_buffer_bp, ' +
  'quote_intro_text, quote_terms_text, quote_closing_text, quote_item_templates';

function useCompanyId() {
  return useMembership().data?.company_id;
}

export function useCompanySettings() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company-settings', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CompanySettings> => {
      const { data, error } = await client()
        .from('companies')
        .select(COLUMNS)
        .eq('id', companyId!)
        .single();
      if (error) throw toAppError(error);
      return data as unknown as CompanySettings;
    },
  });
}

/** Firmendaten ändern; die Datenbank erlaubt nur freigegebene Spalten und nur im Schreibmodus. */
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (values: Partial<CompanySettings>) => {
      const { error } = await client().from('companies').update(values).eq('id', companyId!);
      if (error) throw toAppError(error);
    },
    // Name, Farbe und Fristen stecken auch im Firmenprofil und in den Start-Daten.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// ---------- Steuersätze ----------

export function useTaxRateList() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['tax-rates', 'list', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<TaxRateRow[]> => {
      const { data, error } = await client()
        .from('tax_rates')
        .select('id, name, rate_bp, category, is_default, reviewed_at')
        .is('archived_at', null)
        .order('category')
        .order('rate_bp', { ascending: false });
      if (error) throw toAppError(error);
      return (data ?? []) as TaxRateRow[];
    },
  });
}

function useTaxRateMutation<V>(fn: (v: V, companyId: string) => Promise<void>) {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (v: V) => fn(v, companyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-rates'] }),
  });
}

/** Pro Kategorie gibt es genau einen Standard; der alte wird zuerst abgewählt (eindeutiger Index). */
async function makeDefault(id: string, category: TaxCategory) {
  const off = await client()
    .from('tax_rates')
    .update({ is_default: false })
    .eq('category', category)
    .eq('is_default', true)
    .is('archived_at', null)
    .neq('id', id);
  if (off.error) throw toAppError(off.error);
  const on = await client().from('tax_rates').update({ is_default: true }).eq('id', id);
  if (on.error) throw toAppError(on.error);
}

export type TaxRateInput = {
  name: string;
  rateBp: number;
  category: TaxCategory;
  isDefault: boolean;
};

export const useCreateTaxRate = () =>
  useTaxRateMutation(async (v: TaxRateInput, companyId) => {
    const { data, error } = await client()
      .from('tax_rates')
      .insert({
        company_id: companyId,
        name: v.name,
        rate_bp: v.rateBp,
        category: v.category,
        country: 'DE',
        reviewed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw toAppError(error);
    if (v.isDefault) await makeDefault(data.id as string, v.category);
  });

export const useUpdateTaxRate = () =>
  useTaxRateMutation(async (v: { id: string; current: TaxRateRow } & TaxRateInput) => {
    const { error } = await client()
      .from('tax_rates')
      .update({ name: v.name, rate_bp: v.rateBp, reviewed_at: new Date().toISOString() })
      .eq('id', v.id);
    if (error) throw toAppError(error);
    if (v.isDefault && !v.current.is_default) await makeDefault(v.id, v.current.category);
  });

export const useArchiveTaxRate = () =>
  useTaxRateMutation(async (id: string) => {
    const { error } = await client()
      .from('tax_rates')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toAppError(error);
  });

export const useConfirmAllTaxRates = () =>
  useTaxRateMutation(async (_: void) => {
    const { error } = await client()
      .from('tax_rates')
      .update({ reviewed_at: new Date().toISOString() })
      .is('reviewed_at', null);
    if (error) throw toAppError(error);
  });

// ---------- Qualifikationen ----------

export function useQualificationList() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['team', 'qualification-list', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<QualificationRow[]> => {
      const [quals, links] = await Promise.all([
        client()
          .from('qualifications')
          .select('id, name')
          .is('archived_at', null)
          .order('sort_order')
          .order('name'),
        client().from('member_qualifications').select('qualification_id'),
      ]);
      if (quals.error) throw toAppError(quals.error);
      if (links.error) throw toAppError(links.error);
      const counts = new Map<string, number>();
      for (const l of links.data ?? []) {
        const id = l.qualification_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return (quals.data ?? []).map((q) => ({
        id: q.id as string,
        name: q.name as string,
        memberCount: counts.get(q.id as string) ?? 0,
      }));
    },
  });
}

function useQualificationMutation<V>(fn: (v: V, companyId: string) => Promise<void>) {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (v: V) => fn(v, companyId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  });
}

export const useCreateQualification = () =>
  useQualificationMutation(async (name: string, companyId) => {
    const { error } = await client()
      .from('qualifications')
      .insert({ company_id: companyId, name: name.trim(), sort_order: 100 });
    if (error) throw toAppError(error);
  });

export const useRenameQualification = () =>
  useQualificationMutation(async (v: { id: string; name: string }) => {
    const { error } = await client()
      .from('qualifications')
      .update({ name: v.name.trim() })
      .eq('id', v.id);
    if (error) throw toAppError(error);
  });

export const useArchiveQualification = () =>
  useQualificationMutation(async (id: string) => {
    const { error } = await client()
      .from('qualifications')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw toAppError(error);
  });
