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
