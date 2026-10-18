import { env } from './env';

/** Nur Pfade der erwarteten Form `{company_id}/logo-{uuid}.{png|jpg}` werden als Bild eingebunden. */
const LOGO_PATH = /^[0-9a-f-]{36}\/logo-[0-9a-f-]{36}\.(png|jpg)$/;

/** Öffentliche Adresse des Firmenlogos (Bucket `logos` ist öffentlich); `null` ohne gültigen Pfad. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path || !env || !LOGO_PATH.test(path)) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/logos/${path}`;
}
