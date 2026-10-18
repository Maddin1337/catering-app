// „Jetzt“-Anzeige für die Startseiten: was läuft gerade oder beginnt in Kürze?

export type LiveSource = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place?: string | null;
};

export type Live = LiveSource & {
  phase: 'running' | 'soon';
  /** Ende (bei fehlendem Ende: Beginn + 4 h). */
  end: string;
  /** Minuten bis zum Ende (läuft) bzw. bis zum Beginn (bald). */
  minutes: number;
  /** Anteil der verstrichenen Zeit, 0–1 (nur bei „läuft“, sonst 0). */
  progress: number;
};

// So lange vorher erscheint „beginnt bald“.
export const SOON_MINUTES = 180;
const DEFAULT_LENGTH_H = 4;

/** Wählt den laufenden Eintrag (sonst den nächsten, der in den nächsten 3 Stunden beginnt). */
export function pickLive(items: LiveSource[], now = Date.now()): Live | null {
  const withEnd = items.map((i) => {
    const start = new Date(i.starts_at).getTime();
    const end = i.ends_at ? new Date(i.ends_at).getTime() : start + DEFAULT_LENGTH_H * 3_600_000;
    return { i, start, end };
  });
  const running = withEnd
    .filter((x) => x.start <= now && now < x.end)
    .sort((a, b) => a.end - b.end)[0];
  if (running) {
    return {
      ...running.i,
      phase: 'running',
      end: new Date(running.end).toISOString(),
      minutes: Math.ceil((running.end - now) / 60_000),
      progress: Math.min(1, Math.max(0, (now - running.start) / (running.end - running.start))),
    };
  }
  const soon = withEnd
    .filter((x) => x.start > now && x.start - now <= SOON_MINUTES * 60_000)
    .sort((a, b) => a.start - b.start)[0];
  if (soon) {
    return {
      ...soon.i,
      phase: 'soon',
      end: new Date(soon.end).toISOString(),
      minutes: Math.ceil((soon.start - now) / 60_000),
      progress: 0,
    };
  }
  return null;
}

/** „2:05“ für Stunden und Minuten, „45 Min.“ unter einer Stunde. */
export function clock(minutes: number): { value: string; unit: 'h' | 'min' } {
  if (minutes < 60) return { value: String(minutes), unit: 'min' };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { value: `${h}:${String(m).padStart(2, '0')}`, unit: 'h' };
}
