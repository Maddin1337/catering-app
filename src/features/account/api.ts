import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useMembership } from '../company/api';

// Supabase-Aufrufe für Profil und Firmendaten (docs/05 §3.2).

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

/** Eigenen Namen und Telefon ändern; die Datenbank erlaubt nur diese Spalten an der eigenen Zeile. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const membership = useMembership();
  const memberId = membership.data?.id;
  return useMutation({
    mutationFn: async (v: { displayName: string; phone: string }) => {
      const { error } = await client()
        .from('company_members')
        .update({ display_name: v.displayName.trim(), phone: v.phone.trim() || null })
        .eq('id', memberId!);
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Firma verlassen: danach gehört das Konto keiner Firma mehr, das Gate zeigt das Willkommen. */
export function useLeaveCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await client().rpc('leave_company');
      if (error) throw toAppError(error);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Konto endgültig löschen und lokal abmelden. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await client().rpc('delete_my_account');
      if (error) throw toAppError(error);
      // Das Konto ist weg; die Abmeldung räumt nur noch die lokale Sitzung auf.
      await client()
        .auth.signOut({ scope: 'local' })
        .catch(() => undefined);
    },
    onSettled: () => queryClient.clear(),
  });
}
