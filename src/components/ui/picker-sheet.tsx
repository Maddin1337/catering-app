import type { ReactNode } from 'react';

import { Sheet } from './sheet';

/** Unteres Blatt für Auswahlen (Datum, Uhrzeit, Zuordnung); Aufbau und Bewegung kommen von `Sheet`. */
export function PickerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      {children}
    </Sheet>
  );
}
