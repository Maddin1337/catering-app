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
  | 'avv_required'
  | 'country_unavailable'
  | 'already_member'
  | 'read_only'
  | 'forbidden'
  | 'invitation_invalid'
  | 'invitation_expired'
  | 'invitation_revoked'
  | 'invitation_accepted'
  | 'invitation_exists'
  | 'invitation_closed'
  | 'email_mismatch'
  | 'member_limit'
  | 'admin_limit'
  | 'last_admin'
  | 'invalid_qualification'
  | 'member_not_found'
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
  link_expired:
    'Der Link oder Code ist abgelaufen, ungültig oder wurde schon verwendet. Fordere einen neuen an.',
  offline: 'Keine Verbindung. Anmelden geht nur online.',
  not_configured: 'Die App ist nicht konfiguriert (Supabase-Zugangsdaten fehlen).',
  avv_required: 'Bitte akzeptiere die Auftragsverarbeitungsvereinbarung (AVV).',
  country_unavailable:
    'Dieses Land ist noch nicht verfügbar. Zurzeit gibt es die App für Deutschland.',
  already_member: 'Du bist bereits Mitglied einer Firma.',
  read_only: 'Die Testphase ist beendet. Änderungen sind derzeit nicht möglich.',
  forbidden: 'Dafür fehlt dir die Berechtigung.',
  invitation_invalid: 'Diese Einladung gibt es nicht. Bitte prüfe den Link.',
  invitation_expired: 'Die Einladung ist abgelaufen. Bitte den Admin um eine neue Einladung.',
  invitation_revoked: 'Die Einladung wurde zurückgezogen. Bitte den Admin um eine neue Einladung.',
  invitation_accepted: 'Diese Einladung wurde schon verwendet.',
  invitation_exists: 'Für diese E-Mail-Adresse gibt es schon eine offene Einladung.',
  invitation_closed: 'Die Einladung ist nicht mehr offen.',
  email_mismatch:
    'Die Einladung gilt für eine andere E-Mail-Adresse. Melde dich mit der Adresse an, an die sie geschickt wurde.',
  member_limit:
    'Das Limit der aktuellen Stufe ist erreicht. Bitte entferne ein Mitglied oder eine offene Einladung.',
  admin_limit: 'Das Limit für Admins in der aktuellen Stufe ist erreicht.',
  last_admin: 'Du bist der einzige Admin. Ernenne zuerst jemand anderen zum Admin.',
  invalid_qualification: 'Eine Qualifikation gibt es nicht mehr. Bitte lade die Seite neu.',
  member_not_found: 'Dieses Mitglied gibt es nicht mehr.',
  unknown: 'Das hat nicht geklappt. Bitte versuche es erneut.',
};

type AuthLikeError = {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
  hint?: string | null;
};

/** Übersetzt Fehler von supabase-js (AuthError) und Netzwerkfehler in einen AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as AuthLikeError;
  // Fehler unserer Datenbankfunktionen tragen einen `hint` (docs/03 §4.1 Nr. 5).
  switch (e.hint) {
    case 'avv_required':
    case 'country_unavailable':
    case 'already_member':
    case 'read_only':
    case 'invitation_invalid':
    case 'invitation_expired':
    case 'invitation_revoked':
    case 'invitation_accepted':
    case 'invitation_exists':
    case 'invitation_closed':
    case 'email_mismatch':
    case 'member_limit':
    case 'admin_limit':
    case 'last_admin':
    case 'invalid_qualification':
    case 'member_not_found':
      return new AppError(e.hint);
  }
  if (e.code === '42501') return new AppError('forbidden');
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
