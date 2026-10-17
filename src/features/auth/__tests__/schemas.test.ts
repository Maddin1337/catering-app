import {
  forgotPasswordSchema,
  loginSchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema,
  resetWithCodeSchema,
} from '../schemas';

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

  it('otp: genau 6 Ziffern, Leerzeichen am Rand werden entfernt', () => {
    expect(otpSchema.safeParse({ code: ' 123456 ' }).success).toBe(true);
    for (const bad of ['', '12345', '1234567', '12345a', '12 456']) {
      const r = otpSchema.safeParse({ code: bad });
      expect(r.success).toBe(false);
      expect(messages(r)).toContain('auth.validation.codeInvalid');
    }
  });

  it('reset mit Code: braucht Code, Passwort und Wiederholung', () => {
    const ok = { code: '123456', password: '1234567890', passwordConfirm: '1234567890' };
    expect(resetWithCodeSchema.safeParse(ok).success).toBe(true);
    expect(resetWithCodeSchema.safeParse({ ...ok, code: '12' }).success).toBe(false);
    const mismatch = resetWithCodeSchema.safeParse({ ...ok, passwordConfirm: 'anders-anders' });
    expect(messages(mismatch)).toContain('auth.validation.passwordMismatch');
  });
});
