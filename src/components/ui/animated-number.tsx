import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text, type TextProps } from './text';

const DURATION = 700;

/**
 * Zahl, die beim Erscheinen und bei Änderungen vom alten zum neuen Wert hochzählt.
 * `format` macht daraus den Anzeigetext (z. B. Euro); bei „Bewegung reduzieren“ springt sie direkt.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  ...text
}: Omit<TextProps, 'children'> & { value: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / DURATION);
      // Schnell los, weich auslaufen.
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <Text {...text} accessibilityLabel={format(value)}>
      {format(shown)}
    </Text>
  );
}
