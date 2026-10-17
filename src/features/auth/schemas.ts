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

const resetBase = z.object({ password: newPassword, passwordConfirm: z.string() });
const passwordsMatch = {
  path: ['passwordConfirm'],
  message: 'auth.validation.passwordMismatch',
};

// Code aus der Mail: genau 6 Ziffern (`otp_length` in supabase/config.toml).
export const OTP_LENGTH = 6;
export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'auth.validation.codeInvalid'),
});

export const resetPasswordSchema = resetBase.refine(
  (v) => v.password === v.passwordConfirm,
  passwordsMatch,
);

// Passwort zurücksetzen mit dem Code statt dem Link: Code und neues Passwort in einem Formular.
export const resetWithCodeSchema = resetBase
  .extend({ code: otpSchema.shape.code })
  .refine((v) => v.password === v.passwordConfirm, passwordsMatch);

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type ResetWithCodeValues = z.infer<typeof resetWithCodeSchema>;
