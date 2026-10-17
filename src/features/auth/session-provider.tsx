import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

type SessionState = {
  /** `loading`, bis die gespeicherte Sitzung gelesen ist. */
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
};

const SessionContext = createContext<SessionState>({ status: 'loading', session: null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: supabase ? 'loading' : 'signedOut',
    session: null,
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(
        data.session
          ? { status: 'signedIn', session: data.session }
          : { status: 'signedOut', session: null },
      );
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
