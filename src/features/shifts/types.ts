export type ApplicationStatus =
  'applied' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_staff' | 'assigned';

export type Slot = {
  id: string;
  event_id: string;
  qualification_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  seats: number;
  taken_seats: number;
  meeting_point: string | null;
  dress_code: string | null;
  notes: string | null;
  published_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type Application = {
  id: string;
  shift_slot_id: string;
  member_id: string;
  status: ApplicationStatus;
  comment: string | null;
  applied_at: string | null;
  late_cancellation: boolean;
  status_note: string | null;
};

export type BoardSlot = {
  shift_slot_id: string;
  title: string;
  qualification_name: string;
  starts_at: string;
  ends_at: string;
  seats: number;
  free_seats: number;
  dress_code: string | null;
  event_kind: 'event_catering' | 'business_lunch';
  guest_count: number | null;
  postal_code: string | null;
  city: string | null;
  is_tentative: boolean;
  my_application_status: ApplicationStatus | null;
};

export type MyShift = {
  application_id: string;
  status: ApplicationStatus;
  shift_slot_id: string;
  title: string;
  qualification_name: string;
  starts_at: string;
  ends_at: string;
  is_called_off: boolean;
  is_tentative: boolean;
  cancel_deadline_at: string;
  late_cancellation: boolean;
  status_note: string | null;
  postal_code: string | null;
  city: string | null;
  event_title: string | null;
  venue_name: string | null;
  street: string | null;
  meeting_point: string | null;
  dress_code: string | null;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  staff_notes: string | null;
  slot_notes: string | null;
};
