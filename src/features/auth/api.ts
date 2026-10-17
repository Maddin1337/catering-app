import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import { AppError, toAppError } from '@/lib/errors';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

// Einziger Ort für Supabase-Auth-Aufrufe (docs/05 §3.2): Screens nutzen nur diese Hooks.

function client() {
  if (!supabase) throw new AppError('not_configured');
  return supabase;
}

// Ziele der Links in E-Mails. Nativ ein Deep Link (Schema aus app.config.ts), im Web die eigene Origin.
const redirect = (path: string) => Linking.createURL(path);

export function useSignIn() {
  return useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const { error } = await client().auth.signInWithPassword(values);
      if (error) throw toAppError(error);
    },
  });
}

export type SignUpResult = { alreadyRegistered: boolean; needsConfirmation: boolean };

export function useSignUp() {
  return useMutation({
    mutationFn: async (values: { email: string; password: string }): Promise<SignUpResult> => {
      const { data, error } = await client().auth.signUp({
        ...values,
        options: { emailRedirectTo: redirect('/verify-email') },
      });
      if (error) throw toAppError(error);
      // Ist die Adresse schon vergeben, antwortet Supabase bei aktiver Bestätigung ohne Fehler,
      // aber mit leerer Identitätsliste (US-01.5: „Konto existiert bereits“).
      const alreadyRegistered = (data.user?.identities?.length ?? 1) === 0;
      return { alreadyRegistered, needsConfirmation: !data.session };
    },
  });
}

export function useResendConfirmation() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await client().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirect('/verify-email') },
      });
      if (error) throw toAppError(error);
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await client().auth.resetPasswordForEmail(email, {
        redirectTo: redirect('/reset-password'),
      });
      // Die Antwort verrät nie, ob es die Adresse gibt (US-02.3): nur echte Fehler werden gezeigt.
      if (error && toAppError(error).code !== 'unknown') throw toAppError(error);
    },
  });
}

export type VerifyOtpValues =
  | { tokenHash: string; type: 'email' | 'recovery' } // Link aus der Mail
  | { email: string; code: string; type: 'email' | 'recovery' }; // Code aus der Mail

/**
 * Löst den Link oder den Code aus Bestätigungs- und Reset-Mails ein (docs/05 §6.3). Beides steht
 * in derselben Mail. Der Link (`token_hash`) funktioniert auf jedem Gerät, setzt aber voraus, dass
 * er in der App oder im Browser geöffnet wird; der Code funktioniert immer, auch wenn die Mail-App
 * den Link nicht öffnen kann. Bei Erfolg entsteht eine Sitzung.
 */
export function useVerifyOtp() {
  return useMutation({
    mutationFn: async (values: VerifyOtpValues) => {
      const params =
        'tokenHash' in values
          ? { token_hash: values.tokenHash, type: values.type }
          : { email: values.email, token: values.code, type: values.type };
      const { error } = await client().auth.verifyOtp(params);
      if (error) throw toAppError(error);
    },
  });
}

/** Tauscht den `code` aus dem Link der Standard-Mails gegen eine Sitzung (PKCE). Nur nativ nötig. */
export function useExchangeCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await client().auth.exchangeCodeForSession(code);
      if (error) throw toAppError(error);
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await client().auth.updateUser({ password });
      if (error) throw toAppError(error);
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      await client().auth.signOut();
    },
    // Beim Abmelden verschwinden auch zwischengespeicherte Firmendaten (docs/05 §2.3).
    onSettled: () => queryClient.clear(),
  });
}
