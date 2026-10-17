import type { ReactNode } from 'react';

import { useCanWrite } from '@/lib/can-write';

/**
 * Zeigt Schreib-Aktionen nur, wenn sie erlaubt sind (docs/04 §3.3). Mit `fallback` erscheint
 * stattdessen ein Hinweis (z. B. ein deaktivierter Button mit Begründung).
 */
export function WriteGuard({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?:
    ReactNode | ((reason: NonNullable<ReturnType<typeof useCanWrite>['reason']>) => ReactNode);
}) {
  const { canWrite, reason } = useCanWrite();
  if (canWrite) return <>{children}</>;
  return <>{typeof fallback === 'function' ? (reason ? fallback(reason) : null) : fallback}</>;
}
