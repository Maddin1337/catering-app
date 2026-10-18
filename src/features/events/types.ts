import type { EventStatus } from '@/lib/event-status';

export type EventKind = 'event_catering' | 'business_lunch';

/** Auftrag. Admins lesen die Tabelle `events`, die Küche die View `kitchen_events` (ohne Kundendaten). */
export type EventRow = {
  id: string;
  title: string;
  kind: EventKind;
  occasion: string | null;
  status: EventStatus;
  starts_at: string;
  ends_at: string | null;
  event_date: string;
  guest_count: number | null;
  venue_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  is_pickup: boolean;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  meeting_point: string | null;
  dress_code: string | null;
  staff_notes: string | null;
  kitchen_notes: string | null;
  // nur admin
  internal_notes?: string | null;
  option_expires_at?: string | null;
  changes_until?: string | null;
  customer_id?: string;
  customer_name?: string;
  cancellation_agreement?: string | null;
  invoice_reference?: string | null;
  invoiced_on?: string | null;
  created_at?: string;
};

export type ScheduleKind = 'departure' | 'setup' | 'service' | 'teardown' | 'delivery' | 'other';
export const SCHEDULE_KINDS: ScheduleKind[] = [
  'departure',
  'delivery',
  'setup',
  'service',
  'teardown',
  'other',
];

export type ScheduleItem = {
  id: string;
  event_id: string;
  kind: ScheduleKind;
  label: string | null;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
};

export type StatusChange = {
  id: string;
  from_status: EventStatus | null;
  to_status: EventStatus;
  actor_kind: string;
  reason: string | null;
  confirmation_channel: string | null;
  created_at: string;
};

export type DietaryRow = {
  id: string;
  event_id: string;
  person_count: number;
  diet: import('@/lib/dietary').Diet | null;
  avoid_allergens: import('@/lib/dietary').Allergen[];
  guest_name: string | null;
  table_label: string | null;
  note: string | null;
  source: 'customer' | 'internal';
  is_short_notice: boolean;
};
