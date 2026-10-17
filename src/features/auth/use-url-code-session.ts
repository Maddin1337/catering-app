import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useExchangeCode } from './api';
import { useSession } from './session-provider';

// So lange warten wir im Web auf die automatische Sitzung, bevor wir den Link als ungültig melden.
const WEB_WAIT_MS = 8000;

/**
 * Link aus den Standard-Mails von Supabase: Sie führen über den Server von Supabase zurück in die
 * App und hängen einen `code` an die URL (PKCE). Im Web tauscht supabase-js ihn selbst
 * (`detectSessionInUrl`), nativ tun wir es hier. Ein zweiter Tausch würde scheitern, weil der Code
 * nur einmal gilt – deshalb nie beides.
 *
 * Schlägt der Tausch fehl, z. B. weil der Link auf einem anderen Gerät geöffnet wurde als dem, auf
 * dem die Anfrage begann, ist die Adresse meist trotzdem bestätigt; der Nutzer meldet sich dann an.
 */
export function useUrlCodeSession(code: string | undefined) {
  const { status } = useSession();
  const exchange = useExchangeCode();
  const started = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!code) return;
    if (Platform.OS !== 'web' && !started.current) {
      started.current = true;
      exchange.mutate(code);
    }
    const id = setTimeout(() => setTimedOut(true), WEB_WAIT_MS);
    return () => clearTimeout(id);
  }, [code, exchange]);

  const ready = status === 'signedIn';
  return {
    active: !!code,
    ready,
    failed: !ready && (exchange.isError || timedOut),
  };
}
