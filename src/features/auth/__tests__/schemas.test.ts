import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../schemas';

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe('auth schemas', () => {
  it('login: verlangt E-Mail und Passwort', () => {
    const r = loginSchema.safeParse({ email: '', password: '' });
    expect(r.success).toBe(false);
    expect(messages(r)).toEqual(
      expect.arrayContaining(['auth.validation.emailRequired', 'auth.validation.passwordRequired']),
    );
  });

  it('login: schneidet Leerzeichen um die E-Mail ab', () => {
    const r = loginSchema.safeParse({ email: '  a@b.de ', password: 'x' });
    expect(r.success && r.data.email).toBe('a@b.de');
  });

  it('login: lehnt ungültige E-Mail ab', () => {
    expect(messages(loginSchema.safeParse({ email: 'abc', password: 'x' }))).toContain(
      'auth.validation.emailInvalid',
    );
  });

  it('register: verlangt mindestens 10 Zeichen', () => {
    expect(registerSchema.safeParse({ email: 'a@b.de', password: '123456789' }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse({ email: 'a@b.de', password: '1234567890' }).success).toBe(
      true,
    );
  });

  it('forgot: braucht nur eine gültige E-Mail', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.de' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('reset: Passwörter müssen übereinstimmen', () => {
    const bad = resetPasswordSchema.safeParse({
      password: '1234567890',
      passwordConfirm: '1234567891',
    });
    expect(bad.success).toBe(false);
    expect(messages(bad)).toContain('auth.validation.passwordMismatch');
    expect(
      resetPasswordSchema.safeParse({ password: '1234567890', passwordConfirm: '1234567890' })
        .success,
    ).toBe(true);
  });
});
