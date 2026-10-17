import type { MemberRole } from '../company/types';

export type TeamMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  phone: string | null;
  joined_at: string;
  /** Nur für Admins sichtbar (Basistabelle statt View). */
  login_email?: string | null;
};

export type Invitation = {
  id: string;
  email: string | null;
  display_name: string;
  role: MemberRole;
  qualification_ids: string[];
  expires_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type InvitationStatus = 'open' | 'expired' | 'revoked' | 'accepted';

export type Qualification = { id: string; name: string };

/** Ergebnis von create/resend: der Klartext-Token erscheint nur dieses eine Mal. */
export type InvitationToken = { id: string; token: string; expires_at: string };

export type InvitationPreview =
  | { status: 'invalid' }
  | {
      status: InvitationStatus;
      company_name: string;
      accent_color: string | null;
      role: MemberRole;
      display_name: string;
      email: string | null;
      expires_at: string;
      qualifications: string[];
    };
