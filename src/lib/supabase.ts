import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { secureKv } from './secure-kv';

// Ohne Konfiguration (z. B. lokal vor `cp .env.example .env.local`) bleibt der Client `null`;
// der Root-Layout zeigt dann einen Konfigurationshinweis (src/app/_layout.tsx).
// Typisierung mit `createClient<Database>` folgt in M1, sobald Tabellen abgefragt werden
// und `npm run db:types` die Typen aus den Migrationen erzeugt (docs/05 §3.3).
export const supabase = env
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: secureKv,
        autoRefreshToken: true,
        persistSession: true,
        // Nur im Web enthält die URL Auth-Parameter (E-Mail-Links); nativ läuft das über Deep Links.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

// Token-Erneuerung nur im Vordergrund (Empfehlung von supabase-js für React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
