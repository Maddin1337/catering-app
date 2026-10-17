export type MemberRole = 'admin' | 'kitchen' | 'staff';

export type Membership = {
  id: string;
  company_id: string;
  role: MemberRole;
  display_name: string;
  phone: string | null;
};

/** Zeile aus der View `company_profile` (docs/03 §4.6): nur Felder, die jede Rolle sehen darf. */
export type CompanyProfile = {
  id: string;
  name: string;
  phone: string | null;
  contact_email: string;
  logo_path: string | null;
  accent_color: string | null;
  country: 'DE' | 'AT' | 'CH';
  shift_cancel_deadline_hours: number;
  onboarding_completed_at: string | null;
  is_writable: boolean;
  effective_plan: 'start' | 'team' | 'profi' | 'pilot';
};

export type TaxRate = {
  id: string;
  name: string;
  rate_bp: number;
  category: string;
  reviewed_at: string | null;
};

export type SubscriptionInfo = {
  status: string;
  trial_ends_at: string | null;
  writable_until: string;
};
