import type { ViewStyle } from 'react-native';

import { tokens } from '@/theme/tokens';

/**
 * Reanimated-CSS-Übergang für Animated-Komponenten: geänderte Stilwerte gleiten statt zu springen.
 * Die Typen von React Native kennen diese Schlüssel nicht, daher die Umwandlung an einer Stelle.
 */
export function transition(
  property: string | string[],
  duration: number = tokens.motion.base,
  easing: string = tokens.motion.ease,
): ViewStyle {
  return {
    transitionProperty: property,
    transitionDuration: duration,
    transitionTimingFunction: easing,
  } as ViewStyle;
}
