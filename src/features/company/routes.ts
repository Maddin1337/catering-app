import type { MemberRole } from './types';

/**
 * Wo gehört der Nutzer hin? (docs/04 §1.1 Nr. 2)
 * - `signedOut`: Anmeldung
 * - `noCompany`: angemeldet ohne Firma → Willkommen (Firma anlegen oder Einladung)
 * - `onboarding`: admin mit nicht abgeschlossenem Onboarding
 * - `ready`: Team-App
 * - `error`: Die Mitgliedschaft ließ sich nicht lesen (z. B. offline) – nicht ins Willkommen schicken,
 *   sonst sähe ein Mitglied „Firma anlegen“
 */
export type SetupStage = 'loading' | 'error' | 'signedOut' | 'noCompany' | 'onboarding' | 'ready';

/** Erste Route je Stand und Rolle. */
export function defaultRoute(stage: SetupStage, role: MemberRole | null) {
  switch (stage) {
    case 'signedOut':
    case 'loading':
    case 'error':
      return '/login' as const;
    case 'noCompany':
      return '/welcome' as const;
    case 'onboarding':
      return '/onboarding/branding' as const;
    default:
      return role === 'kitchen'
        ? ('/today' as const)
        : role === 'staff'
          ? ('/my-shifts' as const)
          : ('/start' as const);
  }
}
