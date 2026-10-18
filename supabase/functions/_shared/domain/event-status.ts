// Statusübergänge von Aufträgen (docs/02 §1.1, entschieden R2-2, R2-3, R2-4).
// Spiegelt `private.is_allowed_event_transition()` in der Datenbank; ein Test hält beide gleich.
// Die Oberfläche baut ihre Statusaktionen aus dieser Tabelle, die Datenbank prüft sie unabhängig.

export const EVENT_STATUSES = [
  'inquiry',
  'quoted',
  'optioned',
  'confirmed',
  'completed',
  'invoiced',
  'declined',
  'cancelled',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Erlaubte Vorwärts-Übergänge. Rückwärts und Reaktivierung gibt es nicht (R2-4). */
export const TRANSITIONS: ReadonlyArray<readonly [EventStatus, EventStatus]> = [
  ['inquiry', 'quoted'],
  ['inquiry', 'optioned'],
  ['inquiry', 'confirmed'],
  ['inquiry', 'declined'],
  ['quoted', 'optioned'],
  ['quoted', 'confirmed'],
  ['quoted', 'declined'],
  ['optioned', 'confirmed'],
  ['optioned', 'cancelled'],
  ['confirmed', 'completed'],
  ['confirmed', 'cancelled'],
  ['completed', 'invoiced'],
];

export function isAllowedTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/** Pflichtangaben je Übergang für den Bestätigungsdialog (02 §1.1.1). */
export type Requirement = 'option' | 'channel' | 'reason' | 'invoice';

export function requirementsFor(_from: EventStatus, to: EventStatus): Requirement[] {
  switch (to) {
    case 'optioned':
      return ['option'];
    case 'confirmed':
      return ['channel'];
    case 'declined':
    case 'cancelled':
      return ['reason'];
    case 'invoiced':
      return ['invoice'];
    default:
      return [];
  }
}

/**
 * Manuell wählbare Folgestatus. „Angebot versendet“ entsteht nur durch den Versand; „optioniert“
 * lässt sich zusätzlich verlängern (optioned → optioned, 02 §1.1).
 */
export function nextStatuses(status: EventStatus): EventStatus[] {
  const next = TRANSITIONS.filter(([f, t]) => f === status && t !== 'quoted').map(([, t]) => t);
  return status === 'optioned' ? ['optioned', ...next] : next;
}

/** Endzustände: nur noch lesen, ein neuer Anlauf läuft über „Auftrag kopieren“. */
export function isClosed(status: EventStatus): boolean {
  return status === 'declined' || status === 'cancelled' || status === 'invoiced';
}
