import { z } from 'zod';

const schema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(20),
});

// Expo ersetzt EXPO_PUBLIC_*-Variablen beim Bündeln durch ihre Werte. Die Zugriffe müssen
// deshalb als wörtliches `process.env.EXPO_PUBLIC_…` stehen (keine dynamischen Schlüssel).
const parsed = schema.safeParse({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

/** `null`, wenn die Konfiguration fehlt: Die App zeigt dann einen Hinweis statt abzustürzen. */
export const env = parsed.success ? parsed.data : null;

export const envProblem = parsed.success
  ? null
  : parsed.error.issues.map((i) => i.path.join('.')).join(', ');

/**
 * Enthalten die Auth-Mails den 6-stelligen Code? Das setzt eigene Mail-Vorlagen voraus, und die
 * lassen sich bei Supabase erst mit eigenem SMTP-Dienst bearbeiten (docs/07). Bis dahin laufen
 * Bestätigung und Passwort-Reset nur über den Link der Standard-Mails; die Code-Felder bleiben aus.
 */
export const authEmailCode = process.env.EXPO_PUBLIC_AUTH_EMAIL_CODE === 'true';

/**
 * Öffentliche Adresse der Web-App für Einladungslinks aus der nativen App (z. B. https://xyz.vercel.app).
 * Im Web gilt die eigene Adresse; ohne beides fällt der Link auf das App-Schema zurück.
 */
export const webUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
