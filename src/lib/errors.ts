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
  | 'duplicate'
  | 'schema_outdated'
  | 'event_not_found'
  | 'option_required'
  | 'channel_required'
  | 'reason_required'
  | 'invalid_transition'
  | 'use_quote_send'
  | 'invalid_dates'
  | 'guest_sum_exceeded'
  | 'dish_not_found'
  | 'ingredient_not_found'
  | 'package_not_found'
  | 'invalid_name'
  | 'unit_in_use'
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
  | 'quote_not_found'
  | 'revision_outdated'
  | 'snapshot_invalid'
  | 'quote_empty'
  | 'send_mode_required'
  | 'not_sent'
  | 'invalid_send'
  | 'slot_full'
  | 'slot_not_open'
  | 'slot_not_found'
  | 'missing_qualification'
  | 'application_exists'
  | 'application_not_found'
  | 'deadline_passed'
  | 'already_assigned'
  | 'qualification_required'
  | 'seats_below_taken'
  | 'logo_type'
  | 'logo_size'
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
  duplicate: 'Diesen Eintrag gibt es schon.',
  schema_outdated:
    'Die Datenbank ist noch nicht auf dem neuesten Stand. Bitte führe das neueste SQL-Update im Supabase SQL Editor aus.',
  event_not_found: 'Diesen Auftrag gibt es nicht mehr.',
  option_required: 'Bitte gib ein „Optioniert bis“ ab heute an.',
  channel_required: 'Bitte wähle den Bestätigungsweg.',
  reason_required: 'Bitte nenne einen Grund.',
  invalid_transition:
    'Dieser Statuswechsel ist nicht möglich. Für einen neuen Anlauf kopiere den Auftrag.',
  use_quote_send: 'Der Status „Angebot versendet“ entsteht durch den Angebotsversand.',
  invalid_dates: 'Bitte gib ein bis zehn Termine an.',
  guest_sum_exceeded: 'Es gibt mehr Sonderessen als Gäste.',
  dish_not_found: 'Dieses Gericht gibt es nicht mehr.',
  ingredient_not_found: 'Diese Zutat gibt es nicht mehr.',
  package_not_found: 'Dieses Paket gibt es nicht mehr.',
  invalid_name: 'Bitte gib einen Namen ein.',
  unit_in_use: 'Die Einheit lässt sich nicht ändern, solange Gerichte die Zutat nutzen.',
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
  quote_not_found: 'Dieses Angebot gibt es nicht mehr.',
  revision_outdated:
    'Das Angebot wurde inzwischen geändert oder schon versendet. Bitte öffne es neu.',
  snapshot_invalid:
    'Der Stand des Angebots stimmt nicht mit den Positionen überein. Bitte öffne das Angebot neu und versuche es erneut.',
  quote_empty: 'Das Angebot hat noch keine Position.',
  send_mode_required:
    'Bitte wähle, ob der Kunde die Änderung bestätigen soll oder sie nur zur Info bekommt.',
  not_sent: 'Das Angebot wurde noch nicht versendet.',
  invalid_send: 'Der Versandweg ist ungültig.',
  slot_full: 'Alle Plätze sind schon vergeben.',
  slot_not_open: 'Diese Schicht ist nicht (mehr) offen.',
  slot_not_found: 'Diese Schicht gibt es nicht mehr.',
  missing_qualification: 'Dafür fehlt die nötige Qualifikation.',
  application_exists: 'Du hast dich schon beworben.',
  application_not_found: 'Diesen Einsatz gibt es nicht mehr.',
  deadline_passed: 'Die Absagefrist ist abgelaufen. Bitte sage telefonisch ab.',
  already_assigned: 'Diese Person ist schon eingeplant.',
  qualification_required: 'Bitte wähle eine Qualifikation für die Schicht.',
  seats_below_taken: 'Es sind schon mehr Plätze belegt. Plane erst Personen aus.',
  logo_type: 'Bitte wähle ein Bild als PNG oder JPEG.',
  logo_size: 'Das Bild ist größer als 2 MB. Bitte wähle ein kleineres.',
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
    case 'dish_not_found':
    case 'ingredient_not_found':
    case 'package_not_found':
    case 'invalid_name':
    case 'unit_in_use':
    case 'event_not_found':
    case 'option_required':
    case 'channel_required':
    case 'reason_required':
    case 'invalid_transition':
    case 'use_quote_send':
    case 'invalid_dates':
    case 'guest_sum_exceeded':
    case 'quote_not_found':
    case 'revision_outdated':
    case 'snapshot_invalid':
    case 'quote_empty':
    case 'send_mode_required':
    case 'not_sent':
    case 'invalid_send':
    case 'slot_full':
    case 'slot_not_open':
    case 'slot_not_found':
    case 'missing_qualification':
    case 'application_exists':
    case 'application_not_found':
    case 'deadline_passed':
    case 'already_assigned':
    case 'qualification_required':
      return new AppError(e.hint);
  }
  if (e.code === '42501') return new AppError('forbidden');
  // Tabelle oder Funktion fehlt: das SQL-Update wurde noch nicht eingespielt (42P01, 42883, PGRST2xx)
  if (
    e.code === '42P01' ||
    e.code === '42883' ||
    e.code === '42703' ||
    e.code?.startsWith('PGRST20')
  )
    return new AppError('schema_outdated');
  if (e.code === '23505') return new AppError('duplicate');
  if (e.code === '23514' && e.message?.includes('shift_slots_taken_le_seats'))
    return new AppError('seats_below_taken');
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
  return new AppError(
    'unknown',
    e.code || e.message
      ? `${messages.unknown} (Fehlercode: ${[e.code, e.message].filter(Boolean).join(' – ').slice(0, 120)})`
      : undefined,
  );
}
