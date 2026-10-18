import type { TFunction } from 'i18next';

import { formatDate, formatTime } from '@/lib/dates';
import type { Tint } from '@/theme/tokens';

import type { AppNotification, NotificationKind } from './types';

type Role = 'admin' | 'kitchen' | 'staff';

export type Target =
  | { pathname: '/events/[id]'; params: { id: string } }
  | '/my-shifts'
  | '/shifts/mine'
  | '/shift-board'
  | '/shifts/board';

const LOOK: Record<NotificationKind, { icon: string; tint: Tint }> = {
  application_new: { icon: 'hand', tint: 'amber' },
  application_withdrawn: { icon: 'undo', tint: 'slate' },
  shift_cancelled_by_staff: { icon: 'user-x', tint: 'rose' },
  shift_confirmed: { icon: 'check', tint: 'teal' },
  shift_rejected: { icon: 'x', tint: 'slate' },
  shift_new: { icon: 'sparkles', tint: 'indigo' },
  shift_slot_cancelled: { icon: 'ban', tint: 'rose' },
  quote_accepted: { icon: 'party', tint: 'teal' },
  quote_declined: { icon: 'x', tint: 'rose' },
  change_requested: { icon: 'message', tint: 'violet' },
  dietary_added: { icon: 'salad', tint: 'sky' },
};

/**
 * Text, Aussehen und Ziel einer Mitteilung. Die Datenbank liefert nur Art und Rohdaten; Wortlaut
 * und Anrede bleiben in den Übersetzungen.
 */
export function describe(n: AppNotification, role: Role, t: TFunction) {
  const p = n.payload;
  const vars = {
    member: p.member_name ?? '',
    slot: p.slot_title ?? '',
    event: p.event_title ?? '',
    customer: p.customer_name ?? t('notifications.someCustomer'),
    date: p.starts_at ? formatDate(p.starts_at) : '',
    time: p.starts_at ? formatTime(p.starts_at) : '',
    place: p.city ? t('notifications.inCity', { city: p.city }) : '',
    count: p.person_count ?? 0,
  };
  const short = n.kind === 'dietary_added' && p.short_notice ? ` ${t('notifications.short')}` : '';
  const mine = role === 'kitchen' ? '/shifts/mine' : '/my-shifts';
  const board = role === 'kitchen' ? '/shifts/board' : '/shift-board';
  let target: Target | null = null;
  if (n.kind === 'shift_new') target = board;
  else if (n.kind.startsWith('shift_') && role !== 'admin') target = mine;
  else if (n.event_id) target = { pathname: '/events/[id]', params: { id: n.event_id } };
  return {
    ...LOOK[n.kind],
    title: t(`notifications.kind.${n.kind}.title`),
    body: t(`notifications.kind.${n.kind}.body`, vars) + short,
    target,
  };
}

/** Teilt in „Heute“ und „Früher“ (Ortszeit Berlin), Reihenfolge bleibt erhalten. */
export function splitByDay(list: AppNotification[], now = new Date()) {
  const day = (d: Date | string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(d));
  const today = day(now);
  return {
    today: list.filter((n) => day(n.created_at) === today),
    earlier: list.filter((n) => day(n.created_at) !== today),
  };
}

/** „vor 5 Min.“, „vor 3 Std.“, sonst Datum. */
export function ago(iso: string, t: TFunction, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t('notifications.justNow');
  if (min < 60) return t('notifications.minutesAgo', { count: min });
  const h = Math.round(min / 60);
  if (h < 24) return t('notifications.hoursAgo', { count: h });
  return formatDate(iso);
}
