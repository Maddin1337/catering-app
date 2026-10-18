// Eine Quelle für App, Web und Portal. Werte aus docs/04-screens-ux.md §4.2–4.5.

export const tokens = {
  color: {
    // Seitenhintergrund (warmes Off-White) und weiße Flächen darauf.
    canvas: '#F6F4F0',
    bg: '#FFFFFF',
    bgSubtle: '#FAF8F5',
    bgMuted: '#EFECE6',
    border: '#E9E4DB',
    borderInput: '#8A8478',
    text: '#14181F',
    textSecondary: '#4A5160',
    textTertiary: '#667085',
    // Marke: tiefes Petrol; `ink` ist die dunkle Zweitfarbe für starke Aktionen.
    accent: '#0F766E',
    accentPressed: '#0B5F58',
    accentGradientFrom: '#139085',
    accentGradientTo: '#0B6A62',
    accentSubtle: '#D9F3EE',
    onAccent: '#FFFFFF',
    ink: '#161B26',
    inkPressed: '#2B3242',
    focus: '#2563EB',
    success: '#15803D',
    successSubtle: '#DDF5E6',
    warning: '#B45309',
    warningSubtle: '#FEF0CF',
    danger: '#B91C1C',
    dangerSubtle: '#FDE4E2',
    info: '#1D4ED8',
    infoSubtle: '#E0EAFE',
    scrim: 'rgba(20, 24, 31, 0.45)',
    // Kopfleiste beim Scrollen (halbtransparent über dem Inhalt) und feine Trennlinien.
    chrome: 'rgba(246, 244, 240, 0.86)',
    hairline: 'rgba(20, 24, 31, 0.08)',
    skeleton: '#E7E3DB',
  },
  // 4/8-Raster; nur diese Werte.
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, full: 999 },
  // Weiche, warme Schatten (Karten, schwebende Leisten, Aktionen).
  shadow: {
    card: '0px 1px 2px rgba(60, 45, 20, 0.05), 0px 6px 18px rgba(60, 45, 20, 0.06)',
    raised: '0px 2px 4px rgba(60, 45, 20, 0.06), 0px 12px 28px rgba(60, 45, 20, 0.12)',
    float: '0px 4px 10px rgba(20, 24, 31, 0.10), 0px 16px 36px rgba(20, 24, 31, 0.18)',
    accent: '0px 6px 16px rgba(15, 118, 110, 0.32)',
    ink: '0px 6px 16px rgba(22, 27, 38, 0.28)',
  },
  // Statische Schnitte statt fontWeight (Android wählt bei variablen Schriften unzuverlässig).
  // Inter für Fließtext und Bedienung, Plus Jakarta Sans für Überschriften.
  font: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    heading: 'PlusJakartaSans_700Bold',
    headingHeavy: 'PlusJakartaSans_800ExtraBold',
  },
  touch: { min: 48, kitchen: 56 },
  // Bewegung: Skalierung beim Tippen, Dauern in ms, Versatz für gestaffelte Listen, Kurven.
  motion: {
    pressScale: 0.97,
    fast: 140,
    base: 220,
    slow: 360,
    stagger: 45,
    // Schnell hinein, weich auslaufen (für Übergänge ohne Feder).
    ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: { damping: 20, stiffness: 220, mass: 0.9 },
    springSoft: { damping: 26, stiffness: 160, mass: 1 },
  },
} as const;

// Pastell-Töne für runde Symbol-Plaketten (Einstiegskarten, Listen); Vordergrund ≥ 4,5:1.
export const tints = {
  teal: { fg: '#0F766E', bg: '#D9F3EE' },
  amber: { fg: '#92400E', bg: '#FDEBC8' },
  indigo: { fg: '#3730A3', bg: '#E3E6FD' },
  rose: { fg: '#9F1239', bg: '#FCE1E7' },
  sky: { fg: '#075985', bg: '#DCEFFB' },
  violet: { fg: '#5B21B6', bg: '#EBE4FC' },
  slate: { fg: '#334155', bg: '#E8E6E1' },
} as const;
export type Tint = keyof typeof tints;

export type TextVariant =
  'display' | 'title1' | 'title2' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'kitchen';

export const textStyles: Record<
  TextVariant,
  { fontSize: number; lineHeight: number; fontFamily: string }
> = {
  display: { fontSize: 30, lineHeight: 38, fontFamily: tokens.font.headingHeavy },
  title1: { fontSize: 24, lineHeight: 30, fontFamily: tokens.font.heading },
  title2: { fontSize: 18, lineHeight: 24, fontFamily: tokens.font.heading },
  body: { fontSize: 16, lineHeight: 24, fontFamily: tokens.font.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: tokens.font.semibold },
  small: { fontSize: 14, lineHeight: 20, fontFamily: tokens.font.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: tokens.font.semibold },
  kitchen: { fontSize: 20, lineHeight: 28, fontFamily: tokens.font.heading },
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
