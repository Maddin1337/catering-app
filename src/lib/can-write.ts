import { onlineManager, useIsRestoring } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

export type WriteBlockReason = 'offline' | null;

/**
 * Darf der Nutzer gerade schreiben? Gerüst für docs/04 §3.3: Heute zählt nur das Netz.
 * M1 ergänzt die Rolle, M9 den Abo-Status (Lesemodus, `company_is_writable()`).
 * Der Server setzt Schreibrechte immer selbst durch; die Oberfläche blendet nur aus.
 */
export function useCanWrite(): { canWrite: boolean; reason: WriteBlockReason } {
  const online = useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
  const restoring = useIsRestoring();
  if (!online) return { canWrite: false, reason: 'offline' };
  return { canWrite: !restoring, reason: null };
}
