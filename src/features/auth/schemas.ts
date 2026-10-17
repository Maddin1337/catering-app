import { z } from 'zod';

// Die Meldungen sind Schlüssel im Namensraum `team` und werden erst in der Oberfläche übersetzt.
const email = z
  .string()
  .trim()
  .min(1, 'auth.validation.emailRequired')
  .pipe(z.email('auth.validation.emailInvalid'));

// Mindestlänge 10 – muss zu `minimum_password_length` in supabase/config.toml passen.
export const PASSWORD_MIN_LENGTH = 10;
const newPassword = z.string().min(PASSWORD_MIN_LENGTH, 'auth.validation.passwordShort');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'auth.validation.passwordRequired'),
});

export const registerSchema = z.object({ email, password: newPassword });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'auth.validation.passwordMismatch',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
