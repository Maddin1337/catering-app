export type NotificationKind =
  | 'application_new'
  | 'application_withdrawn'
  | 'shift_cancelled_by_staff'
  | 'shift_confirmed'
  | 'shift_rejected'
  | 'shift_new'
  | 'shift_slot_cancelled'
  | 'quote_accepted'
  | 'quote_declined'
  | 'change_requested'
  | 'dietary_added';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  event_id: string | null;
  shift_slot_id: string | null;
  payload: {
    slot_title?: string;
    starts_at?: string;
    member_name?: string;
    event_title?: string;
    customer_name?: string;
    number?: string;
    city?: string | null;
    person_count?: number;
    short_notice?: boolean;
  };
  created_at: string;
  read_at: string | null;
};
