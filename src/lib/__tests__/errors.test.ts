import { AppError, toAppError } from '../errors';

describe('toAppError', () => {
  it('übersetzt bekannte Auth-Fehlercodes', () => {
    expect(toAppError({ code: 'invalid_credentials' }).code).toBe('invalid_credentials');
    expect(toAppError({ code: 'email_not_confirmed' }).code).toBe('email_not_confirmed');
    expect(toAppError({ code: 'user_already_exists' }).code).toBe('user_exists');
    expect(toAppError({ code: 'weak_password' }).code).toBe('weak_password');
    expect(toAppError({ code: 'otp_expired' }).code).toBe('link_expired');
  });

  it('erkennt Rate-Limits über Code und Status', () => {
    expect(toAppError({ code: 'over_email_send_rate_limit' }).code).toBe('rate_limited');
    expect(toAppError({ status: 429 }).code).toBe('rate_limited');
  });

  it('erkennt fehlende Verbindung', () => {
    expect(toAppError({ status: 0, message: 'x' }).code).toBe('offline');
    expect(toAppError(new TypeError('Network request failed')).code).toBe('offline');
  });

  it('liest den hint der Datenbankfunktionen', () => {
    expect(toAppError({ code: 'P0001', hint: 'avv_required' }).code).toBe('avv_required');
    expect(toAppError({ code: 'P0001', hint: 'already_member' }).code).toBe('already_member');
    expect(toAppError({ code: 'P0001', hint: 'read_only' }).code).toBe('read_only');
    expect(toAppError({ code: 'P0001', hint: 'last_admin' }).code).toBe('last_admin');
    expect(toAppError({ code: 'P0001', hint: 'invitation_expired' }).code).toBe(
      'invitation_expired',
    );
    expect(toAppError({ code: 'P0001', hint: 'member_limit' }).code).toBe('member_limit');
    expect(toAppError({ code: 'P0001', hint: 'invalid_transition' }).code).toBe(
      'invalid_transition',
    );
    expect(toAppError({ code: '42501' }).code).toBe('forbidden');
    expect(toAppError({ code: '23505' }).code).toBe('duplicate');
  });

  it('reicht AppError unverändert durch und fällt sonst auf „unknown“ zurück', () => {
    const e = new AppError('not_configured');
    expect(toAppError(e)).toBe(e);
    expect(toAppError(undefined).code).toBe('unknown');
    expect(toAppError({ code: 'etwas_neues' }).code).toBe('unknown');
  });

  it('liefert deutsche Meldungen', () => {
    expect(toAppError({ code: 'invalid_credentials' }).message).toBe(
      'E-Mail oder Passwort stimmen nicht.',
    );
  });
});
