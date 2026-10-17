// Eine Quelle für App, Web und Portal. Werte aus docs/04-screens-ux.md §4.2–4.5.

export const tokens = {
  color: {
    bg: '#FFFFFF',
    bgSubtle: '#F8FAFC',
    bgMuted: '#F1F5F9',
    border: '#E2E8F0',
    borderInput: '#8A94A6',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    accent: '#0F766E',
    accentPressed: '#115E59',
    accentSubtle: '#CCFBF1',
    onAccent: '#FFFFFF',
    focus: '#2563EB',
    success: '#15803D',
    successSubtle: '#DCFCE7',
    warning: '#B45309',
    warningSubtle: '#FEF3C7',
    danger: '#B91C1C',
    dangerSubtle: '#FEE2E2',
    info: '#1D4ED8',
    infoSubtle: '#DBEAFE',
  },
  // 4/8-Raster; nur diese Werte.
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 6, md: 8, lg: 12, xl: 16, full: 999 },
  // Statische Inter-Schnitte statt fontWeight (Android wählt bei variablen Schriften unzuverlässig).
  font: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
  },
  touch: { min: 48, kitchen: 56 },
} as const;

export type TextVariant =
  'display' | 'title1' | 'title2' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'kitchen';

export const textStyles: Record<
  TextVariant,
  { fontSize: number; lineHeight: number; fontFamily: string }
> = {
  display: { fontSize: 28, lineHeight: 36, fontFamily: tokens.font.semibold },
  title1: { fontSize: 22, lineHeight: 28, fontFamily: tokens.font.semibold },
  title2: { fontSize: 18, lineHeight: 24, fontFamily: tokens.font.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: tokens.font.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: tokens.font.semibold },
  small: { fontSize: 14, lineHeight: 20, fontFamily: tokens.font.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: tokens.font.semibold },
  kitchen: { fontSize: 20, lineHeight: 28, fontFamily: tokens.font.semibold },
};

export type EventStatus =
  | 'inquiry'
  | 'quoted'
  | 'optioned'
  | 'confirmed'
  | 'completed'
  | 'invoiced'
  | 'declined'
  | 'cancelled';

// Auftragsstatus: Label, Badge-Text- und Hintergrundfarbe (docs/04 §4.3, alle ≥ 6:1).
export const eventStatusStyle: Record<EventStatus, { label: string; fg: string; bg: string }> = {
  inquiry: { label: 'Anfrage', fg: '#075985', bg: '#E0F2FE' },
  quoted: { label: 'Angebot versendet', fg: '#3730A3', bg: '#E0E7FF' },
  optioned: { label: 'Optioniert', fg: '#92400E', bg: '#FEF3C7' },
  confirmed: { label: 'Bestätigt', fg: '#115E59', bg: '#CCFBF1' },
  completed: { label: 'Durchgeführt', fg: '#5B21B6', bg: '#EDE9FE' },
  invoiced: { label: 'Abgerechnet', fg: '#334155', bg: '#F1F5F9' },
  declined: { label: 'Abgelehnt', fg: '#57534E', bg: '#F5F5F4' },
  cancelled: { label: 'Abgesagt', fg: '#991B1B', bg: '#FEE2E2' },
};
