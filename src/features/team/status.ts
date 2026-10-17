import type { Invitation, InvitationStatus } from './types';

/** Widerrufen → angenommen → abgelaufen → offen (docs/03 §3.1 invitations). */
export function invitationStatus(i: Invitation, now: Date = new Date()): InvitationStatus {
  if (i.revoked_at) return 'revoked';
  if (i.accepted_at) return 'accepted';
  if (new Date(i.expires_at) <= now) return 'expired';
  return 'open';
}
