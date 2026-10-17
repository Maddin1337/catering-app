// Fehlercodes → verständliche deutsche Meldungen (docs/05 §4.6). Die Team-App duzt.

export type AppErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'link_expired'
  | 'offline'
  | 'not_configured'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
  ) {
    super(message ?? messages[code]);
    this.name = 'AppError';
  }
}

export const messages: Record<AppErrorCode, string> = {
  invalid_credentials: 'E-Mail oder Passwort stimmen nicht.',
  email_not_confirmed:
    'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link geschickt.',
  user_exists: 'Konto existiert bereits – anmelden oder Passwort zurücksetzen.',
  weak_password: 'Das Passwort ist zu schwach. Nutze mindestens 10 Zeichen.',
  same_password: 'Das neue Passwort muss sich vom alten unterscheiden.',
  rate_limited: 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.',
  link_expired: 'Der Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an.',
  offline: 'Keine Verbindung. Anmelden geht nur online.',
  not_configured: 'Die App ist nicht konfiguriert (Supabase-Zugangsdaten fehlen).',
  unknown: 'Das hat nicht geklappt. Bitte versuche es erneut.',
};

type AuthLikeError = { code?: string; message?: string; status?: number; name?: string };

/** Übersetzt Fehler von supabase-js (AuthError) und Netzwerkfehler in einen AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as AuthLikeError;
  switch (e.code) {
    case 'invalid_credentials':
      return new AppError('invalid_credentials');
    case 'email_not_confirmed':
      return new AppError('email_not_confirmed');
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('user_exists');
    case 'weak_password':
      return new AppError('weak_password');
    case 'same_password':
      return new AppError('same_password');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AppError('rate_limited');
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return new AppError('link_expired');
  }
  if (e.status === 429) return new AppError('rate_limited');
  // supabase-js meldet fehlende Verbindung als AuthRetryableFetchError (status 0) bzw. „Failed to fetch“.
  if (e.status === 0 || /network|fetch/i.test(e.message ?? '')) return new AppError('offline');
  return new AppError('unknown');
}
